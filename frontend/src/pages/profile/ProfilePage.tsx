import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { FiCalendar, FiLock, FiMapPin, FiShield, FiUser } from 'react-icons/fi';
import { useAuthStore } from '../../store/auth';
import { authApi } from '../../services/auth.service';
import { formatDate } from '../../lib/utils';
import { getErrorMessage } from '../../lib/api';
import { ROLE_LABELS, label } from '../../lib/labels';
import { useDocumentTitle } from '../../lib/hooks';
import { Avatar, fullName } from '../../components/ui/avatar';
import { Badge } from '../../components/ui/badge';
import { Button, ButtonLink } from '../../components/ui/button';
import { Card, CardFooter, CardHeader } from '../../components/ui/card';
import { Field, Input, Textarea } from '../../components/ui/input';
import { Page } from '../../components/ui/page';
import { Tabs } from '../../components/ui/tabs';
import VerificationCard from '../../components/verification/VerificationCard';

const profileSchema = z.object({
  firstName: z.string().trim().min(1, 'Enter your first name').max(50),
  lastName: z.string().trim().min(1, 'Enter your last name').max(50),
  phone: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || /^\+?[0-9 ]{9,15}$/.test(v), 'Use a phone number like +256 700 123456'),
  location: z.string().trim().max(120).optional(),
  bio: z.string().trim().max(500, 'Keep it under 500 characters').optional(),
});
type ProfileForm = z.infer<typeof profileSchema>;

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password'),
    newPassword: z.string().min(8, 'At least 8 characters').regex(/[A-Z]/, 'Add an uppercase letter').regex(/[0-9]/, 'Add a number'),
    confirmPassword: z.string().min(1, 'Confirm your new password'),
  })
  .refine((d) => d.newPassword === d.confirmPassword, { message: "Passwords don't match", path: ['confirmPassword'] })
  .refine((d) => d.newPassword !== d.currentPassword, { message: 'Choose a different password', path: ['newPassword'] });
type PasswordForm = z.infer<typeof passwordSchema>;

type Tab = 'profile' | 'security' | 'verification';

