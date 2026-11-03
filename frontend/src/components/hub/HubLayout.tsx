import { FormEvent, ReactNode, useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { LuArrowLeft, LuBell, LuMenu, LuSearch, LuX } from 'react-icons/lu';
import type { IconType } from 'react-icons';
import { useAuthStore } from '../../store/auth';
import { useOrderCounts, useUnreadCounts } from '../../lib/hooks';
import { cn } from '../../lib/utils';
import { ThemeToggle } from '../../lib/theme';
import { RouteContent, MaintenanceBanner } from '../layout/layouts';
import { AccountMenu } from '../layout/navbar';
import { SidebarBrand } from '../layout/logo';
import { ButtonLink } from '../ui/button';
import { useBrand } from '../../lib/settings';

export type HubNavItem = { to: string; label: string; icon: IconType; end?: boolean; badge?: 'messages' | 'notifications' | 'orders' };

/** Everything that differs between the Campus Market and the Services Hub. */
export interface HubConfig {
  name: string;
  homeTo: string;
  nav: HubNavItem[];
  /** Results page the top search sends people to. */
  searchTo: string;
  searchPlaceholder: string;
  /** Text on the search button; an icon is used when omitted. */
  searchLabel?: string;
  showBell?: boolean;
  promo: ReactNode;
}

function Sidebar({ config, onNavigate }: { config: HubConfig; onNavigate?: () => void }) {
  const unread = useUnreadCounts();
  const orderCounts = useOrderCounts();
  const badges = { ...unread, orders: orderCounts.incoming };
  const brand = useBrand();
  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-brand-900 text-white">
      <div className="pointer-events-none absolute -top-24 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-brand-500/30 blur-3xl" />

      <div className="relative px-6 pt-8 pb-6">
        <SidebarBrand to={config.homeTo} />
      </div>

      <nav className="no-scrollbar relative flex-1 space-y-1 overflow-y-auto px-3" aria-label={config.name}>
        {config.nav.map((item) => {
          const count = item.badge ? badges[item.badge] : 0;
          return (
            <NavLink
              key={item.label}
              to={item.to}
              end={item.end}
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  'group relative flex items-center gap-4 rounded-xl px-4 py-2.5 text-[15px] font-medium transition-all duration-200',
                  isActive
                    ? 'bg-gradient-to-r from-brand-500 to-brand-600 text-white shadow-lg shadow-black/20'
                    : 'text-white/80 hover:translate-x-1 hover:bg-white/8 hover:text-white'
                )
              }
            >
              <item.icon className="h-[22px] w-[22px] shrink-0 transition-transform duration-200 group-hover:scale-110" />
              {item.label}
              {count > 0 && (
                <span className="ml-auto flex h-6 min-w-6 items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-bold tabular-nums">
                  {count > 99 ? '99+' : count}
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>

      <div className="relative mx-3 mt-4">{config.promo}</div>

      <div className="relative px-6 py-5 text-center">
        <p className="text-sm font-semibold">{brand.universityName}</p>
        <p className="mt-0.5 text-[11px] text-white/60">© {new Date().getFullYear()}. All rights reserved.</p>
      </div>
    </div>
  );
}

function TopBar({ config, onMenu }: { config: HubConfig; onMenu: () => void }) {
  const { user, isAuthenticated } = useAuthStore();
  const unread = useUnreadCounts();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const location = useLocation();
  const onResults = location.pathname === config.searchTo;
  const [q, setQ] = useState(onResults ? params.get('search') ?? '' : '');
  useEffect(() => {
    if (onResults) setQ(params.get('search') ?? '');
  }, [onResults, params]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const next = new URLSearchParams(onResults ? params : undefined);
    if (q.trim()) next.set('search', q.trim());
    else next.delete('search');
    next.delete('page');
    navigate(`${config.searchTo}${next.toString() ? `?${next}` : ''}`);
  };

  return (
    <header className="sticky top-0 z-30 border-b border-gray-200/70 bg-canvas/85 backdrop-blur-xl">
      <div className="flex h-[76px] items-center gap-3 px-4 sm:px-6 lg:px-8">
        <button type="button" onClick={onMenu} className="flex h-10 w-10 items-center justify-center rounded-xl text-gray-700 hover:bg-gray-100 lg:hidden" aria-label="Open menu">
          <LuMenu className="h-6 w-6" />
        </button>

        <form
          onSubmit={submit}
          role="search"
          className="flex h-12 max-w-2xl flex-1 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-card transition focus-within:border-brand-400 focus-within:ring-4 focus-within:ring-brand-500/15"
        >
          <span className="flex items-center pl-4 text-gray-500">
            <LuSearch className="h-5 w-5" />
          </span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={config.searchPlaceholder}
            aria-label={`Search ${config.name}`}
            className="min-w-0 flex-1 bg-transparent px-3 text-[15px] text-gray-900 outline-none placeholder:text-gray-400"
          />
          <button
            type="submit"
            className={cn(
              'flex items-center justify-center bg-brand-800 font-semibold text-white transition-colors hover:bg-brand-700',
              config.searchLabel ? 'm-1 rounded-lg px-4 sm:px-6' : 'w-16'
            )}
            aria-label="Search"
          >
            {config.searchLabel ? <span className="hidden sm:inline">{config.searchLabel}</span> : null}
            <LuSearch className={cn('h-5 w-5', config.searchLabel && 'sm:hidden')} />
          </button>
        </form>

        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          <Link to="/" className="hidden items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 xl:flex">
            <LuArrowLeft className="h-4 w-4" /> Main site
          </Link>
          <ThemeToggle />
          {config.showBell && isAuthenticated && (
            <Link to="/notifications" className="relative flex h-10 w-10 items-center justify-center rounded-xl text-gray-600 hover:bg-gray-100" aria-label="Notifications">
              <LuBell className={cn('h-6 w-6', unread.notifications > 0 && 'animate-wiggle')} />
              {unread.notifications > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-bold text-white ring-2 ring-canvas">
                  {unread.notifications}
                </span>
              )}
            </Link>
          )}
          <span className="hidden h-8 w-px bg-gray-200 sm:block" />
          {isAuthenticated ? (
            <div className="flex items-center gap-3">
              <span className="hidden text-right leading-tight sm:block">
                <span className="block text-sm text-gray-600">Welcome back,</span>
                <span className="block text-base font-bold text-gray-900">{user?.firstName}</span>
              </span>
              <AccountMenu />
            </div>
          ) : (
            <ButtonLink to={`/login?redirect=${encodeURIComponent(location.pathname)}`}>Log in</ButtonLink>
          )}
        </div>
      </div>
    </header>
  );
}

/** Shared shell for the Campus Market and Services Hub: navy sidebar on desktop, slide-out drawer on mobile. */
export function HubLayout({ config }: { config: HubConfig }) {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  useEffect(() => setOpen(false), [location.pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <div className="min-h-dvh bg-canvas lg:flex">
      <aside className="sticky top-0 hidden h-dvh w-[260px] shrink-0 lg:block">
        <Sidebar config={config} />
      </aside>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button type="button" className="animate-fade-in absolute inset-0 bg-brand-950/60 backdrop-blur-sm" onClick={() => setOpen(false)} aria-label="Close menu" />
          <div className="animate-slide-in-left absolute inset-y-0 left-0 w-[280px] max-w-[85vw] shadow-overlay">
            <Sidebar config={config} onNavigate={() => setOpen(false)} />
            <button type="button" onClick={() => setOpen(false)} className="absolute top-3 right-3 rounded-lg p-2 text-white/80 hover:bg-white/10" aria-label="Close menu">
              <LuX className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}

      <div className="min-w-0 flex-1">
        <MaintenanceBanner />
        <TopBar config={config} onMenu={() => setOpen(true)} />
        <main className="px-4 py-6 sm:px-6 lg:px-8">
          <RouteContent />
        </main>
      </div>
    </div>
  );
}
