import keytar from 'keytar';
import type { ConfluenceBackend } from '@shared/domain';

const SERVICE = 'loopbridge';

function accountFor(backend: ConfluenceBackend, baseUrl: string): string {
  return `${backend}:${baseUrl}`;
}

export async function getSecret(backend: ConfluenceBackend, baseUrl: string): Promise<string | null> {
  return keytar.getPassword(SERVICE, accountFor(backend, baseUrl));
}

export async function setSecret(
  backend: ConfluenceBackend,
  baseUrl: string,
  value: string,
): Promise<void> {
  await keytar.setPassword(SERVICE, accountFor(backend, baseUrl), value);
}

export async function clearSecret(backend: ConfluenceBackend, baseUrl: string): Promise<void> {
  await keytar.deletePassword(SERVICE, accountFor(backend, baseUrl));
}

export async function clearAllSecrets(): Promise<void> {
  const creds = await keytar.findCredentials(SERVICE);
  for (const { account } of creds) {
    await keytar.deletePassword(SERVICE, account);
  }
}
