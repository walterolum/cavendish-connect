import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { FiMapPin, FiNavigation } from 'react-icons/fi';
import { toast } from 'sonner';
import { accommodationApi } from '../../services/listing.service';
import { categoriesApi } from '../../services/marketplace.service';
import { getErrorMessage } from '../../lib/api';
import { useDocumentTitle } from '../../lib/hooks';
import { PROPERTY_TYPE_LABELS } from '../../lib/labels';
import { useAuthStore } from '../../store/auth';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { Checkbox, Field, Input, Select, Textarea } from '../../components/ui/input';
import { Page, PageHeader } from '../../components/ui/page';
import { ErrorState, PageLoader } from '../../components/ui/loading';
import { FormActions, FormSection, PhotoPicker, emptyToUndefined, postSavedMessage } from '../../components/forms/FormParts';

const PROPERTY_TYPES = ['HOSTEL', 'SINGLE_ROOM', 'SHARED_ROOM', 'APARTMENT', 'HOUSE', 'BEDSITTER', 'OTHER'] as const;

const FEATURES = [
  { key: 'hasWater', label: 'Running water' },
  { key: 'hasElectricity', label: 'Electricity' },
  { key: 'hasWifi', label: 'Wi-Fi' },
  { key: 'hasSecurity', label: 'Security / guard' },
  { key: 'hasParking', label: 'Parking' },
  { key: 'isFurnished', label: 'Furnished' },
] as const;

const schema = z
  .object({
    title: z.string().trim().min(5, 'Use at least 5 characters').max(120, 'Keep the title under 120 characters'),
    categoryId: z.coerce.number({ message: 'Choose a category' }).min(1, 'Choose a category'),
    propertyType: z.enum(PROPERTY_TYPES, { message: 'Choose a type' }),
    description: z.string().trim().min(20, 'Add a bit more detail (at least 20 characters)').max(5000),
    location: z.string().trim().min(2, 'Enter the area or street'),
    distanceFromCampus: z.string().trim().max(60).optional(),
    monthlyPrice: z.coerce.number({ message: 'Enter the monthly rent' }).min(0, 'Cannot be negative'),
    depositAmount: z.preprocess(emptyToUndefined, z.coerce.number().min(0, 'Cannot be negative').optional()),
    totalRooms: z.coerce.number().int().min(1, 'At least 1 room').default(1),
    availableRooms: z.coerce.number().int().min(0, 'Cannot be negative').default(1),
    roomType: z.string().trim().max(100).optional(),
    isFurnished: z.boolean().default(false),
    hasWifi: z.boolean().default(false),
    hasWater: z.boolean().default(true),
    hasElectricity: z.boolean().default(true),
    hasSecurity: z.boolean().default(false),
    hasParking: z.boolean().default(false),
    rules: z.string().trim().max(2000).optional(),
  })
  .refine((d) => d.availableRooms <= d.totalRooms, {
    path: ['availableRooms'],
    message: "Can't be more than the total rooms",
  });

type FormIn = z.input<typeof schema>;
type FormOut = z.output<typeof schema>;

