import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { FiCalendar, FiMapPin } from 'react-icons/fi';
import { toast } from 'sonner';
import { servicesApi } from '../../services/listing.service';
import { categoriesApi } from '../../services/marketplace.service';
import { getErrorMessage } from '../../lib/api';
import { useDocumentTitle } from '../../lib/hooks';
import { PRICE_TYPE_LABELS } from '../../lib/labels';
import { useAuthStore } from '../../store/auth';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { Field, Input, Select, Textarea } from '../../components/ui/input';
import { Page, PageHeader } from '../../components/ui/page';
import { ErrorState, PageLoader } from '../../components/ui/loading';
import { FormActions, FormSection, PhotoPicker, emptyToUndefined, postSavedMessage } from '../../components/forms/FormParts';

const PRICE_TYPES = ['fixed', 'hourly', 'daily', 'negotiable', 'quote'] as const;
const optionalPrice = z.preprocess(emptyToUndefined, z.coerce.number().min(0, 'Cannot be negative').optional());

const schema = z
  .object({
    title: z.string().trim().min(5, 'Use at least 5 characters').max(120, 'Keep the title under 120 characters'),
    categoryId: z.coerce.number({ message: 'Choose a category' }).min(1, 'Choose a category'),
    description: z.string().trim().min(20, 'Add a bit more detail (at least 20 characters)').max(5000),
    priceType: z.enum(PRICE_TYPES).default('fixed'),
    priceMin: optionalPrice,
    priceMax: optionalPrice,
    currency: z.enum(['UGX', 'USD', 'KES', 'TZS']).default('UGX'),
    location: z.string().trim().max(120).optional(),
    availability: z.string().trim().max(500).optional(),
  })
  .refine((d) => d.priceMin == null || d.priceMax == null || d.priceMax >= d.priceMin, {
    path: ['priceMax'],
    message: 'Must be at least the starting price',
  })
  .refine((d) => d.priceType === 'quote' || d.priceType === 'negotiable' || d.priceMin != null, {
    path: ['priceMin'],
    message: 'Enter a starting price, or choose “On quote”',
  });

type FormIn = z.input<typeof schema>;
type FormOut = z.output<typeof schema>;

