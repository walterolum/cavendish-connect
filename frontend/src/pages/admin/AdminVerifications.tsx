import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { FiCheckCircle, FiFileText } from 'react-icons/fi';
import { adminApi } from '../../services/admin.service';
import { VERIFICATION_TYPE_LABELS } from '../../services/verifications.service';
import { getErrorMessage } from '../../lib/api';
import { useDocumentTitle } from '../../lib/hooks';
import { formatRelativeTime } from '../../lib/utils';
import { label } from '../../lib/labels';
import { PageHeader } from '../../components/ui/page';
import { Segmented } from '../../components/ui/tabs';
import { Badge, StatusBadge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Select } from '../../components/ui/input';
import { Avatar, fullName } from '../../components/ui/avatar';
import { ConfirmDialog } from '../../components/ui/modal';
import { Pagination } from '../../components/ui/pagination';
import { useUrlFilters } from '../../components/browse/Browse';
import { ListState, ReasonDialog, RecordList, Toolbar, countLabel } from '../../components/admin/AdminParts';
import type { AdminVerification } from '../../types/admin';

const STATUS_TABS = [
  { key: 'PENDING', label: 'Pending' },
  { key: 'VERIFIED', label: 'Verified' },
  { key: 'REJECTED', label: 'Rejected' },
  { key: 'SUSPENDED', label: 'Revoked' },
  { key: 'all', label: 'All' },
];

type Dialog = { kind: 'reject' | 'revoke' | 'reopen'; item: AdminVerification };

