import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { FiShoppingBag, FiCalendar, FiHome } from 'react-icons/fi';
import { ordersApi, OrderTargetType } from '../../services/orders.service';
import { getErrorMessage } from '../../lib/api';
import { formatMoney } from '../../lib/utils';
import { useAuthStore } from '../../store/auth';
import { Modal } from '../ui/modal';
import { Button } from '../ui/button';
import { Field, Input, Textarea } from '../ui/input';

const COPY: Record<OrderTargetType, { title: string; button: string; icon: typeof FiShoppingBag; qty?: string; date?: string; place: string; message: string }> = {
  LISTING: {
    title: 'Order this item',
    button: 'Send order',
    icon: FiShoppingBag,
    qty: 'Quantity',
    place: 'Where to meet',
    message: 'Anything the seller should know? e.g. best time to meet',
  },
  SERVICE: {
    title: 'Book this service',
    button: 'Send booking request',
    icon: FiCalendar,
    date: 'Preferred date and time',
    place: 'Where (optional)',
    message: 'Describe what you need, e.g. size of the job, deadline, details',
  },
  PROPERTY: {
    title: 'Request a viewing',
    button: 'Send viewing request',
    icon: FiHome,
    qty: 'Rooms needed',
    date: 'Preferred viewing date',
    place: 'Meeting point (optional)',
    message: 'Questions for the landlord, e.g. move-in date, how long you plan to stay',
  },
};

/** Order / booking / viewing request form shown from a detail page. */
export function OrderDialog({
  open,
  onClose,
  targetType,
  targetId,
  title,
  price,
  currency = 'UGX',
  maxQuantity,
  defaultPlace,
}: {
  open: boolean;
  onClose: () => void;
  targetType: OrderTargetType;
  targetId: number;
  title: string;
  price?: number | string | null;
  currency?: string;
  maxQuantity?: number;
  defaultPlace?: string | null;
}) {
  const copy = COPY[targetType];
  const me = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [quantity, setQuantity] = useState(1);
  const [phone, setPhone] = useState('');
  const [place, setPlace] = useState('');
  const [date, setDate] = useState('');
  const [message, setMessage] = useState('');
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!open) return;
    setQuantity(1);
    setPhone(me?.phone ?? '');
    setPlace(targetType === 'LISTING' ? defaultPlace ?? '' : '');
    setDate('');
    setMessage('');
    setTouched(false);
  }, [open, me?.phone, defaultPlace, targetType]);

  const phoneError = !/^[+\d\s()-]{7,20}$/.test(phone.trim()) ? 'Enter a phone number they can reach you on' : undefined;
  const qtyError = copy.qty && (quantity < 1 || (maxQuantity !== undefined && quantity > maxQuantity)) ? `Choose between 1 and ${maxQuantity ?? 1}` : undefined;
  const dateError = date && new Date(date).getTime() < Date.now() - 60_000 ? 'Choose a time in the future' : undefined;

  const send = useMutation({
    mutationFn: () =>
      ordersApi.create({
        targetType,
        targetId,
        quantity: copy.qty ? quantity : undefined,
        contactPhone: phone.trim(),
        meetingPlace: place.trim() || undefined,
        preferredDate: date ? new Date(date).toISOString() : undefined,
        message: message.trim() || undefined,
      }),
    onSuccess: (order) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast.success('Request sent! The seller has been notified.', {
        description: 'Follow it in “My orders”, or keep talking in Messages.',
        action: order.conversationId ? { label: 'Open chat', onClick: () => navigate(`/messages/${order.conversationId}`) } : undefined,
      });
      onClose();
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Could not send your request')),
  });

  const submit = () => {
    setTouched(true);
    if (phoneError || qtyError || dateError) return;
    send.mutate();
  };

  const total = price != null && copy.qty && targetType === 'LISTING' ? Number(price) * quantity : null;
  const minDate = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);

  return (
    <Modal
      open={open}
      onClose={send.isPending ? () => {} : onClose}
      title={copy.title}
      description={title}
      icon={<copy.icon />}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={send.isPending}>
            Cancel
          </Button>
          <Button onClick={submit} loading={send.isPending}>
            {copy.button}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {copy.qty && (
          <Field label={copy.qty} htmlFor="o-qty" hint={maxQuantity !== undefined ? `${maxQuantity} available` : undefined}>
            <Input id="o-qty" type="number" inputMode="numeric" min={1} max={maxQuantity} value={quantity} onChange={(e) => setQuantity(Math.max(0, Math.floor(Number(e.target.value) || 0)))} error={touched ? qtyError : undefined} />
          </Field>
        )}
        {copy.date && (
          <Field label={copy.date} htmlFor="o-date" optional>
            <Input id="o-date" type="datetime-local" min={minDate} value={date} onChange={(e) => setDate(e.target.value)} error={touched ? dateError : undefined} />
          </Field>
        )}
        <Field label="Your phone number" htmlFor="o-phone" hint="Shared with the seller so they can reach you.">
          <Input id="o-phone" type="tel" autoComplete="tel" placeholder="+256 7…" value={phone} onChange={(e) => setPhone(e.target.value)} error={touched ? phoneError : undefined} />
        </Field>
        <Field label={copy.place} htmlFor="o-place" optional={targetType !== 'LISTING'} className={copy.qty && copy.date ? 'sm:col-span-2' : undefined}>
          <Input id="o-place" placeholder="e.g. Main campus library entrance" value={place} onChange={(e) => setPlace(e.target.value)} maxLength={160} />
        </Field>
        <Field label="Message" htmlFor="o-msg" optional className="sm:col-span-2">
          <Textarea id="o-msg" rows={3} maxLength={1000} placeholder={copy.message} value={message} onChange={(e) => setMessage(e.target.value)} />
        </Field>
      </div>
      {total !== null && (
        <p className="mt-4 flex items-center justify-between rounded-xl bg-gray-50 px-4 py-3 text-sm">
          <span className="text-gray-600">Estimated total (pay the seller directly)</span>
          <span className="font-bold text-gray-900 tabular-nums">{formatMoney(total, currency)}</span>
        </p>
      )}
      <p className="mt-3 text-xs text-gray-500">Nothing is charged here. The seller confirms, then you arrange payment and pick-up together. Meet in a public place and inspect before paying.</p>
    </Modal>
  );
}
