import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { FiRotateCcw, FiSave } from 'react-icons/fi';
import { adminApi } from '../../services/admin.service';
import { getErrorMessage } from '../../lib/api';
import { useDocumentTitle } from '../../lib/hooks';
import { PageHeader } from '../../components/ui/page';
import { Card, CardBody, CardHeader } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Checkbox, Field, Input } from '../../components/ui/input';
import { ErrorState, Skeleton } from '../../components/ui/loading';
import type { SystemSetting } from '../../types/admin';

type Kind = 'string' | 'number' | 'boolean' | 'email';

/** What each setting means and whether the platform acts on it yet. */
const FIELDS: Record<string, { label: string; hint?: string; kind?: Kind; suffix?: string; live: boolean }> = {
  'platform.name': { label: 'Platform name', hint: 'Shown in the site footer.', live: true },
  'platform.tagline': { label: 'Tagline', hint: 'Shown in the site footer.', live: true },
  'platform.currency': { label: 'Default currency', hint: 'Currency code, e.g. UGX.', live: false },
  'contact.email': { label: 'Support email', kind: 'email', hint: 'Shown in the footer so people can reach you.', live: true },
  'contact.phone': { label: 'Support phone', hint: 'Shown in the footer.', live: true },
  'moderation.require_review': {
    label: 'Review posts before they go live',
    kind: 'boolean',
    hint: 'Off: new ads, services and rooms appear instantly (admins can still suspend them). On: they wait in Admin → Listings until approved.',
    live: true,
  },
  'listing.free_limit': { label: 'Free posts per user', kind: 'number', suffix: 'posts', live: false },
  'listing.free_days': { label: 'Free post duration', kind: 'number', suffix: 'days', live: false },
  'promotion.featured_price': { label: 'Featured price', kind: 'number', suffix: 'UGX', live: false },
  'promotion.featured_days': { label: 'Featured duration', kind: 'number', suffix: 'days', live: false },
  'promotion.premium_price': { label: 'Premium price', kind: 'number', suffix: 'UGX', live: false },
  'promotion.premium_days': { label: 'Premium duration', kind: 'number', suffix: 'days', live: false },
  'promotion.sponsored_price': { label: 'Sponsored price', kind: 'number', suffix: 'UGX', live: false },
  'promotion.sponsored_days': { label: 'Sponsored duration', kind: 'number', suffix: 'days', live: false },
  'verification.student_required': { label: 'Require student verification', kind: 'boolean', live: false },
  'maintenance.mode': {
    label: 'Maintenance mode',
    kind: 'boolean',
    hint: 'People can still browse, but only admins can post, edit or send messages. A notice is shown on every page.',
    live: true,
  },
};

const GROUPS: { key: string; label: string; description: string }[] = [
  { key: 'general', label: 'General', description: 'Platform identity and how people contact support' },
  { key: 'system', label: 'System', description: 'Switches that change how the whole site behaves' },
  { key: 'listings', label: 'Listings', description: 'Allowances for free posts' },
  { key: 'promotions', label: 'Promotions', description: 'Pricing for boosted posts' },
  { key: 'verification', label: 'Verification', description: 'Rules for verified members' },
];

/** platform.name is not seeded, but the footer reads it, so always offer it. */
const DEFAULTS: Omit<SystemSetting, 'id' | 'createdAt' | 'updatedAt'>[] = [
  { key: 'platform.name', value: 'CAV CONNECT', group: 'general', type: 'string' },
];

function kindOf(s: Pick<SystemSetting, 'key' | 'type'>): Kind {
  return FIELDS[s.key]?.kind ?? (s.type === 'number' || s.type === 'boolean' ? s.type : 'string');
}

