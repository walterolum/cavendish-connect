import { FormEvent, ReactNode, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  FiArrowRight,
  FiBriefcase,
  FiCheckCircle,
  FiFlag,
  FiHome,
  FiMessageSquare,
  FiPackage,
  FiSearch,
  FiShield,
} from 'react-icons/fi';
import { marketplaceApi, categoriesApi } from '../../services/marketplace.service';
import { servicesApi, accommodationApi } from '../../services/listing.service';
import { useAuthStore } from '../../store/auth';
import { useDocumentTitle } from '../../lib/hooks';
import ListingCard from '../../components/listing/ListingCard';
import ServiceCard from '../../components/listing/ServiceCard';
import PropertyCard from '../../components/listing/PropertyCard';
import { Button, ButtonLink } from '../../components/ui/button';
import { CardGrid, SectionHeader } from '../../components/ui/page';
import { CardGridSkeleton, EmptyState } from '../../components/ui/loading';

function Row<T>({
  title,
  description,
  to,
  loading,
  items,
  render,
  emptyIcon,
  emptyText,
  createTo,
}: {
  title: string;
  description: string;
  to: string;
  loading: boolean;
  items?: T[];
  render: (item: T) => ReactNode;
  emptyIcon: ReactNode;
  emptyText: string;
  createTo: string;
}) {
  return (
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <SectionHeader title={title} description={description} to={to} />
      {loading ? (
        <CardGridSkeleton count={4} />
      ) : items?.length ? (
        <CardGrid>{items.map(render)}</CardGrid>
      ) : (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white">
          <EmptyState icon={emptyIcon} title="Nothing here yet" message={emptyText}>
            <ButtonLink to={createTo} variant="outline">
              Post the first one
            </ButtonLink>
          </EmptyState>
        </div>
      )}
    </section>
  );
}

