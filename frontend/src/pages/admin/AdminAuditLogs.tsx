import { Fragment, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FiActivity, FiChevronDown } from 'react-icons/fi';
import { adminApi } from '../../services/admin.service';
import { useDocumentTitle } from '../../lib/hooks';
import { cn, formatRelativeTime } from '../../lib/utils';
import { humanize } from '../../lib/labels';
import { PageHeader } from '../../components/ui/page';
import { Badge, BadgeVariant } from '../../components/ui/badge';
import { Select } from '../../components/ui/input';
import { Pagination } from '../../components/ui/pagination';
import { fullName } from '../../components/ui/avatar';
import { useUrlFilters } from '../../components/browse/Browse';
import { ListState, Table, Td, Th, Toolbar, countLabel } from '../../components/admin/AdminParts';
import type { AuditLog } from '../../types/admin';

const ENTITIES: Record<string, string> = {
  USER: 'User',
  MARKETPLACE: 'Marketplace listing',
  SERVICE: 'Service',
  ACCOMMODATION: 'Accommodation',
  REVIEW: 'Review',
  REPORT: 'Report',
  VERIFICATION: 'Verification',
  SETTINGS: 'Settings',
  PROMOTION: 'Promotion',
};

const ACTIONS: Record<string, { label: string; variant: BadgeVariant }> = {
  CREATE: { label: 'Created', variant: 'brand' },
  UPDATE: { label: 'Updated', variant: 'gray' },
  STATUS_CHANGE: { label: 'Status changed', variant: 'amber' },
  SUSPEND: { label: 'Suspended', variant: 'red' },
  ACTIVATE: { label: 'Reactivated', variant: 'green' },
  SUBMIT: { label: 'Submitted', variant: 'brand' },
  PURCHASE: { label: 'Purchased', variant: 'accent' },
  DELETE: { label: 'Deleted', variant: 'red' },
};

/** One-line, human summary of what changed, e.g. "status: In review → Live". */
function summary(log: AuditLog): string {
  const before = (log.oldValues ?? {}) as Record<string, unknown>;
  const after = (log.newValues ?? {}) as Record<string, unknown>;
  if (typeof after !== 'object' || after === null) return String(after ?? '');
  const show = (v: unknown) => (Array.isArray(v) ? v.join(', ') : typeof v === 'string' ? humanize(v) : JSON.stringify(v));
  const parts = Object.keys(after).map((k) =>
    k in before ? `${k}: ${show(before[k])} → ${show(after[k])}` : `${k}: ${show(after[k])}`
  );
  return parts.join(' · ');
}

