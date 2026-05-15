import { useEffect, useState } from 'react';
import { Button } from '@renderer/components/ui/button';
import { api } from '@renderer/lib/ipc';
import type { UpdaterStatus } from '@shared/types';

export function AboutScreen() {
  const [updater, setUpdater] = useState<UpdaterStatus>({ kind: 'idle' });

  useEffect(() => {
    return api.on.updaterStatus(setUpdater);
  }, []);

  return (
    <div className="mx-auto max-w-xl p-6 flex flex-col gap-4">
      <h1 className="text-xl font-semibold">About loopbridge</h1>
      <p className="text-sm text-muted-foreground">
        A desktop helper for migrating Confluence pages to Microsoft Loop via clipboard-assisted paste.
        Production-grade tool for one-off space migrations.
      </p>
      <section className="space-y-2">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Updates</h2>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => api.updater.check()}>
            Check for updates
          </Button>
          <Button
            variant="outline"
            onClick={() => api.updater.download()}
            disabled={updater.kind !== 'available'}
          >
            Download
          </Button>
          <Button
            onClick={() => api.updater.quitAndInstall()}
            disabled={updater.kind !== 'downloaded'}
          >
            Quit & install
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Status: {updater.kind}
          {updater.info?.version ? ` — version ${updater.info.version}` : ''}
          {updater.message ? ` — ${updater.message}` : ''}
        </p>
      </section>
    </div>
  );
}
