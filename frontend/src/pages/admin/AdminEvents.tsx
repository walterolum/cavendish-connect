import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { FiCalendar, FiEdit2, FiPlus, FiTrash2 } from 'react-icons/fi';
import { eventsApi, CampusEvent } from '../../lib/community';
import { getErrorMessage } from '../../lib/api';
import { useDocumentTitle } from '../../lib/hooks';
import { PageHeader } from '../../components/ui/page';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Checkbox, Field, Input, Textarea } from '../../components/ui/input';
import { ConfirmDialog, Modal } from '../../components/ui/modal';
import { ListState, Table, Td, Th } from '../../components/admin/AdminParts';

const CATEGORIES = ['Campus', 'Academic', 'Career', 'Social', 'Sports', 'Culture', 'Workshop'];

const schema = z
  .object({
    title: z.string().trim().min(1, 'Give the event a title').max(120),
    category: z.string().min(1),
    location: z.string().trim().max(120).optional(),
    startsAt: z.string().min(1, 'Choose when it starts'),
    endsAt: z.string().optional(),
    description: z.string().trim().max(2000).optional(),
    isPublished: z.boolean(),
  })
  .refine((v) => !v.endsAt || new Date(v.endsAt) >= new Date(v.startsAt), { path: ['endsAt'], message: 'End must be after the start' });
type Form = z.infer<typeof schema>;

/** ISO -> value for <input type="datetime-local"> in the viewer's time zone. */
const toLocalInput = (iso?: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

function EventDialog({ open, event, onClose }: { open: boolean; event: CampusEvent | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<Form>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (!open) return;
    reset({
      title: event?.title ?? '',
      category: event?.category ?? 'Campus',
      location: event?.location ?? '',
      startsAt: toLocalInput(event?.startsAt),
      endsAt: toLocalInput(event?.endsAt),
      description: event?.description ?? '',
      isPublished: event?.isPublished ?? true,
    });
  }, [open, event, reset]);

  const onSubmit = async (v: Form) => {
    const input = {
      ...v,
      startsAt: new Date(v.startsAt).toISOString(),
      endsAt: v.endsAt ? new Date(v.endsAt).toISOString() : undefined,
      location: v.location || undefined,
      description: v.description || undefined,
    };
    try {
      if (event) await eventsApi.update(event.id, input);
      else await eventsApi.create(input);
      toast.success(event ? 'Event updated' : 'Event added');
      queryClient.invalidateQueries({ queryKey: ['events'] });
      onClose();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not save the event'));
    }
  };

  return (
    <Modal
      open={open}
      onClose={isSubmitting ? () => {} : onClose}
      title={event ? 'Edit event' : 'Add an event'}
      description="Published upcoming events appear on the Services Hub."
      icon={<FiCalendar />}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" form="event-form" loading={isSubmitting}>
            {event ? 'Save changes' : 'Add event'}
          </Button>
        </>
      }
    >
      <form id="event-form" onSubmit={handleSubmit(onSubmit)} className="grid gap-4 sm:grid-cols-2" noValidate>
        <Field label="Title" htmlFor="ev-title" className="sm:col-span-2">
          <Input id="ev-title" autoFocus placeholder="e.g. Campus Tech Talk" error={errors.title?.message} {...register('title')} />
        </Field>
        <Field label="Starts" htmlFor="ev-start">
          <Input id="ev-start" type="datetime-local" error={errors.startsAt?.message} {...register('startsAt')} />
        </Field>
        <Field label="Ends" htmlFor="ev-end" optional>
          <Input id="ev-end" type="datetime-local" error={errors.endsAt?.message} {...register('endsAt')} />
        </Field>
        <Field label="Category" htmlFor="ev-cat">
          <select id="ev-cat" className="h-11 w-full rounded-xl border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15" {...register('category')}>
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
        <Field label="Location" htmlFor="ev-loc" optional>
          <Input id="ev-loc" placeholder="e.g. Main Hall" error={errors.location?.message} {...register('location')} />
        </Field>
        <Field label="Details" htmlFor="ev-desc" optional className="sm:col-span-2">
          <Textarea id="ev-desc" rows={3} error={errors.description?.message} {...register('description')} />
        </Field>
        <Checkbox className="sm:col-span-2" label="Published" description="Unpublished events are only visible here." {...register('isPublished')} />
      </form>
    </Modal>
  );
}

export default function AdminEvents() {
  useDocumentTitle('Events · Admin');
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<CampusEvent | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState<CampusEvent | null>(null);

  const { data = [], isLoading, error, refetch } = useQuery({ queryKey: ['events', 'all'], queryFn: () => eventsApi.all() });

  const remove = useMutation({
    mutationFn: (id: number) => eventsApi.remove(id),
    onSuccess: () => {
      toast.success('Event deleted');
      setDeleting(null);
      queryClient.invalidateQueries({ queryKey: ['events'] });
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Could not delete the event')),
  });

  const now = Date.now();
  const open = (e: CampusEvent | null) => {
    setEditing(e);
    setDialogOpen(true);
  };

  return (
    <div>
      <PageHeader
        title="Events"
        description="Campus events shown in “Upcoming Events” on the Services Hub."
        actions={
          <Button onClick={() => open(null)}>
            <FiPlus className="h-4 w-4" /> Add event
          </Button>
        }
      />
      <ListState
        isLoading={isLoading}
        error={error}
        isEmpty={!data.length}
        onRetry={() => refetch()}
        errorFallback="Could not load events"
        empty={{ icon: <FiCalendar />, title: 'No events yet', message: 'Add talks, fairs and celebrations for students to see.', action: 'Add event', onAction: () => open(null) }}
      >
        <Table
          head={
            <>
              <Th>Event</Th>
              <Th>When</Th>
              <Th>Where</Th>
              <Th>Status</Th>
              <Th className="text-right">Actions</Th>
            </>
          }
        >
          {data.map((e) => {
            const past = new Date(e.endsAt ?? e.startsAt).getTime() < now;
            return (
              <tr key={e.id} className="transition-colors hover:bg-gray-50/70">
                <Td>
                  <span className="block font-medium text-gray-900">{e.title}</span>
                  <span className="text-xs text-gray-500">{e.category}</span>
                </Td>
                <Td className="whitespace-nowrap">
                  {new Date(e.startsAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                </Td>
                <Td>{e.location || '—'}</Td>
                <Td>
                  {past ? <Badge variant="gray">Past</Badge> : e.isPublished ? <Badge variant="green" dot>Published</Badge> : <Badge variant="amber" dot>Hidden</Badge>}
                </Td>
                <Td>
                  <div className="flex justify-end gap-1">
                    <Button size="icon-sm" variant="ghost" onClick={() => open(e)} aria-label={`Edit ${e.title}`}>
                      <FiEdit2 className="h-4 w-4" />
                    </Button>
                    <Button size="icon-sm" variant="ghost" className="text-red-600 hover:bg-red-50" onClick={() => setDeleting(e)} aria-label={`Delete ${e.title}`}>
                      <FiTrash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </Td>
              </tr>
            );
          })}
        </Table>
      </ListState>

      <EventDialog open={dialogOpen} event={editing} onClose={() => setDialogOpen(false)} />
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
        loading={remove.isPending}
        title="Delete this event?"
        message={deleting ? `“${deleting.title}” will be removed from the Services Hub.` : ''}
        confirmLabel="Delete event"
      />
    </div>
  );
}
