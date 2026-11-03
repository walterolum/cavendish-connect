# Database Backups

CAV CONNECT's data — users, listings, conversations, payments, audit logs — lives in a MySQL database (`DATABASE_URL`). Protect it with scheduled `mysqldump` backups, an off-site retention policy, and a practiced recovery procedure.

## Backup Overview

- **Tool:** `mysqldump` (MySQL 8 client), single consistent dump per run.
- **Scope:** the `cavconnect` schema (or the schema named in `DATABASE_URL`).
- **Extra scope:** the Prisma `migrations` history lives in the repo (`backend/prisma/migrations`), so the dump only needs the database data itself — migrations are reapplied with `prisma migrate deploy` on a fresh restore.
- **Uploads:** image files under `backend/uploads/` (or your storage volume) are *not* in the database — back them up alongside, or treat them as rebuildable.

## Automated Backup Script

Create `/usr/local/bin/cavconnect-backup.sh` on the database host (or a bastion with MySQL client access):

```bash
#!/usr/bin/env bash
set -euo pipefail

DB_USER="${CAVCONNECT_DB_USER}"
DB_PASS="${CAVCONNECT_DB_PASS}"
DB_NAME="${CAVCONNECT_DB_NAME:-cavconnect}"
BACKUP_DIR="${CAVCONNECT_BACKUP_DIR:-/var/backups/cavconnect}"
RETENTION_DAYS="${CAVCONNECT_RETENTION_DAYS:-30}"

mkdir -p "$BACKUP_DIR"

STAMP="$(date +%Y-%m-%d_%H-%M-%S)"
FILE="$BACKUP_DIR/cavconnect_$STAMP.sql.gz"

# --single-transaction gives a consistent snapshot without locking tables
# --routines --triggers preserve stored objects if you add them later
MYSQL_PWD="$DB_PASS" mysqldump \
  --user="$DB_USER" \
  --host="${CAVCONNECT_DB_HOST:-127.0.0.1}" \
  --port="${CAVCONNECT_DB_PORT:-3306}" \
  --single-transaction \
  --routines \
  --triggers \
  "$DB_NAME" | gzip > "$FILE"

# Retention: delete dumps older than RETENTION_DAYS
find "$BACKUP_DIR" -name 'cavconnect_*.sql.gz' -mtime "+$RETENTION_DAYS" -delete

# Optional: push the newest dump off-site (e.g. encrypted object storage)
# aws s3 cp "$FILE" "s3://bucket/cavconnect/" --sse AES256
```

Make it executable and schedule via cron:

```cron
# Every day at 02:00 UTC; write a log
0 2 * * * /usr/local/bin/cavconnect-backup.sh >> /var/log/cavconnect-backup.log 2>&1
```

### Retention Policy

- **Daily dumps** — keep **30 days** on the primary host (`RETENTION_DAYS=30`).
- **Off-site copy** — push at least one dump per day to separate storage (object store / second datacenter), encrypted at rest.
- **Long-term** — archive monthly snapshots for **12 months** (needed for audit evidence, payment disputes, and legal holds).
- Review the policy quarterly; storage is cheap, restore-time correctness is the goal.

## Health Checks

Verify backups are actually restorable, not just present:

```bash
# Quick structural check (lists tables; exits non-zero on corruption)
zcat /var/backups/cavconnect/cavconnect_latest.sql.gz | head -n 50 > /dev/null

# Daily integrity: load the newest dump into a throwaway schema and count rows
# psql-style pattern for MySQL:
mysql -u "$DB_USER" -p"$DB_PASS" -e "CREATE DATABASE IF NOT EXISTS cavconnect_restore_test;"
zcat /var/backups/cavconnect/cavconnect_latest.sql.gz \
  | mysql -u "$DB_USER" -p"$DB_PASS" cavconnect_restore_test
mysql -u "$DB_USER" -p"$DB_PASS" cavconnect_restore_test \
  -e "SELECT COUNT(*) AS users FROM User;"
```

Run a full restore drill once per quarter and time it, so the recovery duration is a known quantity.

## Recovery Procedure

### Objective

Restore the `cavconnect` schema to a target point in time from the latest good dump.

### Steps

1. **Stop writes** — put the API in maintenance mode via `PUT /api/v1/admin/settings` (`maintenance.mode = true`) or stop the app; prevent new writes during restore.
2. **Take a current state snapshot (for forensic comparison)** — dump the broken state to a side file *before* touching anything, in case the problem is recent data loss and the fix needs analysis.
3. **Create the target database** (if absent):

   ```sql
   CREATE DATABASE cavconnect CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   ```

4. **Apply the dump**:

   ```bash
   gunzip -c /var/backups/cavconnect/cavconnect_<stamp>.sql.gz | mysql ... cavconnect
   ```

5. **Verify** — confirm table counts, the latest `Payment`/`User` rows, and that `SystemSetting` promotions keys are intact:

   ```bash
   mysql ... cavconnect -e "
     SELECT COUNT(*) FROM User;
     SELECT key, value FROM SystemSetting WHERE \`group\` = 'promotions';
     SELECT COUNT(*) FROM Payment WHERE status = 'SUCCESSFUL';
   "
   ```

6. **Point the app at the restored DB** — `DATABASE_URL` unchanged if you restored into `cavconnect`; otherwise update the env var and restart the API.
7. **Run the app's own migration check** — `npm run prisma:migrate:prod` is a no-op against a restores-from-matching-version dump; do **not** run it eagerly against a snapshot taken from an older version (see below).
8. **Bring the API back up**, clear `maintenance.mode`, and smoke-test `/api/health`, a login, and a marketplace list.

### Prisma Migrate Restore Caveat

Because the schema is owned by Prisma Migrate (`backend/prisma/migrations`), a **fresh deployment** does not need a dump to create tables at all:

```bash
# On a fresh host (empty database):
cd backend
npm run prisma:migrate:prod   # creates schema from migration history
npm run prisma:seed           # roles, demo data, settings (seeded defaults)

# THEN restore your data dump on top, seeded defaults will be overwritten by real rows
```

If the dump was taken from an older schema version than the current migrations, run `prisma migrate deploy` so the PRISMA-generated tables are absent and only data is imported — never apply *new* migrations to a restored dump assuming it contains their schema.

## Backup of Uploads

`mysqldump` does not cover files. Back up the uploads location on the same schedule and retention as the database, since listing/service/property images are referenced by URL paths stored in the DB:

```
/var/lib/cavconnect/uploads/   (the STORAGE_PATH value; backend/uploads/ in development)
```

If uploads are disposable (re-uploadable in testing), declare them rebuildable and skip long retention — do this deliberately, not implicitly.

## Restore Checklist

- [ ] Maintenance mode on / API stopped.
- [ ] Forensic snapshot of current state taken.
- [ ] Latest verified dump selected (not just newest — health-checked).
- [ ] Schema created with correct charset (`utf8mb4`).
- [ ] Dump imported without errors; counts match the pre-loss baseline.
- [ ] `SystemSetting` promotions rows and recent `Payment` rows present.
- [ ] API restarted, maintenance mode off, smoke test passed.
- [ ] Off-site copy re-seeded with the restored state's next dump.