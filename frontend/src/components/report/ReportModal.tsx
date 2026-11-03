import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { FiFlag } from 'react-icons/fi';
import { toast } from 'sonner';
import { reportsApi, REPORT_REASON_LABELS } from '../../services/reports.service';
import { getErrorMessage } from '../../lib/api';
import { useAuthGate } from '../../lib/hooks';
import { ReportReason, ReportTargetType } from '../../types/moderation';
import { Button } from '../ui/button';
import { Field, Select, Textarea } from '../ui/input';
import { Modal } from '../ui/modal';

interface ReportModalProps {
  open: boolean;
  onClose: () => void;
  targetType: ReportTargetType;
  targetId: number;
  targetLabel: string;
}

const REASONS = Object.keys(REPORT_REASON_LABELS) as ReportReason[];

export default function ReportModal({ open, onClose, targetType, targetId, targetLabel }: ReportModalProps) {
  const queryClient = useQueryClient();
  const [reason, setReason] = useState<ReportReason | ''>('');
  const [description, setDescription] = useState('');

  const mutation = useMutation({
    mutationFn: () =>
      reportsApi.submitReport({
        targetType,
        targetId,
        reason: reason as ReportReason,
        description: description.trim() || undefined,
      }),
    onSuccess: () => {
      toast.success('Thanks. Our moderators will review this shortly.');
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      setReason('');
      setDescription('');
      onClose();
    },
    onError: (err) => toast.error(getErrorMessage(err, "Couldn't submit the report")),
  });

  return (
    <Modal
      open={open}
      onClose={() => !mutation.isPending && onClose()}
      title={`Report this ${targetLabel.toLowerCase()}`}
      description="Reports are confidential. The person won't know who reported them."
      icon={
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600">
          <FiFlag className="h-5 w-5" />
        </span>
      }
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button variant="danger" loading={mutation.isPending} disabled={!reason} onClick={() => mutation.mutate()}>
            Submit report
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="What's the problem?" htmlFor="report-reason">
          <Select id="report-reason" value={reason} onChange={(e) => setReason(e.target.value as ReportReason)}>
            <option value="" disabled>
              Choose a reason
            </option>
            {REASONS.map((r) => (
              <option key={r} value={r}>
                {REPORT_REASON_LABELS[r]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Details" htmlFor="report-description" optional hint="Anything that helps us check quickly.">
          <Textarea
            id="report-description"
            rows={4}
            maxLength={2000}
            placeholder="Describe what happened…"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>
      </div>
    </Modal>
  );
}

/** Hook that opens the report dialog only for signed-in users. */
export function useReportDialog() {
  const [open, setOpen] = useState(false);
  const gate = useAuthGate();
  return {
    open,
    openReport: () => gate('Sign in to report a post') && setOpen(true),
    close: () => setOpen(false),
  };
}
