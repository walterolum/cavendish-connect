import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { FiAlertTriangle, FiExternalLink, FiFlag } from 'react-icons/fi';
import { adminApi } from '../../services/admin.service';
import { REPORT_REASON_LABELS } from '../../services/reports.service';
import { getErrorMessage } from '../../lib/api';
import { useDocumentTitle } from '../../lib/hooks';
import { formatRelativeTime } from '../../lib/utils';
import { label } from '../../lib/labels';
import { PageHeader } from '../../components/ui/page';
import { Segmented } from '../../components/ui/tabs';
import { Badge, StatusBadge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Select } from '../../components/ui/input';
import { ConfirmDialog } from '../../components/ui/modal';
import { Pagination } from '../../components/ui/pagination';
import { fullName } from '../../components/ui/avatar';
import { useUrlFilters } from '../../components/browse/Browse';
import { ListState, ReasonDialog, RecordList, Toolbar, countLabel } from '../../components/admin/AdminParts';
import type { AdminReport } from '../../types/admin';

const STATUS_TABS = [
  { key: 'OPEN', label: 'Open' },
  { key: 'UNDER_REVIEW', label: 'Under review' },
  { key: 'RESOLVED', label: 'Resolved' },
  { key: 'REJECTED', label: 'Dismissed' },
  { key: 'all', label: 'All' },
];

const TYPE_LABELS: Record<string, string> = {
  LISTING: 'Marketplace listing',
  SERVICE: 'Service',
  ACCOMMODATION: 'Accommodation',
  USER: 'User',
  REVIEW: 'Review',
};

type Dialog =
  | { kind: 'resolve' | 'dismiss'; report: AdminReport }
  | { kind: 'takedown'; report: AdminReport };

