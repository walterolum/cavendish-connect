import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  LuArrowRight,
  LuBookOpen,
  LuCalculator,
  LuChevronRight,
  LuCirclePlus,
  LuCpu,
  LuEllipsis,
  LuFlame,
  LuFootprints,
  LuHandshake,
  LuHeadphones,
  LuLaptop,
  LuLayoutGrid,
  LuLock,
  LuMegaphone,
  LuMonitor,
  LuPackage,
  LuPencil,
  LuShieldCheck,
  LuShirt,
  LuShoppingCart,
  LuSmartphone,
  LuSparkles,
  LuTrophy,
  LuTv,
  LuUtensils,
  LuWifi,
  LuArmchair,
} from 'react-icons/lu';
import { marketplaceApi, categoriesApi } from '../../services/marketplace.service';
import { getErrorMessage } from '../../lib/api';
import { useDocumentTitle, useNewArrivals, LIVE_REFRESH_MS } from '../../lib/hooks';
import { cn } from '../../lib/utils';
import MarketCard from '../../components/market/MarketCard';
import { HubHero, HubSlide } from '../../components/hub/HubHero';
import { CardGridSkeleton, EmptyState, ErrorState, Skeleton } from '../../components/ui/loading';
import type { Category } from '../../types';

/** Picks an icon from the category's name, so new categories still get a sensible one. */
const ICONS: [RegExp, typeof LuLaptop][] = [
  [/phone/i, LuSmartphone],
  [/laptop/i, LuLaptop],
  [/computer|desktop/i, LuMonitor],
  [/electronic|gadget/i, LuTv],
  [/accessor|headphone/i, LuHeadphones],
  [/cloth|fashion|wear/i, LuShirt],
  [/shoe|foot/i, LuFootprints],
  [/book|text/i, LuBookOpen],
  [/station|pen/i, LuPencil],
  [/calculat/i, LuCalculator],
  [/arduino|kit|component/i, LuCpu],
  [/network|router/i, LuWifi],
  [/furniture|home|bed/i, LuArmchair],
  [/food|grocer|snack/i, LuUtensils],
  [/beauty|cosmetic|makeup/i, LuSparkles],
  [/sport|fitness|gym/i, LuTrophy],
];
const iconFor = (c: Category) => ICONS.find(([re]) => re.test(c.name))?.[1] ?? LuPackage;

const SLIDES: HubSlide[] = [
  {
    eyebrow: 'Cavendish University',
    title: 'Campus',
    highlight: 'Market',
    text: 'Buy and sell second-hand items easily within our campus community.',
    image: '/images/campus-hero.jpg',
    position: 'center 35%',
    primary: { to: '/marketplace/browse', label: 'Browse Items', icon: LuShoppingCart },
    secondary: { to: '/marketplace/create', label: 'Post an Ad', icon: LuCirclePlus },
  },
  {
    eyebrow: 'Back to class',
    title: 'Books &',
    highlight: 'Study Gear',
    text: "Textbooks, calculators and supplies from students who've finished the course, at student prices.",
    image: '/images/campus-hero-2.jpg',
    primary: { to: '/marketplace/browse?search=book', label: 'Shop Books', icon: LuShoppingCart },
    secondary: { to: '/marketplace/create', label: 'Post an Ad', icon: LuCirclePlus },
  },
  {
    eyebrow: 'Safe trading',
    title: 'Verified',
    highlight: 'Members Only',
    text: 'Every account is created by the admin office. Meet in public campus spaces and inspect before you pay.',
    image: '/images/campus-hero.jpg',
    position: 'center 70%',
    primary: { to: '/help#safety', label: 'Safety Tips' },
    secondary: { to: '/marketplace/create', label: 'Post an Ad', icon: LuCirclePlus },
  },
];

function Panel({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('rounded-2xl border border-gray-200/80 bg-white shadow-card', className)}>{children}</div>;
}

