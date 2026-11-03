import { useState } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '../../lib/utils';

/**
 * The official crest is used when /images/cavendish-logo.png exists.
 * Until then, a drawn shield in the university colours stands in.
 */
const OFFICIAL_LOGO = '/images/cavendish-logo.png';
let officialMissing = false;

function DrawnCrest({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 72" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="crest-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1442a3" />
          <stop offset="1" stopColor="#0a245c" />
        </linearGradient>
      </defs>
      {/* crown */}
      <path d="M20 9 l4 5 4-7 4 7 4-7 4 7 4-5 -2 9 H22z" fill="#ffc81f" />
      {/* shield */}
      <path d="M8 18 h48 v20 c0 16-11 26-24 31 C19 64 8 54 8 38z" fill="url(#crest-fill)" stroke="#ffc81f" strokeWidth="3" strokeLinejoin="round" />
      <path d="M14 23 h36 v15 c0 12-8 20-18 24 C22 58 14 50 14 38z" fill="none" stroke="#ffffff" strokeOpacity="0.35" strokeWidth="1.2" />
      <text x="32" y="47" textAnchor="middle" fontFamily="Plus Jakarta Sans, Inter, sans-serif" fontWeight="800" fontSize="20" fill="#ffffff" letterSpacing="-1">
        CU
      </text>
    </svg>
  );
}

export function Crest({ className }: { className?: string }) {
  const [missing, setMissing] = useState(officialMissing);
  if (missing) return <DrawnCrest className={className} />;
  return (
    <img
      src={OFFICIAL_LOGO}
      alt=""
      className={cn('object-contain', className)}
      onError={() => {
        officialMissing = true;
        setMissing(true);
      }}
    />
  );
}

/** Kept for places that only need the small mark. */
export function LogoMark({ className }: { className?: string }) {
  return <Crest className={cn('h-10 w-9', className)} />;
}

export function Logo({ inverse, className, to = '/' }: { inverse?: boolean; className?: string; to?: string }) {
  return (
    <Link to={to} className={cn('group flex items-center gap-2.5', className)} aria-label="Cavendish Connect home">
      <Crest className="h-10 w-9 shrink-0 transition-transform duration-300 group-hover:-rotate-3 group-hover:scale-105" />
      <span className="leading-none">
        <span
          className={cn(
            'block font-[family-name:var(--font-display)] text-[17px] font-extrabold tracking-tight',
            inverse ? 'text-white' : 'text-brand-900 dark:text-white'
          )}
        >
          Cavendish<span className={inverse ? 'text-accent-400' : 'text-accent-500'}> Connect</span>
        </span>
        <span className={cn('mt-1 block text-[10px] font-semibold uppercase tracking-[0.18em]', inverse ? 'text-white/60' : 'text-gray-500')}>
          University Uganda
        </span>
      </span>
    </Link>
  );
}

/** Large stacked crest used at the top of the Market and Services sidebars. */
export function SidebarBrand({ to = '/' }: { to?: string }) {
  return (
    <Link to={to} className="group flex flex-col items-center text-center" aria-label="Section home">
      <Crest className="h-20 w-[72px] drop-shadow-lg transition-transform duration-500 group-hover:scale-105" />
      <span className="mt-3 font-[family-name:var(--font-display)] text-[17px] leading-tight font-extrabold tracking-wide text-white">
        CAVENDISH
        <br />
        UNIVERSITY
      </span>
      <span className="mt-1 text-xs font-semibold tracking-[0.35em] text-white/70">UGANDA</span>
    </Link>
  );
}
