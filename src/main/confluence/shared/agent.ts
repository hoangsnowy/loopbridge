import { Agent, ProxyAgent, type Dispatcher } from 'undici';
import type { NetworkConfig } from '@shared/config-schema';
import { readCaBundle, resolveHttpsProxy } from '@main/net/proxy';

export interface AgentOptions {
  network: NetworkConfig;
}

export function buildDispatcher(opts: AgentOptions): Dispatcher {
  const proxyUrl = resolveHttpsProxy(opts.network.httpsProxy);
  const ca = readCaBundle(opts.network.caBundlePath);

  const connect: { ca?: Buffer[] } = {};
  if (ca) connect.ca = ca;

  const baseOptions = {
    headersTimeout: opts.network.requestTimeoutMs,
    bodyTimeout: opts.network.requestTimeoutMs,
    connect,
    keepAliveTimeout: 30_000,
    keepAliveMaxTimeout: 600_000,
  };

  if (proxyUrl) {
    return new ProxyAgent({ uri: proxyUrl, ...baseOptions });
  }
  return new Agent(baseOptions);
}
