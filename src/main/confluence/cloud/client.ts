import type { Dispatcher } from 'undici';
import type {
  AttachmentInfo,
  ConfluenceBackend,
  PageDetail,
  PageSummary,
  SpaceInfo,
  UserInfo,
} from '@shared/domain';
import type { CloudConfluenceConfig, NetworkConfig } from '@shared/config-schema';
import { ClientError } from '@shared/errors';
import type { ConfluenceClient, ListSpacesOptions } from '../interfaces';
import { buildAuthHeader } from '../shared/auth';
import { buildDispatcher } from '../shared/agent';
import { binaryRequest, jsonRequest } from '../shared/http';
import {
  attachmentsUrl,
  currentUserUrl,
  pageDetailUrl,
  pagesUrl,
  resolveCloudUrl,
  spaceByKeyUrl,
  spacesUrl,
} from './endpoints';
import {
  mapCloudAttachment,
  mapCloudPageDetail,
  mapCloudPageSummary,
  mapCloudSpace,
  mapCloudUser,
} from './map';
import { paginateCloud } from './paginate';
import type {
  CloudAttachmentResponse,
  CloudListEnvelope,
  CloudPageResponse,
  CloudSpaceResponse,
  CloudUserResponse,
} from './wire';

export interface CloudClientDeps {
  config: CloudConfluenceConfig;
  network: NetworkConfig;
  secret: string;
}

export class ConfluenceCloudClient implements ConfluenceClient {
  readonly backend: ConfluenceBackend = 'cloud';
  readonly baseUrl: string;
  private readonly dispatcher: Dispatcher;
  private readonly headers: Record<string, string>;
  private readonly timeoutMs: number;
  private readonly host: string;

  constructor(deps: CloudClientDeps) {
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
    const wire = await this.getJson<CloudUserResponse>(currentUserUrl(this.baseUrl));
    return { user: mapCloudUser(wire) };
  }

  async resolveSpace(spaceKey: string): Promise<SpaceInfo> {
    const wire = await this.getJson<CloudListEnvelope<CloudSpaceResponse>>(
      spaceByKeyUrl(this.baseUrl, spaceKey),
    );
    const first = wire.results[0];
    if (!first) throw new ClientError(`Space "${spaceKey}" not found`, { statusCode: 404 });
    return mapCloudSpace(first);
  }

  async listSpaces(opts?: ListSpacesOptions): Promise<SpaceInfo[]> {
    const wire = await this.getJson<CloudListEnvelope<CloudSpaceResponse>>(
      spacesUrl(this.baseUrl, opts?.type),
    );
    return wire.results.map(mapCloudSpace);
  }

  async *listPages(spaceId: string): AsyncIterable<PageSummary> {
    const initial = pagesUrl(this.baseUrl, spaceId);
    for await (const batch of paginateCloud<CloudPageResponse>(
      initial,
      this.baseUrl,
      (url) => this.getJson<CloudListEnvelope<CloudPageResponse>>(url),
    )) {
      for (const item of batch) {
        yield mapCloudPageSummary(item, this.baseUrl);
      }
    }
  }

  async getPage(pageId: string): Promise<PageDetail> {
    const wire = await this.getJson<CloudPageResponse>(pageDetailUrl(this.baseUrl, pageId));
    const attachments = await this.listAttachments(pageId);
    return mapCloudPageDetail(wire, this.baseUrl, attachments);
  }

  async listAttachments(pageId: string): Promise<AttachmentInfo[]> {
    const out: AttachmentInfo[] = [];
    const initial = attachmentsUrl(this.baseUrl, pageId);
    for await (const batch of paginateCloud<CloudAttachmentResponse>(
      initial,
      this.baseUrl,
      (url) => this.getJson<CloudListEnvelope<CloudAttachmentResponse>>(url),
    )) {
      for (const item of batch) {
        out.push(mapCloudAttachment(item, this.baseUrl));
      }
    }
    return out;
  }

  async downloadAttachment(att: AttachmentInfo): Promise<Buffer> {
    return binaryRequest(resolveCloudUrl(this.baseUrl, att.downloadHref), {
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
