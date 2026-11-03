import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { FiArrowRight, FiChevronLeft } from 'react-icons/fi';
import { cn } from '../../lib/utils';

const widths = {
  sm: 'max-w-2xl',
  md: 'max-w-4xl',
  lg: 'max-w-5xl',
  xl: 'max-w-7xl',
};

/** Standard page container: consistent width, gutters and vertical rhythm. */
export function Page({
  children,
  width = 'xl',
  className,
}: {
  children: ReactNode;
  width?: keyof typeof widths;
  className?: string;
}) {
  return (
    <div className={cn('mx-auto w-full px-4 py-6 sm:px-6 sm:py-8 lg:px-8', widths[width], className)}>{children}</div>
  );
}

/** Standard page title block. Every page starts with one. */
export function PageHeader({
  title,
  description,
  actions,
  back,
  eyebrow,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  back?: { to: string; label: string };
  eyebrow?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('mb-6 sm:mb-8', className)}>
      {back && (
        <Link
          to={back.to}
          className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-gray-500 transition-colors hover:text-gray-900"
        >
          <FiChevronLeft className="h-4 w-4" />
          {back.label}
        </Link>
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          {eyebrow && (
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-brand-600">{eyebrow}</p>
          )}
          <h1 className="text-2xl font-bold text-gray-900 sm:text-[28px] sm:leading-9">{title}</h1>
          {description && <p className="mt-1.5 max-w-2xl text-sm text-gray-500 sm:text-[15px]">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

/** Section title with an optional "view all" link, used on overview pages. */
export function SectionHeader({
  title,
  description,
  to,
  linkLabel = 'View all',
}: {
  title: ReactNode;
  description?: ReactNode;
  to?: string;
  linkLabel?: string;
}) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <div>
        <h2 className="text-xl font-bold text-gray-900 sm:text-2xl">{title}</h2>
        {description && <p className="mt-1 text-sm text-gray-500">{description}</p>}
      </div>
      {to && (
        <Link
          to={to}
          className="group inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-brand-700 hover:text-brand-800"
        >
          {linkLabel}
          <FiArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </Link>
      )}
    </div>
  );
}

/** Label/value rows used on detail pages. */
export function DetailList({ items }: { items: { label: ReactNode; value: ReactNode }[] }) {
  return (
    <dl className="divide-y divide-gray-100">
      {items.map((item, i) => (
        <div key={i} className="flex items-center justify-between gap-4 py-2.5 text-sm first:pt-0 last:pb-0">
          <dt className="text-gray-500">{item.label}</dt>
          <dd className="text-right font-medium text-gray-900">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Responsive grid for listing/service/property cards. */
export function CardGrid({ children, columns = 4 }: { children: ReactNode; columns?: 3 | 4 }) {
  return (
    <div
      className={cn(
        'grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5',
        columns === 4 ? 'lg:grid-cols-3 xl:grid-cols-4' : 'xl:grid-cols-3'
      )}
    >
      {children}
    </div>
  );
}
