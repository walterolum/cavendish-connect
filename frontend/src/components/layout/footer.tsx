import { Link } from 'react-router-dom';
import { FiMail, FiPhone, FiShield } from 'react-icons/fi';
import { usePublicSettings } from '../../lib/settings';
import { Logo } from './logo';

const columns = [
  {
    title: 'Discover',
    links: [
      { to: '/marketplace', label: 'Campus Market' },
      { to: '/services', label: 'Services' },
      { to: '/accommodation', label: 'Accommodation' },
      { to: '/explore', label: 'Search everything' },
    ],
  },
  {
    title: 'Sell & offer',
    links: [
      { to: '/marketplace/create', label: 'Sell an item' },
      { to: '/services/create', label: 'Offer a service' },
      { to: '/accommodation/create', label: 'List accommodation' },
      { to: '/dashboard', label: 'Manage my posts' },
    ],
  },
  {
    title: 'Account',
    links: [
      { to: '/profile', label: 'Profile & verification' },
      { to: '/messages', label: 'Messages' },
      { to: '/favorites', label: 'Saved items' },
      { to: '/notifications', label: 'Notifications' },
    ],
  },
];

export function Footer() {
  const { data: settings } = usePublicSettings();
  const name = settings?.platformName || 'CAV CONNECT';
  return (
    <footer className="mt-16 border-t border-gray-200 bg-white pb-20 md:pb-0">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-10 md:grid-cols-5">
          <div className="col-span-2">
            <Logo />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-gray-600">
              The trusted marketplace and community platform for the Cavendish University Uganda community.
            </p>
            <div className="mt-5 flex max-w-xs items-start gap-2.5 rounded-xl bg-emerald-50 p-3 text-xs leading-relaxed text-emerald-800">
              <FiShield className="mt-0.5 h-4 w-4 shrink-0" />
              Meet in public campus spaces, inspect before you pay, and report anything suspicious.
            </div>
            {(settings?.contactEmail || settings?.contactPhone) && (
              <div className="mt-5 space-y-1.5 text-sm">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-900">Support</p>
                {settings.contactEmail && (
                  <a href={`mailto:${settings.contactEmail}`} className="flex items-center gap-2 text-gray-600 hover:text-brand-700">
                    <FiMail className="h-4 w-4 shrink-0" /> {settings.contactEmail}
                  </a>
                )}
                {settings.contactPhone && (
                  <a href={`tel:${settings.contactPhone.replace(/\s/g, '')}`} className="flex items-center gap-2 text-gray-600 hover:text-brand-700">
                    <FiPhone className="h-4 w-4 shrink-0" /> {settings.contactPhone}
                  </a>
                )}
              </div>
            )}
          </div>
          {columns.map((col) => (
            <div key={col.title}>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-900">{col.title}</h3>
              <ul className="mt-4 space-y-2.5 text-sm">
                {col.links.map((l) => (
                  <li key={l.to}>
                    <Link to={l.to} className="text-gray-600 transition-colors hover:text-brand-700">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-2 border-t border-gray-100 pt-6 text-xs text-gray-500 sm:flex-row">
          <p>© {new Date().getFullYear()} {name}. An independent community platform.</p>
          <p className="font-medium text-gray-400">{settings?.tagline || 'Connect · Buy · Sell · Serve · Find'}</p>
        </div>
      </div>
    </footer>
  );
}
