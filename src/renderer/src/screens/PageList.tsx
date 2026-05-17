import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Button } from '@renderer/components/ui/button';
import { Input } from '@renderer/components/ui/input';
import { ErrorBanner } from '@renderer/components/common/ErrorBanner';
import { EmptyState } from '@renderer/components/common/EmptyState';
import { StatusBadge } from '@renderer/components/common/StatusBadge';
import { api } from '@renderer/lib/ipc';
import { useMigrationStore } from '@renderer/state/migration-store';
import type { PageStatus } from '@shared/types';
import type { PageSummary } from '@shared/domain';
import type { AuditRow } from '@shared/types';

interface Row {
  pageId: string;
  title: string;
  versionNumber: number;
  spaceKey: string;
  status: PageStatus;
  needsReview: number;
}

function combineRows(pages: PageSummary[], audit: AuditRow[]): Row[] {
  const auditByPage = new Map(audit.map((r) => [r.pageId, r]));
  return pages.map((p) => {
    const a = auditByPage.get(p.id);
    return {
      pageId: p.id,
      title: p.title,
      versionNumber: p.versionNumber,
      spaceKey: p.spaceKey,
      status: a?.status ?? 'pending',
      needsReview: a?.needsReview ?? 0,
    };
  });
}

const ROW_HEIGHT = 40;

export function PageListScreen() {
  const qc = useQueryClient();
  const [spaceKey, setSpaceKey] = useState('');
  const [activeSpaceKey, setActiveSpaceKey] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | PageStatus>('all');
  const [search, setSearch] = useState('');
  const [error, setError] = useState<unknown>(null);
  const listingProgress = useMigrationStore((s) => s.listingProgress);

  const pages = useQuery({
    queryKey: ['pages-list', activeSpaceKey],
    queryFn: () => api.pages.list(activeSpaceKey!),
    enabled: !!activeSpaceKey,
  });

  // Audit list refreshes on EvtMigrationStatus events from main, wired in App.tsx.
  const audit = useQuery({
    queryKey: ['audit-list'],
    queryFn: () => api.audit.list(),
  });

  const rows = useMemo(() => {
    if (!pages.data) return [] as Row[];
    const merged = combineRows(pages.data, audit.data ?? []);
    return merged
      .filter((r) => filterStatus === 'all' || r.status === filterStatus)
      .filter((r) => !search || r.title.toLowerCase().includes(search.toLowerCase()));
  }, [pages.data, audit.data, filterStatus, search]);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 12,
  });

  async function loadSpace() {
    setError(null);
    if (!spaceKey) {
      setError({ message: 'Enter a space key' });
      return;
    }
    setActiveSpaceKey(spaceKey.trim());
    await qc.invalidateQueries({ queryKey: ['pages-list'] });
  }

  return (
    <div className="p-6 flex flex-col gap-4 h-full">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Pages</h1>
        <div className="flex items-center gap-2">
          <Input
            placeholder="Space key (e.g. DOCS)"
            value={spaceKey}
            onChange={(e) => setSpaceKey(e.currentTarget.value)}
            className="w-48"
          />
          <Button onClick={loadSpace} disabled={pages.isFetching}>
            {pages.isFetching ? 'Loading…' : 'Load space'}
          </Button>
        </div>
      </header>

      <ErrorBanner error={error ?? pages.error} onDismiss={() => setError(null)} />

      {listingProgress !== null && (
        <p className="text-sm text-muted-foreground">Fetched {listingProgress} pages…</p>
      )}

      {activeSpaceKey && (
        <div className="flex items-center gap-2">
          <Input
            placeholder="Filter by title"
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
            className="max-w-xs"
          />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.currentTarget.value as 'all' | PageStatus)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="all">All statuses</option>
            <option value="pending">Pending</option>
            <option value="fetched">Fetched</option>
            <option value="converted">Converted</option>
            <option value="copied">Copied</option>
            <option value="done">Done</option>
            <option value="skipped">Skipped</option>
            <option value="error">Error</option>
          </select>
          <span className="text-xs text-muted-foreground">{rows.length} rows</span>
        </div>
      )}

      {!activeSpaceKey ? (
        <EmptyState
          title="Pick a space"
          body="Enter a Confluence space key above to load its pages. For DC, the key is the short ALL-CAPS identifier shown in the Confluence URL."
        />
      ) : pages.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <EmptyState title="No pages match" body="Adjust the filter or search." />
      ) : (
        <div className="rounded-md border border-border overflow-hidden flex flex-col flex-1 min-h-0">
          <div className="grid grid-cols-[1fr_7rem_6rem_5rem] bg-muted text-muted-foreground text-left text-sm">
            <div className="px-3 py-2 font-medium">Title</div>
            <div className="px-3 py-2 font-medium">Status</div>
            <div className="px-3 py-2 font-medium">Review</div>
            <div className="px-3 py-2 font-medium">Version</div>
          </div>
          <div ref={scrollRef} className="flex-1 overflow-auto">
            <div
              style={{
                height: virtualizer.getTotalSize(),
                position: 'relative',
                width: '100%',
              }}
            >
              {virtualizer.getVirtualItems().map((vRow) => {
                const r = rows[vRow.index];
                if (!r) return null;
                return (
                  <div
                    key={r.pageId}
                    className="grid grid-cols-[1fr_7rem_6rem_5rem] items-center border-t border-border hover:bg-secondary/40 text-sm"
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: ROW_HEIGHT,
                      transform: `translateY(${vRow.start}px)`,
                    }}
                  >
                    <div className="px-3 py-2 truncate">
                      <Link to={`/pages/${r.pageId}`} className="hover:underline" title={r.title}>
                        {r.title}
                      </Link>
                    </div>
                    <div className="px-3 py-2">
                      <StatusBadge status={r.status} />
                    </div>
                    <div className="px-3 py-2">
                      {r.needsReview > 0 ? (
                        <span className="text-amber-600 font-medium">{r.needsReview}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </div>
                    <div className="px-3 py-2 text-muted-foreground">v{r.versionNumber}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