export default function AdminVerifications() {
  useDocumentTitle('Verifications · Admin');
  const queryClient = useQueryClient();
  const { get, set, page } = useUrlFilters();
  const [dialog, setDialog] = useState<Dialog | null>(null);

  // Pending requests are the work queue, so they are the default view.
  const status = get('status') || 'PENDING';
  const type = get('type');

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['admin', 'verification', { page, status, type }],
    queryFn: () =>
      adminApi.getVerifications({
        page,
        limit: 20,
        status: status === 'all' ? undefined : status,
        type: type || undefined,
      }),
    placeholderData: (prev) => prev,
  });

  const mutation = useMutation({
    mutationFn: (v: { item: AdminVerification; status: string; reason?: string }) =>
      adminApi.updateVerification(v.item.id, { status: v.status, rejectionReason: v.reason }),
    onSuccess: (_d, v) => {
      const name = fullName(v.item.user);
      const msg: Record<string, string> = {
        VERIFIED: `${name} is now verified`,
        REJECTED: `${name}'s request was rejected`,
        SUSPENDED: `${name}'s verification was revoked`,
        PENDING: 'Request moved back to pending',
      };
      toast.success(msg[v.status] ?? 'Verification updated', { description: 'They have been notified.' });
      setDialog(null);
      queryClient.invalidateQueries({ queryKey: ['admin', 'verification'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard'] });
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Could not update this request')),
  });

  const items = data?.data ?? [];
  const busyId = mutation.isPending ? mutation.variables?.item.id : undefined;

  return (
    <div>
      <PageHeader
        title="Verifications"
        description="Confirm people are who they say they are. Verified members get a badge that buyers and tenants trust."
      />

      <Toolbar>
        <Segmented value={status} onChange={(s) => set({ status: s === 'PENDING' ? null : s })} items={STATUS_TABS} />
        <Select value={type} onChange={(e) => set({ type: e.target.value })} className="sm:ml-auto sm:w-56" aria-label="Filter by type">
          <option value="">All types</option>
          {Object.entries(VERIFICATION_TYPE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </Select>
      </Toolbar>

      <p className="mb-3 text-sm text-gray-500" aria-live="polite">
        {countLabel(data?.meta.total, 'request')}
      </p>

      <ListState
        isLoading={isLoading}
        error={error}
        isEmpty={!items.length}
        onRetry={() => refetch()}
        errorFallback="Could not load verification requests"
        empty={
          status === 'PENDING' && !type
            ? { icon: <FiCheckCircle />, title: 'All caught up', message: 'No verification requests are waiting.' }
            : {
                icon: <FiCheckCircle />,
                title: 'No requests found',
                message: 'Nothing matches these filters.',
                action: 'Show pending requests',
                onAction: () => set({ status: null, type: null }),
              }
        }
      >
        <RecordList
          footer={
            data?.meta && data.meta.totalPages > 1 ? (
              <Pagination meta={data.meta} onPageChange={(p) => set({ page: String(p) }, false)} noun="requests" />
            ) : undefined
          }
        >
          {items.map((v) => {
            const busy = busyId === v.id;
            return (
              <li key={v.id} className="px-5 py-4 sm:px-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                  <Avatar person={v.user} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        to={`/admin/users?search=${encodeURIComponent(v.user?.username ?? '')}`}
                        className="font-semibold text-gray-900 hover:text-brand-700"
                      >
                        {fullName(v.user)}
                      </Link>
                      <Badge variant="brand">{label(VERIFICATION_TYPE_LABELS, v.type)}</Badge>
                      <StatusBadge status={v.status} />
                    </div>
                    <p className="mt-0.5 truncate text-sm text-gray-500">
                      @{v.user?.username} · {v.user?.email}
                    </p>
                    {v.notes && (
                      <p className="mt-2 rounded-lg bg-gray-50 px-3 py-2 text-sm whitespace-pre-line text-gray-700">
                        <span className="font-medium text-gray-900">Their note:</span> {v.notes}
                      </p>
                    )}
                    {v.rejectionReason && (
                      <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                        <span className="font-medium">Reason given:</span> {v.rejectionReason}
                      </p>
                    )}
                    <p className="mt-2 text-xs text-gray-500">
                      Submitted <span title={new Date(v.createdAt).toLocaleString()}>{formatRelativeTime(v.createdAt)}</span>
                      {v.reviewedAt && ` · reviewed ${formatRelativeTime(v.reviewedAt)}`}
                    </p>
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    {v.documentUrl && (
                      <a
                        href={v.documentUrl}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[13px] font-semibold text-brand-700 hover:bg-brand-50"
                      >
                        <FiFileText className="h-4 w-4" /> View document
                      </a>
                    )}
                    {v.status === 'PENDING' && (
                      <>
                        <Button size="sm" variant="success" loading={busy} onClick={() => mutation.mutate({ item: v, status: 'VERIFIED' })}>
                          Approve
                        </Button>
                        <Button size="sm" variant="outline" disabled={busy} onClick={() => setDialog({ kind: 'reject', item: v })}>
                          Reject
                        </Button>
                      </>
                    )}
                    {v.status === 'VERIFIED' && (
                      <Button size="sm" variant="ghost" className="text-red-600 hover:bg-red-50 hover:text-red-700" disabled={busy} onClick={() => setDialog({ kind: 'revoke', item: v })}>
                        Revoke
                      </Button>
                    )}
                    {(v.status === 'REJECTED' || v.status === 'SUSPENDED') && (
                      <Button size="sm" variant="outline" disabled={busy} onClick={() => setDialog({ kind: 'reopen', item: v })}>
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
        open={dialog?.kind === 'reject' || dialog?.kind === 'revoke'}
        onClose={() => setDialog(null)}
        loading={mutation.isPending}
        required
        title={dialog?.kind === 'revoke' ? 'Revoke verification?' : 'Reject this request?'}
        description={
          dialog && (
            <>
              {fullName(dialog.item.user)} will {dialog.kind === 'revoke' ? 'lose their verified badge' : 'not be verified'} and will see
              your reason, so they know what to fix.
            </>
          )
        }
        label="Reason"
        placeholder="e.g. The student ID photo is too blurry to read"
        confirmLabel={dialog?.kind === 'revoke' ? 'Revoke' : 'Reject request'}
        onConfirm={(reason) =>
          dialog && mutation.mutate({ item: dialog.item, status: dialog.kind === 'revoke' ? 'SUSPENDED' : 'REJECTED', reason })
        }
      />

      <ConfirmDialog
        open={dialog?.kind === 'reopen'}
        onClose={() => setDialog(null)}
        onConfirm={() => dialog && mutation.mutate({ item: dialog.item, status: 'PENDING' })}
        loading={mutation.isPending}
        tone="primary"
        title="Move back to pending?"
        message="The request goes back into the review queue so it can be checked again."
        confirmLabel="Reopen request"
      />
    </div>
  );
}
