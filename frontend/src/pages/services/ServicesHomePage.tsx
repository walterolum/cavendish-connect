import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  LuArrowRight,
  LuBookOpen,
  LuBriefcase,
  LuCalendarDays,
  LuCamera,
  LuChefHat,
  LuCircleCheck,
  LuCode,
  LuEllipsis,
  LuFileText,
  LuGraduationCap,
  LuHandshake,
  LuKeyboard,
  LuLayoutGrid,
  LuMapPin,
  LuMic,
  LuPalette,
  LuPartyPopper,
  LuPenTool,
  LuPrinter,
  LuScissors,
  LuSend,
  LuShare2,
  LuSmartphone,
  LuSparkles,
  LuStar,
  LuTruck,
  LuUsers,
  LuVideo,
  LuWrench,
  LuShirt,
} from 'react-icons/lu';
import type { IconType } from 'react-icons';
import { servicesApi } from '../../services/listing.service';
import { categoriesApi } from '../../services/marketplace.service';
import { getErrorMessage } from '../../lib/api';
import { useDocumentTitle, useNewArrivals, LIVE_REFRESH_MS } from '../../lib/hooks';
import { cn } from '../../lib/utils';
import { compactNumber, usePublicStats, useUpcomingEvents } from '../../lib/community';
import ProviderCard from '../../components/services/ProviderCard';
import { HubHero, HubSlide } from '../../components/hub/HubHero';
import { CardGridSkeleton, EmptyState, ErrorState, Skeleton } from '../../components/ui/loading';
import type { Category } from '../../types';
import { Brand, useBrand } from '../../lib/settings';

/** Icon + colour per service category, picked from its name so new categories still look right. */
const LOOK: [RegExp, IconType, string][] = [
  [/mobile|phone/i, LuSmartphone, 'text-sky-600 bg-sky-50'],
  [/web|software|develop|app/i, LuCode, 'text-blue-600 bg-blue-50'],
  [/logo/i, LuPenTool, 'text-fuchsia-600 bg-fuchsia-50'],
  [/graphic|design|art/i, LuPalette, 'text-violet-600 bg-violet-50'],
  [/video/i, LuVideo, 'text-rose-600 bg-rose-50'],
  [/photo/i, LuCamera, 'text-gray-800 bg-gray-100'],
  [/tutor|coach|lesson/i, LuGraduationCap, 'text-indigo-600 bg-indigo-50'],
  [/academic|research|study/i, LuBookOpen, 'text-emerald-600 bg-emerald-50'],
  [/cv|resume|writing/i, LuFileText, 'text-teal-600 bg-teal-50'],
  [/typing|transcri/i, LuKeyboard, 'text-slate-600 bg-slate-100'],
  [/print|station/i, LuPrinter, 'text-cyan-700 bg-cyan-50'],
  [/social|media|market/i, LuShare2, 'text-pink-600 bg-pink-50'],
  [/hair|barber/i, LuScissors, 'text-orange-600 bg-orange-50'],
  [/makeup|beauty/i, LuSparkles, 'text-rose-500 bg-rose-50'],
  [/event|party|mc|host/i, LuPartyPopper, 'text-amber-600 bg-amber-50'],
  [/deliver|errand/i, LuTruck, 'text-red-600 bg-red-50'],
  [/cook|cater|chef|food/i, LuChefHat, 'text-amber-600 bg-amber-50'],
  [/tailor|fashion|sew/i, LuShirt, 'text-blue-700 bg-blue-50'],
  [/repair|mainten|fix/i, LuWrench, 'text-blue-600 bg-blue-50'],
  [/danc|music|entertain/i, LuMic, 'text-purple-600 bg-purple-50'],
];
const lookFor = (c: Category) => LOOK.find(([re]) => re.test(c.name)) ?? [/./, LuBriefcase, 'text-brand-700 bg-brand-50'];

const slidesFor = (b: Brand): HubSlide[] => [
  {
    title: 'Campus',
    highlight: 'Services Hub',
    text: `Find and offer services easily within our ${b.universityName} community.`,
    image: b.heroServices,
    position: 'center 40%',
    checks: ['Trusted Students', 'Affordable Prices', 'Quality Services'],
    primary: { to: '/services/browse', label: 'Explore Services' },
  },
  {
    title: 'Share Your',
    highlight: 'Skills',
    text: 'Design, tutoring, photography, repairs, hair, catering: earn from what you are good at.',
    image: '/images/services-students.jpg',
    checks: ['Free to post', 'Reach the whole campus', 'Get reviewed'],
    primary: { to: '/services/create', label: 'Post a Service' },
  },
  {
    title: 'Hire with',
    highlight: 'Confidence',
    text: `Every provider is a verified member of the ${b.universityShort} community, with real reviews from students.`,
    image: '/images/campus-hero-2.jpg',
    checks: ['Verified members', 'Real reviews', 'Message directly'],
    primary: { to: '/services/browse?sort=popular', label: 'See Top Providers' },
  },
];

