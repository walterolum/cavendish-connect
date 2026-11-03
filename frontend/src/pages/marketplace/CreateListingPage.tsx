import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { FiMapPin } from 'react-icons/fi';
import { toast } from 'sonner';
import { marketplaceApi, categoriesApi } from '../../services/marketplace.service';
import { getErrorMessage } from '../../lib/api';
import { useDocumentTitle } from '../../lib/hooks';
import { CONDITION_LABELS } from '../../lib/labels';
import { useAuthStore } from '../../store/auth';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { Checkbox, Field, Input, Select, Textarea } from '../../components/ui/input';
import { Page, PageHeader } from '../../components/ui/page';
import { ErrorState, PageLoader } from '../../components/ui/loading';
import { FormActions, FormSection, PhotoPicker, postSavedMessage } from '../../components/forms/FormParts';

const schema = z.object({
  title: z.string().trim().min(5, 'Use at least 5 characters').max(120, 'Keep the title under 120 characters'),
  categoryId: z.coerce.number({ message: 'Choose a category' }).min(1, 'Choose a category'),
  condition: z.enum(['NEW', 'USED_EXCELLENT', 'USED_GOOD', 'USED_FAIR'], { message: 'Choose a condition' }),
  price: z.coerce.number({ message: 'Enter a price' }).min(0, 'Price cannot be negative').max(1_000_000_000, 'That price looks too high'),
  currency: z.enum(['UGX', 'USD']).default('UGX'),
  quantity: z.coerce.number().int('Whole numbers only').min(1, 'At least 1').default(1),
  location: z.string().trim().max(120).optional(),
  isNegotiable: z.boolean().default(false),
  description: z.string().trim().min(20, 'Add a bit more detail (at least 20 characters)').max(5000, 'Keep it under 5,000 characters'),
});

type FormIn = z.input<typeof schema>;
type FormOut = z.output<typeof schema>;

