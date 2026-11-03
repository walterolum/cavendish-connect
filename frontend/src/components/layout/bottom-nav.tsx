import { NavLink } from 'react-router-dom';
import { FiGrid, FiHome, FiMessageSquare, FiPlus, FiUser } from 'react-icons/fi';
import { useAuthStore } from '../../store/auth';
import { useUnreadCounts } from '../../lib/hooks';
import { cn } from '../../lib/utils';
import { CountBadge } from './navbar';

/** Mobile tab bar. Active state matches whole sections, e.g. /messages/12 lights up Messages. */
export function BottomNav() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const unread = useUnreadCounts();

  const items = [
    { to: '/', icon: FiHome, label: 'Home', end: true },
    { to: '/explore', icon: FiGrid, label: 'Explore' },
    { to: '/post', icon: FiPlus, label: 'Post', primary: true },
    { to: '/messages', icon: FiMessageSquare, label: 'Inbox', badge: unread.messages },
    { to: isAuthenticated ? '/dashboard' : '/login', icon: FiUser, label: isAuthenticated ? 'Me' : 'Sign in' },
  ];

  return (
    <nav
      aria-label="Primary"
      className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-gray-200/80 bg-white/90 backdrop-blur-xl md:hidden"
    >
      <div className="grid grid-cols-5">
        {items.map((item) => (
          <NavLink
            key={item.label}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center gap-1 pb-2 pt-2.5 text-[11px] font-medium transition-colors',
                isActive && !item.primary ? 'text-brand-700' : 'text-gray-500'
              )
            }
          >
            {item.primary ? (
              <span className="-mt-1 flex h-9 w-12 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-md shadow-brand-900/25">
                <item.icon className="h-5 w-5" />
              </span>
            ) : (
              <span className="relative">
                <item.icon className="h-[22px] w-[22px]" />
                {item.badge ? <CountBadge count={item.badge} /> : null}
              </span>
            )}
            <span>{item.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
