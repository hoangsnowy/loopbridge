import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@renderer/components/ui/button';
import { Input } from '@renderer/components/ui/input';
import { Label } from '@renderer/components/ui/label';
import { Select } from '@renderer/components/ui/select';
import { ErrorBanner } from '@renderer/components/common/ErrorBanner';
import { api } from '@renderer/lib/ipc';
import { useNavigate } from 'react-router-dom';

export function SettingsScreen() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [error, setError] = useState<unknown>(null);
  const config = useQuery({ queryKey: ['config'], queryFn: () => api.config.get() });

  const patch = useMutation({
    mutationFn: api.config.set,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['config'] }),
    onError: (err) => setError(err),
  });

  const clear = useMutation({
    mutationFn: api.connection.clearAuth,
    onSuccess: async () => {
      await qc.invalidateQueries();
      navigate('/setup', { replace: true });
    },
    onError: (err) => setError(err),
  });

  if (!config.data) return <p className="p-6 text-sm text-muted-foreground">Loading…</p>;
  const cfg = config.data;

  return (
    <div className="mx-auto max-w-2xl p-6 flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Settings</h1>
      <ErrorBanner error={error} onDismiss={() => setError(null)} />

      <section className="space-y-4">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Migration
        </h2>
        <div className="space-y-2">
          <Label htmlFor="imageStrategy">Image handling</Label>
          <Select
            id="imageStrategy"
            value={cfg.migration.imageStrategy}
            onChange={(e) =>
              patch.mutate({
                migration: {
                  ...cfg.migration,
                  imageStrategy: e.currentTarget.value as 'auto' | 'base64' | 'manual',
                },
              })
            }
          >
            <option value="auto">Auto (base64 small images, manual for large)</option>
            <option value="base64">Base64 always</option>
            <option value="manual">Manual drag-drop only</option>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>
            <input
              type="checkbox"
              checked={cfg.migration.demoteH1ToH2}
              onChange={(e) =>
                patch.mutate({
                  migration: { ...cfg.migration, demoteH1ToH2: e.currentTarget.checked },
                })
              }
            />{' '}
            Demote H1 to H2 (Loop uses page title as H1)
          </Label>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Network
        </h2>
        <div className="space-y-2">
          <Label htmlFor="caBundlePath">Custom CA bundle path</Label>
          <Input
            id="caBundlePath"
            placeholder="PEM file path"
            defaultValue={cfg.network.caBundlePath ?? ''}
            onBlur={(e) =>
              patch.mutate({
                network: { ...cfg.network, caBundlePath: e.currentTarget.value || undefined },
              })
            }
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="httpsProxy">HTTPS proxy URL</Label>
          <Input
            id="httpsProxy"
            placeholder="http://proxy.example.com:8080"
            defaultValue={cfg.network.httpsProxy ?? ''}
            onBlur={(e) =>
              patch.mutate({
                network: { ...cfg.network, httpsProxy: e.currentTarget.value || undefined },
              })
            }
          />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Updater
        </h2>
        <div className="space-y-2">
          <Label htmlFor="feedUrl">Update feed URL (generic provider)</Label>
          <Input
            id="feedUrl"
            placeholder="https://your-update-server/loopbridge/"
            defaultValue={cfg.updater.feedUrl ?? ''}
            onBlur={(e) =>
              patch.mutate({
                updater: { ...cfg.updater, feedUrl: e.currentTarget.value || undefined },
              })
            }
          />
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Audit</h2>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={async () => {
              setError(null);
              try {
                const target = await api.dialog.showSaveDialog({
                  title: 'Export audit as CSV',
                  defaultPath: `loopbridge-audit-${new Date().toISOString().slice(0, 10)}.csv`,
                  filters: [{ name: 'CSV', extensions: ['csv'] }],
                });
                if (!target) return;
                await api.audit.exportCsv(target);
              } catch (err) {
                setError(err);
              }
            }}
          >
            Export audit as CSV
          </Button>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Account
        </h2>
        <Button variant="destructive" onClick={() => clear.mutate()}>
          Sign out & clear stored credential
        </Button>
      </section>
    </div>
  );
}
