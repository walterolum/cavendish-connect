import { FormEvent, ReactNode, useEffect, useState } from 'react';
import { FiSearch, FiX } from 'react-icons/fi';
import { cn } from '../../lib/utils';
import { getErrorMessage } from '../../lib/api';
import { Button } from '../ui/button';
import { Input, Field, Textarea } from '../ui/input';
import { Modal } from '../ui/modal';
import { EmptyState, ErrorState, Skeleton } from '../ui/loading';

/** Card that holds a page's filters, above its results. */
export function Toolbar({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'mb-4 flex flex-col gap-3 rounded-2xl border border-gray-200/80 bg-white p-3 shadow-card sm:flex-row sm:flex-wrap sm:items-center',
        className
      )}
    >
      {children}
    </div>
  );
}

/** Search field that applies on Enter and can be cleared in one click. */
export function SearchBox({
  value,
  onSearch,
  placeholder,
  className,
}: {
  value: string;
  onSearch: (value: string) => void;
  placeholder: string;
  className?: string;
}) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSearch(text.trim());
  };

  return (
    <form onSubmit={submit} role="search" className={cn('relative min-w-0 flex-1', className)}>
      <Input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        leadingIcon={<FiSearch className="h-4 w-4" />}
        className="pr-9"
      />
      {text && (
        <button
          type="button"
          onClick={() => {
            setText('');
            onSearch('');
          }}
          className="absolute top-1/2 right-2 -translate-y-1/2 rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          aria-label="Clear search"
        >
          <FiX className="h-4 w-4" />
        </button>
      )}
    </form>
  );
}

/** Handles loading, error and empty states the same way on every admin list. */
export function ListState({
  isLoading,
  error,
  isEmpty,
  onRetry,
  errorFallback,
  empty,
  children,
  rows = 6,
}: {
  isLoading: boolean;
  error: unknown;
  isEmpty: boolean;
  onRetry: () => void;
  errorFallback: string;
  empty: { icon: ReactNode; title: string; message: ReactNode; action?: string; onAction?: () => void };
  children: ReactNode;
  rows?: number;
}) {
  if (isLoading) {
    return (
      <div className="overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-card" role="status" aria-label="Loading">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-gray-100 px-5 py-4 last:border-0">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3.5 w-1/3" />
              <Skeleton className="h-3 w-1/2" />
            </div>
            <Skeleton className="h-8 w-20 rounded-lg" />
          </div>
        ))}
      </div>
    );
  }
  if (error) {
    return (
      <div className="rounded-2xl border border-gray-200/80 bg-white shadow-card">
        <ErrorState message={getErrorMessage(error, errorFallback)} onRetry={onRetry} />
      </div>
    );
  }
  if (isEmpty) {
    return (
      <div className="rounded-2xl border border-gray-200/80 bg-white shadow-card">
        <EmptyState {...empty} />
      </div>
    );
  }
  return <>{children}</>;
}

/** Table frame: scrolls sideways on small screens instead of breaking the layout. */
export function Table({ head, children, footer }: { head: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-card">
      <div className="overflow-x-auto">
        <table className="min-w-full text-left">
          <thead className="border-b border-gray-200 bg-gray-50/80">
            <tr>{head}</tr>
          </thead>
          <tbody className="divide-y divide-gray-100">{children}</tbody>
        </table>
      </div>
      {footer && <div className="border-t border-gray-100 px-4 py-3">{footer}</div>}
    </div>
  );
}

export function Th({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <th scope="col" className={cn('px-5 py-3 text-xs font-semibold tracking-wide whitespace-nowrap text-gray-500 uppercase', className)}>
      {children}
    </th>
  );
}

export function Td({ children, className }: { children?: ReactNode; className?: string }) {
  return <td className={cn('px-5 py-3.5 align-middle text-sm text-gray-600', className)}>{children}</td>;
}

/** Card list frame, for records with more text than fits a table row. */
export function RecordList({ children, footer }: { children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-card">
      <ul className="divide-y divide-gray-100">{children}</ul>
      {footer && <div className="border-t border-gray-100 px-4 py-3">{footer}</div>}
    </div>
  );
}

/**
 * Confirmation that collects a note: a rejection reason, a resolution, etc.
 * The note is sent to the server and, where relevant, shown to the user.
 */
export function ReasonDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  label,
  placeholder,
  confirmLabel,
  tone = 'danger',
  required = false,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (note: string) => void;
  title: string;
  description?: ReactNode;
  label: string;
  placeholder?: string;
  confirmLabel: string;
  tone?: 'danger' | 'primary' | 'success';
  required?: boolean;
  loading?: boolean;
}) {
  const [note, setNote] = useState('');
  const [touched, setTouched] = useState(false);
  useEffect(() => {
    if (open) {
      setNote('');
      setTouched(false);
    }
  }, [open]);

  const missing = required && !note.trim();
  const submit = () => {
    setTouched(true);
    if (!missing) onConfirm(note.trim());
  };

  return (
    <Modal
      open={open}
      onClose={loading ? () => {} : onClose}
      title={title}
      description={description}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button variant={tone} onClick={submit} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <Field label={label} htmlFor="reason-note" optional={!required}>
        <Textarea
          id="reason-note"
          rows={3}
          maxLength={500}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={placeholder}
          error={touched && missing ? 'Please add a note' : undefined}
          autoFocus
        />
      </Field>
    </Modal>
  );
}

/** Small "x results" line shown in page headers. */
export function countLabel(total: number | undefined, singular: string, plural = `${singular}s`) {
  if (total === undefined) return undefined;
  return `${total.toLocaleString()} ${total === 1 ? singular : plural}`;
}
