import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  FiBell,
  FiChevronDown,
  FiGrid,
  FiHeart,
  FiLogOut,
  FiMenu,
  FiMessageSquare,
  FiPlus,
  FiSearch,
  FiShield,
  FiUser,
  FiX,
  FiMapPin,
  FiHome,
  FiPhone,
  FiLogIn,
  FiShoppingBag,
} from 'react-icons/fi';
import { useBrand, usePublicSettings } from '../../lib/settings';
import { ThemeToggle } from '../../lib/theme';
import { useAuthStore, isAdmin } from '../../store/auth';
import { authApi } from '../../services/auth.service';
import { useOrderCounts, useUnreadCounts } from '../../lib/hooks';
import { cn } from '../../lib/utils';
import { Avatar, fullName } from '../ui/avatar';
import { ButtonLink } from '../ui/button';
import { Logo } from './logo';

export const PRIMARY_NAV = [
  { to: '/', label: 'Home', end: true },
  { to: '/marketplace', label: 'Campus Market' },
  { to: '/accommodation', label: 'Accommodation' },
  { to: '/services', label: 'Services' },
  { to: '/help', label: 'Help' },
];

/** Slim info strip above the main navigation (location, quick links, support line). */
export function UtilityBar() {
  const { data: settings } = usePublicSettings();
  const brand = useBrand();
  return (
    <div className="hidden bg-brand-950 text-[13px] text-white/80 sm:block">
      <div className="mx-auto flex h-9 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <span className="flex items-center gap-1.5">
          <FiMapPin className="h-3.5 w-3.5 text-accent-400" /> {brand.universityName}, {brand.city}
        </span>
        <Link to="/accommodation/create" className="hidden items-center gap-1.5 transition-colors hover:text-accent-300 md:flex">
          <FiHome className="h-3.5 w-3.5 text-accent-400" /> List your room or hostel
        </Link>
        <span className="flex items-center gap-4">
          {settings?.contactPhone && (
            <a href={`tel:${settings.contactPhone.replace(/\s/g, '')}`} className="flex items-center gap-1.5 transition-colors hover:text-accent-300">
              <FiPhone className="h-3.5 w-3.5 text-accent-400" /> {settings.contactPhone}
            </a>
          )}
          <Link to="/help" className="transition-colors hover:text-accent-300">
            Help centre
          </Link>
        </span>
      </div>
    </div>
  );
}

