export type ConfluenceBackend = 'dc' | 'cloud';

export interface UserInfo {
  accountId: string;
  displayName: string;
  email?: string;
}

export interface SpaceInfo {
  id: string;
  key: string;
  name: string;
  type: 'global' | 'personal' | string;
  homepageId?: string;
}

export interface AncestorRef {
  id: string;
  title: string;
}

export interface PageSummary {
  id: string;
  title: string;
  spaceId: string;
  spaceKey: string;
  versionNumber: number;
  parentId?: string;
  updatedAt?: string;
  webUrl?: string;
}

export interface AttachmentInfo {
  id: string;
  pageId: string;
  filename: string;
  mediaType: string;
  sizeBytes: number;
  downloadHref: string;
  versionNumber: number;
}

export interface PageDetail extends PageSummary {
  ancestors: AncestorRef[];
  bodyStorageXhtml: string;
  attachments: AttachmentInfo[];
  webUrl: string;
}
