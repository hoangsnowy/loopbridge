import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@renderer/components/ui/button';
import { Input } from '@renderer/components/ui/input';
import { Label } from '@renderer/components/ui/label';
import { Select } from '@renderer/components/ui/select';
import { ErrorBanner } from '@renderer/components/common/ErrorBanner';
import { api } from '@renderer/lib/ipc';
import type { AuthInput, ConnectionResult } from '@shared/types';
import type { ConfluenceBackend } from '@shared/domain';

export function SetupScreen() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [backend, setBackend] = useState<ConfluenceBackend>('dc');
  const [baseUrl, setBaseUrl] = useState('');
  const [authMethod, setAuthMethod] = useState<'pat' | 'basic'>('pat');
  const [username, setUsername] = useState('');
  const [secret, setSecret] = useState('');
  const [email, setEmail] = useState('');
  const [apiToken, setApiToken] = useState('');
  const [caBundlePath, setCaBundlePath] = useState('');
  const [httpsProxy, setHttpsProxy] = useState('');

  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<ConnectionResult | null>(null);
  const [error, setError] = useState<unknown>(null);

  function buildInput(): AuthInput | null {
    if (!baseUrl) {
      setError({ message: 'Base URL is required' });
      return null;
    }
    if (backend === 'dc') {
      if (!secret) {
        setError({ message: 'Token or password is required' });
        return null;
      }
      if (authMethod === 'basic' && !username) {
        setError({ message: 'Basic auth requires a username' });
        return null;
      }
      return {
        backend: 'dc',
        baseUrl: baseUrl.replace(/\/$/, ''),
        authMethod,
        secret,
        ...(username ? { username } : {}),
        ...(caBundlePath ? { caBundlePath } : {}),
        ...(httpsProxy ? { httpsProxy } : {}),
      };
    }
    if (!email || !apiToken) {
      setError({ message: 'Email and API token are required' });
      return null;
    }
    return {
      backend: 'cloud',
      baseUrl: baseUrl.replace(/\/$/, ''),
      email,
      apiToken,
      ...(httpsProxy ? { httpsProxy } : {}),
    };
  }

  async function handleTest() {
    setError(null);
    setTestResult(null);
    const input = buildInput();
    if (!input) return;
    setTesting(true);
    try {
      const result = await api.connection.test(input);
      setTestResult(result);
      if (!result.ok && result.error) setError(result.error);
    } catch (err) {
      setError(err);
    } finally {
      setTesting(false);
    }
  }

  async function handleSave() {
    setError(null);
    const input = buildInput();
    if (!input) return;
    setSaving(true);
    try {
      await api.connection.saveAuth(input);
      await qc.invalidateQueries({ queryKey: ['connection-status'] });
      navigate('/pages', { replace: true });
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl p-8 flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Connect to Confluence</h1>
        <p className="text-sm text-muted-foreground">
          loopbridge fetches pages from your Confluence space and stages them on the system clipboard
          for pasting into Microsoft Loop.
        </p>
      </header>

      <ErrorBanner error={error} onDismiss={() => setError(null)} />

      {testResult?.ok && (
        <div className="rounded-md border border-green-500/40 bg-green-50 px-3 py-2 text-sm text-green-900">
          Connected as <strong>{testResult.user?.displayName}</strong>
          {testResult.serverVersion ? ` (server ${testResult.serverVersion})` : ''}.
        </div>
      )}

      <section className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="backend">Confluence flavor</Label>
          <Select
            id="backend"
            value={backend}
            onChange={(e) => setBackend(e.currentTarget.value as ConfluenceBackend)}
          >
            <option value="dc">Data Center / Server (self-hosted)</option>
            <option value="cloud">Cloud (*.atlassian.net)</option>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="baseUrl">Base URL</Label>
          <Input
            id="baseUrl"
            placeholder={
              backend === 'dc'
                ? 'https://confluence.example.com'
                : 'https://your-tenant.atlassian.net'
            }
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.currentTarget.value)}
          />
        </div>

        {backend === 'dc' ? (
          <>
            <div className="space-y-2">
              <Label htmlFor="authMethod">Authentication method</Label>
              <Select
                id="authMethod"
                value={authMethod}
                onChange={(e) => setAuthMethod(e.currentTarget.value as 'pat' | 'basic')}
              >
                <option value="pat">Personal Access Token (recommended)</option>
                <option value="basic">Username + password (Basic)</option>
              </Select>
            </div>
            {authMethod === 'basic' && (
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.currentTarget.value)}
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="secret">{authMethod === 'pat' ? 'Personal Access Token' : 'Password'}</Label>
              <Input
                id="secret"
                type="password"
                value={secret}
                onChange={(e) => setSecret(e.currentTarget.value)}
              />
            </div>
            <details className="text-sm">
              <summary className="cursor-pointer text-muted-foreground">Network options (proxy, CA bundle)</summary>
              <div className="mt-3 space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="ca">Custom CA bundle path (PEM)</Label>
                  <Input
                    id="ca"
                    placeholder="C:\path\to\corporate-ca.pem"
                    value={caBundlePath}
                    onChange={(e) => setCaBundlePath(e.currentTarget.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="proxy">HTTPS proxy URL</Label>
                  <Input
                    id="proxy"
                    placeholder="http://corp-proxy.example.com:8080"
                    value={httpsProxy}
                    onChange={(e) => setHttpsProxy(e.currentTarget.value)}
                  />
                </div>
              </div>
            </details>
          </>
        ) : (
          <>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.currentTarget.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="apiToken">API token</Label>
              <Input
                id="apiToken"
                type="password"
                value={apiToken}
                onChange={(e) => setApiToken(e.currentTarget.value)}
              />
              <p className="text-xs text-muted-foreground">
                Create one at id.atlassian.com → Security → API tokens.
              </p>
            </div>
          </>
        )}
      </section>

      <footer className="flex justify-end gap-2">
        <Button variant="outline" onClick={handleTest} disabled={testing || saving}>
          {testing ? 'Testing…' : 'Test connection'}
        </Button>
        <Button onClick={handleSave} disabled={saving || testing}>
          {saving ? 'Saving…' : 'Save & continue'}
        </Button>
      </footer>
    </div>
  );
}
