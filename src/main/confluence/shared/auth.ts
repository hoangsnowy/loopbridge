import type { ConfluenceConfig } from '@shared/config-schema';
import { AuthError } from '@shared/errors';

export interface AuthContext {
  config: ConfluenceConfig;
  secret: string;
}

export function buildAuthHeader(ctx: AuthContext): string {
  const { config, secret } = ctx;
  if (!secret) throw new AuthError('Missing credential');
  if (config.backend === 'dc') {
    if (config.authMethod === 'pat') {
      return `Bearer ${secret}`;
    }
    const username = config.username;
    if (!username) throw new AuthError('Basic auth requires a username');
    return `Basic ${Buffer.from(`${username}:${secret}`, 'utf8').toString('base64')}`;
  }
  // Cloud — email + API token via Basic
  return `Basic ${Buffer.from(`${config.email}:${secret}`, 'utf8').toString('base64')}`;
}

export function identityLabel(config: ConfluenceConfig): string {
  if (config.backend === 'dc') {
    if (config.authMethod === 'pat') {
      return config.username ? `PAT (${config.username})` : 'Personal Access Token';
    }
    return config.username ? `Basic (${config.username})` : 'Basic auth';
  }
  return config.email;
}
