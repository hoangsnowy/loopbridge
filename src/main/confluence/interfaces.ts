import type {
  AttachmentInfo,
  ConfluenceBackend,
  PageDetail,
  PageSummary,
  SpaceInfo,
  UserInfo,
} from '@shared/domain';

export interface ListSpacesOptions {
  type?: 'global' | 'personal';
}

export interface ConfluenceClient {
  readonly backend: ConfluenceBackend;
  readonly baseUrl: string;

  testAuth(): Promise<{ user: UserInfo; serverVersion?: string }>;
  resolveSpace(spaceKey: string): Promise<SpaceInfo>;
  listSpaces(opts?: ListSpacesOptions): Promise<SpaceInfo[]>;
  listPages(spaceId: string): AsyncIterable<PageSummary>;
  getPage(pageId: string): Promise<PageDetail>;
  listAttachments(pageId: string): Promise<AttachmentInfo[]>;
  downloadAttachment(att: AttachmentInfo): Promise<Buffer>;
  close(): Promise<void>;
}
