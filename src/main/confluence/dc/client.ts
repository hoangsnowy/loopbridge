import type { Dispatcher } from 'undici';
import type {
  AttachmentInfo,
  ConfluenceBackend,
  PageDetail,
  PageSummary,
  SpaceInfo,
  UserInfo,
} from '@shared/domain';
import type { DcConfluenceConfig, NetworkConfig } from '@shared/config-schema';
import { AuthError, ClientError, LoopbridgeError, NetworkError } from '@shared/errors';
import type { ConfluenceClient, ListSpacesOptions } from '../interfaces';
import { buildAuthHeader } from '../shared/auth';
import { buildDispatcher } from '../shared/agent';
import { binaryRequest, jsonRequest } from '../shared/http';
import {
  attachmentsUrl,
  currentUserUrl,
  pageDetailUrl,
  pagesUrl,
  resolveDownloadUrl,
  serverInfoUrl,
  spaceByKeyUrl,
  spacesUrl,
} from './endpoints';
import {
  mapDcAttachment,
  mapDcPageDetail,
  mapDcPageSummary,
  mapDcSpace,
  mapDcUser,
} from './map';
import { paginateDc } from './paginate';
import type {
  DcAttachmentResponse,
  DcContentResponse,
  DcListEnvelope,
  DcServerInfoResponse,
  DcSpaceResponse,
  DcUserResponse,
} from './wire';

export interface DcClientDeps {
  config: DcConfluenceConfig;
  network: NetworkConfig;
  secret: string;
}

export class ConfluenceDcClient implements ConfluenceClient {
  readonly backend: ConfluenceBackend = 'dc';
  readonly baseUrl: string;
  private readonly dispatcher: Dispatcher;
  private readonly headers: Record<string, string>;
  private readonly timeoutMs: number;
  private readonly host: string;

  constructor(deps: DcClientDeps) {
    this.baseUrl = deps.config.baseUrl;
    const url = new URL(this.baseUrl);
    this.host = url.host;
    this.dispatcher = buildDispatcher({ network: deps.network });
    this.timeoutMs = deps.network.requestTimeoutMs;
    this.headers = {
      Accept: 'application/json',
      'User-Agent': 'loopbridge/0.1',
      Authorization: buildAuthHeader({ config: deps.config, secret: deps.secret }),
    };
  }

  private async getJson<T>(url: string): Promise<T> {
    const res = await jsonRequest<T>(url, {
      method: 'GET',
      headers: this.headers,
      dispatcher: this.dispatcher,
      timeoutMs: this.timeoutMs,
      host: this.host,
    });
    return res.data;
  }

  async testAuth(): Promise<{ user: UserInfo; serverVersion?: string }> {
    let user: UserInfo;
    try {
      const wire = await this.getJson<DcUserResponse>(currentUserUrl(this.baseUrl));
      user = mapDcUser(wire);
    } catch (err) {
      if (err instanceof AuthError || err instanceof ClientError) throw err;
      if (err instanceof LoopbridgeError) throw err;
      throw new NetworkError('Failed to verify auth', { cause: err });
    }
    let serverVersion: string | undefined;
    try {
      const info = await this.getJson<DcServerInfoResponse>(serverInfoUrl(this.baseUrl));
      serverVersion = info.version;
    } catch {
      // serverInfo can be restricted; non-fatal.
    }
    return serverVersion !== undefined ? { user, serverVersion } : { user };
  }

  async resolveSpace(spaceKey: string): Promise<SpaceInfo> {
    const wire = await this.getJson<DcSpaceResponse>(spaceByKeyUrl(this.baseUrl, spaceKey));
    return mapDcSpace(wire);
  }

  async listSpaces(opts?: ListSpacesOptions): Promise<SpaceInfo[]> {
    const wire = await this.getJson<DcListEnvelope<DcSpaceResponse>>(
      spacesUrl(this.baseUrl, opts?.type),
    );
    return wire.results.map(mapDcSpace);
  }

  async *listPages(spaceId: string): AsyncIterable<PageSummary> {
    // DC's "spaceId" in this client is the space key (see SpaceInfo.id mapping).
    const initial = pagesUrl(this.baseUrl, spaceId);
    for await (const batch of paginateDc<DcContentResponse>(
      initial,
      this.baseUrl,
      (url) => this.getJson<DcListEnvelope<DcContentResponse>>(url),
    )) {
      for (const item of batch) {
        yield mapDcPageSummary(item, this.baseUrl);
      }
    }
  }

  async getPage(pageId: string): Promise<PageDetail> {
    const wire = await this.getJson<DcContentResponse>(pageDetailUrl(this.baseUrl, pageId));
    return mapDcPageDetail(wire, this.baseUrl);
  }

  async listAttachments(pageId: string): Promise<AttachmentInfo[]> {
    const out: AttachmentInfo[] = [];
    const initial = attachmentsUrl(this.baseUrl, pageId);
    for await (const batch of paginateDc<DcAttachmentResponse>(
      initial,
      this.baseUrl,
      (url) => this.getJson<DcListEnvelope<DcAttachmentResponse>>(url),
    )) {
      for (const item of batch) {
        out.push(mapDcAttachment(item, this.baseUrl, pageId));
      }
    }
    return out;
  }

  async downloadAttachment(att: AttachmentInfo): Promise<Buffer> {
    return binaryRequest(resolveDownloadUrl(this.baseUrl, att.downloadHref), {
      method: 'GET',
      headers: this.headers,
      dispatcher: this.dispatcher,
      timeoutMs: this.timeoutMs,
      host: this.host,
    });
  }

  async close(): Promise<void> {
    await this.dispatcher.close();
  }
}