export default function CreateAccommodationPage() {
  const { slug } = useParams<{ slug: string }>();
  const isEdit = !!slug;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const me = useAuthStore((s) => s.user);
  const [photos, setPhotos] = useState<File[]>([]);
  useDocumentTitle(isEdit ? 'Edit accommodation' : 'List accommodation');

  const { data: categories = [], isLoading: categoriesLoading } = useQuery({
    queryKey: ['property-categories'],
    queryFn: () => categoriesApi.getPropertyCategories(),
    staleTime: 5 * 60_000,
  });

  const existing = useQuery({
    queryKey: ['accommodation', 'detail', slug],
    queryFn: () => accommodationApi.getProperty(slug!),
    enabled: isEdit,
  });

  const { register, handleSubmit, watch, reset, formState: { errors, isDirty } } = useForm<FormIn, unknown, FormOut>({
    resolver: zodResolver(schema),
    defaultValues: {
      totalRooms: 1,
      availableRooms: 1,
      isFurnished: false,
      hasWifi: false,
      hasWater: true,
      hasElectricity: true,
      hasSecurity: false,
      hasParking: false,
    },
  });

  useEffect(() => {
    const p = existing.data;
    if (!p) return;
    reset({
      title: p.title,
      categoryId: p.propertyCategory?.id,
      propertyType: p.propertyType,
      description: p.description,
      location: p.location,
      distanceFromCampus: p.distanceFromCampus ?? '',
      monthlyPrice: Number(p.monthlyPrice),
      depositAmount: p.depositAmount != null ? Number(p.depositAmount) : undefined,
      totalRooms: p.totalRooms,
      availableRooms: p.availableRooms,
      roomType: p.roomType ?? '',
      isFurnished: p.isFurnished,
      hasWifi: p.hasWifi,
      hasWater: p.hasWater,
      hasElectricity: p.hasElectricity,
      hasSecurity: p.hasSecurity,
      hasParking: p.hasParking,
      rules: p.rules ?? '',
    });
  }, [existing.data, reset]);

  const save = useMutation({
    mutationFn: async (data: FormOut) => {
      const property = isEdit ? await accommodationApi.updateProperty(existing.data!.id, data) : await accommodationApi.createProperty(data);
      let photoError: unknown = null;
      if (photos.length) {
        try {
          await accommodationApi.addImages(property.id, photos);
        } catch (err) {
          photoError = err;
        }
      }
      return { property, photoError };
    },
    onSuccess: ({ property, photoError }) => {
      queryClient.invalidateQueries({ queryKey: ['accommodation'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      if (photoError) toast.warning(`Saved, but photos failed to upload: ${getErrorMessage(photoError, 'try again from Edit')}`);
      else toast.success(postSavedMessage('listing', property.status, isEdit));
      navigate(`/accommodation/${property.slug ?? slug}`);
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
        title={isEdit ? 'Edit accommodation' : 'List accommodation'}
        description={
          isEdit
            ? 'Update your listing. Changes show up as soon as you save.'
            : 'Hostels, rooms and apartments near campus. Accurate listings get booked faster.'
        }
      />

      <Card>
        <form onSubmit={handleSubmit((d) => save.mutate(d))} noValidate>
          <FormSection title="Photos" description="Rooms, bathroom, kitchen, outside and the view from the gate.">
            <PhotoPicker files={photos} onChange={setPhotos} existing={existing.data?.images} />
          </FormSection>

          <FormSection title="The place">
            <Field label="Title" htmlFor="title" hint="e.g. “Self-contained single room, 5 min walk to main campus”">
              <Input id="title" error={errors.title?.message} {...register('title')} />
            </Field>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Type" htmlFor="propertyType">
                <Select id="propertyType" error={errors.propertyType?.message} defaultValue="" {...register('propertyType')}>
                  <option value="" disabled>
                    Choose a type
                  </option>
                  {PROPERTY_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {PROPERTY_TYPE_LABELS[t]}
                    </option>
                  ))}
                </Select>
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
            </div>
            <Field label="Description" htmlFor="description" hint={`${description.length.toLocaleString()} / 5,000`}>
              <Textarea
                id="description"
                rows={6}
                placeholder="Room size, bathroom, kitchen access, neighbourhood, who it suits…"
                error={errors.description?.message}
                {...register('description')}
              />
            </Field>
          </FormSection>

          <FormSection title="Location">
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Area or street" htmlFor="location">
                <Input id="location" leadingIcon={<FiMapPin />} placeholder="e.g. Nsambya, Ggaba Road" error={errors.location?.message} {...register('location')} />
              </Field>
              <Field label="Distance from campus" htmlFor="distanceFromCampus" optional>
                <Input id="distanceFromCampus" leadingIcon={<FiNavigation />} placeholder="e.g. 10 min walk" {...register('distanceFromCampus')} />
              </Field>
            </div>
          </FormSection>

          <FormSection title="Rooms & cost">
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Monthly rent (UGX)" htmlFor="monthlyPrice">
                <Input id="monthlyPrice" type="number" inputMode="numeric" min={0} placeholder="0" error={errors.monthlyPrice?.message} {...register('monthlyPrice')} />
              </Field>
              <Field label="Deposit (UGX)" htmlFor="depositAmount" optional>
                <Input id="depositAmount" type="number" inputMode="numeric" min={0} placeholder="None" error={errors.depositAmount?.message} {...register('depositAmount')} />
              </Field>
              <Field label="Total rooms" htmlFor="totalRooms">
                <Input id="totalRooms" type="number" inputMode="numeric" min={1} error={errors.totalRooms?.message} {...register('totalRooms')} />
              </Field>
              <Field label="Rooms available now" htmlFor="availableRooms">
                <Input id="availableRooms" type="number" inputMode="numeric" min={0} error={errors.availableRooms?.message} {...register('availableRooms')} />
              </Field>
            </div>
            <Field label="Room type" htmlFor="roomType" optional>
              <Input id="roomType" placeholder="e.g. Self-contained, shared bathroom" {...register('roomType')} />
            </Field>
          </FormSection>

          <FormSection title="Facilities" description="Tick everything that's included in the rent.">
            <div className="grid gap-2 sm:grid-cols-2">
              {FEATURES.map((f) => (
                <Checkbox key={f.key} label={f.label} {...register(f.key)} />
              ))}
            </div>
            <Field label="House rules" htmlFor="rules" optional>
              <Textarea id="rules" rows={3} placeholder="e.g. Quiet hours after 10pm, visitors until 8pm" {...register('rules')} />
            </Field>
          </FormSection>

          <FormActions>
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
