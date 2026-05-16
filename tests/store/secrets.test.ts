import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

// In-test mock of Electron's app + safeStorage. The store reads
// app.getPath('userData') for the secrets.bin location and uses
// safeStorage.{isEncryptionAvailable, encryptString, decryptString}.

let userDataDir: string;

vi.mock('electron', () => {
  return {
    app: { getPath: (_k: string) => userDataDir },
    safeStorage: {
      isEncryptionAvailable: () => true,
      // Trivial "encryption": prefix the string so we can verify it round-trips.
      encryptString: (plain: string) => Buffer.from('ENC:' + plain, 'utf8'),
      decryptString: (buf: Buffer) => {
        const s = buf.toString('utf8');
        if (!s.startsWith('ENC:')) throw new Error('bad blob');
        return s.slice(4);
      },
    },
  };
});

const { getSecret, setSecret, clearSecret, clearAllSecrets } = await import('@main/store/secrets');

describe('store/secrets', () => {
  beforeEach(async () => {
    userDataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'loopbridge-secrets-'));
  });

  afterEach(async () => {
    await fs.rm(userDataDir, { recursive: true, force: true }).catch(() => undefined);
  });

  it('getSecret returns null when file does not exist', async () => {
    const s = await getSecret('dc', 'https://example.com');
    expect(s).toBeNull();
  });

  it('setSecret then getSecret roundtrips', async () => {
    await setSecret('dc', 'https://example.com', 'pat-123');
    const s = await getSecret('dc', 'https://example.com');
    expect(s).toBe('pat-123');
  });

  it('setSecret writes to userData/secrets.bin in encrypted form', async () => {
    await setSecret('cloud', 'https://acme.atlassian.net', 'token-abc');
    const raw = await fs.readFile(path.join(userDataDir, 'secrets.bin'), 'utf8');
    expect(raw.startsWith('ENC:')).toBe(true);
    expect(raw).toContain('token-abc'); // mock "encryption" preserves plaintext
  });

  it('multiple secrets coexist by account key', async () => {
    await setSecret('dc', 'https://a.example.com', 'A');
    await setSecret('dc', 'https://b.example.com', 'B');
    expect(await getSecret('dc', 'https://a.example.com')).toBe('A');
    expect(await getSecret('dc', 'https://b.example.com')).toBe('B');
  });

  it('clearSecret removes one entry, leaves others', async () => {
    await setSecret('dc', 'https://a.example.com', 'A');
    await setSecret('dc', 'https://b.example.com', 'B');
    await clearSecret('dc', 'https://a.example.com');
    expect(await getSecret('dc', 'https://a.example.com')).toBeNull();
    expect(await getSecret('dc', 'https://b.example.com')).toBe('B');
  });

  it('clearSecret on unknown account is a no-op', async () => {
    await setSecret('dc', 'https://a.example.com', 'A');
    await clearSecret('dc', 'https://nope.example.com');
    expect(await getSecret('dc', 'https://a.example.com')).toBe('A');
  });

  it('clearAllSecrets empties the store', async () => {
    await setSecret('dc', 'https://a.example.com', 'A');
    await setSecret('dc', 'https://b.example.com', 'B');
    await clearAllSecrets();
    expect(await getSecret('dc', 'https://a.example.com')).toBeNull();
    expect(await getSecret('dc', 'https://b.example.com')).toBeNull();
  });
});