export function CountBadge({ count, className }: { count: number; className?: string }) {
  if (!count) return null;
  return (
    <span
      className={cn(
        'absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-white tabular-nums',
        className
      )}
      aria-label={`${count} unread`}
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}

export function useSignOut() {
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  return async () => {
    await authApi.logout();
    logout();
    navigate('/');
  };
}

export function AccountMenu() {
  const orders = useOrderCounts();
  const user = useAuthStore((s) => s.user);
  const signOut = useSignOut();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const location = useLocation();

  useEffect(() => setOpen(false), [location.pathname]);
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const item =
    'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-100 hover:text-gray-900';

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-1.5 rounded-full p-0.5 pr-1.5 transition-colors hover:bg-gray-100"
      >
        <Avatar person={user} size="sm" />
        <FiChevronDown className={cn('hidden h-4 w-4 text-gray-500 transition-transform sm:block', open && 'rotate-180')} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 w-64 origin-top-right animate-pop-in rounded-2xl border border-gray-200 bg-white p-1.5 shadow-raised"
        >
          <div className="flex items-center gap-3 px-3 py-2.5">
            <Avatar person={user} size="md" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-gray-900">{fullName(user)}</p>
              <p className="truncate text-xs text-gray-500">{user?.email}</p>
            </div>
          </div>
          <div className="my-1 h-px bg-gray-100" />
          <Link role="menuitem" to="/orders" className={item}>
            <FiShoppingBag className="h-4 w-4 text-gray-400" /> Orders
            {orders.incoming + orders.mine > 0 && (
              <span className="ml-auto rounded-full bg-brand-600 px-2 py-0.5 text-[11px] font-bold text-white tabular-nums">{orders.incoming + orders.mine}</span>
            )}
          </Link>
          <Link role="menuitem" to="/dashboard" className={item}>
            <FiGrid className="h-4 w-4 text-gray-400" /> My posts
          </Link>
          <Link role="menuitem" to="/favorites" className={item}>
            <FiHeart className="h-4 w-4 text-gray-400" /> Saved
          </Link>
          <Link role="menuitem" to="/profile" className={item}>
            <FiUser className="h-4 w-4 text-gray-400" /> Profile & settings
          </Link>
          {isAdmin(user) && (
            <Link role="menuitem" to="/admin" className={item}>
              <FiShield className="h-4 w-4 text-gray-400" /> Admin console
            </Link>
          )}
          <div className="my-1 h-px bg-gray-100" />
          <button role="menuitem" type="button" onClick={signOut} className={cn(item, 'text-red-600 hover:bg-red-50 hover:text-red-700')}>
            <FiLogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}

export function Navbar() {
  const brand = useBrand();
  const { user, isAuthenticated } = useAuthStore();
  const unread = useUnreadCounts();
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const signOut = useSignOut();

  useEffect(() => setMobileOpen(false), [location.pathname]);

  const iconLink =
    'relative hidden h-10 w-10 items-center justify-center rounded-xl text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 sm:flex';

  return (
    <header className="sticky top-0 z-40 border-b border-gray-200/70 bg-white/85 backdrop-blur-xl backdrop-saturate-150">
      <nav className="mx-auto flex h-[68px] max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8" aria-label="Main">
        <div className="flex items-center gap-10">
          <Logo />
          <div className="hidden items-center gap-1 lg:flex">
            {PRIMARY_NAV.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                className={({ isActive }) =>
                  cn(
                    'group relative px-3 py-2 text-sm font-semibold transition-colors',
                    isActive ? 'text-brand-800' : 'text-gray-600 hover:text-gray-900'
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    {link.label}
                    <span
                      className={cn(
                        'absolute inset-x-3 -bottom-[13px] h-[3px] origin-left rounded-full bg-accent-400 transition-transform duration-300',
                        isActive ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100 group-hover:bg-gray-300'
                      )}
                    />
                  </>
                )}
              </NavLink>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-1 sm:gap-1.5">
          <Link to="/explore" className={iconLink} aria-label="Search">
            <FiSearch className="h-5 w-5" />
          </Link>
          <ThemeToggle className="hidden sm:flex" />
          {isAuthenticated ? (
            <>
              <Link to="/messages" className={iconLink} aria-label="Messages">
                <FiMessageSquare className="h-5 w-5" />
                <CountBadge count={unread.messages} />
              </Link>
              <Link to="/notifications" className={iconLink} aria-label="Notifications">
                <FiBell className="h-5 w-5" />
                <CountBadge count={unread.notifications} />
              </Link>
              <ButtonLink to="/post" size="md" className="ml-1.5 hidden md:inline-flex">
                <FiPlus className="h-4 w-4" />
                Post
              </ButtonLink>
              <div className="ml-1">
                <AccountMenu />
              </div>
            </>
          ) : (
            <ButtonLink to="/login" className="ml-1.5 hidden md:inline-flex">
              <FiLogIn className="h-4 w-4" />
              Log in
            </ButtonLink>
          )}

          <button
            type="button"
            onClick={() => setMobileOpen((o) => !o)}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-gray-600 hover:bg-gray-100 lg:hidden"
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <FiX className="h-5 w-5" /> : <FiMenu className="h-5 w-5" />}
          </button>
        </div>
      </nav>

      {mobileOpen && (
        <div className="animate-fade-in border-t border-gray-100 bg-white px-4 pb-4 pt-2 lg:hidden">
          <div className="flex flex-col gap-0.5">
            {[...PRIMARY_NAV, { to: '/explore', label: 'Search everything', end: false }].map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                className={({ isActive }) =>
                  cn(
                    'rounded-xl px-3 py-2.5 text-[15px] font-medium',
                    isActive ? 'bg-brand-50 text-brand-700' : 'text-gray-700 hover:bg-gray-50'
                  )
                }
              >
                {link.label}
              </NavLink>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between rounded-xl px-3 py-1 text-[15px] font-medium text-gray-700">
            Appearance <ThemeToggle />
          </div>
          <div className="mt-3 border-t border-gray-100 pt-3">
            {isAuthenticated ? (
              <div className="flex flex-col gap-0.5">
                <Link to="/notifications" className="flex items-center justify-between rounded-xl px-3 py-2.5 text-[15px] font-medium text-gray-700 hover:bg-gray-50">
                  Notifications
                  {unread.notifications > 0 && (
                    <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs font-bold text-white">{unread.notifications}</span>
                  )}
                </Link>
                <Link to="/orders" className="rounded-xl px-3 py-2.5 text-[15px] font-medium text-gray-700 hover:bg-gray-50">
                  Orders
                </Link>
                <Link to="/dashboard" className="rounded-xl px-3 py-2.5 text-[15px] font-medium text-gray-700 hover:bg-gray-50">
                  My posts
                </Link>
                <Link to="/favorites" className="rounded-xl px-3 py-2.5 text-[15px] font-medium text-gray-700 hover:bg-gray-50">
                  Saved
                </Link>
                {isAdmin(user) && (
                  <Link to="/admin" className="rounded-xl px-3 py-2.5 text-[15px] font-medium text-gray-700 hover:bg-gray-50">
                    Admin console
                  </Link>
                )}
                <button type="button" onClick={signOut} className="rounded-xl px-3 py-2.5 text-left text-[15px] font-medium text-red-600 hover:bg-red-50">
                  Sign out
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <ButtonLink to="/login" className="w-full">
                  Log in
                </ButtonLink>
                <p className="text-center text-xs text-gray-500">Accounts are issued by the {brand.appName} admin office.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
