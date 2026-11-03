import { FiCheckCircle, FiMail, FiPhone, FiShield, FiUserCheck } from 'react-icons/fi';
import { useDocumentTitle } from '../../lib/hooks';
import { usePublicSettings } from '../../lib/settings';
import { ButtonLink } from '../../components/ui/button';

/**
 * Self sign-up is closed: the admin office creates every account.
 * This page (at the old /register address) explains how to get one.
 */
export default function Register() {
  useDocumentTitle('Get an account');
  const { data: settings } = usePublicSettings();

  const steps = [
    { icon: FiUserCheck, title: 'Visit or contact the admin office', text: 'Bring your student or staff ID, or the details of the business or hostel you represent.' },
    { icon: FiShield, title: 'We create your account', text: 'Every member is checked first, so everyone you meet on Cavendish Connect is real.' },
    { icon: FiCheckCircle, title: 'Sign in and set your password', text: "You'll get a temporary password. The first time you sign in, you choose your own." },
  ];

  return (
    <div className="w-full max-w-[520px] animate-pop-in">
      <div className="mb-8 text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-100 px-3 py-1 text-xs font-semibold text-accent-700">
          <FiShield className="h-3.5 w-3.5" /> Verified members only
        </span>
        <h1 className="mt-4 text-[28px] font-bold text-gray-900">Accounts are issued by the admin office</h1>
        <p className="mt-2 text-[15px] text-gray-500">
          To keep the campus community safe, you can't sign yourself up. The Cavendish Connect administrator creates
          accounts for students, staff, landlords and vendors.
        </p>
      </div>

      <div className="rounded-3xl border border-gray-200/80 bg-white p-6 shadow-raised sm:p-8">
        <ol className="stagger space-y-5">
          {steps.map((s, i) => (
            <li key={s.title} className="flex gap-4">
              <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
                <s.icon className="h-5 w-5" />
                <span className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-accent-400 text-[11px] font-bold text-brand-950">
                  {i + 1}
                </span>
              </span>
              <div>
                <p className="font-semibold text-gray-900">{s.title}</p>
                <p className="mt-0.5 text-sm text-gray-500">{s.text}</p>
              </div>
            </li>
          ))}
        </ol>

        {(settings?.contactEmail || settings?.contactPhone) && (
          <div className="mt-6 grid gap-2 rounded-2xl bg-gray-50 p-4 text-sm sm:grid-cols-2">
            {settings.contactEmail && (
              <a href={`mailto:${settings.contactEmail}?subject=Cavendish%20Connect%20account%20request`} className="flex items-center gap-2 font-medium text-brand-700 hover:text-brand-800">
                <FiMail className="h-4 w-4 shrink-0" /> {settings.contactEmail}
              </a>
            )}
            {settings.contactPhone && (
              <a href={`tel:${settings.contactPhone.replace(/\s/g, '')}`} className="flex items-center gap-2 font-medium text-brand-700 hover:text-brand-800">
                <FiPhone className="h-4 w-4 shrink-0" /> {settings.contactPhone}
              </a>
            )}
          </div>
        )}

        <ButtonLink to="/login" size="lg" className="mt-6 w-full">
          I already have an account
        </ButtonLink>
      </div>
    </div>
  );
}
