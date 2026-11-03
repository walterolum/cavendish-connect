import { Suspense } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  FiActivity,
  FiAlertTriangle,
  FiCalendar,
  FiArrowUpRight,
  FiCheckCircle,
  FiGrid,
  FiLogOut,
  FiPackage,
  FiSettings,
  FiUsers,
} from 'react-icons/fi';
import { useAuthStore } from '../../store/auth';
import { cn } from '../../lib/utils';
import { Avatar, fullName } from '../ui/avatar';
import { PageLoader } from '../ui/loading';
import { ErrorBoundary, MaintenanceBanner } from '../layout/layouts';
import { useSignOut } from '../layout/navbar';
import { Logo } from '../layout/logo';

export const ADMIN_NAV = [
  { group: 'Overview', items: [{ to: '/admin', label: 'Dashboard', icon: FiGrid, end: true }] },
  {
    group: 'Moderation',
    items: [
      { to: '/admin/listings', label: 'Listings', icon: FiPackage },
      { to: '/admin/reports', label: 'Reports', icon: FiAlertTriangle },
      { to: '/admin/verification', label: 'Verifications', icon: FiCheckCircle },
    ],
  },
  {
    group: 'Platform',
    items: [
      { to: '/admin/users', label: 'Users', icon: FiUsers },
      { to: '/admin/events', label: 'Events', icon: FiCalendar },
      { to: '/admin/settings', label: 'Settings', icon: FiSettings },
      { to: '/admin/audit-logs', label: 'Audit log', icon: FiActivity },
    ],
  },
];

const flatNav = ADMIN_NAV.flatMap((g) => g.items);

function SideNav() {
  return (
    <nav className="space-y-6" aria-label="Admin">
      {ADMIN_NAV.map((group) => (
        <div key={group.group}>
          <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-400">{group.group}</p>
          <div className="space-y-0.5">
            {group.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={'end' in item ? Boolean(item.end) : false}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors',
                    isActive ? 'bg-brand-50 text-brand-700' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  )
                }
              >
                <item.icon className="h-[18px] w-[18px] shrink-0" />
                {item.label}
              </NavLink>
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}

export default function AdminLayout() {
  const user = useAuthStore((s) => s.user);
  const signOut = useSignOut();
  const location = useLocation();

  return (
    <div className="min-h-dvh bg-canvas lg:flex">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-gray-200 bg-white lg:flex">
        <div className="flex h-16 items-center gap-2 border-b border-gray-100 px-5">
          <Logo />
          <span className="rounded-md bg-gray-900 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
            Admin
          </span>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-5">
          <SideNav />
        </div>
        <div className="border-t border-gray-100 p-3">
          <Link
            to="/"
            className="mb-2 flex items-center justify-between rounded-xl px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
          >
            View public site <FiArrowUpRight className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-3 rounded-xl bg-gray-50 p-2.5">
            <Avatar person={user} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-gray-900">{fullName(user)}</p>
              <p className="truncate text-xs text-gray-500">Administrator</p>
            </div>
            <button
              type="button"
              onClick={signOut}
              className="rounded-lg p-1.5 text-gray-400 hover:bg-white hover:text-red-600"
              aria-label="Sign out"
            >
              <FiLogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile header */}
      <header className="sticky top-0 z-30 border-b border-gray-200 bg-white/90 backdrop-blur-xl lg:hidden">
        <div className="flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Logo />
            <span className="rounded-md bg-gray-900 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
              Admin
            </span>
          </div>
          <Link to="/" className="text-sm font-medium text-gray-600">
            Exit
          </Link>
        </div>
        <nav className="no-scrollbar flex gap-1 overflow-x-auto px-3 pb-2" aria-label="Admin">
          {flatNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={'end' in item ? Boolean(item.end) : false}
              className={({ isActive }) =>
                cn(
                  'flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium',
                  isActive ? 'bg-brand-50 text-brand-700' : 'text-gray-600'
                )
              }
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="min-w-0 flex-1">
        <MaintenanceBanner />
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-10">
          <ErrorBoundary resetKey={location.pathname}>
            <Suspense fallback={<PageLoader />}>
              <Outlet />
            </Suspense>
          </ErrorBoundary>
        </div>
      </main>
    </div>
  );
}
