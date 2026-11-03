import {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
  forwardRef,
  useId,
} from 'react';
import { FiChevronDown } from 'react-icons/fi';
import { cn } from '../../lib/utils';

const fieldBase =
  'w-full rounded-xl border bg-white text-sm text-gray-900 shadow-card transition-[border-color,box-shadow] duration-150 placeholder:text-gray-400 focus:outline-none focus:ring-4 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500';
const fieldOk = 'border-gray-300 hover:border-gray-400 focus:border-brand-500 focus:ring-brand-500/15';
const fieldError = 'border-red-400 focus:border-red-500 focus:ring-red-500/15';

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="mt-1.5 text-xs font-medium text-red-600">
      {message}
    </p>
  );
}

type WithError = { error?: string; leadingIcon?: ReactNode };

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & WithError>(
  ({ className, error, leadingIcon, id, ...props }, ref) => {
    const auto = useId();
    const errId = `${id || auto}-error`;
    return (
      <div className="w-full">
        <div className="relative">
          {leadingIcon && (
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 [&>svg]:h-4 [&>svg]:w-4">
              {leadingIcon}
            </span>
          )}
          <input
            ref={ref}
            id={id}
            aria-invalid={!!error || undefined}
            aria-describedby={error ? errId : undefined}
            className={cn(fieldBase, 'h-11 px-3.5', !!leadingIcon && 'pl-10', error ? fieldError : fieldOk, className)}
            {...props}
          />
        </div>
        <FieldError id={errId} message={error} />
      </div>
    );
  }
);
Input.displayName = 'Input';

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & { error?: string }>(
  ({ className, error, id, ...props }, ref) => {
    const auto = useId();
    const errId = `${id || auto}-error`;
    return (
      <div className="w-full">
        <textarea
          ref={ref}
          id={id}
          aria-invalid={!!error || undefined}
          aria-describedby={error ? errId : undefined}
          className={cn(fieldBase, 'min-h-[96px] px-3.5 py-2.5 leading-relaxed', error ? fieldError : fieldOk, className)}
          {...props}
        />
        <FieldError id={errId} message={error} />
      </div>
    );
  }
);
Textarea.displayName = 'Textarea';

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & { error?: string }>(
  ({ className, error, children, id, ...props }, ref) => {
    const auto = useId();
    const errId = `${id || auto}-error`;
    return (
      <div className="w-full">
        <div className="relative">
          <select
            ref={ref}
            id={id}
            aria-invalid={!!error || undefined}
            aria-describedby={error ? errId : undefined}
            className={cn(fieldBase, 'h-11 appearance-none pl-3.5 pr-10', error ? fieldError : fieldOk, className)}
            {...props}
          >
            {children}
          </select>
          <FiChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        </div>
        <FieldError id={errId} message={error} />
      </div>
    );
  }
);
Select.displayName = 'Select';

export function Label({
  children,
  htmlFor,
  optional,
  className,
}: {
  children: ReactNode;
  htmlFor?: string;
  optional?: boolean;
  className?: string;
}) {
  return (
    <label htmlFor={htmlFor} className={cn('mb-1.5 block text-sm font-medium text-gray-800', className)}>
      {children}
      {optional && <span className="ml-1 font-normal text-gray-400">(optional)</span>}
    </label>
  );
}

/** Label + control + hint, in the standard vertical rhythm. */
export function Field({
  label,
  htmlFor,
  optional,
  hint,
  children,
  className,
}: {
  label: ReactNode;
  htmlFor?: string;
  optional?: boolean;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label htmlFor={htmlFor} optional={optional}>
        {label}
      </Label>
      {children}
      {hint && <p className="mt-1.5 text-xs text-gray-500">{hint}</p>}
    </div>
  );
}

/** A labelled checkbox with an optional description line. */
export const Checkbox = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & { label: ReactNode; description?: ReactNode }
>(({ label, description, id, className, ...props }, ref) => {
  const auto = useId();
  const inputId = id || auto;
  return (
    <label
      htmlFor={inputId}
      className={cn(
        'flex cursor-pointer items-start gap-3 rounded-xl border border-gray-200 bg-white p-3 transition-colors hover:border-gray-300 has-[:checked]:border-brand-300 has-[:checked]:bg-brand-50/50',
        className
      )}
    >
      <input
        ref={ref}
        id={inputId}
        type="checkbox"
        className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 accent-brand-600"
        {...props}
      />
      <span className="min-w-0">
        <span className="block text-sm font-medium text-gray-900">{label}</span>
        {description && <span className="mt-0.5 block text-xs text-gray-500">{description}</span>}
      </span>
    </label>
  );
});
Checkbox.displayName = 'Checkbox';
