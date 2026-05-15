export interface CloudUserResponse {
  type: string;
  accountId: string;
  accountType?: string;
  email?: string;
  displayName: string;
}

export interface CloudSpaceResponse {
  id: string;
  key: string;
  name: string;
  type: string;
  status?: string;
  authorId?: string;
  createdAt?: string;
  homepageId?: string;
  description?: unknown;
}

export interface CloudPageResponse {
  id: string;
  type: 'page' | string;
  status: string;
  title: string;
  spaceId: string;
  parentId?: string;
  authorId?: string;
  createdAt?: string;
  version?: {
    number: number;
    createdAt?: string;
  };
  body?: {
    storage?: {
      value: string;
      representation: 'storage' | string;
    };
  };
  _links?: {
    webui?: string;
    base?: string;
    editui?: string;
  };
}

export interface CloudAttachmentResponse {
  id: string;
  status: string;
  title: string;
  createdAt?: string;
  pageId: string;
  mediaType?: string;
  mediaTypeDescription?: string;
  fileSize: number;
  webuiLink?: string;
  downloadLink: string;
  version?: {
    number: number;
  };
}

export interface CloudListEnvelope<T> {
  results: T[];
  _links?: {
    next?: string;
    base?: string;
  };
}
