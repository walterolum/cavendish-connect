import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  LuArrowRight,
  LuBedDouble,
  LuBedSingle,
  LuBuilding2,
  LuDoorOpen,
  LuHeadphones,
  LuHotel,
  LuHouse,
  LuKeyRound,
  LuLayoutGrid,
  LuMapPin,
  LuMinus,
  LuPlus,
  LuSearch,
  LuShieldCheck,
  LuSofa,
  LuUsers,
  LuWallet,
  LuCalendarCheck,
} from 'react-icons/lu';
import { accommodationApi } from '../../services/listing.service';
import { api, getErrorMessage } from '../../lib/api';
import { useDocumentTitle, useNewArrivals, LIVE_REFRESH_MS } from '../../lib/hooks';
import { cn, formatMoney } from '../../lib/utils';
import { PROPERTY_TYPE_LABELS } from '../../lib/labels';
import PropertyCard from '../../components/listing/PropertyCard';
import { CardGridSkeleton, EmptyState, ErrorState } from '../../components/ui/loading';
import { ButtonLink } from '../../components/ui/button';

const TYPES = [
  { key: '', label: 'All stays', icon: LuLayoutGrid },
  { key: 'HOSTEL', label: 'Hostels', icon: LuHotel },
  { key: 'SINGLE_ROOM', label: 'Single rooms', icon: LuBedSingle },
  { key: 'SHARED_ROOM', label: 'Shared rooms', icon: LuUsers },
  { key: 'BEDSITTER', label: 'Bedsitters', icon: LuDoorOpen },
  { key: 'APARTMENT', label: 'Apartments', icon: LuBuilding2 },
  { key: 'HOUSE', label: 'Houses', icon: LuHouse },
  { key: 'furnished', label: 'Furnished', icon: LuSofa },
  { key: 'popular', label: 'Trending', icon: LuBedDouble },
];

const BUDGETS = [
  { value: '', label: 'Any budget' },
  { value: '200000', label: `Up to ${formatMoney(200000)}` },
  { value: '350000', label: `Up to ${formatMoney(350000)}` },
  { value: '500000', label: `Up to ${formatMoney(500000)}` },
  { value: '800000', label: `Up to ${formatMoney(800000)}` },
  { value: '1200000', label: `Up to ${formatMoney(1200000)}` },
];

const TRUST = [
  { icon: LuShieldCheck, title: 'Checked listings', text: 'Every place is reviewed by our team before it goes live.' },
  { icon: LuCalendarCheck, title: 'Flexible viewing', text: 'Message landlords directly and arrange a viewing that suits you.' },
  { icon: LuHeadphones, title: 'Campus support', text: 'The Cavendish Connect team is here if anything goes wrong.' },
  { icon: LuKeyRound, title: 'List your place', text: 'Landlords: reach hundreds of Cavendish students every term.', to: '/accommodation/create' },
];

function SearchField({ icon: Icon, label, children, className }: { icon: typeof LuMapPin; label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn('group flex min-w-0 flex-1 cursor-text items-start gap-3 rounded-2xl px-4 py-3 transition-colors hover:bg-gray-50', className)}>
      <Icon className="mt-0.5 h-5 w-5 shrink-0 text-gray-500 transition-colors group-focus-within:text-brand-600" />
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-semibold text-gray-900">{label}</span>
        {children}
      </span>
    </label>
  );
}

