export interface DcUserResponse {
  type: string;
  username?: string;
  userKey?: string;
  accountId?: string;
  displayName: string;
  email?: string;
}

export interface DcServerInfoResponse {
  baseUrl: string;
  buildNumber: number;
  version: string;
  serverTime?: number;
}

export interface DcSpaceResponse {
  id: number | string;
  key: string;
  name: string;
  type: string;
  homepage?: {
    id: string | number;
  };
  _links?: {
    self?: string;
    webui?: string;
    base?: string;
  };
}

export interface DcAttachmentResponse {
  id: string;
  type: 'attachment';
  title: string;
  container?: {
    id: string | number;
  };
  metadata?: {
    mediaType?: string;
  };
  extensions?: {
    fileSize?: number;
    mediaType?: string;
  };
  version: {
    number: number;
  };
  _links: {
    download: string;
    self?: string;
    base?: string;
    context?: string;
  };
}

export interface DcAncestorResponse {
  id: string;
  type: string;
  title: string;
}

export interface DcContentResponse {
  id: string;
  type: 'page' | 'blogpost' | string;
  title: string;
  status: string;
  space?: {
    id: number | string;
    key: string;
    name?: string;
  };
  version: {
    number: number;
    when?: string;
  };
  body?: {
    storage?: {
      value: string;
      representation: 'storage' | string;
    };
  };
  ancestors?: DcAncestorResponse[];
  children?: {
    attachment?: DcListEnvelope<DcAttachmentResponse>;
  };
  _links?: {
    webui?: string;
    base?: string;
    context?: string;
    self?: string;
  };
}

export interface DcListEnvelope<T> {
  results: T[];
  start?: number;
  limit?: number;
  size?: number;
  _links?: {
    next?: string;
    self?: string;
    base?: string;
    context?: string;
  };
}
