import type { PageStatus } from '@shared/types';
import { cn } from '@renderer/lib/cn';

const COLORS: Record<PageStatus, string> = {
  pending: 'bg-slate-100 text-slate-700 border-slate-200',
  fetched: 'bg-blue-100 text-blue-700 border-blue-200',
  converted: 'bg-violet-100 text-violet-700 border-violet-200',
  copied: 'bg-amber-100 text-amber-700 border-amber-200',
  done: 'bg-green-100 text-green-700 border-green-200',
  skipped: 'bg-gray-100 text-gray-500 border-gray-200',
  error: 'bg-red-100 text-red-700 border-red-200',
};

export function StatusBadge({ status }: { status: PageStatus }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium',
        COLORS[status],
      )}
    >
      {status}
    </span>
  );
}
