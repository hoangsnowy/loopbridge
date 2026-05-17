import { ClientError } from '@shared/errors';
import type { AttachmentInfo, PageDetail, PageSummary, SpaceInfo, UserInfo } from '@shared/domain';
import type {
  DcAttachmentResponse,
  DcContentResponse,
  DcSpaceResponse,
  DcUserResponse,
} from './wire';

export function mapDcUser(r: DcUserResponse): UserInfo {
  const accountId = r.accountId ?? r.userKey ?? r.username;
  if (!accountId) {
    throw new ClientError('Confluence user response has no stable identifier', {
      statusCode: 500,
    });
  }
  const out: UserInfo = { accountId, displayName: r.displayName };
  if (r.email) out.email = r.email;
  return out;
}

export function mapDcSpace(r: DcSpaceResponse): SpaceInfo {
  const out: SpaceInfo = {
    id: r.key,
    key: r.key,
    name: r.name,
    type: r.type,
  };
  if (r.homepage?.id !== undefined) out.homepageId = String(r.homepage.id);
  return out;
}

export function mapDcPageSummary(r: DcContentResponse, baseUrl: string): PageSummary {
  const spaceKey = r.space?.key ?? '';
  const spaceId = r.space?.id !== undefined ? String(r.space.id) : spaceKey;
  const parent =
    r.ancestors && r.ancestors.length > 0 ? r.ancestors[r.ancestors.length - 1] : undefined;
  const out: PageSummary = {
    id: r.id,
    title: r.title,
    spaceId,
    spaceKey,
    versionNumber: r.version.number,
  };
  if (parent) out.parentId = parent.id;
  if (r.version.when) out.updatedAt = r.version.when;
  const web = r._links?.webui;
  const base = r._links?.base ?? baseUrl;
  const ctx = r._links?.context ?? '';
  if (web) out.webUrl = `${base}${ctx}${web}`;
  return out;
}

export function mapDcAttachment(
  r: DcAttachmentResponse,
  baseUrl: string,
  fallbackPageId: string,
): AttachmentInfo {
  const pageId = r.container?.id !== undefined ? String(r.container.id) : fallbackPageId;
  const mediaType = r.metadata?.mediaType ?? r.extensions?.mediaType ?? 'application/octet-stream';
  const sizeBytes = r.extensions?.fileSize ?? 0;
  const base = r._links.base ?? baseUrl;
  const ctx = r._links.context ?? '';
  const download = r._links.download.startsWith('http')
    ? r._links.download
    : `${base}${ctx}${r._links.download}`;
  return {
    id: r.id,
    pageId,
    filename: r.title,
    mediaType,
    sizeBytes,
    downloadHref: download,
    versionNumber: r.version.number,
  };
}

export function mapDcPageDetail(r: DcContentResponse, baseUrl: string): PageDetail {
  const summary = mapDcPageSummary(r, baseUrl);
  const ancestors = (r.ancestors ?? []).map((a) => ({ id: a.id, title: a.title }));
  const attachments = (r.children?.attachment?.results ?? []).map((a) =>
    mapDcAttachment(a, baseUrl, r.id),
  );
  return {
    ...summary,
    webUrl: summary.webUrl ?? `${baseUrl}/pages/viewpage.action?pageId=${r.id}`,
    ancestors,
    bodyStorageXhtml: r.body?.storage?.value ?? '',
    attachments,
  };
}
