import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { FiCheckCircle, FiKey, FiUserPlus, FiUsers } from 'react-icons/fi';
import { adminApi } from '../../services/admin.service';
import { getErrorMessage } from '../../lib/api';
import { useDocumentTitle } from '../../lib/hooks';
import { formatDate, formatRelativeTime } from '../../lib/utils';
import { ROLE_LABELS, label } from '../../lib/labels';
import { useAuthStore } from '../../store/auth';
import { PageHeader } from '../../components/ui/page';
import { Segmented } from '../../components/ui/tabs';
import { Badge, StatusBadge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Select } from '../../components/ui/input';
import { Avatar, fullName } from '../../components/ui/avatar';
import { ConfirmDialog } from '../../components/ui/modal';
import { Pagination } from '../../components/ui/pagination';
import { useUrlFilters } from '../../components/browse/Browse';
import { ListState, SearchBox, Table, Td, Th, Toolbar, countLabel } from '../../components/admin/AdminParts';
import type { AdminUser } from '../../types/admin';
import { ACCOUNT_ROLES, CreateAccountDialog, TempPasswordDialog } from '../../components/admin/AccountDialogs';

/** Roles that exist in the database. */
const ROLES = ACCOUNT_ROLES;

const STATUS_TABS = [
  { key: '', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'suspended', label: 'Deactivated' },
  { key: 'inactive', label: 'Inactive' },
];

type Pending = { kind: 'suspend' | 'activate' | 'role' | 'reset'; user: AdminUser; role?: string };

function UserStatus({ u }: { u: AdminUser }) {
  if (u.isSuspended) return <Badge variant="red" dot>Deactivated</Badge>;
  if (!u.isActive) return <StatusBadge status="INACTIVE" />;
  if (u.mustChangePassword) return <Badge variant="amber" dot>Awaiting first sign-in</Badge>;
  return <Badge variant="green" dot>Active</Badge>;
}

