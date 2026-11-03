import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FiStar, FiTrash2 } from 'react-icons/fi';
import { toast } from 'sonner';
import { reviewsApi, ReviewTargetType } from '../../services/engagement.service';
import { getErrorMessage } from '../../lib/api';
import { formatRelativeTime } from '../../lib/utils';
import { useAuthGate } from '../../lib/hooks';
import { useAuthStore } from '../../store/auth';
import { ListingOwner } from '../../types';
import { Avatar, fullName } from '../ui/avatar';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Field, Input, Textarea } from '../ui/input';
import { Modal } from '../ui/modal';
import { StarInput, Stars } from '../ui/stat';
import { Skeleton } from '../ui/loading';

const ROLE_NOUN: Record<ReviewTargetType, string> = {
  SELLER: 'seller',
  SERVICE_PROVIDER: 'provider',
  LANDLORD: 'landlord',
  BUSINESS: 'business',
};

/** Reviews of a person in a given role, with summary, list and a write-review dialog. */
export function ReviewsSection({ targetType, owner }: { targetType: ReviewTargetType; owner?: ListingOwner }) {
  const me = useAuthStore((s) => s.user);
  const gate = useAuthGate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const key = ['reviews', targetType, owner?.id];

  const { data, isLoading } = useQuery({
    queryKey: key,
    queryFn: () => reviewsApi.list(targetType, owner!.id),
    enabled: !!owner?.id,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: key });
    queryClient.invalidateQueries({ queryKey: ['services', 'detail'] });
    queryClient.invalidateQueries({ queryKey: ['accommodation', 'detail'] });
  };

  const create = useMutation({
    mutationFn: () =>
      reviewsApi.create({
        targetType,
        targetId: owner!.id,
        rating,
        title: title.trim() || undefined,
        content: content.trim() || undefined,
      }),
    onSuccess: () => {
      toast.success('Thanks — your review is live');
      setOpen(false);
      setRating(0);
      setTitle('');
      setContent('');
      invalidate();
    },
    onError: (err) => toast.error(getErrorMessage(err, "Couldn't post your review")),
  });

  const remove = useMutation({
    mutationFn: (id: number) => reviewsApi.remove(id),
    onSuccess: () => {
      toast.success('Review removed');
      invalidate();
    },
    onError: (err) => toast.error(getErrorMessage(err, "Couldn't remove the review")),
  });

  if (!owner) return null;
  const reviews = data?.reviews ?? [];
  const average = Number(data?.averageRating ?? 0);
  const isOwner = me?.id === owner.id;
  const alreadyReviewed = reviews.some((r) => r.author.id === me?.id);
  const noun = ROLE_NOUN[targetType];

  // Rating distribution for the summary bars.
  const dist = [5, 4, 3, 2, 1].map((n) => ({ n, count: reviews.filter((r) => r.rating === n).length }));

  return (
    <section id="reviews" className="mt-10 scroll-mt-24">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Reviews</h2>
          <p className="text-sm text-gray-500">What people say about this {noun}</p>
        </div>
        {!isOwner && !alreadyReviewed && (
          <Button variant="outline" size="sm" onClick={() => gate('Sign in to write a review') && setOpen(true)}>
            <FiStar className="h-3.5 w-3.5" />
            Write a review
          </Button>
        )}
      </div>

      <Card>
        {isLoading ? (
          <div className="space-y-3 p-6">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ) : !reviews.length ? (
          <div className="p-6 text-center sm:p-8">
            <p className="font-medium text-gray-900">No reviews yet</p>
            <p className="mt-1 text-sm text-gray-500">
              {isOwner ? 'Reviews from people you deal with will appear here.' : `Dealt with this ${noun}? Be the first to share how it went.`}
            </p>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-6 border-b border-gray-100 p-5 sm:flex-row sm:items-center sm:p-6">
              <div className="text-center sm:w-36 sm:shrink-0">
                <p className="font-[family-name:var(--font-display)] text-4xl font-bold text-gray-900 tabular-nums">
                  {average.toFixed(1)}
                </p>
                <Stars value={average} size="md" />
                <p className="mt-1 text-xs text-gray-500">
                  {data?.totalReviews} review{data?.totalReviews !== 1 ? 's' : ''}
                </p>
              </div>
              <div className="flex-1 space-y-1.5">
                {dist.map(({ n, count }) => (
                  <div key={n} className="flex items-center gap-2 text-xs text-gray-500">
                    <span className="w-3 tabular-nums">{n}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                      <div
                        className="h-full rounded-full bg-accent-400"
                        style={{ width: `${reviews.length ? (count / reviews.length) * 100 : 0}%` }}
                      />
                    </div>
                    <span className="w-6 text-right tabular-nums">{count}</span>
                  </div>
                ))}
              </div>
            </div>
            <ul className="divide-y divide-gray-100">
              {reviews.map((r) => (
                <li key={r.id} className="flex gap-3 p-5 sm:px-6">
                  <Avatar person={r.author} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-gray-900">{fullName(r.author)}</p>
                      <span className="text-xs text-gray-400">{formatRelativeTime(r.createdAt)}</span>
                    </div>
                    <Stars value={r.rating} />
                    {r.title && <p className="mt-2 text-sm font-medium text-gray-900">{r.title}</p>}
                    {r.content && <p className="mt-1 text-sm leading-relaxed text-gray-600">{r.content}</p>}
                    {r.author.id === me?.id && (
                      <button
                        type="button"
                        onClick={() => remove.mutate(r.id)}
                        disabled={remove.isPending}
                        className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-gray-400 hover:text-red-600"
                      >
                        <FiTrash2 className="h-3 w-3" /> Delete my review
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>

      <Modal
        open={open}
        onClose={() => !create.isPending && setOpen(false)}
        title={`Review ${fullName(owner)}`}
        description={`Your honest rating helps others choose a good ${noun}.`}
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={create.isPending}>
              Cancel
            </Button>
            <Button onClick={() => create.mutate()} disabled={!rating} loading={create.isPending}>
              Post review
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <p className="mb-1.5 text-sm font-medium text-gray-800">Your rating</p>
            <StarInput value={rating} onChange={setRating} />
          </div>
          <Field label="Headline" htmlFor="review-title" optional>
            <Input id="review-title" maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Quick and reliable" />
          </Field>
          <Field label="Your experience" htmlFor="review-content" optional hint={`${content.length}/2000`}>
            <Textarea
              id="review-content"
              rows={4}
              maxLength={2000}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="What went well? What could be better?"
            />
          </Field>
        </div>
      </Modal>
    </section>
  );
}
