import type { ReactNode } from 'react';

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center gap-3 py-16 text-muted-foreground">
      <p className="text-base font-medium text-foreground">{title}</p>
      {body && <p className="text-sm max-w-md">{body}</p>}
      {action}
    </div>
  );
}
