import fs from 'node:fs';
import { ConfigError } from '@shared/errors';

export function resolveHttpsProxy(configured?: string): string | undefined {
  if (configured) return configured;
  return (
    process.env.HTTPS_PROXY ??
    process.env.https_proxy ??
    process.env.HTTP_PROXY ??
    process.env.http_proxy ??
    undefined
  );
}

export function readCaBundle(configuredPath?: string): Buffer[] | undefined {
  const bundles: Buffer[] = [];
  if (configuredPath) {
    if (!fs.existsSync(configuredPath)) {
      throw new ConfigError(`CA bundle not found at ${configuredPath}`);
    }
    bundles.push(fs.readFileSync(configuredPath));
  }
  const envPath = process.env.NODE_EXTRA_CA_CERTS;
  if (envPath && fs.existsSync(envPath)) {
    bundles.push(fs.readFileSync(envPath));
  }
  return bundles.length > 0 ? bundles : undefined;
}