export default function CreateListingPage() {
  const { slug } = useParams<{ slug: string }>();
  const isEdit = !!slug;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const me = useAuthStore((s) => s.user);
  const [photos, setPhotos] = useState<File[]>([]);
  useDocumentTitle(isEdit ? 'Edit listing' : 'Sell an item');

  const { data: categories = [], isLoading: categoriesLoading } = useQuery({
    queryKey: ['marketplace', 'categories'],
    queryFn: () => categoriesApi.getCategories(),
    staleTime: 5 * 60_000,
  });

  const existing = useQuery({
    queryKey: ['marketplace', 'listing', slug],
    queryFn: () => marketplaceApi.getListing(slug!),
    enabled: isEdit,
  });

  const { register, handleSubmit, watch, reset, formState: { errors, isDirty } } = useForm<FormIn, unknown, FormOut>({
    resolver: zodResolver(schema),
    defaultValues: { currency: 'UGX', quantity: 1, isNegotiable: false },
  });

  useEffect(() => {
    const l = existing.data;
    if (!l) return;
    reset({
      title: l.title,
      categoryId: l.category?.id,
      condition: l.condition,
      price: Number(l.price),
      currency: (l.currency as 'UGX' | 'USD') ?? 'UGX',
      quantity: l.quantity,
      location: l.location ?? '',
      isNegotiable: l.isNegotiable,
      description: l.description,
    });
  }, [existing.data, reset]);

  const save = useMutation({
    mutationFn: async (data: FormOut) => {
      const listing = isEdit ? await marketplaceApi.updateListing(existing.data!.id, data) : await marketplaceApi.createListing(data);
      let photoError: unknown = null;
      if (photos.length) {
        try {
          await marketplaceApi.addImages(listing.id, photos);
        } catch (err) {
          photoError = err;
        }
      }
      return { listing, photoError };
    },
    onSuccess: ({ listing, photoError }) => {
      queryClient.invalidateQueries({ queryKey: ['marketplace'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      if (photoError) toast.warning(`Saved, but photos failed to upload: ${getErrorMessage(photoError, 'try again from Edit')}`);
      else toast.success(postSavedMessage('ad', listing.status, isEdit));
      navigate(`/marketplace/${listing.slug ?? slug}`);
    },
    onError: (err) => toast.error(getErrorMessage(err, "Couldn't save your listing")),
  });

  if (isEdit && existing.isLoading) return <PageLoader />;
  if (isEdit && (existing.error || (existing.data && existing.data.user?.id !== me?.id))) {
    return <ErrorState title="Can't edit this listing" message="It doesn't exist or it isn't yours." />;
  }

  const description = watch('description') ?? '';

  return (
    <Page width="sm">
      <PageHeader
        back={isEdit ? { to: '/dashboard', label: 'My posts' } : { to: '/post', label: 'Post something' }}
        title={isEdit ? 'Edit listing' : 'Sell an item'}
        description={
          isEdit
            ? 'Update your ad. Changes show up as soon as you save.'
            : 'Your ad appears in the Campus Market as soon as you post it.'
        }
      />

      <Card>
        <form onSubmit={handleSubmit((d) => save.mutate(d))} noValidate>
          <FormSection title="Photos" description="Show the item from a few angles, including any wear.">
            <PhotoPicker files={photos} onChange={setPhotos} existing={existing.data?.images} />
          </FormSection>

          <FormSection title="What are you selling?">
            <Field label="Title" htmlFor="title" hint="Brand, model and key detail, e.g. “HP EliteBook 840 G5, 16GB RAM”">
              <Input id="title" error={errors.title?.message} {...register('title')} />
            </Field>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Category" htmlFor="categoryId">
                <Select id="categoryId" error={errors.categoryId?.message} disabled={categoriesLoading} defaultValue="" {...register('categoryId')}>
                  <option value="" disabled>
                    {categoriesLoading ? 'Loading…' : 'Choose a category'}
                  </option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Condition" htmlFor="condition">
                <Select id="condition" error={errors.condition?.message} defaultValue="" {...register('condition')}>
                  <option value="" disabled>
                    Choose a condition
                  </option>
                  {Object.entries(CONDITION_LABELS).map(([value, text]) => (
                    <option key={value} value={value}>
                      {text}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <Field label="Description" htmlFor="description" hint={`${description.length.toLocaleString()} / 5,000`}>
              <Textarea
                id="description"
                rows={6}
                placeholder="Condition, what's included, reason for selling, where to meet…"
                error={errors.description?.message}
                {...register('description')}
              />
            </Field>
          </FormSection>

          <FormSection title="Price & availability">
            <div className="grid gap-5 sm:grid-cols-[1fr_120px_120px]">
              <Field label="Price" htmlFor="price">
                <Input id="price" type="number" inputMode="numeric" min={0} step="any" placeholder="0" error={errors.price?.message} {...register('price')} />
              </Field>
              <Field label="Currency" htmlFor="currency">
                <Select id="currency" {...register('currency')}>
                  <option value="UGX">UGX</option>
                  <option value="USD">USD</option>
                </Select>
              </Field>
              <Field label="Quantity" htmlFor="quantity">
                <Input id="quantity" type="number" inputMode="numeric" min={1} error={errors.quantity?.message} {...register('quantity')} />
              </Field>
            </div>
            <Checkbox label="Price is negotiable" description="Buyers will see that you're open to offers." {...register('isNegotiable')} />
            <Field label="Meet-up location" htmlFor="location" optional>
              <Input id="location" leadingIcon={<FiMapPin />} placeholder="e.g. Main campus, Nsambya" error={errors.location?.message} {...register('location')} />
            </Field>
          </FormSection>

          <FormActions note={isEdit ? undefined : 'By posting you agree to keep the listing honest and accurate.'}>
            <Button variant="outline" onClick={() => navigate(-1)} disabled={save.isPending}>
              Cancel
            </Button>
            <Button type="submit" loading={save.isPending} disabled={isEdit && !isDirty && !photos.length}>
              {isEdit ? 'Save changes' : 'Submit listing'}
            </Button>
          </FormActions>
        </form>
      </Card>
    </Page>
  );
}
