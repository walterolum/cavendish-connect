import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FiCheckCircle, FiClock, FiShield } from 'react-icons/fi';
import { toast } from 'sonner';
import { verificationsApi, VERIFICATION_TYPE_LABELS } from '../../services/verifications.service';
import { getErrorMessage } from '../../lib/api';
import { formatDate, cn } from '../../lib/utils';
import { VerificationType } from '../../types/moderation';
import { Button } from '../ui/button';
import { Card, CardFooter, CardHeader } from '../ui/card';
import { Field, Select, Textarea } from '../ui/input';
import { StatusBadge } from '../ui/badge';
import { Skeleton } from '../ui/loading';

const TYPES = Object.keys(VERIFICATION_TYPE_LABELS) as VerificationType[];

const STATUS_HINTS: Record<string, string> = {
  PENDING: 'Our team is reviewing your request. This usually takes 1–2 working days.',
  VERIFIED: 'You have a verified badge, which helps people trust you.',
  REJECTED: 'Your request was declined. You can correct the details and apply again.',
  SUSPENDED: 'Your verification was suspended. You can apply again.',
};

const BENEFITS = ['Verified badge on your posts and profile', 'Higher trust, more replies', 'Priority when moderators review your posts'];

export default function VerificationCard() {
  const queryClient = useQueryClient();
  const [type, setType] = useState<VerificationType>('STUDENT');
  const [notes, setNotes] = useState('');

  const { data: requests, isLoading } = useQuery({
    queryKey: ['verifications', 'me'],
    queryFn: () => verificationsApi.getMyRequests(),
  });
  const latest = requests?.[0];

  const submit = useMutation({
    mutationFn: () => verificationsApi.submitRequest({ type, notes: notes.trim() || undefined }),
    onSuccess: () => {
      toast.success('Verification request sent');
      setNotes('');
      queryClient.invalidateQueries({ queryKey: ['verifications', 'me'] });
    },
    onError: (err) => toast.error(getErrorMessage(err, "Couldn't send your request")),
  });

  const canApply = !isLoading && (!latest || latest.status === 'REJECTED' || latest.status === 'SUSPENDED');

  return (
    <Card>
      <CardHeader icon={<FiShield />} title="Account verification" description="Show the community you're who you say you are." />

      <div className="space-y-5 px-5 py-6 sm:px-6">
        {isLoading && <Skeleton className="h-20 rounded-xl" />}

        {latest && (
          <div
            className={cn(
              'rounded-xl border p-4',
              latest.status === 'VERIFIED' ? 'border-emerald-200 bg-emerald-50/60' : 'border-gray-200 bg-gray-50'
            )}
          >
            <div className="flex flex-wrap items-center gap-2">
              {latest.status === 'VERIFIED' && <FiCheckCircle className="h-5 w-5 text-emerald-600" />}
              <span className="text-sm font-semibold text-gray-900">{VERIFICATION_TYPE_LABELS[latest.type]}</span>
              <StatusBadge status={latest.status} />
            </div>
            <p className="mt-1.5 text-sm text-gray-600">{STATUS_HINTS[latest.status]}</p>
            {latest.rejectionReason && <p className="mt-1.5 text-sm text-red-700">Reason: {latest.rejectionReason}</p>}
            <p className="mt-2 flex items-center gap-1 text-xs text-gray-400">
              <FiClock className="h-3 w-3" />
              Submitted {formatDate(latest.createdAt)}
            </p>
          </div>
        )}

        {canApply && (
          <>
            {!latest && (
              <ul className="space-y-1.5 text-sm text-gray-600">
                {BENEFITS.map((b) => (
                  <li key={b} className="flex items-center gap-2">
                    <FiCheckCircle className="h-4 w-4 text-emerald-600" />
                    {b}
                  </li>
                ))}
              </ul>
            )}
            <Field label="Verify me as" htmlFor="verification-type">
              <Select id="verification-type" value={type} onChange={(e) => setType(e.target.value as VerificationType)} disabled={submit.isPending}>
                {TYPES.map((t) => (
                  <option key={t} value={t}>
                    {VERIFICATION_TYPE_LABELS[t]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Details for the reviewer" htmlFor="verification-notes" optional hint="e.g. your student number, business registration, or the property address.">
              <Textarea id="verification-notes" rows={3} maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} disabled={submit.isPending} />
            </Field>
          </>
        )}
      </div>

      {canApply && (
        <CardFooter>
          <Button loading={submit.isPending} onClick={() => submit.mutate()}>
            {latest ? 'Apply again' : 'Request verification'}
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}