function Panel({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('rounded-2xl border border-gray-200/80 bg-white shadow-card', className)}>{children}</div>;
}

function SeeAll({ to }: { to: string }) {
  return (
    <Link to={to} className="group flex items-center gap-1 text-[15px] font-semibold text-brand-700 hover:text-brand-800">
      See All <LuArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
    </Link>
  );
}

function EventDate({ iso }: { iso: string }) {
  const d = new Date(iso);
  return (
    <span className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-gradient-to-br from-brand-600 to-brand-900 text-white shadow-sm">
      <span className="text-[10px] font-semibold tracking-wider uppercase text-accent-300">{d.toLocaleDateString(undefined, { month: 'short' })}</span>
      <span className="text-xl leading-none font-extrabold">{d.getDate()}</span>
    </span>
  );
}

export default function ServicesHomePage() {
  useDocumentTitle('Services Hub');
  const brand = useBrand();
  const SLIDES = slidesFor(brand);

  const categoriesQ = useQuery({ queryKey: ['service-categories'], queryFn: () => categoriesApi.getServiceCategories(), staleTime: 5 * 60_000 });
  const featuredQ = useQuery({
    queryKey: ['services', 'featured'],
    queryFn: () => servicesApi.getServices({ limit: 8, sort: 'newest' }),
    refetchInterval: LIVE_REFRESH_MS,
    refetchOnWindowFocus: true,
  });
  const fresh = useNewArrivals(featuredQ.data?.data.map((s) => s.id));
  const events = useUpcomingEvents(3);
  const stats = usePublicStats();

  const categories = categoriesQ.data ?? [];
  const shown = categories.slice(0, 15);

  return (
    <div className="mx-auto max-w-[1440px] space-y-6">
      <HubHero slides={SLIDES} script={['Talents', 'at Your', 'Service!']} label="Services Hub highlights" />

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-6">
          {/* Browse by category */}
          <section aria-labelledby="browse-cats">
            <div className="mb-4 flex items-center justify-between">
              <h2 id="browse-cats" className="flex items-center gap-2.5 text-2xl font-bold text-gray-900">
                <LuLayoutGrid className="h-6 w-6 text-brand-600" /> Browse by Category
              </h2>
              <SeeAll to="/services/browse" />
            </div>
            {categoriesQ.isLoading ? (
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-8">
                {Array.from({ length: 16 }).map((_, n) => (
                  <Skeleton key={n} className="h-[96px] rounded-xl" />
                ))}
              </div>
            ) : (
              <div className="stagger grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-8">
                {shown.map((c) => {
                  const [, Icon, tone] = lookFor(c);
                  return (
                    <Link
                      key={c.id}
                      to={`/services/browse?category=${c.slug}`}
                      className="group flex h-[96px] flex-col items-center justify-center gap-2 rounded-xl border border-gray-200/70 bg-white px-2 text-center shadow-card transition-all duration-300 hover:-translate-y-1 hover:border-brand-200 hover:shadow-raised"
                    >
                      <span className={cn('flex h-10 w-10 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6', tone)}>
                        <Icon className="h-[22px] w-[22px]" />
                      </span>
                      <span className="line-clamp-2 text-[12.5px] leading-tight font-semibold text-gray-800">{c.name}</span>
                    </Link>
                  );
                })}
                <Link
                  to="/services/browse"
                  className="group flex h-[96px] flex-col items-center justify-center gap-2 rounded-xl border border-gray-200/70 bg-white shadow-card transition-all duration-300 hover:-translate-y-1 hover:border-brand-200 hover:shadow-raised"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600 transition-transform group-hover:scale-110">
                    <LuEllipsis className="h-6 w-6" />
                  </span>
                  <span className="text-[12.5px] font-semibold text-gray-800">More Services</span>
                </Link>
              </div>
            )}
          </section>

          {/* Featured providers */}
          <section aria-labelledby="featured-providers">
            <div className="mb-4 flex items-center justify-between">
              <h2 id="featured-providers" className="flex items-center gap-2 text-2xl font-bold text-gray-900">
                <LuStar className="h-6 w-6 fill-accent-400 text-accent-400" /> Featured Service Providers
              </h2>
              <SeeAll to="/services/browse" />
            </div>
            {featuredQ.isLoading ? (
              <CardGridSkeleton count={4} columns={4} />
            ) : featuredQ.error ? (
              <Panel>
                <ErrorState message={getErrorMessage(featuredQ.error, "Couldn't load services")} onRetry={() => featuredQ.refetch()} />
              </Panel>
            ) : !featuredQ.data?.data.length ? (
              <Panel>
                <EmptyState icon={<LuBriefcase />} title="No services yet" message="Be the first to offer your skills to the campus." />
              </Panel>
            ) : (
              <div className="stagger grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                {featuredQ.data.data.map((s) => (
                  <ProviderCard key={s.id} service={s} isNew={fresh.has(s.id)} />
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Right rail */}
        <aside className="stagger grid gap-5 sm:grid-cols-2 xl:grid-cols-1" aria-label="About the Services Hub">
          <Panel className="p-5">
            <p className="text-lg font-bold text-gray-900">Why Use Our Platform?</p>
            <ul className="mt-4 space-y-4">
              {['Connect with verified students', 'Get quality services at fair prices', `Support fellow ${brand.universityShort} students`].map((t) => (
                <li key={t} className="flex items-start gap-3 text-sm text-gray-700">
                  <LuCircleCheck className="h-6 w-6 shrink-0 fill-emerald-500 text-white dark:text-gray-50" /> {t}
                </li>
              ))}
            </ul>
          </Panel>

          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-800 to-brand-950 p-5 text-white shadow-raised">
            <div className="absolute -right-8 -bottom-10 h-36 w-36 rounded-full bg-accent-400/15 blur-2xl" />
            <LuSend className="animate-float absolute top-5 right-5 h-11 w-11 text-white" aria-hidden="true" />
            <p className="relative max-w-[70%] text-xl leading-tight font-extrabold">Post Your Service Today!</p>
            <Link
              to="/services/create"
              className="group relative mt-4 inline-flex h-11 items-center gap-2 rounded-xl bg-accent-400 px-5 font-bold text-brand-950 transition-all hover:bg-accent-300 active:scale-95"
            >
              Create Ad <LuArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <svg viewBox="0 0 200 20" preserveAspectRatio="none" className="absolute inset-x-0 bottom-0 h-3 w-full" aria-hidden="true">
              <path d="M0 20 C60 2 140 2 200 12 V20 Z" style={{ fill: 'var(--color-accent-400)' }} />
            </svg>
          </div>

          <Panel className="p-5 sm:col-span-2 xl:col-span-1">
            <p className="flex items-center gap-2 font-bold text-gray-900">
              <LuCalendarDays className="h-5 w-5 text-brand-700" /> Upcoming Events
            </p>
            {events.isLoading ? (
              <div className="mt-4 space-y-3">
                {[0, 1, 2].map((n) => (
                  <Skeleton key={n} className="h-14 rounded-xl" />
                ))}
              </div>
            ) : events.data?.length ? (
              <ul className="mt-3 divide-y divide-gray-100">
                {events.data.map((e) => (
                  <li key={e.id} className="flex items-center gap-3 py-3">
                    <EventDate iso={e.startsAt} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-gray-900" title={e.title}>
                        {e.title}
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(e.startsAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} •{' '}
                        {new Date(e.startsAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                      </p>
                      {e.location && (
                        <p className="flex items-center gap-1 truncate text-xs text-gray-500">
                          <LuMapPin className="h-3 w-3 shrink-0" /> {e.location}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-gray-500">No upcoming events right now. Check back soon.</p>
            )}
          </Panel>
        </aside>
      </div>

      {/* Community in numbers (live) */}
      <section className="grid gap-4 rounded-2xl border border-brand-100 bg-brand-50/70 p-5 sm:grid-cols-2 lg:grid-cols-4 lg:items-center dark:border-gray-200" aria-label="Community in numbers">
        {[
          { icon: LuUsers, value: stats.data ? compactNumber(stats.data.activeMembers) : '–', label: 'Active Members' },
          { icon: LuHandshake, value: stats.data ? compactNumber(stats.data.serviceProviders) : '–', label: 'Service Providers' },
          {
            icon: LuStar,
            value: stats.data?.averageRating ? `${stats.data.averageRating}/5` : 'New',
            label: stats.data?.reviewCount ? `From ${compactNumber(stats.data.reviewCount)} reviews` : 'Be the first to review',
            star: true,
          },
        ].map((x) => (
          <div key={x.label} className="flex items-center gap-4 lg:border-r lg:border-brand-100 dark:lg:border-gray-200">
            <x.icon className={cn('h-9 w-9 shrink-0 text-brand-700', x.star && 'fill-accent-400 text-accent-400')} />
            <div>
              <p className="text-2xl font-extrabold text-brand-900 tabular-nums dark:text-white">{x.value}</p>
              <p className="text-sm text-brand-800/80 dark:text-gray-600">{x.label}</p>
            </div>
          </div>
        ))}
        <p className="font-script text-center text-2xl text-brand-900 dark:text-white">
          Together for a Better Campus Life
          <svg viewBox="0 0 160 14" className="mx-auto mt-0.5 block h-3 w-36 text-accent-400" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" aria-hidden="true">
            <path d="M4 10 C50 2 110 2 156 8" />
          </svg>
        </p>
      </section>
    </div>
  );
}
