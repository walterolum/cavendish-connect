import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { LuArrowRight, LuCircleCheck } from 'react-icons/lu';
import type { IconType } from 'react-icons';
import { cn } from '../../lib/utils';

export interface HubSlide {
  eyebrow?: string;
  title: string;
  highlight: string;
  text: string;
  image: string;
  position?: string;
  checks?: string[];
  primary: { to: string; label: string; icon?: IconType };
  secondary?: { to: string; label: string; icon?: IconType };
}

const SLIDE_MS = 6500;

/**
 * Rotating campus banner used on the Market and Services home pages.
 * Cross-fades between slides, pauses on hover/focus, and shows progress on the active dot.
 */
export function HubHero({ slides, script, label }: { slides: HubSlide[]; script: string[]; label: string }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (paused || slides.length < 2) return;
    timer.current = window.setTimeout(() => setI((n) => (n + 1) % slides.length), SLIDE_MS);
    return () => window.clearTimeout(timer.current);
  }, [i, paused, slides.length]);

  const s = slides[i];
  const Primary = s.primary.icon;
  const Secondary = s.secondary?.icon;

  return (
    <section
      className="relative isolate overflow-hidden rounded-3xl bg-brand-900 shadow-raised"
      aria-roledescription="carousel"
      aria-label={label}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      {slides.map((slide, n) => (
        <div key={n} className={cn('absolute inset-0 transition-opacity duration-1000', n === i ? 'opacity-100' : 'opacity-0')} aria-hidden={n !== i}>
          <img
            src={slide.image}
            alt=""
            // The first photo is what people see first; the rest load in the background.
            loading={n === 0 ? 'eager' : 'lazy'}
            fetchPriority={n === 0 ? 'high' : 'low'}
            decoding="async"
            className={cn('h-full w-full object-cover', n === i && 'animate-ken-burns')}
            style={{ objectPosition: slide.position ?? 'center' }}
          />
        </div>
      ))}
      <div className="absolute inset-0 bg-gradient-to-r from-brand-950 via-brand-900/85 to-brand-900/20" />
      <div className="absolute inset-0 bg-gradient-to-t from-brand-950/50 to-transparent" />

      <div className="relative flex min-h-[300px] items-center justify-between gap-6 px-6 pt-10 pb-12 sm:min-h-[320px] sm:px-10">
        <div key={i} className="stagger max-w-2xl text-white" aria-live="polite">
          {s.eyebrow && <p className="font-[family-name:var(--font-display)] text-2xl font-bold sm:text-[32px]">{s.eyebrow}</p>}
          <h1 className="text-[40px] leading-none font-extrabold sm:text-[60px]">
            {s.title} <span className="text-accent-400">{s.highlight}</span>
          </h1>
          <p className="mt-4 max-w-lg text-base text-white/90 sm:text-xl">{s.text}</p>
          {s.checks && (
            <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm sm:text-base">
              {s.checks.map((c) => (
                <li key={c} className="flex items-center gap-1.5">
                  <LuCircleCheck className="h-5 w-5 fill-accent-400 text-brand-900" /> {c}
                </li>
              ))}
            </ul>
          )}
          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              to={s.primary.to}
              className="group inline-flex h-12 items-center gap-2 rounded-full bg-accent-400 px-6 font-bold text-brand-950 shadow-lg shadow-black/20 transition-all hover:bg-accent-300 hover:shadow-xl active:scale-95"
            >
              {Primary && <Primary className="h-5 w-5" />} {s.primary.label}
              {!Primary && <LuArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />}
            </Link>
            {s.secondary && (
              <Link
                to={s.secondary.to}
                className="inline-flex h-12 items-center gap-2 rounded-full border-2 border-accent-400 px-6 font-bold text-white transition-all hover:bg-accent-400 hover:text-brand-950 active:scale-95"
              >
                {Secondary && <Secondary className="h-5 w-5" />} {s.secondary.label}
              </Link>
            )}
          </div>
        </div>

        <p className="font-script hidden -rotate-6 text-right text-5xl leading-[1.05] text-white drop-shadow-lg xl:block" aria-hidden="true">
          {script.map((line, n) => (
            <span key={n} className="block">
              {line}
            </span>
          ))}
          <svg viewBox="0 0 160 20" className="mt-1 ml-auto block h-4 w-40 text-accent-400" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round">
            <path d="M4 14 C50 2 110 2 156 10" />
          </svg>
        </p>
      </div>

      {slides.length > 1 && (
        <div className="absolute inset-x-0 bottom-4 flex justify-center gap-2">
          {slides.map((_, n) => (
            <button
              key={n}
              type="button"
              onClick={() => setI(n)}
              className={cn('relative h-2.5 overflow-hidden rounded-full bg-white/40 transition-all duration-300', n === i ? 'w-8' : 'w-2.5 hover:bg-white/70')}
              aria-label={`Show slide ${n + 1}`}
              aria-current={n === i}
            >
              {n === i && (
                <span
                  key={`${i}-${paused}`}
                  className="absolute inset-0 origin-left bg-white"
                  style={paused ? undefined : { animation: `progress ${SLIDE_MS}ms linear both` }}
                />
              )}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