export default function AdminAuditLogs() {
  useDocumentTitle('Audit log · Admin');
  const { get, set, page } = useUrlFilters();
  const [openId, setOpenId] = useState<number | null>(null);
  const entity = get('entity');
  const action = get('action');

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['admin', 'audit-logs', { page, entity, action }],
    queryFn: () => adminApi.getAuditLogs({ page, limit: 25, entity: entity || undefined, action: action || undefined }),
    placeholderData: (prev) => prev,
  });

  const logs = data?.data ?? [];
  const filtered = Boolean(entity || action);

  return (
    <div>
      <PageHeader title="Audit log" description="A permanent record of who did what, and when. Entries cannot be edited or deleted." />

      <Toolbar>
        <Select value={entity} onChange={(e) => set({ entity: e.target.value })} className="sm:w-56" aria-label="Filter by area">
          <option value="">Everything</option>
          {Object.entries(ENTITIES).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </Select>
        <Select value={action} onChange={(e) => set({ action: e.target.value })} className="sm:w-56" aria-label="Filter by action">
          <option value="">All actions</option>
          {Object.entries(ACTIONS).map(([k, v]) => (
            <option key={k} value={k}>
              {v.label}
            </option>
          ))}
        </Select>
      </Toolbar>

      <p className="mb-3 text-sm text-gray-500" aria-live="polite">
        {countLabel(data?.meta.total, 'entry', 'entries')}
      </p>

      <ListState
        isLoading={isLoading}
        error={error}
        isEmpty={!logs.length}
        onRetry={() => refetch()}
        errorFallback="Could not load the audit log"
        empty={{
          icon: <FiActivity />,
          title: filtered ? 'No matching entries' : 'Nothing recorded yet',
          message: filtered ? 'Nothing matches these filters.' : 'Actions on the platform will appear here.',
          action: filtered ? 'Clear filters' : undefined,
          onAction: () => set({ entity: null, action: null }),
        }}
      >
        <Table
          head={
            <>
              <Th>When</Th>
              <Th>Who</Th>
              <Th>Action</Th>
              <Th>What</Th>
              <Th>Change</Th>
              <Th className="w-10">
                <span className="sr-only">Details</span>
              </Th>
            </>
          }
          footer={
            data?.meta && data.meta.totalPages > 1 ? (
              <Pagination meta={data.meta} onPageChange={(p) => set({ page: String(p) }, false)} noun="entries" />
            ) : undefined
          }
        >
          {logs.map((log) => {
            const a = ACTIONS[log.action] ?? { label: humanize(log.action), variant: 'gray' as const };
            const open = openId === log.id;
            const text = summary(log);
            return (
              <Fragment key={log.id}>
                <tr className="transition-colors hover:bg-gray-50/70">
                  <Td className="whitespace-nowrap">
                    <span title={new Date(log.createdAt).toLocaleString()}>{formatRelativeTime(log.createdAt)}</span>
                  </Td>
                  <Td>
                    {log.user ? (
                      <>
                        <span className="block font-medium text-gray-900">{fullName(log.user)}</span>
                        <span className="text-xs text-gray-500">@{log.user.username}</span>
                      </>
                    ) : (
                      <span className="text-gray-400">System</span>
                    )}
                  </Td>
                  <Td>
                    <Badge variant={a.variant}>{a.label}</Badge>
                  </Td>
                  <Td className="whitespace-nowrap">
                    {ENTITIES[log.entity] ?? humanize(log.entity)}
                    {log.entityId != null && <span className="text-gray-400 tabular-nums"> #{log.entityId}</span>}
                  </Td>
                  <Td className="max-w-xs">
                    <span className="line-clamp-1 text-xs text-gray-500" title={text}>
                      {text || '—'}
                    </span>
                  </Td>
                  <Td>
                    <button
                      type="button"
                      onClick={() => setOpenId(open ? null : log.id)}
                      aria-expanded={open}
                      aria-label={open ? 'Hide details' : 'Show details'}
                      className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                    >
                      <FiChevronDown className={cn('h-4 w-4 transition-transform', open && 'rotate-180')} />
                    </button>
                  </Td>
                </tr>
                {open && (
                  <tr className="bg-gray-50/70">
                    <td colSpan={6} className="px-5 py-4">
                      <dl className="grid gap-4 text-xs sm:grid-cols-2 lg:grid-cols-4">
                        <div>
                          <dt className="font-semibold text-gray-500">Exact time</dt>
                          <dd className="mt-1 text-gray-800">{new Date(log.createdAt).toLocaleString()}</dd>
                        </div>
                        <div>
                          <dt className="font-semibold text-gray-500">IP address</dt>
                          <dd className="mt-1 font-mono text-gray-800">{log.ipAddress || 'Not recorded'}</dd>
                        </div>
                        <div className="sm:col-span-2">
                          <dt className="font-semibold text-gray-500">Device</dt>
                          <dd className="mt-1 break-words text-gray-800">{log.userAgent || 'Not recorded'}</dd>
                        </div>
                        {log.oldValues != null && (
                          <div className="sm:col-span-2">
                            <dt className="font-semibold text-gray-500">Before</dt>
                            <dd className="mt-1 overflow-x-auto rounded-lg bg-white p-2 font-mono text-gray-800 ring-1 ring-gray-200">
                              <pre className="whitespace-pre-wrap">{JSON.stringify(log.oldValues, null, 2)}</pre>
                            </dd>
                          </div>
                        )}
                        {log.newValues != null && (
                          <div className="sm:col-span-2">
                            <dt className="font-semibold text-gray-500">After</dt>
                            <dd className="mt-1 overflow-x-auto rounded-lg bg-white p-2 font-mono text-gray-800 ring-1 ring-gray-200">
                              <pre className="whitespace-pre-wrap">{JSON.stringify(log.newValues, null, 2)}</pre>
                            </dd>
                          </div>
                        )}
                      </dl>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </Table>
      </ListState>
    </div>
  );
}
