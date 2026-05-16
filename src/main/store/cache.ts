import fs from 'node:fs/promises';
import path from 'node:path';
import type { PageDetail } from '@shared/domain';

export interface PageCacheEntry {
  pageId: string;
  page: PageDetail;
  convertedHtml?: string;
  fetchedAt: string;
}

function pageDir(userDataDir: string, pageId: string): string {
  return path.join(userDataDir, 'pages', pageId);
}

export async function writePageCache(userDataDir: string, entry: PageCacheEntry): Promise<void> {
  const dir = pageDir(userDataDir, entry.pageId);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, 'page.json'), JSON.stringify(entry), 'utf8');
}

export async function readPageCache(
  userDataDir: string,
  pageId: string,
): Promise<PageCacheEntry | null> {
  const file = path.join(pageDir(userDataDir, pageId), 'page.json');
  try {
    const text = await fs.readFile(file, 'utf8');
    return JSON.parse(text) as PageCacheEntry;
  } catch {
    return null;
  }
}

export async function writeAttachmentBlob(
  userDataDir: string,
  pageId: string,
  filename: string,
  data: Buffer,
): Promise<string> {
  const dir = path.join(pageDir(userDataDir, pageId), 'attachments');
  await fs.mkdir(dir, { recursive: true });
  const target = path.join(dir, sanitizeFilename(filename));
  await fs.writeFile(target, data);
  return target;
}

export async function readAttachmentBlob(
  userDataDir: string,
  pageId: string,
  filename: string,
): Promise<Buffer | null> {
  const file = path.join(pageDir(userDataDir, pageId), 'attachments', sanitizeFilename(filename));
  try {
    return await fs.readFile(file);
  } catch {
    return null;
  }
}

export function attachmentLocalPath(userDataDir: string, pageId: string, filename: string): string {
  return path.join(pageDir(userDataDir, pageId), 'attachments', sanitizeFilename(filename));
}

function sanitizeFilename(name: string): string {
  return name.replace(/[\\/:*?"<>|]+/g, '_');
}