export default function AdminReports() {
  useDocumentTitle('Reports · Admin');
  const queryClient = useQueryClient();
  const { get, set, page } = useUrlFilters();
  const [dialog, setDialog] = useState<Dialog | null>(null);

  // Open reports are the work queue, so they are the default view.
  const status = get('status') || 'OPEN';
  const statusFilter = status === 'all' ? undefined : status;
  const type = get('type');

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['admin', 'reports', { page, status, type }],
    queryFn: () => adminApi.getReports({ page, limit: 20, status: statusFilter, type: type || undefined }),
    placeholderData: (prev) => prev,
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['admin', 'reports'] });
    queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard'] });
  };

  const update = useMutation({
    mutationFn: (v: { report: AdminReport; status: string; resolution?: string }) =>
      adminApi.updateReport(v.report.id, { status: v.status, resolution: v.resolution }),
    onSuccess: (_d, v) => {
      const msg: Record<string, string> = {
        UNDER_REVIEW: 'Report marked as under review',
        RESOLVED: 'Report resolved',
        REJECTED: 'Report dismissed',
        OPEN: 'Report reopened',
      };
      toast.success(msg[v.status] ?? 'Report updated', {
        description: v.status === 'RESOLVED' || v.status === 'REJECTED' ? 'The reporter has been notified.' : undefined,
      });
      setDialog(null);
      refresh();
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Could not update this report')),
  });

  // Take the reported item down and resolve the report in one step.
  const takedown = useMutation({
    mutationFn: async ({ report, reason }: { report: AdminReport; reason: string }) => {
      const t = report.target!;
      if (t.kind === 'user') await adminApi.suspendUser(report.targetId);
      else if (t.kind !== 'review') await adminApi.updateListingStatus(t.kind, report.targetId, 'SUSPENDED', reason);
      await adminApi.updateReport(report.id, { status: 'RESOLVED', resolution: reason });
    },
    onSuccess: (_d, { report }) => {
      toast.success(report.target?.kind === 'user' ? 'Account suspended and report resolved' : 'Post suspended and report resolved');
      setDialog(null);
      refresh();
      queryClient.invalidateQueries({ queryKey: ['admin', 'listings'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Could not complete this action')),
  });

  const reports = data?.data ?? [];
  const busyId = update.isPending ? update.variables?.report.id : takedown.isPending ? takedown.variables?.report.id : undefined;
  const takedownTarget = dialog?.kind === 'takedown' ? dialog.report.target : null;

  return (
    <div>
      <PageHeader title="Reports" description="Things the community has flagged. Check each one, act on it, and close it out." />

      <Toolbar>
        <Segmented value={status} onChange={(s) => set({ status: s === 'OPEN' ? null : s })} items={STATUS_TABS} />
        <Select value={type} onChange={(e) => set({ type: e.target.value })} className="sm:ml-auto sm:w-56" aria-label="Filter by type">
          <option value="">Everything reported</option>
          {Object.entries(TYPE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </Select>
      </Toolbar>

      <p className="mb-3 text-sm text-gray-500" aria-live="polite">
        {countLabel(data?.meta.total, 'report')}
      </p>

      <ListState
        isLoading={isLoading}
        error={error}
        isEmpty={!reports.length}
        onRetry={() => refetch()}
        errorFallback="Could not load reports"
        empty={
          status === 'OPEN' && !type
            ? { icon: <FiFlag />, title: 'No open reports', message: 'Nothing is waiting for review. New reports will appear here.' }
            : {
                icon: <FiFlag />,
                title: 'No reports found',
                message: 'Nothing matches these filters.',
                action: 'Show open reports',
                onAction: () => set({ status: null, type: null }),
              }
        }
      >
        <RecordList
          footer={
            data?.meta && data.meta.totalPages > 1 ? (
              <Pagination meta={data.meta} onPageChange={(p) => set({ page: String(p) }, false)} noun="reports" />
            ) : undefined
          }
        >
          {reports.map((r) => {
            const t = r.target;
            const busy = busyId === r.id;
            const closed = r.status === 'RESOLVED' || r.status === 'REJECTED';
            const canTakeDown = t && t.kind !== 'review' && t.status !== 'SUSPENDED' && t.status !== 'DELETED';
            return (
              <li key={r.id} className="px-5 py-4 sm:px-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-50 text-red-600">
                        <FiAlertTriangle className="h-4 w-4" />
                      </span>
                      <h3 className="font-semibold text-gray-900">{label(REPORT_REASON_LABELS, r.reason)}</h3>
                      <StatusBadge status={r.status} />
                      <Badge variant="gray">{TYPE_LABELS[r.targetType] ?? r.targetType}</Badge>
                    </div>

                    {/* What was reported */}
                    <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50/70 px-4 py-3">
                      {t ? (
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="min-w-0">
                            {t.url ? (
                              <Link to={t.url} target="_blank" rel="noreferrer" className="group inline-flex max-w-full items-center gap-1 font-medium text-gray-900 hover:text-brand-700">
                                <span className="truncate">{t.title}</span>
                                <FiExternalLink className="h-3.5 w-3.5 shrink-0 text-gray-400 group-hover:text-brand-600" aria-label="Opens in a new tab" />
                              </Link>
                            ) : (
                              <p className="truncate font-medium text-gray-900">{t.title}</p>
                            )}
                            {t.owner && (
                              <p className="text-xs text-gray-500">
                                {t.kind === 'user' ? 'Account' : t.kind === 'review' ? 'Written by' : 'Posted by'}{' '}
                                <Link to={`/admin/users?search=${encodeURIComponent(t.owner.username)}`} className="font-medium text-gray-700 hover:text-brand-700">
                                  {fullName(t.owner)} (@{t.owner.username})
                                </Link>
                              </p>
                            )}
                          </div>
                          {t.status === 'DELETED' ? <Badge variant="gray">Deleted</Badge> : <StatusBadge status={t.status} />}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500">This item no longer exists.</p>
                      )}
                    </div>

                    {r.description && <p className="mt-3 text-sm whitespace-pre-line text-gray-700">“{r.description}”</p>}
                    <p className="mt-2 text-xs text-gray-500">
                      Reported by {r.reporter ? `${fullName(r.reporter)} (@${r.reporter.username})` : 'a deleted user'} ·{' '}
                      <span title={new Date(r.createdAt).toLocaleString()}>{formatRelativeTime(r.createdAt)}</span>
                      {r.reviewedAt && ` · last updated ${formatRelativeTime(r.reviewedAt)}`}
                    </p>
                    {r.resolution && (
                      <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                        <span className="font-medium">Outcome:</span> {r.resolution}
                      </p>
                    )}
                  </div>

                  <div className="flex shrink-0 flex-wrap gap-2 lg:w-44 lg:flex-col lg:items-stretch">
                    {!closed ? (
                      <>
                        {canTakeDown && (
                          <Button size="sm" variant="danger" disabled={busy} onClick={() => setDialog({ kind: 'takedown', report: r })}>
                            {t!.kind === 'user' ? 'Suspend user' : 'Suspend post'}
                          </Button>
                        )}
                        <Button size="sm" variant="success" disabled={busy} onClick={() => setDialog({ kind: 'resolve', report: r })}>
                          Resolve
                        </Button>
                        {r.status === 'OPEN' && (
                          <Button size="sm" variant="outline" loading={busy && update.variables?.status === 'UNDER_REVIEW'} onClick={() => update.mutate({ report: r, status: 'UNDER_REVIEW' })}>
                            Start review
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" disabled={busy} onClick={() => setDialog({ kind: 'dismiss', report: r })}>
                          Dismiss
                        </Button>
                      </>
                    ) : (
                      <Button size="sm" variant="outline" loading={busy} onClick={() => update.mutate({ report: r, status: 'OPEN' })}>
                        Reopen
                      </Button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </RecordList>
      </ListState>

      <ReasonDialog
        open={dialog?.kind === 'resolve'}
        onClose={() => setDialog(null)}
        loading={update.isPending}
        required
        tone="success"
        title="Resolve this report?"
        description="Describe what you did. The person who reported it will see this."
        label="Outcome"
        placeholder="e.g. Contacted the seller and the listing was corrected"
        confirmLabel="Resolve report"
        onConfirm={(note) => dialog && update.mutate({ report: dialog.report, status: 'RESOLVED', resolution: note })}
      />

      <ReasonDialog
        open={dialog?.kind === 'takedown'}
        onClose={() => setDialog(null)}
        loading={takedown.isPending}
        required
        title={takedownTarget?.kind === 'user' ? 'Suspend this account?' : 'Suspend this post?'}
        description={
          takedownTarget && (
            <>
              <span className="font-medium text-gray-900">{takedownTarget.title}</span>{' '}
              {takedownTarget.kind === 'user'
                ? 'will not be able to sign in or post.'
                : 'will be hidden from everyone except its owner, who will be notified.'}{' '}
              The report will be marked resolved.
            </>
          )
        }
        label="Reason"
        placeholder="e.g. Confirmed scam: asked buyers to pay before meeting"
        confirmLabel={takedownTarget?.kind === 'user' ? 'Suspend account' : 'Suspend post'}
        onConfirm={(reason) => dialog && takedown.mutate({ report: dialog.report, reason })}
      />

      <ConfirmDialog
        open={dialog?.kind === 'dismiss'}
        onClose={() => setDialog(null)}
        onConfirm={() => dialog && update.mutate({ report: dialog.report, status: 'REJECTED' })}
        loading={update.isPending}
        tone="primary"
        title="Dismiss this report?"
        message="Use this when nothing breaks the rules. The reporter will be told it was reviewed and no action was needed."
        confirmLabel="Dismiss report"
      />
    </div>
  );
}
