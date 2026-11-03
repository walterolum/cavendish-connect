import { ComponentType, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { FiStar } from 'react-icons/fi';
import { cn } from '../../lib/utils';

const tones = {
  brand: 'bg-brand-50 text-brand-700',
  green: 'bg-emerald-50 text-emerald-700',
  amber: 'bg-amber-50 text-amber-700',
  red: 'bg-red-50 text-red-600',
  gray: 'bg-gray-100 text-gray-600',
  accent: 'bg-accent-50 text-accent-600',
};

/** KPI tile: label, big number, optional context line. */
export function StatCard({
  label,
  value,
  icon: Icon,
  tone = 'brand',
  hint,
  to,
}: {
  label: string;
  value: ReactNode;
  icon?: ComponentType<{ className?: string }>;
  tone?: keyof typeof tones;
  hint?: ReactNode;
  to?: string;
}) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-gray-500">{label}</p>
        {Icon && (
          <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', tones[tone])}>
            <Icon className="h-[18px] w-[18px]" />
          </span>
        )}
      </div>
      <p className="mt-2 font-[family-name:var(--font-display)] text-[28px] font-bold leading-none tracking-tight text-gray-900 tabular-nums">
        {value}
      </p>
      {hint && <p className="mt-2 text-xs text-gray-500">{hint}</p>}
    </>
  );
  const cls = 'block rounded-2xl border border-gray-200/80 bg-white p-5 shadow-card';
  return to ? (
    <Link to={to} className={cn(cls, 'transition-shadow hover:shadow-raised')}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/** Read-only star rating. */
export function Stars({ value, size = 'sm' }: { value: number; size?: 'sm' | 'md' }) {
  const px = size === 'sm' ? 'h-3.5 w-3.5' : 'h-5 w-5';
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${value.toFixed(1)} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <FiStar
          key={n}
          aria-hidden="true"
          className={cn(px, n <= Math.round(value) ? 'fill-accent-400 text-accent-400' : 'text-gray-300')}
        />
      ))}
    </span>
  );
}

/** Interactive star picker for review forms. */
export function StarInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div role="radiogroup" aria-label="Rating" className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} star${n > 1 ? 's' : ''}`}
          onClick={() => onChange(n)}
          className="rounded-md p-0.5 transition-transform hover:scale-110"
        >
          <FiStar className={cn('h-7 w-7', n <= value ? 'fill-accent-400 text-accent-400' : 'text-gray-300')} />
        </button>
      ))}
    </div>
  );
}