export default function AdminUsers() {
  useDocumentTitle('Users · Admin');
  const queryClient = useQueryClient();
  const me = useAuthStore((s) => s.user);
  const { get, set, page } = useUrlFilters();
  const [pending, setPending] = useState<Pending | null>(null);
  const [creating, setCreating] = useState(false);
  const [issued, setIssued] = useState<{ title: string; name: string; email?: string; tempPassword: string } | null>(null);

  const role = get('role');
  const status = get('status');
  const search = get('search');

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['admin', 'users', { page, role, status, search }],
    queryFn: () =>
      adminApi.getUsers({ page, limit: 20, role: role || undefined, status: status || undefined, search: search || undefined }),
    placeholderData: (prev) => prev,
  });

  const mutation = useMutation({
    mutationFn: async (p: Pending) => {
      if (p.kind === 'suspend') return adminApi.suspendUser(p.user.id);
      if (p.kind === 'activate') return adminApi.activateUser(p.user.id);
      if (p.kind === 'reset') return adminApi.resetUserPassword(p.user.id);
      return adminApi.changeUserRole(p.user.id, p.role!);
    },
    onSuccess: (result, p) => {
      const name = fullName(p.user);
      if (p.kind === 'reset' && result && 'tempPassword' in result) {
        setPending(null);
        setIssued({ title: 'New temporary password', name, email: p.user.email, tempPassword: result.tempPassword });
        queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
        return;
      }
      toast.success(
        p.kind === 'suspend'
          ? `${name}'s account is deactivated`
          : p.kind === 'activate'
            ? `${name} can sign in again`
            : `${name} is now ${label(ROLE_LABELS, p.role).toLowerCase()}`
      );
      setPending(null);
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard'] });
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Could not update this account')),
  });

  const users = data?.data ?? [];
  const filtered = Boolean(role || status || search);

  const dialog = (() => {
    if (!pending) return null;
    const name = fullName(pending.user);
    if (pending.kind === 'reset')
      return {
        title: `Reset ${name}'s password?`,
        message: 'Their current password stops working. You will get a new temporary password to give them, and they must choose their own when they next sign in.',
        confirm: 'Reset password',
        tone: 'primary' as const,
      };
    if (pending.kind === 'suspend')
      return {
        title: `Deactivate ${name}'s account?`,
        message: 'They will not be able to sign in or post until you reactivate the account. They will be notified when they next try to sign in.',
        confirm: 'Deactivate account',
        tone: 'danger' as const,
      };
    if (pending.kind === 'activate')
      return {
        title: `Activate ${name}'s account?`,
        message: 'They will be able to sign in and use the platform again.',
        confirm: 'Activate account',
        tone: 'primary' as const,
      };
    return {
      title: `Change role to ${label(ROLE_LABELS, pending.role)}?`,
      message:
        pending.role === 'ADMIN'
          ? `${name} will get full access to this admin console, including users, posts and settings.`
          : `${name}'s current role (${pending.user.roles.map((r) => label(ROLE_LABELS, r)).join(', ') || 'none'}) will be replaced.`,
      confirm: 'Change role',
      tone: pending.role === 'ADMIN' ? ('danger' as const) : ('primary' as const),
    };
  })();

  return (
    <div>
      <PageHeader
        title="Users"
        description="Only admins can create accounts. Add people, change what they can do, reset passwords, and deactivate accounts."
        actions={
          <Button onClick={() => setCreating(true)}>
            <FiUserPlus className="h-4 w-4" /> Add account
          </Button>
        }
      />

      <Toolbar>
        <SearchBox value={search} onSearch={(v) => set({ search: v })} placeholder="Search by name, username or email" />
        <Select value={role} onChange={(e) => set({ role: e.target.value })} className="sm:w-48" aria-label="Filter by role">
          <option value="">All roles</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {label(ROLE_LABELS, r)}
            </option>
          ))}
        </Select>
        <Segmented value={status} onChange={(s) => set({ status: s })} items={STATUS_TABS} />
      </Toolbar>

      <p className="mb-3 text-sm text-gray-500" aria-live="polite">
        {countLabel(data?.meta.total, 'account')}
      </p>

      <ListState
        isLoading={isLoading}
        error={error}
        isEmpty={!users.length}
        onRetry={() => refetch()}
        errorFallback="Could not load users"
        empty={{
          icon: <FiUsers />,
          title: 'No accounts found',
          message: filtered ? 'Nothing matches these filters.' : 'No accounts yet. Add the first one.',
          action: filtered ? 'Clear filters' : 'Add account',
          onAction: () => (filtered ? set({ role: null, status: null, search: null }) : setCreating(true)),
        }}
      >
        <Table
          head={
            <>
              <Th>User</Th>
              <Th>Role</Th>
              <Th>Status</Th>
              <Th>Posts</Th>
              <Th>Joined</Th>
              <Th className="text-right">Actions</Th>
            </>
          }
          footer={
            data?.meta && data.meta.totalPages > 1 ? (
              <Pagination meta={data.meta} onPageChange={(p) => set({ page: String(p) }, false)} noun="accounts" />
            ) : undefined
          }
        >
          {users.map((u) => {
            const isMe = u.id === me?.id;
            const posts = u._count.marketplaceListings + u._count.services + u._count.properties;
            const busy = mutation.isPending && mutation.variables?.user.id === u.id;
            return (
              <tr key={u.id} className="transition-colors hover:bg-gray-50/70">
                <Td>
                  <div className="flex items-center gap-3">
                    <Avatar person={u} size="sm" />
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 font-medium text-gray-900">
                        <span className="truncate">{fullName(u)}</span>
                        {u.isEmailVerified && <FiCheckCircle className="h-3.5 w-3.5 shrink-0 text-brand-500" aria-label="Email verified" />}
                        {isMe && <Badge variant="brand">You</Badge>}
                      </p>
                      <p className="truncate text-xs text-gray-500">
                        @{u.username} · {u.email}
                      </p>
                    </div>
                  </div>
                </Td>
                <Td>
                  {isMe ? (
                    <span className="text-gray-900">{u.roles.map((r) => label(ROLE_LABELS, r)).join(', ')}</span>
                  ) : (
                    <Select
                      value={u.roles[0] ?? ''}
                      disabled={busy}
                      onChange={(e) => setPending({ kind: 'role', user: u, role: e.target.value })}
                      className="h-9 w-44 text-sm"
                      aria-label={`Role for ${fullName(u)}`}
                    >
                      {!u.roles.length && <option value="">No role</option>}
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {label(ROLE_LABELS, r)}
                        </option>
                      ))}
                    </Select>
                  )}
                </Td>
                <Td>
                  <UserStatus u={u} />
                </Td>
                <Td className="tabular-nums">
                  {posts > 0 ? (
                    <span title={`${u._count.marketplaceListings} listings, ${u._count.services} services, ${u._count.properties} properties`}>
                      {posts}
                    </span>
                  ) : (
                    <span className="text-gray-400">0</span>
                  )}
                </Td>
                <Td className="whitespace-nowrap">
                  {formatDate(u.createdAt)}
                  <span className="block text-xs text-gray-400">
                    {u.lastLoginAt ? `Last seen ${formatRelativeTime(u.lastLoginAt)}` : 'Never signed in'}
                  </span>
                </Td>
                <Td className="text-right">
                  {isMe ? (
                    <span className="text-xs text-gray-400">Your account</span>
                  ) : (
                    <div className="flex items-center justify-end gap-1">
                      <Button size="icon-sm" variant="ghost" disabled={busy} onClick={() => setPending({ kind: 'reset', user: u })} aria-label={`Reset password for ${fullName(u)}`} title="Reset password">
                        <FiKey className="h-4 w-4" />
                      </Button>
                      {u.isSuspended ? (
                        <Button size="sm" variant="success" loading={busy} onClick={() => setPending({ kind: 'activate', user: u })}>
                          Activate
                        </Button>
                      ) : (
                        <Button size="sm" variant="ghost" className="text-red-600 hover:bg-red-50 hover:text-red-700" disabled={busy} onClick={() => setPending({ kind: 'suspend', user: u })}>
                          Deactivate
                        </Button>
                      )}
                    </div>
                  )}
                </Td>
              </tr>
            );
          })}
        </Table>
      </ListState>

      <CreateAccountDialog
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(r) => {
          setCreating(false);
          setIssued({ title: 'Account created', ...r });
          toast.success(`${r.name}'s account is ready`);
          queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
          queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard'] });
        }}
      />
      <TempPasswordDialog data={issued} onClose={() => setIssued(null)} />

      <ConfirmDialog
        open={!!pending}
        onClose={() => setPending(null)}
        onConfirm={() => pending && mutation.mutate(pending)}
        loading={mutation.isPending}
        title={dialog?.title ?? ''}
        message={dialog?.message ?? ''}
        confirmLabel={dialog?.confirm}
        tone={dialog?.tone}
      />
    </div>
  );
}
