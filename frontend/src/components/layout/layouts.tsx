import { Component, ErrorInfo, ReactNode, Suspense } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { FiShield, FiTool } from 'react-icons/fi';
import { usePublicSettings } from '../../lib/settings';
import { useAuthStore, isAdmin } from '../../store/auth';
import { loginPath } from '../../lib/hooks';
import { ErrorState, EmptyState, PageLoader } from '../ui/loading';
import { ButtonLink } from '../ui/button';
import { Navbar, UtilityBar } from './navbar';
import { Footer } from './footer';
import { BottomNav } from './bottom-nav';
import { Logo } from './logo';

/** Shown on every page while an admin has maintenance mode switched on. */
export function MaintenanceBanner() {
  const { data } = usePublicSettings();
  if (!data?.maintenanceMode) return null;
  return (
    <div role="status" className="flex items-center justify-center gap-2 bg-amber-500 px-4 py-2 text-center text-sm font-medium text-amber-950">
      <FiTool className="h-4 w-4 shrink-0" aria-hidden="true" />
      Scheduled maintenance: you can browse, but posting and messaging are paused for a short while.
    </div>
  );
}

/** Catches render errors so one broken widget never blanks the whole app. */
export class ErrorBoundary extends Component<{ children: ReactNode; resetKey?: string }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled UI error', error, info.componentStack);
  }

  componentDidUpdate(prev: { resetKey?: string }) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null });
  }

  render() {
    if (this.state.error) {
      return (
        <ErrorState
          title="This page hit a problem"
          message="Something unexpected happened while showing this page. Reloading usually fixes it."
          onRetry={() => window.location.reload()}
        >
          <ButtonLink to="/" variant="ghost">
            Go to home
          </ButtonLink>
        </ErrorState>
      );
    }
    return this.props.children;
  }
}

/** Page body with a soft fade-in each time the page (not just its filters) changes. */
export function RouteContent() {
  const location = useLocation();
  return (
    <ErrorBoundary resetKey={location.pathname}>
      <Suspense fallback={<PageLoader />}>
        <div key={location.pathname} className="animate-page-in">
          <Outlet />
        </div>
      </Suspense>
    </ErrorBoundary>
  );
}

/**
 * Accounts are created by admins with a temporary password. Until the person
 * picks their own, every page sends them to the set-password screen.
 */
export function PasswordGate() {
  const { user, isAuthenticated } = useAuthStore();
  const location = useLocation();
  if (isAuthenticated && user?.mustChangePassword && location.pathname !== '/set-password') {
    return <Navigate to={`/set-password?redirect=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  }
  return null;
}

/** Main site chrome: top bar, footer, mobile tab bar. */
export function PublicLayout() {
  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[200] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:shadow-raised"
      >
        Skip to content
      </a>
      <MaintenanceBanner />
      <UtilityBar />
      <Navbar />
      <main id="main" className="flex-1 pb-20 md:pb-0">
        <RouteContent />
      </main>
      <Footer />
      <BottomNav />
    </div>
  );
}

/** Full-height app pages (chat) — top bar only, no footer. */
export function AppLayout() {
  return (
    <div className="flex h-dvh flex-col">
      <MaintenanceBanner />
      <Navbar />
      <main className="min-h-0 flex-1">
        <RouteContent />
      </main>
    </div>
  );
}

/** Sign-in and password screens: focused, no navigation distractions. */
export function AuthLayout() {
  return (
    <div className="relative flex min-h-dvh flex-col bg-white">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(60%_60%_at_50%_0%,var(--color-brand-100),transparent)]"
        aria-hidden="true"
      />
      <header className="relative mx-auto flex w-full max-w-7xl items-center px-4 py-5 sm:px-6 lg:px-8">
        <Logo />
      </header>
      <main className="relative flex flex-1 items-start justify-center px-4 pb-16 pt-4 sm:items-center sm:pt-0">
        <RouteContent />
      </main>
    </div>
  );
}

/** Redirects to sign-in (and back afterwards) when there is no session. */
export function RequireAuth({ children }: { children?: ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const location = useLocation();
  if (!isAuthenticated) return <Navigate to={loginPath(location.pathname + location.search)} replace />;
  return children ? <>{children}</> : <Outlet />;
}

export function RequireAdmin({ children }: { children?: ReactNode }) {
  const { user, isAuthenticated } = useAuthStore();
  const location = useLocation();
  if (!isAuthenticated) return <Navigate to={loginPath(location.pathname)} replace />;
  if (!isAdmin(user)) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-canvas px-4">
        <EmptyState
          icon={<FiShield />}
          title="Admins only"
          message="Your account doesn't have access to the admin console. Contact an administrator if you think this is a mistake."
        >
          <ButtonLink to="/" variant="outline">
            Back to CAV CONNECT
          </ButtonLink>
        </EmptyState>
      </div>
    );
  }
  return children ? <>{children}</> : <Outlet />;
}
