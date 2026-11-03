import { ReactNode } from 'react';
import { FiAlertCircle, FiInbox } from 'react-icons/fi';
import { Button } from './button';
import { cn } from '../../lib/utils';

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton rounded-lg', className)} aria-hidden="true" />;
}

/** Placeholder matching the listing/service/property card layout. */
export function CardGridSkeleton({ count = 8, columns = 4 }: { count?: number; columns?: 3 | 4 }) {
  return (
    <div
      role="status"
      aria-label="Loading"
      className={cn(
        'grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5',
        columns === 4 ? 'lg:grid-cols-3 xl:grid-cols-4' : 'xl:grid-cols-3'
      )}
    >
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="overflow-hidden rounded-2xl border border-gray-200/80 bg-white">
          <Skeleton className="aspect-[4/3] rounded-none" />
          <div className="space-y-2.5 p-4">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-5 w-1/2" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Placeholder for stacked rows (inbox, notifications, tables). */
export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div role="status" aria-label="Loading" className="divide-y divide-gray-100">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 px-5 py-4">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Kept for older call sites; renders the card grid placeholder. */
export function LoadingSkeleton({ className }: { className?: string }) {
  return (
    <div className={className}>
      <CardGridSkeleton count={6} columns={3} />
    </div>
  );
}

export function PageLoader() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center" role="status" aria-label="Loading page">
      <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-brand-100 border-t-brand-600" />
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  message,
  action,
  onAction,
  children,
  className,
}: {
  icon?: ReactNode;
  title: string;
  message?: ReactNode;
  action?: string;
  onAction?: () => void;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-14 text-center sm:py-16', className)}>
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-b from-gray-50 to-gray-100 text-gray-400 ring-1 ring-gray-200 [&>svg]:h-6 [&>svg]:w-6">
        {icon || <FiInbox />}
      </div>
      <h3 className="text-base font-semibold text-gray-900">{title}</h3>
      {message && <p className="mt-1 max-w-sm text-sm text-gray-500">{message}</p>}
      {(children || (action && onAction)) && (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {action && onAction && <Button onClick={onAction}>{action}</Button>}
          {children}
        </div>
      )}
    </div>
  );
}

export function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
  children,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center sm:py-16" role="alert">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-500 ring-1 ring-red-100">
        <FiAlertCircle className="h-6 w-6" />
      </div>
      <h3 className="text-base font-semibold text-gray-900">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-gray-500">{message}</p>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
        {onRetry && (
          <Button onClick={onRetry} variant="outline">
            Try again
          </Button>
        )}
        {children}
      </div>
    </div>
  );
}
