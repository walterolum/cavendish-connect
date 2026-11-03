import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  LuChevronDown,
  LuFlag,
  LuHandshake,
  LuHotel,
  LuKeyRound,
  LuMail,
  LuPhone,
  LuShieldCheck,
  LuShoppingBag,
  LuUserCheck,
} from 'react-icons/lu';
import { useDocumentTitle } from '../../lib/hooks';
import { Brand, useBrand, usePublicSettings } from '../../lib/settings';
import { cn } from '../../lib/utils';

const TOPICS = [
  { icon: LuUserCheck, title: 'Getting an account', text: 'Accounts are created by the admin office, not by sign-up.', href: '#account' },
  { icon: LuShieldCheck, title: 'Staying safe', text: 'How to meet, inspect and pay without surprises.', href: '#safety' },
  { icon: LuShoppingBag, title: 'Buying & selling', text: 'Posting ads, reviews and what happens after you post.', href: '#faq' },
  { icon: LuHotel, title: 'Accommodation', text: 'Finding a room and listing a property.', href: '#faq' },
  { icon: LuFlag, title: 'Reporting a problem', text: 'Flag scams, fake listings or harassment.', href: '#report' },
];

const safetyFor = (b: Brand) => [
  'Meet in busy, public places on campus, such as the library entrance or main reception, during the day.',
  'Inspect the item or room before paying. Never pay a deposit for a room you have not seen.',
  `Keep conversations in ${b.appName} messages, so there is a record if something goes wrong.`,
  'Be wary of prices that look too good, pressure to pay quickly, or requests to pay to a third party.',
  'Bring a friend when viewing accommodation and tell someone where you are going.',
];

const faqFor = (b: Brand) => [
  {
    q: 'How do I get an account?',
    a: `Visit or contact the ${b.appName} admin office with your student or staff ID (or business or property details). An admin creates your account and gives you a temporary password. The first time you sign in, you choose your own.`,
    id: 'account',
  },
  {
    q: 'I forgot my password. What do I do?',
    a: 'Contact the admin office. They will issue a new temporary password, and you will set a new one when you sign in.',
  },
  {
    q: 'Why is my post "In review"?',
    a: 'Every new or edited post is checked by our team before it goes live, usually within a day. You will get a notification when it is approved, or a reason if it is not.',
  },
  {
    q: 'What does the verified badge mean?',
    a: 'The admin team has confirmed that this member is who they say they are (for example a current student, a landlord or a registered business). You can request verification from your profile page.',
  },
  {
    q: `Is ${b.appName} involved in payments?`,
    a: 'No. Buyers and sellers agree on payment directly. Always inspect first and avoid paying in advance to people you have not met.',
  },
  {
    q: 'How do I list a room or hostel?',
    a: 'Sign in with a landlord account and choose "List your place" on the Accommodation page. Add clear photos, the monthly rent and the rooms available.',
  },
  {
    q: 'My account was deactivated. Why?',
    a: 'Accounts can be deactivated for breaking the community rules, for example after confirmed scam reports. Contact the admin office to discuss it.',
  },
];

export default function HelpPage() {
  useDocumentTitle('Help & Support');
  const brand = useBrand();
  const SAFETY = safetyFor(brand);
  const FAQ = faqFor(brand);
  const { data: settings } = usePublicSettings();
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="stagger text-center">
        <p className="text-sm font-semibold text-accent-600">Help & Support</p>
        <h1 className="mt-2 text-3xl font-extrabold text-gray-900 sm:text-5xl">How can we help?</h1>
        <p className="mx-auto mt-3 max-w-xl text-gray-500">Answers about accounts, safe trading, accommodation and reporting problems.</p>
      </header>

      <nav className="stagger mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-5" aria-label="Help topics">
        {TOPICS.map((t) => (
          <a key={t.title} href={t.href} className="lift group rounded-2xl border border-gray-200/80 bg-white p-4 shadow-card">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-700 transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6">
              <t.icon className="h-5 w-5" />
            </span>
            <p className="mt-3 text-sm font-semibold text-gray-900">{t.title}</p>
            <p className="mt-1 text-xs leading-relaxed text-gray-500">{t.text}</p>
          </a>
        ))}
      </nav>

      <section id="safety" className="mt-12 scroll-mt-24 overflow-hidden rounded-3xl bg-gradient-to-br from-brand-800 to-brand-950 p-6 text-white sm:p-10">
        <h2 className="flex items-center gap-3 text-2xl font-bold">
          <LuHandshake className="h-7 w-7 text-accent-400" /> Trade safely on campus
        </h2>
        <ol className="stagger mt-6 grid gap-4 sm:grid-cols-2">
          {SAFETY.map((tip, n) => (
            <li key={n} className="flex gap-3 rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-400 text-sm font-bold text-brand-950">{n + 1}</span>
              <span className="text-sm leading-relaxed text-white/90">{tip}</span>
            </li>
          ))}
        </ol>
      </section>

      <section id="faq" className="mt-12 scroll-mt-24">
        <h2 className="text-2xl font-bold text-gray-900">Frequently asked questions</h2>
        <div className="mt-5 divide-y divide-gray-200 overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-card">
          {FAQ.map((f, n) => {
            const isOpen = open === n;
            return (
              <div key={f.q} id={f.id} className="scroll-mt-24">
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : n)}
                  aria-expanded={isOpen}
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left font-semibold text-gray-900 transition-colors hover:bg-gray-50"
                >
                  {f.q}
                  <LuChevronDown className={cn('h-5 w-5 shrink-0 text-gray-400 transition-transform duration-300', isOpen && 'rotate-180 text-brand-600')} />
                </button>
                <div className={cn('grid transition-[grid-template-rows] duration-300 ease-out', isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}>
                  <p className="overflow-hidden px-5 text-sm leading-relaxed text-gray-600">
                    <span className="block pb-5">{f.a}</span>
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="mt-12 grid gap-5 md:grid-cols-2">
        <div id="report" className="scroll-mt-24 rounded-2xl border border-red-100 bg-red-50/60 p-6 dark:bg-gray-50">
          <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900">
            <LuFlag className="h-5 w-5 text-red-600" /> Report something
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-gray-600">
            Open the listing, service, property or profile and choose <span className="font-semibold">Report</span>. Our moderators review
            every report and you'll be told the outcome. In an emergency, contact campus security first.
          </p>
        </div>
        <div className="rounded-2xl border border-gray-200/80 bg-white p-6 shadow-card">
          <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900">
            <LuKeyRound className="h-5 w-5 text-brand-700" /> Contact the admin office
          </h2>
          <p className="mt-2 text-sm text-gray-600">For accounts, password resets and anything else.</p>
          <div className="mt-4 space-y-2 text-sm">
            {settings?.contactEmail && (
              <a href={`mailto:${settings.contactEmail}`} className="flex items-center gap-2 font-medium text-brand-700 hover:text-brand-800">
                <LuMail className="h-4 w-4" /> {settings.contactEmail}
              </a>
            )}
            {settings?.contactPhone && (
              <a href={`tel:${settings.contactPhone.replace(/\s/g, '')}`} className="flex items-center gap-2 font-medium text-brand-700 hover:text-brand-800">
                <LuPhone className="h-4 w-4" /> {settings.contactPhone}
              </a>
            )}
            {!settings?.contactEmail && !settings?.contactPhone && <p className="text-gray-500">Contact details will appear here.</p>}
          </div>
          <Link to="/register" className="mt-4 inline-block text-sm font-semibold text-gray-700 underline-offset-4 hover:underline">
            How accounts work →
          </Link>
        </div>
      </section>
    </div>
  );
}
