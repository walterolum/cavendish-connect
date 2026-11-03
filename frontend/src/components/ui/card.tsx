import { ReactNode } from 'react';
import { cn } from '../../lib/utils';

type Props = { children: ReactNode; className?: string };

function Card({ children, className }: Props) {
  return <div className={cn('rounded-2xl border border-gray-200/80 bg-white shadow-card', className)}>{children}</div>;
}

function CardHeader({
  title,
  description,
  actions,
  icon,
  children,
  className,
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  icon?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-start justify-between gap-4 border-b border-gray-100 px-5 py-4 sm:px-6', className)}>
      {children ?? (
        <div className="flex min-w-0 items-start gap-3">
          {icon && (
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700 [&>svg]:h-[18px] [&>svg]:w-[18px]">
              {icon}
            </span>
          )}
          <div className="min-w-0">
            {title && <h2 className="text-base font-semibold text-gray-900">{title}</h2>}
            {description && <p className="mt-0.5 text-sm text-gray-500">{description}</p>}
          </div>
        </div>
      )}
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

function CardBody({ children, className }: Props) {
  return <div className={cn('px-5 py-5 sm:px-6', className)}>{children}</div>;
}

function CardFooter({ children, className }: Props) {
  return (
    <div className={cn('flex items-center justify-end gap-2 border-t border-gray-100 bg-gray-50/60 px-5 py-3 sm:px-6 rounded-b-2xl', className)}>
      {children}
    </div>
  );
}

export { Card, CardHeader, CardBody, CardFooter };
export default Object.assign(Card, { CardHeader, CardBody, CardFooter });
