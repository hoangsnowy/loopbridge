import { useQuery } from '@tanstack/react-query';
import { Button } from '@renderer/components/ui/button';
import { api } from '@renderer/lib/ipc';

export function LogPanelScreen() {
  const lines = useQuery({
    queryKey: ['logs-tail'],
    queryFn: () => api.logs.tail(200),
    refetchInterval: 3_000,
  });

  return (
    <div className="p-6 flex flex-col gap-3 h-full">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Logs</h1>
        <Button variant="outline" onClick={() => api.logs.openFolder()}>
          Open logs folder
        </Button>
      </header>
      <div className="flex-1 overflow-auto rounded-md border border-border bg-muted/40 p-3 font-mono text-xs">
        {lines.data?.length === 0 ? (
          <p className="text-muted-foreground">No log entries yet.</p>
        ) : (
          lines.data?.map((l, i) => (
            <div key={i} className="whitespace-pre">
              <span className="text-muted-foreground">{l.ts.slice(11, 19)}</span>{' '}
              <span
                className={
                  l.level === 'error' || l.level === 'fatal'
                    ? 'text-destructive'
                    : l.level === 'warn'
                      ? 'text-amber-600'
                      : ''
                }
              >
                [{l.level}]
              </span>{' '}
              {l.msg}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
