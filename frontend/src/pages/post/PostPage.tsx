import { Link } from 'react-router-dom';
import { FiArrowRight, FiBriefcase, FiHome, FiPackage } from 'react-icons/fi';
import { useDocumentTitle } from '../../lib/hooks';
import { Page, PageHeader } from '../../components/ui/page';

const OPTIONS = [
  {
    to: '/marketplace/create',
    icon: FiPackage,
    title: 'Sell an item',
    body: 'Books, electronics, furniture, clothing — anything you no longer need.',
    tone: 'bg-brand-50 text-brand-700',
  },
  {
    to: '/services/create',
    icon: FiBriefcase,
    title: 'Offer a service',
    body: 'Tutoring, design, photography, repairs, events and more.',
    tone: 'bg-emerald-50 text-emerald-700',
  },
  {
    to: '/accommodation/create',
    icon: FiHome,
    title: 'List accommodation',
    body: 'Hostels, rooms and apartments for students near campus.',
    tone: 'bg-accent-50 text-accent-700',
  },
];

export default function PostPage() {
  useDocumentTitle('Post something');
  return (
    <Page width="md">
      <PageHeader
        title="What would you like to post?"
        description="Every post is checked by our moderators before it goes live, usually within a day."
      />
      <div className="grid gap-4 sm:grid-cols-3">
        {OPTIONS.map((o) => (
          <Link
            key={o.to}
            to={o.to}
            className="group flex flex-col rounded-2xl border border-gray-200/80 bg-white p-6 shadow-card transition-all hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-raised"
          >
            <span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${o.tone}`}>
              <o.icon className="h-6 w-6" />
            </span>
            <h2 className="mt-5 text-lg font-semibold text-gray-900">{o.title}</h2>
            <p className="mt-1.5 flex-1 text-sm text-gray-500">{o.body}</p>
            <span className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-brand-700">
              Start
              <FiArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>
        ))}
      </div>
    </Page>
  );
}