export default function ProfilePage() {
  useDocumentTitle('Profile & settings');
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const [tab, setTab] = useState<Tab>('profile');

  // Refresh the stored user so the page reflects the latest server data.
  useQuery({
    queryKey: ['profile', 'me'],
    queryFn: async () => {
      const fresh = await authApi.getProfile();
      setUser(fresh);
      return fresh;
    },
  });

  const profileForm = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    values: {
      firstName: user?.firstName ?? '',
      lastName: user?.lastName ?? '',
      phone: user?.phone ?? '',
      location: user?.location ?? '',
      bio: user?.bio ?? '',
    },
  });
  const passwordForm = useForm<PasswordForm>({ resolver: zodResolver(passwordSchema) });

  const saveProfile = useMutation({
    mutationFn: (data: ProfileForm) => authApi.updateProfile({ ...data, phone: data.phone?.replace(/\s/g, '') || undefined }),
    onSuccess: (updated) => {
      setUser(updated);
      toast.success('Profile updated');
    },
    onError: (err) => toast.error(getErrorMessage(err, "Couldn't update your profile")),
  });

  const changePassword = useMutation({
    mutationFn: (data: PasswordForm) => authApi.changePassword(data.currentPassword, data.newPassword),
    onSuccess: () => {
      passwordForm.reset();
      toast.success('Password changed');
    },
    onError: (err) => toast.error(getErrorMessage(err, "Couldn't change your password")),
  });

  const pErr = profileForm.formState.errors;
  const wErr = passwordForm.formState.errors;
  const bio = profileForm.watch('bio') ?? '';

  return (
    <Page width="md">
      {/* Identity header */}
      <Card className="mb-6 overflow-hidden">
        <div className="h-28 bg-gradient-to-br from-brand-700 via-brand-800 to-brand-950 sm:h-32" />
        <div className="flex flex-col gap-4 px-5 pb-5 sm:flex-row sm:items-end sm:justify-between sm:px-6">
          <div className="flex items-end gap-4">
            <Avatar person={user} size="xl" className="-mt-12 ring-4 ring-white" />
            <div className="min-w-0 pb-1">
              <h1 className="truncate text-xl font-bold text-gray-900 sm:text-2xl">{fullName(user)}</h1>
              <p className="text-sm text-gray-500">@{user?.username}</p>
            </div>
          </div>
          <ButtonLink to="/dashboard" variant="outline" size="sm">
            View my posts
          </ButtonLink>
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-gray-100 px-5 py-3 text-sm text-gray-500 sm:px-6">
          {user?.roles?.map((role) => (
            <Badge key={role} variant={role === 'ADMIN' ? 'brand' : 'gray'}>
              {label(ROLE_LABELS, role)}
            </Badge>
          ))}
          {user?.location && (
            <span className="flex items-center gap-1.5">
              <FiMapPin className="h-3.5 w-3.5" />
              {user.location}
            </span>
          )}
          {user?.createdAt && (
            <span className="flex items-center gap-1.5">
              <FiCalendar className="h-3.5 w-3.5" />
              Joined {formatDate(user.createdAt)}
            </span>
          )}
        </div>
      </Card>

      <Tabs<Tab>
        className="mb-6"
        value={tab}
        onChange={setTab}
        items={[
          { key: 'profile', label: 'Profile', icon: FiUser },
          { key: 'security', label: 'Password', icon: FiLock },
          { key: 'verification', label: 'Verification', icon: FiShield },
        ]}
      />

      {tab === 'profile' && (
        <Card>
          <CardHeader title="Public profile" description="Shown to people you trade with." />
          <form onSubmit={profileForm.handleSubmit((d) => saveProfile.mutate(d))} noValidate>
            <div className="grid gap-5 px-5 py-6 sm:grid-cols-2 sm:px-6">
              <Field label="First name" htmlFor="firstName">
                <Input id="firstName" error={pErr.firstName?.message} {...profileForm.register('firstName')} />
              </Field>
              <Field label="Last name" htmlFor="lastName">
                <Input id="lastName" error={pErr.lastName?.message} {...profileForm.register('lastName')} />
              </Field>
              <Field label="Phone" htmlFor="phone" optional hint="Only shared when you choose to in a conversation.">
                <Input id="phone" type="tel" placeholder="+256 700 123456" error={pErr.phone?.message} {...profileForm.register('phone')} />
              </Field>
              <Field label="Location" htmlFor="location" optional>
                <Input id="location" placeholder="e.g. Nsambya, Kampala" {...profileForm.register('location')} />
              </Field>
              <Field label="Bio" htmlFor="bio" optional hint={`${bio.length}/500`} className="sm:col-span-2">
                <Textarea id="bio" rows={3} placeholder="A line or two about you — course, what you sell, what you offer." error={pErr.bio?.message} {...profileForm.register('bio')} />
              </Field>
              <Field label="Email" htmlFor="email" hint="Contact support to change your email." className="sm:col-span-2">
                <Input id="email" value={user?.email ?? ''} disabled readOnly />
              </Field>
            </div>
            <CardFooter>
              <Button variant="ghost" onClick={() => profileForm.reset()} disabled={!profileForm.formState.isDirty || saveProfile.isPending}>
                Discard
              </Button>
              <Button type="submit" loading={saveProfile.isPending} disabled={!profileForm.formState.isDirty}>
                Save changes
              </Button>
            </CardFooter>
          </form>
        </Card>
      )}

      {tab === 'security' && (
        <Card>
          <CardHeader title="Change password" description="Use at least 8 characters with an uppercase letter and a number." />
          <form onSubmit={passwordForm.handleSubmit((d) => changePassword.mutate(d))} noValidate>
            <div className="max-w-md space-y-5 px-5 py-6 sm:px-6">
              <Field label="Current password" htmlFor="currentPassword">
                <Input id="currentPassword" type="password" autoComplete="current-password" error={wErr.currentPassword?.message} {...passwordForm.register('currentPassword')} />
              </Field>
              <Field label="New password" htmlFor="newPassword">
                <Input id="newPassword" type="password" autoComplete="new-password" error={wErr.newPassword?.message} {...passwordForm.register('newPassword')} />
              </Field>
              <Field label="Confirm new password" htmlFor="confirmPassword">
                <Input id="confirmPassword" type="password" autoComplete="new-password" error={wErr.confirmPassword?.message} {...passwordForm.register('confirmPassword')} />
              </Field>
            </div>
            <CardFooter>
              <Button type="submit" loading={changePassword.isPending}>
                Update password
              </Button>
            </CardFooter>
          </form>
        </Card>
      )}

      {tab === 'verification' && <VerificationCard />}
    </Page>
  );
}
