import { useState } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '../../lib/utils';
import { useBrand } from '../../lib/settings';

/**
 * The official crest is used when /images/cavendish-logo.png exists.
 * Until then, a drawn shield in the university colours stands in.
 */
const OFFICIAL_LOGO = '/images/cavendish-logo.png';
let officialMissing = false;

function DrawnCrest({ className, initials }: { className?: string; initials: string }) {
  return (
    <svg viewBox="0 0 64 72" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="crest-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: 'var(--color-brand-600)' }} />
          <stop offset="1" style={{ stopColor: 'var(--color-brand-900)' }} />
        </linearGradient>
      </defs>
      {/* crown */}
      <path d="M20 9 l4 5 4-7 4 7 4-7 4 7 4-5 -2 9 H22z" style={{ fill: 'var(--color-accent-400)' }} />
      {/* shield */}
      <path d="M8 18 h48 v20 c0 16-11 26-24 31 C19 64 8 54 8 38z" fill="url(#crest-fill)" style={{ stroke: 'var(--color-accent-400)' }} strokeWidth="3" strokeLinejoin="round" />
      <path d="M14 23 h36 v15 c0 12-8 20-18 24 C22 58 14 50 14 38z" fill="none" stroke="#ffffff" strokeOpacity="0.35" strokeWidth="1.2" />
      <text x="32" y="47" textAnchor="middle" fontFamily="Plus Jakarta Sans, Inter, sans-serif" fontWeight="800" fontSize={initials.length > 2 ? 15 : 20} fill="#ffffff" letterSpacing="-1">
        {initials}
      </text>
    </svg>
  );
}

/**
 * The university's mark: the logo uploaded in Admin > Appearance, else the
 * official file at /images/cavendish-logo.png if present, else a drawn shield
 * with the university's initials in the platform colours.
 */
export function Crest({ className }: { className?: string }) {
  const brand = useBrand();
  const sources = [brand.logoUrl, officialMissing ? '' : OFFICIAL_LOGO].filter(Boolean);
  const [failed, setFailed] = useState<string[]>([]);
  const src = sources.find((x) => !failed.includes(x));
  if (!src) return <DrawnCrest className={className} initials={brand.initials} />;
  return (
    <img
      src={src}
      alt=""
      className={cn('object-contain', className)}
      onError={() => {
        if (src === OFFICIAL_LOGO) officialMissing = true;
        setFailed((f) => [...f, src]);
      }}
    />
  );
}

/** Kept for places that only need the small mark. */
export function LogoMark({ className }: { className?: string }) {
  return <Crest className={cn('h-10 w-9', className)} />;
}

export function Logo({ inverse, className, to = '/' }: { inverse?: boolean; className?: string; to?: string }) {
  const brand = useBrand();
  const [first, ...rest] = brand.appName.split(' ');
  return (
    <Link to={to} className={cn('group flex items-center gap-2.5', className)} aria-label={`${brand.appName} home`}>
      <Crest className="h-10 w-9 shrink-0 transition-transform duration-300 group-hover:-rotate-3 group-hover:scale-105" />
      <span className="min-w-0 leading-none">
        <span
          className={cn(
            'block truncate font-[family-name:var(--font-display)] text-[17px] font-extrabold tracking-tight',
            inverse ? 'text-white' : 'text-brand-900 dark:text-white'
          )}
        >
          {first}
          {rest.length > 0 && <span className={inverse ? 'text-accent-400' : 'text-accent-500'}> {rest.join(' ')}</span>}
        </span>
        <span className={cn('mt-1 block truncate text-[10px] font-semibold uppercase tracking-[0.18em]', inverse ? 'text-white/60' : 'text-gray-500')}>
          {brand.universityName}
        </span>
      </span>
    </Link>
  );
}

/** Large stacked crest used at the top of the Market and Services sidebars. */
export function SidebarBrand({ to = '/' }: { to?: string }) {
  const brand = useBrand();
  const words = brand.universityName.split(/\s+/);
  // "Cavendish University Uganda" -> "CAVENDISH UNIVERSITY" over "UGANDA"
  const [main, sub] = words.length >= 3 ? [words.slice(0, -1).join(' '), words[words.length - 1]] : [brand.universityName, ''];
  return (
    <Link to={to} className="group flex flex-col items-center text-center" aria-label={`${brand.appName} home`}>
      <Crest className="h-20 w-[72px] drop-shadow-lg transition-transform duration-500 group-hover:scale-105" />
      <span className="mt-3 max-w-[200px] font-[family-name:var(--font-display)] text-[17px] leading-tight font-extrabold tracking-wide text-white uppercase">
        {main}
      </span>
      {sub && <span className="mt-1 text-xs font-semibold tracking-[0.35em] text-white/70 uppercase">{sub}</span>}
    </Link>
  );
}
