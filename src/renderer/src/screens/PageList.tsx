import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@renderer/components/ui/button';
import { Input } from '@renderer/components/ui/input';
import { ErrorBanner } from '@renderer/components/common/ErrorBanner';
import { EmptyState } from '@renderer/components/common/EmptyState';
import { StatusBadge } from '@renderer/components/common/StatusBadge';
import { api } from '@renderer/lib/ipc';
import type { PageStatus } from '@shared/types';
import type { PageSummary } from '@shared/domain';
import type { AuditRow } from '@shared/types';

function combineRows(pages: PageSummary[], audit: AuditRow[]): Array<{
  pageId: string;
  title: string;
  versionNumber: number;
  spaceKey: string;
  status: PageStatus;
  needsReview: number;
}> {
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

export function PageListScreen() {
  const qc = useQueryClient();
  const [spaceKey, setSpaceKey] = useState('');
  const [activeSpaceKey, setActiveSpaceKey] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | PageStatus>('all');
  const [search, setSearch] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [listingProgress, setListingProgress] = useState<number | null>(null);

  useEffect(() => {
    const off = api.on.pagesListProgress((p) => {
      setListingProgress(p.done ? null : p.fetched);
    });
    return off;
  }, []);

  const pages = useQuery({
    queryKey: ['pages-list', activeSpaceKey],
    queryFn: () => api.pages.list(activeSpaceKey!),
    enabled: !!activeSpaceKey,
  });

  const audit = useQuery({
    queryKey: ['audit-list'],
    queryFn: () => api.audit.list(),
    refetchInterval: 5_000,
  });

  const rows = useMemo(() => {
    if (!pages.data) return [];
    const merged = combineRows(pages.data, audit.data ?? []);
    return merged
      .filter((r) => filterStatus === 'all' || r.status === filterStatus)
      .filter((r) => !search || r.title.toLowerCase().includes(search.toLowerCase()));
  }, [pages.data, audit.data, filterStatus, search]);

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
    <div className="p-6 flex flex-col gap-4">
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
        <div className="rounded-md border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted text-muted-foreground text-left">
              <tr>
                <th className="px-3 py-2">Title</th>
                <th className="px-3 py-2 w-28">Status</th>
                <th className="px-3 py-2 w-24">Review</th>
                <th className="px-3 py-2 w-20">Version</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.pageId} className="border-t border-border hover:bg-secondary/40">
                  <td className="px-3 py-2">
                    <Link to={`/pages/${r.pageId}`} className="hover:underline">
                      {r.title}
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="px-3 py-2">
                    {r.needsReview > 0 ? (
                      <span className="text-amber-600 font-medium">{r.needsReview}</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">v{r.versionNumber}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
