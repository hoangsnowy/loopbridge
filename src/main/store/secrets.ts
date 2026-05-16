import { app, safeStorage } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { ConfluenceBackend } from '@shared/domain';
import { ConfigError } from '@shared/errors';

// Replaced keytar (archived by Microsoft, 2023) with Electron's safeStorage.
// safeStorage encrypts with the OS keychain when available (DPAPI on Windows,
// Keychain on macOS, Secret Service on Linux), otherwise refuses to write.
// Encrypted blob lives at userData/secrets.bin and holds a JSON map.

const SECRETS_FILE = 'secrets.bin';

function accountKey(backend: ConfluenceBackend, baseUrl: string): string {
  return `${backend}:${baseUrl}`;
}

function filePath(): string {
  return path.join(app.getPath('userData'), SECRETS_FILE);
}

function assertEncryptionAvailable(): void {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new ConfigError(
      'OS keychain unavailable — cannot store secrets. On Linux this usually means libsecret/gnome-keyring is missing.',
    );
  }
}

async function readStore(): Promise<Record<string, string>> {
  let blob: Buffer;
  try {
    blob = await fs.readFile(filePath());
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return {};
    throw err;
  }
  assertEncryptionAvailable();
  const json = safeStorage.decryptString(blob);
  return JSON.parse(json) as Record<string, string>;
}

async function writeStore(data: Record<string, string>): Promise<void> {
  assertEncryptionAvailable();
  const blob = safeStorage.encryptString(JSON.stringify(data));
  await fs.writeFile(filePath(), blob, { mode: 0o600 });
}

export async function getSecret(
  backend: ConfluenceBackend,
  baseUrl: string,
): Promise<string | null> {
  const data = await readStore();
  return data[accountKey(backend, baseUrl)] ?? null;
}

export async function setSecret(
  backend: ConfluenceBackend,
  baseUrl: string,
  value: string,
): Promise<void> {
  const data = await readStore();
  data[accountKey(backend, baseUrl)] = value;
  await writeStore(data);
}

export async function clearSecret(backend: ConfluenceBackend, baseUrl: string): Promise<void> {
  const data = await readStore();
  if (!(accountKey(backend, baseUrl) in data)) return;
  delete data[accountKey(backend, baseUrl)];
  await writeStore(data);
}

export async function clearAllSecrets(): Promise<void> {
  await writeStore({});
}
