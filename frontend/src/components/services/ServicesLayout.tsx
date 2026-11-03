import {
  LuActivity,
  LuBell,
  LuCircleHelp,
  LuCirclePlus,
  LuGraduationCap,
  LuHeart,
  LuHouse,
  LuMessageSquare,
  LuSearch,
  LuUser,
} from 'react-icons/lu';
import { HubConfig, HubLayout } from '../hub/HubLayout';

const config: HubConfig = {
  name: 'Services Hub',
  homeTo: '/services',
  searchTo: '/services/browse',
  searchPlaceholder: 'Search for services (e.g. web developer, tailor, chef…)',
  searchLabel: 'Search',
  showBell: true,
  nav: [
    { to: '/services', label: 'Home', icon: LuHouse, end: true },
    { to: '/services/browse', label: 'Find Services', icon: LuSearch },
    { to: '/services/create', label: 'Post a Service', icon: LuCirclePlus },
    { to: '/dashboard?tab=services', label: 'My Activity', icon: LuActivity },
    { to: '/messages', label: 'Messages', icon: LuMessageSquare, badge: 'messages' },
    { to: '/notifications', label: 'Notifications', icon: LuBell, badge: 'notifications' },
    { to: '/favorites', label: 'Favorites', icon: LuHeart },
    { to: '/profile', label: 'Profile', icon: LuUser },
    { to: '/help', label: 'Help & Support', icon: LuCircleHelp },
  ],
  promo: (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-b from-brand-600 to-brand-800 ring-1 ring-white/10">
      <LuGraduationCap className="animate-float absolute top-3 right-3 h-8 w-8 text-accent-400" aria-hidden="true" />
      <div className="p-4 pb-1">
        <p className="font-[family-name:var(--font-display)] text-xl leading-tight font-extrabold text-white">
          Campus Services
          <br />
          Hub
        </p>
        <p className="mt-1 text-sm font-semibold text-accent-400">Connect • Hire • Grow</p>
      </div>
      <div className="relative h-28 overflow-hidden">
        <img src="/images/services-students.jpg" alt="" className="h-full w-full object-cover" loading="lazy" />
        <div className="absolute inset-0 bg-gradient-to-b from-brand-700 via-transparent to-transparent" />
        <svg viewBox="0 0 200 30" preserveAspectRatio="none" className="absolute inset-x-0 bottom-0 h-6 w-full" aria-hidden="true">
          <path d="M0 30 C60 4 140 4 200 18 V30 Z" fill="#ffc81f" />
        </svg>
      </div>
    </div>
  ),
};

/** Services Hub shell (navy sidebar), matching the services design. */
export default function ServicesLayout() {
  return <HubLayout config={config} />;
}
