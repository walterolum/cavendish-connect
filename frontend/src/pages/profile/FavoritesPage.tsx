import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { FiHeart } from 'react-icons/fi';
import { getErrorMessage } from '../../lib/api';
import { useDocumentTitle } from '../../lib/hooks';
import { favoritesApi, Favorite } from '../../services/favorites.service';
import { MarketplaceListing, Property, Service } from '../../types';
import { ButtonLink } from '../../components/ui/button';
import { CardGrid, Page, PageHeader } from '../../components/ui/page';
import { CardGridSkeleton, EmptyState, ErrorState } from '../../components/ui/loading';
import { Segmented } from '../../components/ui/tabs';
import ListingCard from '../../components/listing/ListingCard';
import ServiceCard from '../../components/listing/ServiceCard';
import PropertyCard from '../../components/listing/PropertyCard';

type Filter = 'ALL' | 'MARKETPLACE' | 'SERVICE' | 'ACCOMMODATION';

export default function FavoritesPage() {
  useDocumentTitle('Saved');
  const [type, setType] = useState<Filter>('ALL');
  const queryClient = useQueryClient();

  const { data: favorites = [], isLoading, error, refetch } = useQuery({
    queryKey: ['favorites', type],
    queryFn: () => favoritesApi.getFavorites(type === 'ALL' ? undefined : type),
  });

  const remove = useMutation({
    mutationFn: (fav: Favorite) => favoritesApi.toggleFavorite(fav.targetType, fav.targetId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['favorites'] });
      toast.success('Removed from saved');
    },
    onError: (err) => toast.error(getErrorMessage(err, "Couldn't update your saved items")),
  });

  const visible = favorites.filter((f) => f.target);
  const hidden = favorites.length - visible.length;

  return (
    <Page>
      <PageHeader
        title="Saved"
        description="Items, services and places you've saved for later."
        actions={
          <Segmented<Filter>
            value={type}
            onChange={setType}
            items={[
              { key: 'ALL', label: 'All' },
              { key: 'MARKETPLACE', label: 'Items' },
              { key: 'SERVICE', label: 'Services' },
              { key: 'ACCOMMODATION', label: 'Accommodation' },
            ]}
          />
        }
      />

      {isLoading ? (
        <CardGridSkeleton count={4} />
      ) : error ? (
        <ErrorState message={getErrorMessage(error, "Couldn't load your saved items")} onRetry={() => refetch()} />
      ) : !visible.length ? (
        <EmptyState icon={<FiHeart />} title="Nothing saved yet" message="Tap Save on anything you like and it will wait for you here.">
          <ButtonLink to="/explore" variant="outline">
            Start exploring
          </ButtonLink>
        </EmptyState>
      ) : (
        <CardGrid>
          {visible.map((fav) => (
            <div key={fav.id} className="relative">
              {fav.targetType === 'MARKETPLACE' && <ListingCard listing={fav.target as MarketplaceListing} />}
              {fav.targetType === 'SERVICE' && <ServiceCard service={fav.target as Service} />}
              {fav.targetType === 'ACCOMMODATION' && <PropertyCard property={fav.target as Property} />}
              <button
                type="button"
                onClick={() => remove.mutate(fav)}
                disabled={remove.isPending}
                className="absolute right-2.5 top-2.5 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white text-red-500 shadow-sm transition hover:scale-105"
                aria-label="Remove from saved"
                title="Remove from saved"
              >
                <FiHeart className="h-4 w-4 fill-current" />
              </button>
            </div>
          ))}
        </CardGrid>
      )}

      {hidden > 0 && (
        <p className="mt-6 text-center text-sm text-gray-500">
          {hidden} saved item{hidden > 1 ? 's are' : ' is'} no longer available and {hidden > 1 ? 'were' : 'was'} hidden.
        </p>
      )}
    </Page>
  );
}
