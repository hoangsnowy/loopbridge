import { useEffect } from 'react';
import { Link, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@renderer/lib/ipc';
import { SetupScreen } from '@renderer/screens/SetupScreen';
import { PageListScreen } from '@renderer/screens/PageList';
import { PageDetailScreen } from '@renderer/screens/PageDetail';
import { SettingsScreen } from '@renderer/screens/SettingsScreen';
import { LogPanelScreen } from '@renderer/screens/LogPanel';
import { AboutScreen } from '@renderer/screens/About';
import { cn } from '@renderer/lib/cn';
import { useMigrationStore } from '@renderer/state/migration-store';

function Sidebar({ identityLabel, baseUrl }: { identityLabel?: string; baseUrl?: string }) {
  const location = useLocation();
  const items: Array<{ to: string; label: string; match: (p: string) => boolean }> = [
    { to: '/pages', label: 'Pages', match: (p) => p.startsWith('/pages') },
    { to: '/settings', label: 'Settings', match: (p) => p.startsWith('/settings') },
    { to: '/logs', label: 'Logs', match: (p) => p.startsWith('/logs') },
    { to: '/about', label: 'About', match: (p) => p.startsWith('/about') },
  ];
  return (
    <aside className="w-56 shrink-0 border-r border-border bg-card flex flex-col">
      <div className="px-4 py-4 border-b border-border">
        <p className="text-base font-semibold">loopbridge</p>
        {baseUrl && (
          <p className="text-xs text-muted-foreground truncate" title={baseUrl}>
            {baseUrl.replace(/^https?:\/\//, '')}
          </p>
        )}
        {identityLabel && (
          <p className="text-xs text-muted-foreground truncate" title={identityLabel}>
            {identityLabel}
          </p>
        )}
      </div>
      <nav className="flex-1 py-2">
        {items.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className={cn(
              'block px-4 py-2 text-sm hover:bg-secondary',
              item.match(location.pathname) && 'bg-secondary font-medium',
            )}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}

export function App() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const setListingProgress = useMigrationStore((s) => s.setListingProgress);
  const status = useQuery({
    queryKey: ['connection-status'],
    queryFn: () => api.connection.getStatus(),
  });

  useEffect(() => {
    if (status.data && !status.data.configured && window.location.hash !== '#/setup') {
      navigate('/setup', { replace: true });
    }
  }, [status.data, navigate]);

  // Subscribe to page-list progress at app scope so it survives screen unmounts.
  useEffect(() => {
    return api.on.pagesListProgress((p) => {
      setListingProgress(p.done ? null : p.fetched);
    });
  }, [setListingProgress]);

  // Audit list is invalidated whenever the main process records a transition.
  useEffect(() => {
    return api.on.migrationStatus(() => {
      qc.invalidateQueries({ queryKey: ['audit-list'] });
    });
  }, [qc]);

  const configured = status.data?.configured === true;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      {configured && (
        <Sidebar
          {...(status.data?.identityLabel ? { identityLabel: status.data.identityLabel } : {})}
          {...(status.data?.baseUrl ? { baseUrl: status.data.baseUrl } : {})}
        />
      )}
      <main className="flex-1 overflow-auto">
        <Routes>
          <Route path="/" element={<Navigate to={configured ? '/pages' : '/setup'} replace />} />
          <Route path="/setup" element={<SetupScreen />} />
          <Route path="/pages" element={<PageListScreen />} />
          <Route path="/pages/:pageId" element={<PageDetailScreen />} />
          <Route path="/settings" element={<SettingsScreen />} />
          <Route path="/logs" element={<LogPanelScreen />} />
          <Route path="/about" element={<AboutScreen />} />
        </Routes>
      </main>
    </div>
  );
}
