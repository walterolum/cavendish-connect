import { cn } from '../../lib/utils';

const sizes = {
  xs: 'h-5 w-5 text-[10px]',
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-14 w-14 text-lg',
  xl: 'h-24 w-24 text-2xl',
};

// Stable, pleasant background per person so avatars are distinguishable.
const tones = [
  'bg-brand-100 text-brand-800',
  'bg-emerald-100 text-emerald-800',
  'bg-accent-100 text-accent-700',
  'bg-rose-100 text-rose-800',
  'bg-sky-100 text-sky-800',
  'bg-violet-100 text-violet-800',
];

export interface AvatarPerson {
  firstName?: string | null;
  lastName?: string | null;
  avatar?: string | null;
  username?: string | null;
}

export function initials(person?: AvatarPerson | null) {
  if (!person) return '?';
  const value = `${person.firstName?.[0] ?? ''}${person.lastName?.[0] ?? ''}`.toUpperCase();
  return value || person.username?.[0]?.toUpperCase() || '?';
}

export function fullName(person?: AvatarPerson | null) {
  if (!person) return 'Unknown user';
  return [person.firstName, person.lastName].filter(Boolean).join(' ') || person.username || 'Unknown user';
}

export function Avatar({
  person,
  size = 'md',
  className,
}: {
  person?: AvatarPerson | null;
  size?: keyof typeof sizes;
  className?: string;
}) {
  const name = fullName(person);
  const tone = tones[(name.charCodeAt(0) + name.length) % tones.length];

  if (person?.avatar) {
    return (
      <img
        src={person.avatar}
        alt={name}
        loading="lazy"
        className={cn('shrink-0 rounded-full object-cover ring-1 ring-black/5', sizes[size], className)}
      />
    );
  }
  return (
    <span
      role="img"
      aria-label={name}
      className={cn(
        'inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold ring-1 ring-black/5',
        tone,
        sizes[size],
        className
      )}
    >
      {initials(person)}
    </span>
  );
}
