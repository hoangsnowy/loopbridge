import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@renderer/components/ui/button';
import { ErrorBanner } from '@renderer/components/common/ErrorBanner';
import { api } from '@renderer/lib/ipc';
import type { ConvertResult } from '@shared/types';

export function PageDetailScreen() {
  const { pageId } = useParams<{ pageId: string }>();
  const qc = useQueryClient();
  const [convertResult, setConvertResult] = useState<ConvertResult | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [copied, setCopied] = useState(false);

  const page = useQuery({
    queryKey: ['page', pageId],
    queryFn: () => api.pages.get(pageId!),
    enabled: !!pageId,
  });

  const convertMutation = useMutation({
    mutationFn: () => api.pages.convert(pageId!),
    onSuccess: (r) => setConvertResult(r),
    onError: (err) => setError(err),
  });

  const copyMutation = useMutation({
    mutationFn: () => api.pages.copyToClipboard(pageId!),
    onSuccess: () => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    },
    onError: (err) => setError(err),
  });

  const doneMutation = useMutation({
    mutationFn: () => api.pages.markDone(pageId!),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['audit-list'] }),
    onError: (err) => setError(err),
  });

  if (!pageId) return null;

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-start justify-between gap-3 border-b border-border px-6 py-4">
        <div className="min-w-0">
          <Link to="/pages" className="text-xs text-muted-foreground hover:underline">
            ← Back to pages
          </Link>
          <h1 className="text-lg font-semibold truncate" title={page.data?.title}>
            {page.data?.title ?? 'Loading…'}
          </h1>
          {page.data && (
            <p className="text-xs text-muted-foreground">
              v{page.data.versionNumber} · {page.data.attachments.length} attachments
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => convertMutation.mutate()}
            disabled={convertMutation.isPending || !page.data}
          >
            {convertMutation.isPending ? 'Converting…' : 'Convert'}
          </Button>
          <Button
            onClick={() => copyMutation.mutate()}
            disabled={copyMutation.isPending || !convertResult}
          >
            {copied ? 'Copied!' : copyMutation.isPending ? 'Copying…' : 'Copy to clipboard'}
          </Button>
          <Button variant="outline" onClick={() => api.shell.openExternal('https://loop.microsoft.com/')}>
            Open Loop
          </Button>
          <Button variant="secondary" onClick={() => doneMutation.mutate()} disabled={doneMutation.isPending}>
            Mark done
          </Button>
        </div>
      </header>

      <div className="px-6 py-4">
        <ErrorBanner error={error ?? page.error} onDismiss={() => setError(null)} />
        {convertResult && (
          <div className="mb-4 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground flex gap-4">
            <span>Needs review: <strong className={convertResult.needsReview > 0 ? 'text-amber-600' : ''}>{convertResult.needsReview}</strong></span>
            <span>Images embedded: <strong>{convertResult.imagesEmbedded}</strong></span>
            <span>Images manual: <strong>{convertResult.imagesManual}</strong></span>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-auto px-6 pb-6">
        {convertResult ? (
          <article className="preview-pane" dangerouslySetInnerHTML={{ __html: convertResult.html }} />
        ) : page.data ? (
          <pre className="text-xs whitespace-pre-wrap font-mono text-muted-foreground border border-dashed border-border rounded-md p-3">
            {page.data.bodyStorageXhtml.slice(0, 4000)}
            {page.data.bodyStorageXhtml.length > 4000 ? '\n…' : ''}
          </pre>
        ) : (
          <p className="text-sm text-muted-foreground">Loading…</p>
        )}
      </div>
    </div>
  );
}
