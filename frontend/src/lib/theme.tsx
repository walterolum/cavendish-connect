import { useSyncExternalStore } from 'react';
import { FiMoon, FiSun } from 'react-icons/fi';
import { cn } from './utils';

type Theme = 'light' | 'dark';
const KEY = 'cav-theme';
const listeners = new Set<() => void>();

function current(): Theme {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

export function setTheme(theme: Theme) {
  const root = document.documentElement;
  // Brief cross-fade so switching feels smooth rather than a hard flash.
  root.classList.add('theme-transition');
  root.classList.toggle('dark', theme === 'dark');
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    /* private mode: the choice just isn't remembered */
  }
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#070f20' : '#0a245c');
  window.setTimeout(() => root.classList.remove('theme-transition'), 350);
  listeners.forEach((l) => l());
}

export function useTheme() {
  const theme = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    current,
    () => 'light' as Theme
  );
  return { theme, toggle: () => setTheme(theme === 'dark' ? 'light' : 'dark') };
}

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggle } = useTheme();
  const dark = theme === 'dark';
  return (
    <button
      type="button"
      onClick={toggle}
      className={cn(
        'relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900',
        className
      )}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={dark ? 'Light mode' : 'Dark mode'}
    >
      <FiSun
        className={cn('absolute h-5 w-5 transition-all duration-500', dark ? 'translate-y-6 rotate-90 opacity-0' : 'translate-y-0 rotate-0 opacity-100')}
      />
      <FiMoon
        className={cn('absolute h-5 w-5 transition-all duration-500', dark ? 'translate-y-0 rotate-0 opacity-100' : '-translate-y-6 -rotate-90 opacity-0')}
      />
    </button>
  );
}
