import type { AppConfig } from '@shared/config-schema';
import { ConfigError } from '@shared/errors';
import type { ConfluenceClient } from './interfaces';
import { ConfluenceDcClient } from './dc/client';
import { ConfluenceCloudClient } from './cloud/client';

export interface ClientDeps {
  config: AppConfig;
  secret: string;
}

export function createClient(deps: ClientDeps): ConfluenceClient {
  const conf = deps.config.confluence;
  if (!conf) throw new ConfigError('No Confluence backend is configured');
  switch (conf.backend) {
    case 'dc':
      return new ConfluenceDcClient({
        config: conf,
        network: deps.config.network,
        secret: deps.secret,
      });
    case 'cloud':
      return new ConfluenceCloudClient({
        config: conf,
        network: deps.config.network,
        secret: deps.secret,
      });
  }
}