export default function CreateServicePage() {
  const { slug } = useParams<{ slug: string }>();
  const isEdit = !!slug;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const me = useAuthStore((s) => s.user);
  const [photos, setPhotos] = useState<File[]>([]);
  useDocumentTitle(isEdit ? 'Edit service' : 'Offer a service');

  const { data: categories = [], isLoading: categoriesLoading } = useQuery({
    queryKey: ['service-categories'],
    queryFn: () => categoriesApi.getServiceCategories(),
    staleTime: 5 * 60_000,
  });

  const existing = useQuery({
    queryKey: ['services', 'detail', slug],
    queryFn: () => servicesApi.getService(slug!),
    enabled: isEdit,
  });

  const { register, handleSubmit, watch, reset, formState: { errors, isDirty } } = useForm<FormIn, unknown, FormOut>({
    resolver: zodResolver(schema),
    defaultValues: { currency: 'UGX', priceType: 'fixed' },
  });

  useEffect(() => {
    const s = existing.data;
    if (!s) return;
    reset({
      title: s.title,
      categoryId: s.serviceCategory?.id,
      description: s.description,
      priceType: (s.priceType as FormIn['priceType']) ?? 'fixed',
      priceMin: s.priceMin != null ? Number(s.priceMin) : undefined,
      priceMax: s.priceMax != null ? Number(s.priceMax) : undefined,
      currency: (s.currency as FormIn['currency']) ?? 'UGX',
      location: s.location ?? '',
      availability: s.availability ?? '',
    });
  }, [existing.data, reset]);

  const save = useMutation({
    mutationFn: async (data: FormOut) => {
      const service = isEdit ? await servicesApi.updateService(existing.data!.id, data) : await servicesApi.createService(data);
      let photoError: unknown = null;
      if (photos.length) {
        try {
          await servicesApi.addImages(service.id, photos);
        } catch (err) {
          photoError = err;
        }
      }
      return { service, photoError };
    },
    onSuccess: ({ service, photoError }) => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      if (photoError) toast.warning(`Saved, but photos failed to upload: ${getErrorMessage(photoError, 'try again from Edit')}`);
      else toast.success(postSavedMessage('service', service.status, isEdit));
      navigate(`/services/${service.slug ?? slug}`);
    },
    onError: (err) => toast.error(getErrorMessage(err, "Couldn't save your service")),
  });

  if (isEdit && existing.isLoading) return <PageLoader />;
  if (isEdit && (existing.error || (existing.data && existing.data.user?.id !== me?.id))) {
    return <ErrorState title="Can't edit this service" message="It doesn't exist or it isn't yours." />;
  }

  const description = watch('description') ?? '';
  const priceType = watch('priceType');

  return (
    <Page width="sm">
      <PageHeader
        back={isEdit ? { to: '/dashboard', label: 'My posts' } : { to: '/post', label: 'Post something' }}
        title={isEdit ? 'Edit service' : 'Offer a service'}
        description={
          isEdit
            ? 'Update your service. Changes show up as soon as you save.'
            : 'Tutoring, design, repairs, events — let the community find your skills.'
        }
      />

      <Card>
        <form onSubmit={handleSubmit((d) => save.mutate(d))} noValidate>
          <FormSection title="Photos" description="Examples of your work, your setup, or you in action.">
            <PhotoPicker files={photos} onChange={setPhotos} existing={existing.data?.images} />
          </FormSection>

          <FormSection title="About the service">
            <Field label="Title" htmlFor="title" hint="Say what you do and for whom, e.g. “Calculus & physics tutoring for first years”">
              <Input id="title" error={errors.title?.message} {...register('title')} />
            </Field>
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
            <Field label="Description" htmlFor="description" hint={`${description.length.toLocaleString()} / 5,000`}>
              <Textarea
                id="description"
                rows={6}
                placeholder="What's included, your experience, how a session or job works…"
                error={errors.description?.message}
                {...register('description')}
              />
            </Field>
          </FormSection>

          <FormSection title="Pricing">
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="How you charge" htmlFor="priceType">
                <Select id="priceType" {...register('priceType')}>
                  {PRICE_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {PRICE_TYPE_LABELS[t]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Currency" htmlFor="currency">
                <Select id="currency" {...register('currency')}>
                  <option value="UGX">UGX</option>
                  <option value="USD">USD</option>
                  <option value="KES">KES</option>
                  <option value="TZS">TZS</option>
                </Select>
              </Field>
              <Field label="Starting price" htmlFor="priceMin" optional={priceType === 'quote' || priceType === 'negotiable'}>
                <Input id="priceMin" type="number" inputMode="numeric" min={0} placeholder="0" error={errors.priceMin?.message} {...register('priceMin')} />
              </Field>
              <Field label="Up to" htmlFor="priceMax" optional hint="Leave empty for a single price.">
                <Input id="priceMax" type="number" inputMode="numeric" min={0} placeholder="—" error={errors.priceMax?.message} {...register('priceMax')} />
              </Field>
            </div>
          </FormSection>

          <FormSection title="Where & when">
            <Field label="Location" htmlFor="location" optional>
              <Input id="location" leadingIcon={<FiMapPin />} placeholder="e.g. On campus, or online" {...register('location')} />
            </Field>
            <Field label="Availability" htmlFor="availability" optional>
              <Input id="availability" leadingIcon={<FiCalendar />} placeholder="e.g. Weekdays after 4pm, Saturdays" {...register('availability')} />
            </Field>
          </FormSection>

          <FormActions>
            <Button variant="outline" onClick={() => navigate(-1)} disabled={save.isPending}>
              Cancel
            </Button>
            <Button type="submit" loading={save.isPending} disabled={isEdit && !isDirty && !photos.length}>
              {isEdit ? 'Save changes' : 'Submit service'}
            </Button>
          </FormActions>
        </form>
      </Card>
    </Page>
  );
}