export default function StaysHomePage() {
  useDocumentTitle('Accommodation');
  const navigate = useNavigate();
  const [where, setWhere] = useState('');
  const [type, setType] = useState('');
  const [budget, setBudget] = useState('');
  const [rooms, setRooms] = useState(1);
  const [tab, setTab] = useState('');
  const [email, setEmail] = useState('');
  const [subscribing, setSubscribing] = useState(false);

  const featuredQuery = {
    limit: 8,
    sort: tab === 'popular' ? 'popular' : 'newest',
    propertyType: tab && tab !== 'furnished' && tab !== 'popular' ? tab : undefined,
    isFurnished: tab === 'furnished' ? 'true' : undefined,
  };
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['accommodation', 'featured', featuredQuery],
    queryFn: () => accommodationApi.getProperties(featuredQuery),
    refetchInterval: LIVE_REFRESH_MS,
    refetchOnWindowFocus: true,
  });
  const fresh = useNewArrivals(data?.data.map((p) => p.id));

  const search = (e: FormEvent) => {
    e.preventDefault();
    const q = new URLSearchParams();
    if (where.trim()) q.set('location', where.trim());
    if (type) q.set('propertyType', type);
    if (budget) q.set('maxPrice', budget);
    if (rooms > 1) q.set('minRooms', String(rooms));
    navigate(`/accommodation/search${q.toString() ? `?${q}` : ''}`);
  };

  const subscribe = async (e: FormEvent) => {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      toast.error('Please enter a valid email address');
      return;
    }
    setSubscribing(true);
    try {
      const res = await api.post('/newsletter', { email: email.trim() });
      toast.success(res.data?.message ?? "You're subscribed");
      setEmail('');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not subscribe right now'));
    } finally {
      setSubscribing(false);
    }
  };

  const seeAll = `/accommodation/search${featuredQuery.propertyType ? `?propertyType=${featuredQuery.propertyType}` : tab === 'furnished' ? '?isFurnished=true' : tab === 'popular' ? '?sort=popular' : ''}`;

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <img
          src="/images/stays-hero-alt.jpg"
          alt=""
          className="animate-ken-burns absolute inset-0 h-full w-full object-cover object-[65%_center]"
          fetchPriority="high"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-white/95 via-white/70 via-35% to-transparent to-65% dark:from-canvas/95 dark:via-canvas/70" />
        <div className="relative mx-auto max-w-7xl px-4 pt-14 pb-28 sm:px-6 sm:pt-20 sm:pb-36 lg:px-8">
          <div className="stagger max-w-xl">
            <p className="text-sm font-semibold text-accent-600 dark:text-accent-400">Live near campus. Feel at home.</p>
            <h1 className="mt-3 text-4xl leading-[1.05] font-extrabold text-brand-950 sm:text-[56px] dark:text-white">
              Find your perfect stay near Cavendish
            </h1>
            <p className="mt-5 max-w-md text-base text-gray-700 sm:text-lg dark:text-gray-700">
              Hostels, rooms and apartments around Kampala, listed by trusted landlords and checked by our team.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink to="/accommodation/search" size="lg" className="group">
                Explore stays <LuArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </ButtonLink>
              <ButtonLink to="/accommodation/create" size="lg" variant="outline">
                List your place
              </ButtonLink>
            </div>
          </div>
        </div>
      </section>

      {/* Floating search */}
      <div className="relative z-10 mx-auto -mt-16 max-w-6xl px-4 sm:-mt-20 sm:px-6 lg:px-8">
        <form
          onSubmit={search}
          className="animate-fade-up flex flex-col gap-1 rounded-3xl border border-gray-200/80 bg-white p-2 shadow-overlay [animation-delay:250ms] md:flex-row md:items-center"
          role="search"
          aria-label="Search accommodation"
        >
          <SearchField icon={LuMapPin} label="Where">
            <input
              value={where}
              onChange={(e) => setWhere(e.target.value)}
              placeholder="Anywhere near campus"
              className="mt-0.5 w-full bg-transparent text-sm text-gray-700 outline-none placeholder:text-gray-400"
            />
          </SearchField>
          <span className="hidden h-10 w-px bg-gray-200 md:block" />
          <SearchField icon={LuHotel} label="Type">
            <select value={type} onChange={(e) => setType(e.target.value)} className="mt-0.5 w-full cursor-pointer bg-transparent text-sm text-gray-700 outline-none">
              <option value="">Any type</option>
              {Object.entries(PROPERTY_TYPE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </SearchField>
          <span className="hidden h-10 w-px bg-gray-200 md:block" />
          <SearchField icon={LuWallet} label="Monthly budget">
            <select value={budget} onChange={(e) => setBudget(e.target.value)} className="mt-0.5 w-full cursor-pointer bg-transparent text-sm text-gray-700 outline-none">
              {BUDGETS.map((b) => (
                <option key={b.value} value={b.value}>
                  {b.label}
                </option>
              ))}
            </select>
          </SearchField>
          <span className="hidden h-10 w-px bg-gray-200 md:block" />
          <div className="flex flex-1 items-center gap-3 rounded-2xl px-4 py-3">
            <LuUsers className="h-5 w-5 shrink-0 text-gray-500" />
            <span className="flex-1">
              <span className="block text-xs font-semibold text-gray-900">Rooms needed</span>
              <span className="mt-0.5 flex items-center gap-3 text-sm text-gray-700">
                <button type="button" onClick={() => setRooms((r) => Math.max(1, r - 1))} disabled={rooms <= 1} className="flex h-6 w-6 items-center justify-center rounded-full border border-gray-300 text-gray-600 transition hover:border-gray-900 disabled:opacity-30" aria-label="Fewer rooms">
                  <LuMinus className="h-3 w-3" />
                </button>
                <span className="w-14 text-center tabular-nums">{rooms} room{rooms > 1 ? 's' : ''}</span>
                <button type="button" onClick={() => setRooms((r) => Math.min(10, r + 1))} className="flex h-6 w-6 items-center justify-center rounded-full border border-gray-300 text-gray-600 transition hover:border-gray-900" aria-label="More rooms">
                  <LuPlus className="h-3 w-3" />
                </button>
              </span>
            </span>
          </div>
          <button
            type="submit"
            className="flex h-14 shrink-0 items-center justify-center gap-2 rounded-2xl bg-brand-600 px-5 font-semibold text-white shadow-lg shadow-brand-900/20 transition-all hover:scale-[1.03] hover:bg-brand-700 active:scale-95 md:w-14 md:rounded-full md:px-0"
            aria-label="Search"
          >
            <LuSearch className="h-5 w-5" />
            <span className="md:hidden">Search</span>
          </button>
        </form>
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Type tabs */}
        <nav className="no-scrollbar mt-10 flex gap-2 overflow-x-auto pb-2 sm:justify-between" aria-label="Stay types">
          {TYPES.map((t) => {
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                aria-pressed={active}
                className={cn('group flex min-w-[88px] shrink-0 flex-col items-center gap-2 px-2 pb-2 text-xs font-medium transition-colors', active ? 'text-gray-900' : 'text-gray-500 hover:text-gray-900')}
              >
                <span
                  className={cn(
                    'flex h-14 w-14 items-center justify-center rounded-full border transition-all duration-300',
                    active ? 'border-brand-200 bg-brand-50 text-brand-700 shadow-sm' : 'border-gray-200 bg-white text-gray-600 group-hover:-translate-y-1 group-hover:border-gray-300 group-hover:shadow-card'
                  )}
                >
                  <t.icon className="h-6 w-6" />
                </span>
                {t.label}
                <span className={cn('h-0.5 w-8 rounded-full bg-accent-400 transition-transform duration-300', active ? 'scale-x-100' : 'scale-x-0')} />
              </button>
            );
          })}
        </nav>

        {/* Featured stays */}
        <section className="mt-10" aria-labelledby="featured">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <h2 id="featured" className="text-2xl font-bold text-gray-900">
                {tab === 'popular' ? 'Trending stays' : 'Featured stays'}
              </h2>
              <p className="mt-1 text-sm text-gray-500">Hand-picked places students love</p>
            </div>
            <Link to={seeAll} className="group inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-brand-700 hover:text-brand-800">
              View all stays <LuArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
          {isLoading ? (
            <CardGridSkeleton count={4} columns={4} />
          ) : error ? (
            <ErrorState message={getErrorMessage(error, "Couldn't load stays")} onRetry={() => refetch()} />
          ) : !data?.data.length ? (
            <EmptyState icon={<LuHotel />} title="Nothing here yet" message="No places of this type are listed right now. Try another type." />
          ) : (
            <div key={tab} className="stagger grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {data.data.map((p) => (
                <PropertyCard key={p.id} property={p} isNew={fresh.has(p.id)} />
              ))}
            </div>
          )}
        </section>

        {/* Trust strip */}
        <section className="mt-14 grid gap-6 rounded-3xl border border-gray-200/80 bg-gray-50/80 p-6 sm:grid-cols-2 sm:p-8 lg:grid-cols-4" aria-label="Why book with us">
          {TRUST.map((t) => {
            const body = (
              <>
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white text-brand-700 shadow-card transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3">
                  <t.icon className="h-[22px] w-[22px]" />
                </span>
                <span>
                  <span className="block text-sm font-semibold text-gray-900">{t.title}</span>
                  <span className="mt-1 block text-[13px] leading-relaxed text-gray-500">{t.text}</span>
                </span>
              </>
            );
            return t.to ? (
              <Link key={t.title} to={t.to} className="group flex gap-4">
                {body}
              </Link>
            ) : (
              <div key={t.title} className="group flex gap-4">
                {body}
              </div>
            );
          })}
        </section>

        {/* Inspiration + email */}
        <section className="mt-8 mb-4 grid overflow-hidden rounded-3xl border border-gray-200/80 bg-white shadow-card md:grid-cols-[minmax(0,320px)_1fr]">
          <div className="relative h-48 overflow-hidden md:h-auto">
            <img src="/images/stays-inspire.jpg" alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-700 hover:scale-105" />
          </div>
          <div className="flex flex-col gap-6 p-6 sm:p-8 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900 sm:text-2xl">Get first pick of new rooms</h2>
              <p className="mt-1.5 max-w-md text-sm text-gray-500">
                New hostels, rooms and student deals near campus, straight to your inbox before each semester.
              </p>
            </div>
            <form onSubmit={subscribe} className="flex w-full max-w-md gap-2 lg:w-auto">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                aria-label="Email address"
                className="h-12 min-w-0 flex-1 rounded-xl border border-gray-300 bg-white px-4 text-sm text-gray-900 outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15 lg:w-64"
              />
              <button
                type="submit"
                disabled={subscribing}
                className="h-12 shrink-0 rounded-xl bg-brand-600 px-6 text-sm font-semibold text-white transition-all hover:bg-brand-700 active:scale-95 disabled:opacity-60"
              >
                {subscribing ? 'Subscribing…' : 'Subscribe'}
              </button>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
}
