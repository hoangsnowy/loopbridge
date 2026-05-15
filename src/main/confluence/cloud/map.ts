import type {
  AttachmentInfo,
  PageDetail,
  PageSummary,
  SpaceInfo,
  UserInfo,
} from '@shared/domain';
import type {
  CloudAttachmentResponse,
  CloudPageResponse,
  CloudSpaceResponse,
  CloudUserResponse,
} from './wire';

export function mapCloudUser(r: CloudUserResponse): UserInfo {
  const out: UserInfo = { accountId: r.accountId, displayName: r.displayName };
  if (r.email) out.email = r.email;
  return out;
}

export function mapCloudSpace(r: CloudSpaceResponse): SpaceInfo {
  const out: SpaceInfo = {
    id: r.id,
    key: r.key,
    name: r.name,
    type: r.type,
  };
  if (r.homepageId) out.homepageId = r.homepageId;
  return out;
}

export function mapCloudPageSummary(r: CloudPageResponse, baseUrl: string): PageSummary {
  const out: PageSummary = {
    id: r.id,
    title: r.title,
    spaceId: r.spaceId,
    spaceKey: '',
    versionNumber: r.version?.number ?? 1,
  };
  if (r.parentId) out.parentId = r.parentId;
  if (r.version?.createdAt) out.updatedAt = r.version.createdAt;
  const web = r._links?.webui;
  if (web) {
    const base = r._links?.base ?? baseUrl;
    out.webUrl = `${base}${web}`;
  }
  return out;
}

export function mapCloudAttachment(r: CloudAttachmentResponse, baseUrl: string): AttachmentInfo {
  const download = r.downloadLink.startsWith('http')
    ? r.downloadLink
    : `${baseUrl}${r.downloadLink.startsWith('/') ? '' : '/'}${r.downloadLink}`;
  return {
    id: r.id,
    pageId: r.pageId,
    filename: r.title,
    mediaType: r.mediaType ?? 'application/octet-stream',
    sizeBytes: r.fileSize,
    downloadHref: download,
    versionNumber: r.version?.number ?? 1,
  };
}

export function mapCloudPageDetail(
  r: CloudPageResponse,
  baseUrl: string,
  attachments: AttachmentInfo[],
): PageDetail {
  const summary = mapCloudPageSummary(r, baseUrl);
  const webUrl = summary.webUrl ?? `${baseUrl}/wiki/spaces/${r.spaceId}/pages/${r.id}`;
  return {
    ...summary,
    webUrl,
    ancestors: [],
    bodyStorageXhtml: r.body?.storage?.value ?? '',
    attachments,
  };
}