function validate(kind: Kind, value: string): string | undefined {
  const v = value.trim();
  if (kind === 'boolean') return undefined;
  if (!v) return 'This cannot be empty';
  if (kind === 'number' && !/^\d+(\.\d+)?$/.test(v)) return 'Enter a number of 0 or more';
  if (kind === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return 'Enter a valid email address';
  return undefined;
}

export default function AdminSettings() {
  useDocumentTitle('Settings · Admin');
  const queryClient = useQueryClient();
  const [values, setValues] = useState<Record<string, string>>({});

  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['admin', 'settings'], queryFn: () => adminApi.getSettings() });

  const settings = useMemo(() => {
    const rows = [...(data ?? [])] as Pick<SystemSetting, 'key' | 'value' | 'group' | 'type'>[];
    for (const d of DEFAULTS) if (!rows.some((r) => r.key === d.key)) rows.push(d);
    return rows;
  }, [data]);

  const original = useMemo(() => Object.fromEntries(settings.map((s) => [s.key, s.value])), [settings]);
  useEffect(() => setValues(original), [original]);

  const changed = Object.keys(values).filter((k) => values[k] !== original[k]);
  const errors = Object.fromEntries(
    settings.map((s) => [s.key, changed.includes(s.key) ? validate(kindOf(s), values[s.key] ?? '') : undefined])
  );
  const invalid = Object.values(errors).some(Boolean);

  // Warn before leaving the page with unsaved edits.
  useEffect(() => {
    if (!changed.length) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [changed.length]);

  const save = useMutation({
    mutationFn: () => adminApi.updateSettings(changed.map((k) => ({ key: k, value: values[k].trim() }))),
    onSuccess: () => {
      toast.success(`Saved ${changed.length} setting${changed.length === 1 ? '' : 's'}`);
      queryClient.invalidateQueries({ queryKey: ['admin', 'settings'] });
      queryClient.invalidateQueries({ queryKey: ['settings', 'public'] });
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Could not save settings')),
  });

  const grouped = useMemo(() => {
    const known = GROUPS.map((g) => ({ ...g, items: settings.filter((s) => s.group === g.key) }));
    const other = settings.filter((s) => !GROUPS.some((g) => g.key === s.group));
    if (other.length) known.push({ key: 'other', label: 'Other', description: 'Additional settings', items: other });
    return known.filter((g) => g.items.length);
  }, [settings]);

  if (error) {
    return (
      <Card>
        <ErrorState message={getErrorMessage(error, 'Could not load settings')} onRetry={() => refetch()} />
      </Card>
    );
  }

  return (
    <div className="pb-24">
      <PageHeader
        title="Settings"
        description="Platform-wide settings. Ones marked Live take effect within a few seconds of saving."
      />

      {isLoading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-64 rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-2">
          {grouped.map((g) => (
            <Card key={g.key}>
              <CardHeader
                title={g.label}
                description={g.description}
                actions={g.items.some((s) => changed.includes(s.key)) ? <Badge variant="amber" dot>Unsaved</Badge> : undefined}
              />
              <CardBody className="space-y-5">
                {g.items.map((s) => {
                  const meta = FIELDS[s.key];
                  const kind = kindOf(s);
                  const id = `setting-${s.key}`;
                  const tag = meta ? (
                    meta.live ? (
                      <Badge variant="green" className="ml-2 align-middle">Live</Badge>
                    ) : (
                      <Badge variant="gray" className="ml-2 align-middle">Saved only</Badge>
                    )
                  ) : null;
                  if (kind === 'boolean') {
                    return (
                      <Checkbox
                        key={s.key}
                        id={id}
                        checked={values[s.key] === 'true'}
                        onChange={(e) => setValues((v) => ({ ...v, [s.key]: e.target.checked ? 'true' : 'false' }))}
                        label={
                          <>
                            {meta?.label ?? s.key}
                            {tag}
                          </>
                        }
                        description={meta?.hint ?? (meta && !meta.live ? 'Stored for later. The platform does not act on this yet.' : undefined)}
                      />
                    );
                  }
                  return (
                    <Field
                      key={s.key}
                      htmlFor={id}
                      label={
                        <>
                          {meta?.label ?? s.key}
                          {tag}
                        </>
                      }
                      hint={
                        errors[s.key]
                          ? undefined
                          : meta?.hint ?? (meta && !meta.live ? 'Stored for later. The platform does not act on this yet.' : undefined)
                      }
                    >
                      <div className="relative">
                        <Input
                          id={id}
                          type={kind === 'email' ? 'email' : 'text'}
                          inputMode={kind === 'number' ? 'decimal' : undefined}
                          value={values[s.key] ?? ''}
                          onChange={(e) => setValues((v) => ({ ...v, [s.key]: e.target.value }))}
                          error={errors[s.key]}
                          className={meta?.suffix ? 'pr-16' : undefined}
                        />
                        {meta?.suffix && (
                          <span className="pointer-events-none absolute top-0 right-3.5 flex h-11 items-center text-sm text-gray-400">
                            {meta.suffix}
                          </span>
                        )}
                      </div>
                    </Field>
                  );
                })}
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      {/* Save bar appears only when something has changed. */}
      {changed.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white/95 backdrop-blur lg:left-64">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-10">
            <p className="text-sm text-gray-700">
              <span className="font-semibold">{changed.length}</span> unsaved change{changed.length === 1 ? '' : 's'}
              {invalid && <span className="text-red-600"> · fix the highlighted fields</span>}
            </p>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setValues(original)} disabled={save.isPending}>
                <FiRotateCcw className="h-4 w-4" /> Discard
              </Button>
              <Button onClick={() => save.mutate()} loading={save.isPending} disabled={invalid}>
                <FiSave className="h-4 w-4" /> Save changes
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