export default function HomePage() {
  useDocumentTitle();
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [q, setQ] = useState('');

  const listings = useQuery({ queryKey: ['marketplace', 'home'], queryFn: () => marketplaceApi.getListings({ limit: 8, sort: 'newest' }) });
  const services = useQuery({ queryKey: ['services', 'home'], queryFn: () => servicesApi.getServices({ limit: 4, sort: 'newest' }) });
  const properties = useQuery({ queryKey: ['accommodation', 'home'], queryFn: () => accommodationApi.getProperties({ limit: 4, sort: 'newest' }) });
  const { data: categories = [] } = useQuery({
    queryKey: ['marketplace', 'categories'],
    queryFn: () => categoriesApi.getCategories(),
    staleTime: 5 * 60_000,
  });

  const search = (e: FormEvent) => {
    e.preventDefault();
    navigate(q.trim() ? `/explore?q=${encodeURIComponent(q.trim())}` : '/explore');
  };

  const pillars = [
    { to: '/marketplace', icon: FiPackage, title: 'Marketplace', body: 'Books, gadgets, furniture and more', count: listings.data?.meta?.total },
    { to: '/services', icon: FiBriefcase, title: 'Services', body: 'Tutors, designers, technicians', count: services.data?.meta?.total },
    { to: '/accommodation', icon: FiHome, title: 'Accommodation', body: 'Hostels and rooms near campus', count: properties.data?.meta?.total },
  ];

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden bg-brand-950">
        <div
          className="absolute inset-0 bg-[radial-gradient(70%_80%_at_80%_0%,rgba(59,99,236,0.55),transparent),radial-gradient(50%_60%_at_0%_100%,rgba(255,200,31,0.2),transparent)]"
          aria-hidden="true"
        />
        <div
          className="absolute inset-0 opacity-[0.07] [background-image:linear-gradient(white_1px,transparent_1px),linear-gradient(90deg,white_1px,transparent_1px)] [background-size:48px_48px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]"
          aria-hidden="true"
        />
        <div className="relative mx-auto max-w-7xl px-4 pb-16 pt-14 sm:px-6 sm:pb-24 sm:pt-20 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-brand-100 backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-accent-400" />
              The Cavendish University community marketplace
            </span>
            <h1 className="mt-6 text-4xl font-extrabold leading-[1.08] text-white sm:text-5xl lg:text-6xl">
              Buy, sell and find what you need —{' '}
              <span className="bg-gradient-to-r from-accent-200 to-accent-400 bg-clip-text text-transparent">right on campus.</span>
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-base text-brand-100/90 sm:text-lg">
              Second-hand items, trusted services and student accommodation from people you can actually meet.
            </p>

            <form onSubmit={search} className="mx-auto mt-9 flex max-w-xl items-center gap-2 rounded-2xl bg-white p-2 shadow-overlay" role="search">
              <FiSearch className="ml-3 h-5 w-5 shrink-0 text-gray-400" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Try “laptop”, “tutor” or “hostel”"
                aria-label="Search CAV CONNECT"
                className="h-11 min-w-0 flex-1 bg-transparent text-[15px] text-gray-900 placeholder:text-gray-400 focus:outline-none"
              />
              <Button type="submit" size="md">
                Search
              </Button>
            </form>

            {categories.length > 0 && (
              <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
                {categories.slice(0, 6).map((cat) => (
                  <Link
                    key={cat.id}
                    to={`/marketplace/browse?category=${cat.slug}`}
                    className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-sm text-white/90 backdrop-blur transition-colors hover:bg-white/15"
                  >
                    {cat.name}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Three pillars */}
      <section className="relative z-10 mx-auto -mt-10 max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-3 sm:grid-cols-3 sm:gap-4">
          {pillars.map((p) => (
            <Link
              key={p.to}
              to={p.to}
              className="group flex items-center gap-4 rounded-2xl border border-gray-200/80 bg-white p-5 shadow-raised transition-all hover:-translate-y-0.5"
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-700 transition-colors group-hover:bg-brand-600 group-hover:text-white">
                <p.icon className="h-6 w-6" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline gap-2">
                  <span className="font-semibold text-gray-900">{p.title}</span>
                  {p.count !== undefined && <span className="text-xs text-gray-400 tabular-nums">{p.count}</span>}
                </span>
                <span className="block truncate text-sm text-gray-500">{p.body}</span>
              </span>
              <FiArrowRight className="h-5 w-5 text-gray-300 transition-all group-hover:translate-x-0.5 group-hover:text-brand-600" />
            </Link>
          ))}
        </div>
      </section>

      <Row
        title="Fresh in the marketplace"
        description="The latest items from the community"
        to="/marketplace"
        loading={listings.isLoading}
        items={listings.data?.data}
        render={(l) => <ListingCard key={l.id} listing={l} />}
        emptyIcon={<FiPackage />}
        emptyText="No items for sale yet."
        createTo="/marketplace/create"
      />
      <Row
        title="Services from students"
        description="Skills you can book this week"
        to="/services"
        loading={services.isLoading}
        items={services.data?.data}
        render={(s) => <ServiceCard key={s.id} service={s} />}
        emptyIcon={<FiBriefcase />}
        emptyText="No services offered yet."
        createTo="/services/create"
      />
      <Row
        title="Places to stay"
        description="Accommodation close to campus"
        to="/accommodation"
        loading={properties.isLoading}
        items={properties.data?.data}
        render={(p) => <PropertyCard key={p.id} property={p} />}
        emptyIcon={<FiHome />}
        emptyText="No accommodation listed yet."
        createTo="/accommodation/create"
      />

      {/* Trust */}
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-6 rounded-3xl border border-gray-200/80 bg-white p-6 shadow-card sm:p-10 lg:grid-cols-[1fr_1.4fr] lg:gap-12">
          <div>
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
              <FiShield className="h-6 w-6" />
            </span>
            <h2 className="mt-5 text-2xl font-bold text-gray-900 sm:text-3xl">Built for trust</h2>
            <p className="mt-3 text-gray-600">
              Every post is checked by moderators before it goes live, and anyone can report a problem in two taps.
            </p>
          </div>
          <ul className="grid gap-5 sm:grid-cols-2">
            {[
              { icon: FiCheckCircle, title: 'Moderated posts', body: 'New and edited posts are reviewed before they appear.' },
              { icon: FiShield, title: 'Verified members', body: 'Students, landlords and providers can get a verified badge.' },
              { icon: FiMessageSquare, title: 'Private messaging', body: 'Agree details in-app without sharing your number.' },
              { icon: FiFlag, title: 'Report anything', body: 'Scams and fake listings are removed quickly.' },
            ].map((item) => (
              <li key={item.title} className="flex gap-3">
                <item.icon className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" />
                <span>
                  <span className="block font-semibold text-gray-900">{item.title}</span>
                  <span className="mt-0.5 block text-sm text-gray-600">{item.body}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-7xl px-4 pb-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-700 to-brand-950 px-6 py-12 text-center sm:px-12 sm:py-16">
          <div className="absolute inset-0 bg-[radial-gradient(60%_80%_at_50%_0%,rgba(255,200,31,0.2),transparent)]" aria-hidden="true" />
          <div className="relative">
            <h2 className="text-2xl font-bold text-white sm:text-3xl">Got something to sell, offer or rent?</h2>
            <p className="mx-auto mt-3 max-w-lg text-brand-100">Post it in a couple of minutes. It's free.</p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <ButtonLink to={isAuthenticated ? '/post' : '/login?redirect=%2Fpost'} variant="inverse" size="lg">
                {isAuthenticated ? 'Post something' : 'Log in to post'}
              </ButtonLink>
              <ButtonLink to="/explore" size="lg" className="bg-white/10 text-white shadow-none hover:bg-white/20">
                Explore first
              </ButtonLink>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
