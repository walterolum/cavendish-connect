import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { FiEye, FiEyeOff, FiLock, FiMail } from 'react-icons/fi';
import { toast } from 'sonner';
import { authApi } from '../../services/auth.service';
import { useAuthStore } from '../../store/auth';
import { getErrorMessage } from '../../lib/api';
import { useDocumentTitle } from '../../lib/hooks';
import { Button } from '../../components/ui/button';
import { Field, Input } from '../../components/ui/input';
import { useBrand } from '../../lib/settings';

const schema = z.object({
  email: z.string().trim().email('Enter a valid email address'),
  password: z.string().min(1, 'Enter your password'),
});
type LoginForm = z.infer<typeof schema>;

/** Only allow redirects within this site. */
export function safeRedirect(value: string | null) {
  return value && value.startsWith('/') && !value.startsWith('//') ? value : '/';
}

export default function Login() {
  useDocumentTitle('Sign in');
  const brand = useBrand();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const redirect = safeRedirect(params.get('redirect'));
  const { setAuth, isAuthenticated } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginForm>({ resolver: zodResolver(schema) });

  if (isAuthenticated) return <Navigate to={redirect} replace />;

  const onSubmit = async (data: LoginForm) => {
    try {
      const res = await authApi.login(data.email, data.password);
      setAuth(res.user, res.accessToken, res.refreshToken);
      if (res.user.mustChangePassword) {
        toast.info(`Welcome, ${res.user.firstName}. Please choose your own password to finish setting up.`);
        navigate(`/set-password?redirect=${encodeURIComponent(redirect)}`, { replace: true });
        return;
      }
      toast.success(`Welcome back, ${res.user.firstName}`);
      navigate(redirect, { replace: true });
    } catch (err) {
      toast.error(getErrorMessage(err, 'Sign in failed'));
    }
  };

  return (
    <div className="w-full max-w-[420px] animate-pop-in">
      <div className="mb-8 text-center">
        <h1 className="text-[28px] font-bold text-gray-900">Welcome back</h1>
        <p className="mt-2 text-[15px] text-gray-500">Sign in to the {brand.universityName} campus platform.</p>
      </div>

      <div className="rounded-3xl border border-gray-200/80 bg-white p-6 shadow-raised sm:p-8">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
          <Field label="Email" htmlFor="email">
            <Input id="email" type="email" autoComplete="email" leadingIcon={<FiMail />} placeholder="you@example.com" error={errors.email?.message} autoFocus {...register('email')} />
          </Field>
          <Field label="Password" htmlFor="password">
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                leadingIcon={<FiLock />}
                className="pr-11"
                error={errors.password?.message}
                {...register('password')}
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute right-2 top-[22px] -translate-y-1/2 rounded-lg p-1.5 text-gray-400 hover:text-gray-700"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <FiEyeOff className="h-4 w-4" /> : <FiEye className="h-4 w-4" />}
              </button>
            </div>
          </Field>
          <Button type="submit" loading={isSubmitting} className="w-full" size="lg">
            Sign in
          </Button>
        </form>
      </div>

      <p className="mt-6 text-center text-sm text-gray-500">
        No account yet?{' '}
        <Link to="/register" className="font-semibold text-brand-700 hover:text-brand-800">
          How to get one
        </Link>
        <span className="mx-1.5 text-gray-300">·</span>
        Forgot your password? Ask the admin office for a new one.
      </p>
    </div>
  );
}
