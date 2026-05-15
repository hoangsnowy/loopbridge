export function currentUserUrl(baseUrl: string): string {
  // v2 doesn't expose a current-user endpoint; v1 endpoint remains available on Cloud.
  return `${baseUrl}/wiki/rest/api/user/current`;
}

export function spaceByKeyUrl(baseUrl: string, spaceKey: string): string {
  const params = new URLSearchParams();
  params.set('keys', spaceKey);
  params.set('limit', '1');
  return `${baseUrl}/wiki/api/v2/spaces?${params.toString()}`;
}

export function spacesUrl(baseUrl: string, type?: 'global' | 'personal'): string {
  const params = new URLSearchParams();
  if (type) params.set('type', type);
  params.set('limit', '50');
  return `${baseUrl}/wiki/api/v2/spaces?${params.toString()}`;
}

export function pagesUrl(baseUrl: string, spaceId: string): string {
  const params = new URLSearchParams();
  params.set('limit', '100');
  params.set('body-format', 'storage');
  return `${baseUrl}/wiki/api/v2/spaces/${encodeURIComponent(spaceId)}/pages?${params.toString()}`;
}

export function pageDetailUrl(baseUrl: string, pageId: string): string {
  const params = new URLSearchParams();
  params.set('body-format', 'storage');
  params.set('include-version', 'true');
  params.set('include-labels', 'true');
  return `${baseUrl}/wiki/api/v2/pages/${encodeURIComponent(pageId)}?${params.toString()}`;
}

export function attachmentsUrl(baseUrl: string, pageId: string): string {
  const params = new URLSearchParams();
  params.set('limit', '200');
  return `${baseUrl}/wiki/api/v2/pages/${encodeURIComponent(pageId)}/attachments?${params.toString()}`;
}

export function resolveCloudUrl(baseUrl: string, href: string): string {
  if (href.startsWith('http://') || href.startsWith('https://')) return href;
  return `${baseUrl}${href.startsWith('/') ? '' : '/'}${href}`;
}
