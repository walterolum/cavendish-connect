import { useState } from 'react';
import { FiMapPin, FiNavigation } from 'react-icons/fi';
import { useBrand } from '../../lib/settings';
import { Card } from '../ui/card';

/**
 * Where an item, service or property is: an embedded map plus a
 * "Get directions" link that opens the phone's maps app.
 */
export function LocationMap({ location, latitude, longitude, title = 'Where to find it' }: { location?: string | null; latitude?: number | string | null; longitude?: number | string | null; title?: string }) {
  const brand = useBrand();
  const [loaded, setLoaded] = useState(false);
  if (!location && (latitude == null || longitude == null)) return null;

  const hasCoords = latitude != null && longitude != null && !Number.isNaN(Number(latitude)) && !Number.isNaN(Number(longitude));
  // Free-text places are searched near the university's city for accuracy.
  const query = hasCoords ? `${latitude},${longitude}` : `${location}${brand.location && !location!.includes(brand.city) ? `, ${brand.location}` : ''}`;
  const q = encodeURIComponent(query);

  return (
    <Card className="mt-6 overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-5 py-4 sm:px-6">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          {location && (
            <p className="mt-0.5 flex items-center gap-1.5 truncate text-sm text-gray-500">
              <FiMapPin className="h-3.5 w-3.5 shrink-0" /> {location}
            </p>
          )}
        </div>
        <a
          href={`https://www.google.com/maps/dir/?api=1&destination=${q}`}
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl bg-brand-600 px-3.5 text-sm font-semibold text-white transition hover:bg-brand-700"
        >
          <FiNavigation className="h-4 w-4" /> Get directions
        </a>
      </div>
      <div className="relative aspect-[16/9] bg-gray-100 sm:aspect-[21/9]">
        {!loaded && <div className="skeleton absolute inset-0" aria-hidden="true" />}
        <iframe
          title={`Map showing ${location ?? 'the location'}`}
          src={`https://maps.google.com/maps?q=${q}&z=15&output=embed`}
          className="absolute inset-0 h-full w-full border-0"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          onLoad={() => setLoaded(true)}
        />
      </div>
      <p className="px-5 py-2.5 text-xs text-gray-500 sm:px-6">The pin is approximate. Confirm the exact spot with the seller in chat.</p>
    </Card>
  );
}
