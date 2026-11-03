import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { FiCheck, FiCopy, FiKey, FiUserPlus } from 'react-icons/fi';
import { adminApi } from '../../services/admin.service';
import { getErrorMessage } from '../../lib/api';
import { ROLE_LABELS, label } from '../../lib/labels';
import { Modal } from '../ui/modal';
import { Button } from '../ui/button';
import { Field, Input, Select } from '../ui/input';
import { useBrand } from '../../lib/settings';

export const ACCOUNT_ROLES = ['STUDENT', 'SERVICE_PROVIDER', 'LANDLORD', 'VENDOR', 'ADMIN'] as const;

const schema = z.object({
  firstName: z.string().trim().min(1, 'Required').max(60),
  lastName: z.string().trim().min(1, 'Required').max(60),
  email: z.string().trim().email('Enter a valid email address'),
  username: z
    .string()
    .trim()
    .min(3, 'At least 3 characters')
    .max(30, 'At most 30 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Letters, numbers and underscores only'),
  phone: z.string().trim().max(20).optional(),
  role: z.enum(ACCOUNT_ROLES),
});
type Form = z.infer<typeof schema>;

const suggestUsername = (first: string, last: string) =>
  `${first}${last ? `_${last}` : ''}`.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 30);

/** Admin creates an account; the person receives a one-time temporary password. */
export function CreateAccountDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (result: { name: string; email: string; tempPassword: string }) => void;
}) {
  const [usernameTouched, setUsernameTouched] = useState(false);
  const { register, handleSubmit, reset, watch, setValue, formState: { errors, isSubmitting } } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { role: 'STUDENT' },
  });

  useEffect(() => {
    if (open) {
      reset({ role: 'STUDENT', firstName: '', lastName: '', email: '', username: '', phone: '' });
      setUsernameTouched(false);
    }
  }, [open, reset]);

  // Suggest a username from the name until the admin types their own.
  const first = watch('firstName') ?? '';
  const last = watch('lastName') ?? '';
  useEffect(() => {
    if (!usernameTouched) setValue('username', suggestUsername(first, last));
  }, [first, last, usernameTouched, setValue]);

  const onSubmit = async (data: Form) => {
    try {
      const res = await adminApi.createUser({ ...data, phone: data.phone || undefined });
      onCreated({ name: `${res.user.firstName} ${res.user.lastName}`, email: res.user.email, tempPassword: res.tempPassword });
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not create the account'));
    }
  };

  const usernameField = register('username');

  return (
    <Modal
      open={open}
      onClose={isSubmitting ? () => {} : onClose}
      title="Add an account"
      description="Only admins can create accounts. The person gets a temporary password and chooses their own the first time they sign in."
      icon={<FiUserPlus />}
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" form="create-account" loading={isSubmitting}>
            Create account
          </Button>
        </>
      }
    >
      <form id="create-account" onSubmit={handleSubmit(onSubmit)} className="grid gap-4 sm:grid-cols-2" noValidate>
        <Field label="First name" htmlFor="ca-first">
          <Input id="ca-first" autoFocus error={errors.firstName?.message} {...register('firstName')} />
        </Field>
        <Field label="Last name" htmlFor="ca-last">
          <Input id="ca-last" error={errors.lastName?.message} {...register('lastName')} />
        </Field>
        <Field label="Email" htmlFor="ca-email" className="sm:col-span-2" hint="They sign in with this email.">
          <Input id="ca-email" type="email" placeholder="name@students.cavendish.ac.ug" error={errors.email?.message} {...register('email')} />
        </Field>
        <Field label="Username" htmlFor="ca-username">
          <Input
            id="ca-username"
            error={errors.username?.message}
            {...usernameField}
            onChange={(e) => {
              setUsernameTouched(true);
              usernameField.onChange(e);
            }}
          />
        </Field>
        <Field label="Phone" htmlFor="ca-phone" optional>
          <Input id="ca-phone" type="tel" placeholder="+256 7…" error={errors.phone?.message} {...register('phone')} />
        </Field>
        <Field label="Account type" htmlFor="ca-role" className="sm:col-span-2" hint="Decides what they can post. You can change it later.">
          <Select id="ca-role" {...register('role')}>
            {ACCOUNT_ROLES.map((r) => (
              <option key={r} value={r}>
                {label(ROLE_LABELS, r)}
              </option>
            ))}
          </Select>
        </Field>
      </form>
    </Modal>
  );
}

/** Shows a temporary password exactly once, with a copy button. */
export function TempPasswordDialog({
  data,
  onClose,
}: {
  data: { title: string; name: string; email?: string; tempPassword: string } | null;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const brand = useBrand();
  useEffect(() => setCopied(false), [data]);

  const text = data
    ? `${brand.appName} sign-in\n${data.email ? `Email: ${data.email}\n` : ''}Temporary password: ${data.tempPassword}\nYou'll choose your own password when you first sign in.`
    : '';

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success('Sign-in details copied');
    } catch {
      toast.error('Copy failed. Select the password and copy it manually.');
    }
  };

  return (
    <Modal
      open={!!data}
      onClose={onClose}
      title={data?.title ?? ''}
      description={data && <>Give these details to <span className="font-medium text-gray-900">{data.name}</span> in person or by a private message. This password is shown only once.</>}
      icon={<FiKey />}
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={copy}>
            {copied ? <FiCheck className="h-4 w-4" /> : <FiCopy className="h-4 w-4" />}
            {copied ? 'Copied' : 'Copy details'}
          </Button>
          <Button onClick={onClose}>Done</Button>
        </>
      }
    >
      {data && (
        <dl className="space-y-3 rounded-2xl bg-gray-50 p-4 text-sm">
          {data.email && (
            <div className="flex items-center justify-between gap-3">
              <dt className="text-gray-500">Email</dt>
              <dd className="truncate font-medium text-gray-900">{data.email}</dd>
            </div>
          )}
          <div className="flex items-center justify-between gap-3">
            <dt className="text-gray-500">Temporary password</dt>
            <dd className="rounded-lg bg-white px-3 py-1.5 font-mono text-base font-semibold tracking-wide text-brand-800 ring-1 ring-gray-200 select-all">
              {data.tempPassword}
            </dd>
          </div>
        </dl>
      )}
    </Modal>
  );
}
