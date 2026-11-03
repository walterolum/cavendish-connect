import { LuBell, LuCircleHelp, LuCirclePlus, LuHouse, LuLayoutGrid, LuMessageSquare, LuTag, LuUser } from 'react-icons/lu';
import { HubConfig, HubLayout } from '../hub/HubLayout';

const config: HubConfig = {
  name: 'Campus Market',
  homeTo: '/marketplace',
  searchTo: '/marketplace/browse',
  searchPlaceholder: 'Search for items… (e.g. laptop, calculator, books)',
  nav: [
    { to: '/marketplace', label: 'Home', icon: LuHouse, end: true },
    { to: '/marketplace/browse', label: 'Browse Items', icon: LuLayoutGrid },
    { to: '/marketplace/create', label: 'Post an Ad', icon: LuCirclePlus },
    { to: '/dashboard?tab=listings', label: 'My Listings', icon: LuTag },
    { to: '/messages', label: 'Messages', icon: LuMessageSquare, badge: 'messages' },
    { to: '/notifications', label: 'Notifications', icon: LuBell, badge: 'notifications' },
    { to: '/profile', label: 'Profile', icon: LuUser },
    { to: '/help', label: 'Help & Support', icon: LuCircleHelp },
  ],
  promo: (
    <div className="overflow-hidden rounded-2xl bg-brand-800 ring-1 ring-white/10">
      <div className="p-4 pb-0">
        <p className="font-[family-name:var(--font-display)] text-lg font-extrabold text-accent-400">Buy • Sell • Connect</p>
        <p className="mt-1 text-sm leading-snug text-white/85">A smarter way to buy and sell on campus!</p>
      </div>
      <div className="relative mt-2 h-24 overflow-hidden">
        <img src="/images/campus-hero.jpg" alt="" className="h-full w-full object-cover object-top opacity-90" loading="lazy" />
        <div className="absolute inset-0 bg-gradient-to-b from-brand-800 via-transparent to-transparent" />
        <svg viewBox="0 0 200 30" preserveAspectRatio="none" className="absolute inset-x-0 bottom-0 h-6 w-full" aria-hidden="true">
          <path d="M0 30 C60 4 140 4 200 18 V30 Z" fill="#ffc81f" />
        </svg>
      </div>
    </div>
  ),
};

/** Campus Market shell (navy sidebar), matching the market design. */
export default function MarketLayout() {
  return <HubLayout config={config} />;
}
