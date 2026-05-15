export function currentUserUrl(baseUrl: string): string {
  return `${baseUrl}/rest/api/user/current`;
}

export function serverInfoUrl(baseUrl: string): string {
  return `${baseUrl}/rest/api/serverInfo`;
}

export function spaceByKeyUrl(baseUrl: string, spaceKey: string): string {
  return `${baseUrl}/rest/api/space/${encodeURIComponent(spaceKey)}`;
}

export function spacesUrl(baseUrl: string, type?: 'global' | 'personal'): string {
  const params = new URLSearchParams();
  if (type) params.set('type', type);
  params.set('start', '0');
  params.set('limit', '50');
  return `${baseUrl}/rest/api/space?${params.toString()}`;
}

export function pagesUrl(baseUrl: string, spaceKey: string): string {
  const params = new URLSearchParams();
  params.set('spaceKey', spaceKey);
  params.set('type', 'page');
  params.set('start', '0');
  params.set('limit', '100');
  params.set('expand', 'ancestors,version,history.lastUpdated');
  return `${baseUrl}/rest/api/content?${params.toString()}`;
}

export function pageDetailUrl(baseUrl: string, pageId: string): string {
  const params = new URLSearchParams();
  params.set('expand', 'body.storage,version,ancestors,space,children.attachment');
  return `${baseUrl}/rest/api/content/${encodeURIComponent(pageId)}?${params.toString()}`;
}

export function attachmentsUrl(baseUrl: string, pageId: string): string {
  const params = new URLSearchParams();
  params.set('limit', '200');
  params.set('expand', 'version,metadata');
  return `${baseUrl}/rest/api/content/${encodeURIComponent(pageId)}/child/attachment?${params.toString()}`;
}

export function resolveDownloadUrl(baseUrl: string, href: string): string {
  if (href.startsWith('http://') || href.startsWith('https://')) return href;
  return `${baseUrl}${href.startsWith('/') ? '' : '/'}${href}`;
}
