import Store from 'electron-store';
import { AppConfigSchema, DEFAULT_APP_CONFIG, type AppConfig } from '@shared/config-schema';
import { ConfigError } from '@shared/errors';
import { childLogger } from '@main/logging/logger';

let store: Store<AppConfig> | undefined;
const log = () => childLogger({ mod: 'config' });

export function initConfigStore(): AppConfig {
  store = new Store<AppConfig>({
    name: 'config',
    defaults: DEFAULT_APP_CONFIG,
    clearInvalidConfig: false,
  });
  const parsed = AppConfigSchema.safeParse(store.store);
  if (!parsed.success) {
    log().warn({ issues: parsed.error.issues }, 'config file failed validation, falling back to defaults');
    store.store = DEFAULT_APP_CONFIG;
    return DEFAULT_APP_CONFIG;
  }
  return parsed.data;
}

export function getConfig(): AppConfig {
  if (!store) throw new ConfigError('Config store not initialized');
  const parsed = AppConfigSchema.safeParse(store.store);
  if (!parsed.success) {
    return DEFAULT_APP_CONFIG;
  }
  return parsed.data;
}

export function setConfig(next: AppConfig): AppConfig {
  if (!store) throw new ConfigError('Config store not initialized');
  const parsed = AppConfigSchema.parse(next);
  store.store = parsed;
  return parsed;
}

export function patchConfig(patch: Partial<AppConfig>): AppConfig {
  const current = getConfig();
  const merged = { ...current, ...patch } as AppConfig;
  return setConfig(merged);
}

export function getConfigFilePath(): string {
  if (!store) throw new ConfigError('Config store not initialized');
  return store.path;
}
