import { errorMessage } from '@renderer/lib/ipc';

export function ErrorBanner({ error, onDismiss }: { error: unknown; onDismiss?: () => void }) {
  if (!error) return null;
  return (
    <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive flex items-start gap-3">
      <span className="flex-1">{errorMessage(error)}</span>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="text-xs text-destructive/70 hover:text-destructive"
          type="button"
        >
          dismiss
        </button>
      )}
    </div>
  );
}
