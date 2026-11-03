import { useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { FiCheck, FiEye, FiEyeOff, FiKey, FiLock } from 'react-icons/fi';
import { toast } from 'sonner';
import { authApi } from '../../services/auth.service';
import { useAuthStore } from '../../store/auth';
import { getErrorMessage } from '../../lib/api';
import { useDocumentTitle } from '../../lib/hooks';
import { cn } from '../../lib/utils';
import { Button } from '../../components/ui/button';
import { Field, Input } from '../../components/ui/input';
import { useSignOut } from '../../components/layout/navbar';
import { safeRedirect } from './Login';

const schema = z
  .object({
    currentPassword: z.string().min(1, 'Enter the temporary password you were given'),
    newPassword: z
      .string()
      .min(8, 'Use at least 8 characters')
      .regex(/[A-Za-z]/, 'Include at least one letter')
      .regex(/\d/, 'Include at least one number'),
    confirm: z.string(),
  })
  .refine((v) => v.newPassword === v.confirm, { path: ['confirm'], message: 'Passwords do not match' })
  .refine((v) => v.newPassword !== v.currentPassword, { path: ['newPassword'], message: 'Choose something different from the temporary password' });
type Form = z.infer<typeof schema>;

/** First sign-in with an admin-issued temporary password: the person picks their own. */
export default function SetPasswordPage() {
  useDocumentTitle('Set your password');
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const redirect = safeRedirect(params.get('redirect'));
  const { user, isAuthenticated, setUser } = useAuthStore();
  const signOut = useSignOut();
  const [show, setShow] = useState(false);

  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<Form>({ resolver: zodResolver(schema) });
  const pwd = watch('newPassword') ?? '';

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  const rules = [
    { ok: pwd.length >= 8, label: 'At least 8 characters' },
    { ok: /[A-Za-z]/.test(pwd), label: 'A letter' },
    { ok: /\d/.test(pwd), label: 'A number' },
  ];

  const onSubmit = async (data: Form) => {
    try {
      await authApi.changePassword(data.currentPassword, data.newPassword);
      setUser({ ...user!, mustChangePassword: false });
      toast.success('Password saved. Welcome to Cavendish Connect!');
      navigate(redirect, { replace: true });
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not save your password'));
    }
  };

  return (
    <div className="w-full max-w-[440px] animate-pop-in">
      <div className="mb-8 text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-100 text-accent-700">
          <FiKey className="h-6 w-6" />
        </span>
        <h1 className="mt-4 text-[28px] font-bold text-gray-900">
          {user?.mustChangePassword ? `Welcome, ${user.firstName}` : 'Change your password'}
        </h1>
        <p className="mt-2 text-[15px] text-gray-500">
          {user?.mustChangePassword
            ? 'Your account was set up by the admin office. Choose your own password to continue.'
            : 'Enter your current password, then choose a new one.'}
        </p>
      </div>

      <div className="rounded-3xl border border-gray-200/80 bg-white p-6 shadow-raised sm:p-8">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
          <Field label={user?.mustChangePassword ? 'Temporary password' : 'Current password'} htmlFor="currentPassword">
            <Input id="currentPassword" type="password" autoComplete="current-password" leadingIcon={<FiLock />} error={errors.currentPassword?.message} autoFocus {...register('currentPassword')} />
          </Field>
          <Field label="New password" htmlFor="newPassword">
            <div className="relative">
              <Input
                id="newPassword"
                type={show ? 'text' : 'password'}
                autoComplete="new-password"
                leadingIcon={<FiKey />}
                className="pr-11"
                error={errors.newPassword?.message}
                {...register('newPassword')}
              />
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                className="absolute top-[22px] right-2 -translate-y-1/2 rounded-lg p-1.5 text-gray-400 hover:text-gray-700"
                aria-label={show ? 'Hide password' : 'Show password'}
              >
                {show ? <FiEyeOff className="h-4 w-4" /> : <FiEye className="h-4 w-4" />}
              </button>
            </div>
          </Field>
          <ul className="grid grid-cols-3 gap-2 text-xs" aria-label="Password requirements">
            {rules.map((r) => (
              <li key={r.label} className={cn('flex items-center gap-1.5 transition-colors', r.ok ? 'text-emerald-600' : 'text-gray-400')}>
                <span className={cn('flex h-4 w-4 items-center justify-center rounded-full transition-all', r.ok ? 'scale-100 bg-emerald-500 text-white' : 'scale-90 bg-gray-200')}>
                  <FiCheck className="h-3 w-3" />
                </span>
                {r.label}
              </li>
            ))}
          </ul>
          <Field label="Confirm new password" htmlFor="confirm">
            <Input id="confirm" type={show ? 'text' : 'password'} autoComplete="new-password" leadingIcon={<FiKey />} error={errors.confirm?.message} {...register('confirm')} />
          </Field>
          <Button type="submit" loading={isSubmitting} className="w-full" size="lg">
            Save password and continue
          </Button>
        </form>
      </div>
      <p className="mt-6 text-center text-sm text-gray-500">
        Not you?{' '}
        <button type="button" onClick={signOut} className="font-semibold text-brand-700 hover:text-brand-800">
          Sign out
        </button>
      </p>
    </div>
  );
}
