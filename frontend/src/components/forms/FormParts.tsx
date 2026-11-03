import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { FiImage, FiUploadCloud, FiX } from 'react-icons/fi';
import { toast } from 'sonner';
import { ListingImage } from '../../types';
import { cn } from '../../lib/utils';
import { orderImages } from '../listing/DetailParts';

/** A titled group of fields inside a form card. */
export function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="border-b border-gray-100 px-5 py-6 last:border-0 sm:px-8 sm:py-7">
      <div className="mb-5">
        <h2 className="text-base font-semibold text-gray-900">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-gray-500">{description}</p>}
      </div>
      <div className="space-y-5">{children}</div>
    </section>
  );
}

/** Sticky bottom bar with the form's main actions, so they are always reachable. */
export function FormActions({ children, note }: { children: ReactNode; note?: ReactNode }) {
  return (
    <div className="sticky bottom-16 z-10 flex flex-col gap-3 rounded-b-2xl border-t border-gray-100 bg-white/95 px-5 py-4 backdrop-blur sm:flex-row sm:items-center sm:justify-between sm:px-8 md:bottom-0">
      <p className="text-xs text-gray-500">{note}</p>
      <div className="flex gap-2 sm:justify-end [&>*]:flex-1 sm:[&>*]:flex-none">{children}</div>
    </div>
  );
}

const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_BYTES = 5 * 1024 * 1024;
export const MAX_PHOTOS = 10;

/**
 * Lets people add photos with instant previews. Existing photos (edit mode)
 * are shown first; new files are uploaded by the page after saving.
 */
export function PhotoPicker({
  files,
  onChange,
  existing,
}: {
  files: File[];
  onChange: (files: File[]) => void;
  existing?: ListingImage[];
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const current = orderImages(existing);
  const remaining = MAX_PHOTOS - current.length - files.length;

  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);

  const add = (list: FileList | null) => {
    if (!list) return;
    const accepted: File[] = [];
    for (const file of Array.from(list)) {
      if (!ACCEPTED.includes(file.type)) {
        toast.error(`${file.name}: use a JPEG, PNG, WebP or GIF image`);
      } else if (file.size > MAX_BYTES) {
        toast.error(`${file.name} is larger than 5 MB`);
      } else if (accepted.length >= remaining) {
        toast.error(`You can add up to ${MAX_PHOTOS} photos`);
        break;
      } else {
        accepted.push(file);
      }
    }
    if (accepted.length) onChange([...files, ...accepted]);
  };

  return (
    <div>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
        {current.map((img, i) => (
          <div key={img.id} className="relative aspect-square overflow-hidden rounded-xl bg-gray-100 ring-1 ring-gray-200">
            <img src={img.url} alt="" className="h-full w-full object-cover" />
            {i === 0 && (
              <span className="absolute bottom-1.5 left-1.5 rounded-md bg-gray-900/75 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                Cover
              </span>
            )}
          </div>
        ))}
        {previews.map((url, i) => (
          <div key={url} className="group relative aspect-square overflow-hidden rounded-xl bg-gray-100 ring-1 ring-brand-200">
            <img src={url} alt="" className="h-full w-full object-cover" />
            {current.length === 0 && i === 0 && (
              <span className="absolute bottom-1.5 left-1.5 rounded-md bg-gray-900/75 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                Cover
              </span>
            )}
            <button
              type="button"
              onClick={() => onChange(files.filter((_, j) => j !== i))}
              className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-white/95 text-gray-700 shadow-sm hover:text-red-600"
              aria-label="Remove photo"
            >
              <FiX className="h-4 w-4" />
            </button>
          </div>
        ))}
        {remaining > 0 && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              add(e.dataTransfer.files);
            }}
            className={cn(
              'flex aspect-square flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed text-xs font-medium transition-colors',
              dragging ? 'border-brand-400 bg-brand-50 text-brand-700' : 'border-gray-300 text-gray-500 hover:border-brand-300 hover:bg-brand-50/50 hover:text-brand-700'
            )}
          >
            {current.length + files.length === 0 ? <FiUploadCloud className="h-6 w-6" /> : <FiImage className="h-5 w-5" />}
            Add photo
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED.join(',')}
        multiple
        className="hidden"
        onChange={(e) => {
          add(e.target.files);
          e.target.value = '';
        }}
      />
      <p className="mt-2 text-xs text-gray-500">
        Up to {MAX_PHOTOS} photos, 5 MB each. The first photo is the cover. Clear, well-lit photos get more replies.
      </p>
    </div>
  );
}

/** Turns empty number inputs into "not set" instead of 0. */
export const emptyToUndefined = (v: unknown) => (v === '' || v === null || Number.isNaN(v) ? undefined : v);

/** Toast after saving a post, based on the status the server actually gave it. */
export function postSavedMessage(noun: string, status: string | undefined, isEdit: boolean) {
  if (status === 'ACTIVE') return isEdit ? `Changes saved. Your ${noun} is live.` : `Your ${noun} is live! Everyone can see it now.`;
  if (status === 'PENDING_REVIEW') return isEdit ? `Changes saved. Your ${noun} is waiting for review.` : `Your ${noun} was submitted for review.`;
  return `Changes saved.`;
}
