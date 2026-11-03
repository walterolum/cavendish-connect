import { MouseEvent, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { FiHeart } from 'react-icons/fi';
import { toast } from 'sonner';
import { favoritesApi, FavoriteType } from '../../services/favorites.service';
import { getErrorMessage } from '../../lib/api';
import { useAuthGate } from '../../lib/hooks';
import { cn } from '../../lib/utils';

/**
 * Heart button that sits on top of a card image. Responds instantly,
 * rolls back if the request fails, and never triggers the card's link.
 */
export function FavoriteHeart({
  type,
  id,
  initial = false,
  className,
}: {
  type: FavoriteType;
  id: number;
  initial?: boolean;
  className?: string;
}) {
  const [saved, setSaved] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [pulse, setPulse] = useState(false);
  const gate = useAuthGate();
  const queryClient = useQueryClient();
  useEffect(() => setSaved(initial), [initial]);

  const onClick = async (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (busy || !gate('Sign in to save items')) return;
    const next = !saved;
    setSaved(next);
    setPulse(next);
    setBusy(true);
    try {
      const res = await favoritesApi.toggleFavorite(type, id);
      setSaved(res.favorited);
      toast.success(res.favorited ? 'Saved to your favourites' : 'Removed from favourites');
      queryClient.invalidateQueries({ queryKey: ['favorites'] });
    } catch (err) {
      setSaved(!next);
      toast.error(getErrorMessage(err, "Couldn't update your saved items"));
    } finally {
      setBusy(false);
      window.setTimeout(() => setPulse(false), 400);
    }
  };

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={saved}
      aria-label={saved ? 'Remove from saved' : 'Save'}
      className={cn(
        'flex h-9 w-9 items-center justify-center rounded-full transition-all duration-200 hover:scale-110 active:scale-95',
        className
      )}
    >
      <FiHeart
        className={cn(
          'h-[22px] w-[22px] drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)] transition-all duration-300',
          saved ? 'fill-red-500 text-red-500' : 'fill-black/20 text-white',
          pulse && 'scale-125'
        )}
      />
    </button>
  );
}