export default function MarketHomePage() {
  useDocumentTitle('Campus Market');

  const categoriesQ = useQuery({ queryKey: ['marketplace', 'categories'], queryFn: () => categoriesApi.getCategories(), staleTime: 5 * 60_000 });
  const latestQ = useQuery({
    queryKey: ['marketplace', 'listings', { limit: 8, sort: 'newest' }],
    queryFn: () => marketplaceApi.getListings({ limit: 8, sort: 'newest' }),
    refetchInterval: LIVE_REFRESH_MS,
    refetchOnWindowFocus: true,
  });
  const fresh = useNewArrivals(latestQ.data?.data.map((l) => l.id));

  const categories = categoriesQ.data ?? [];
  const shown = categories.slice(0, 7);
  const top = [...categories].filter((c) => (c._count?.listings ?? 0) > 0).sort((a, b) => (b._count?.listings ?? 0) - (a._count?.listings ?? 0)).slice(0, 5);

  return (
    <div className="mx-auto max-w-[1440px] space-y-6">
      <HubHero slides={SLIDES} script={['Reuse', 'Save', 'Connect']} label="Campus Market highlights" />

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-6">
          {/* Shop by category */}
          <Panel className="p-5">
            <h2 className="mb-4 flex items-center gap-2.5 text-2xl font-bold text-gray-900">
              <LuLayoutGrid className="h-6 w-6 text-brand-600" /> Shop by Category
            </h2>
            {categoriesQ.isLoading ? (
              <div className="grid grid-cols-4 gap-3 sm:grid-cols-8">
                {Array.from({ length: 8 }).map((_, n) => (
                  <Skeleton key={n} className="h-[104px] rounded-xl" />
                ))}
              </div>
            ) : (
              <div className="stagger grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-8">
                {shown.map((c) => {
                  const Icon = iconFor(c);
                  return (
                    <Link
                      key={c.id}
                      to={`/marketplace/browse?category=${c.slug}`}
                      className="group flex h-[104px] flex-col items-center justify-center gap-2 rounded-xl border border-gray-100 bg-brand-50/40 px-2 text-center transition-all duration-300 hover:-translate-y-1 hover:border-brand-200 hover:bg-white hover:shadow-raised dark:bg-gray-100/40"
                    >
                      <Icon className="h-8 w-8 text-brand-700 transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6" />
                      <span className="line-clamp-2 text-[13px] leading-tight font-medium text-gray-800">{c.name}</span>
                    </Link>
                  );
                })}
                <Link
                  to="/marketplace/browse"
                  className="group flex h-[104px] flex-col items-center justify-center gap-2 rounded-xl border border-gray-100 bg-brand-50/40 text-center transition-all duration-300 hover:-translate-y-1 hover:border-brand-200 hover:bg-white hover:shadow-raised dark:bg-gray-100/40"
                >
                  <LuEllipsis className="h-8 w-8 text-brand-700 transition-transform group-hover:scale-110" />
                  <span className="text-[13px] font-medium text-gray-800">More</span>
                </Link>
              </div>
            )}
          </Panel>

          {/* Latest listings */}
          <section aria-labelledby="latest">
            <div className="mb-4 flex items-center justify-between">
              <h2 id="latest" className="flex items-center gap-2 text-2xl font-bold text-gray-900">
                <LuFlame className="h-6 w-6 animate-[float_3s_ease-in-out_infinite] text-orange-500" /> Latest Listings
              </h2>
              <Link to="/marketplace/browse" className="group flex items-center gap-1 text-[15px] font-semibold text-brand-700 hover:text-brand-800">
                View All <LuArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>
            {latestQ.isLoading ? (
              <CardGridSkeleton count={4} columns={4} />
            ) : latestQ.error ? (
              <Panel>
                <ErrorState message={getErrorMessage(latestQ.error, "Couldn't load listings")} onRetry={() => latestQ.refetch()} />
              </Panel>
            ) : !latestQ.data?.data.length ? (
              <Panel>
                <EmptyState icon={<LuPackage />} title="No items yet" message="Be the first to sell something to the campus community." />
              </Panel>
            ) : (
              <div className="stagger grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                {latestQ.data.data.map((l) => (
                  <MarketCard key={l.id} listing={l} isNew={fresh.has(l.id)} />
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Right rail */}
        <aside className="stagger grid gap-5 sm:grid-cols-2 xl:grid-cols-1" aria-label="About the market">
          <Panel className="p-5">
            <div className="flex items-start gap-3">
              <LuShieldCheck className="h-9 w-9 shrink-0 fill-emerald-500 text-white dark:text-gray-50" />
              <div>
                <p className="text-lg font-bold text-brand-800 dark:text-white">Your Campus Market</p>
                <p className="text-xs text-brand-700">Safe • Trusted • Student Friendly</p>
              </div>
            </div>
            <ul className="mt-4 divide-y divide-gray-100">
              {[
                { icon: LuShieldCheck, text: 'Verified students only', to: '/register' },
                { icon: LuHandshake, text: 'Meet on campus', to: '/help' },
                { icon: LuLock, text: 'Report suspicious activity', to: '/help#report' },
              ].map((x) => (
                <li key={x.text}>
                  <Link to={x.to} className="group flex items-center gap-3 py-3 text-[15px] text-gray-700 transition-colors hover:text-brand-700">
                    <x.icon className="h-6 w-6 shrink-0 text-brand-700 transition-transform group-hover:scale-110" />
                    {x.text}
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>

          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-800 to-brand-950 p-5 text-white shadow-raised">
            <div className="absolute -right-8 -bottom-10 h-36 w-36 rounded-full bg-accent-400/15 blur-2xl" />
            <LuMegaphone className="animate-wiggle absolute top-6 right-4 h-14 w-14 -rotate-12 text-accent-400" aria-hidden="true" />
            <p className="relative max-w-[70%] text-xl leading-tight font-extrabold">Turn Your Unused Items into Cash!</p>
            <Link
              to="/marketplace/create"
              className="group relative mt-4 inline-flex h-11 items-center gap-2 rounded-xl bg-accent-400 px-5 font-bold text-brand-950 transition-all hover:bg-accent-300 active:scale-95"
            >
              Post an Ad <LuArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>

          <Panel className="p-5 sm:col-span-2 xl:col-span-1">
            <p className="flex items-center gap-2 text-lg font-bold text-gray-900">
              <LuTrophy className="h-6 w-6 text-accent-500" /> Top Categories
            </p>
            {top.length ? (
              <ul className="mt-3 space-y-1">
                {top.map((c) => {
                  const Icon = iconFor(c);
                  return (
                    <li key={c.id}>
                      <Link to={`/marketplace/browse?category=${c.slug}`} className="group flex items-center gap-3 rounded-lg px-1 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-50">
                        <Icon className="h-5 w-5 text-brand-700" />
                        <span className="flex-1 truncate">{c.name}</span>
                        <span className="text-xs text-brand-700 tabular-nums">{c._count?.listings} ads</span>
                        <LuChevronRight className="h-4 w-4 text-gray-400 transition-transform group-hover:translate-x-0.5" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-gray-500">Categories with live ads will show here.</p>
            )}
          </Panel>
        </aside>
      </div>
    </div>
  );
}
