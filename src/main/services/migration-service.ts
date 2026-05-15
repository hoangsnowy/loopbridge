import { app } from 'electron';
import path from 'node:path';
import type { ConfluenceClient } from '@main/confluence/interfaces';
import { createClient } from '@main/confluence/factory';
import { convertStorageToHtml, type ConvertContext } from '@main/converter';
import { ConfigError } from '@shared/errors';
import type { ConvertResult } from '@shared/types';
import { getConfig } from '@main/store/config';
import { getSecret } from '@main/store/secrets';
import {
  attachmentLocalPath,
  readAttachmentBlob,
  readPageCache,
  writeAttachmentBlob,
  writePageCache,
} from '@main/store/cache';
import { childLogger } from '@main/logging/logger';
import { transition, upsertPageSummary } from './progress-service';

const log = () => childLogger({ mod: 'migration' });

let client: ConfluenceClient | undefined;

export async function ensureClient(): Promise<ConfluenceClient> {
  if (client) return client;
  const config = getConfig();
  if (!config.confluence) throw new ConfigError('Confluence is not configured');
  const secret = await getSecret(config.confluence.backend, config.confluence.baseUrl);
  if (!secret) throw new ConfigError('Credential missing — re-run setup');
  client = createClient({ config, secret });
  return client;
}

export async function resetClient(): Promise<void> {
  if (client) {
    try {
      await client.close();
    } catch (err) {
      log().warn({ err }, 'failed to close client');
    }
    client = undefined;
  }
}

export function userDataDir(): string {
  return app.getPath('userData');
}

export async function fetchAndCachePage(pageId: string): Promise<void> {
  const c = await ensureClient();
  const page = await c.getPage(pageId);
  upsertPageSummary({
    pageId: page.id,
    spaceKey: page.spaceKey,
    title: page.title,
    versionNumber: page.versionNumber,
    ...(page.parentId ? { parentId: page.parentId } : {}),
  });
  for (const att of page.attachments) {
    const existing = await readAttachmentBlob(userDataDir(), page.id, att.filename);
    if (existing) continue;
    try {
      const buf = await c.downloadAttachment(att);
      await writeAttachmentBlob(userDataDir(), page.id, att.filename, buf);
    } catch (err) {
      log().warn({ err, filename: att.filename }, 'attachment download failed');
    }
  }
  await writePageCache(userDataDir(), {
    pageId: page.id,
    page,
    fetchedAt: new Date().toISOString(),
  });
  transition({
    pageId: page.id,
    next: 'fetched',
    eventKind: 'fetch',
  });
}

export async function convertPage(pageId: string): Promise<ConvertResult> {
  const cached = await readPageCache(userDataDir(), pageId);
  if (!cached) throw new ConfigError(`Page ${pageId} is not fetched yet`);

  const config = getConfig();
  const baseUrl = config.confluence?.baseUrl ?? '';
  const spaceKey = cached.page.spaceKey;

  const ctx: ConvertContext = {
    baseUrl,
    spaceKey,
    attachments: cached.page.attachments,
    imageStrategy: config.migration.imageStrategy,
    base64MaxBytesPerImage: config.migration.base64MaxBytesPerImage,
    base64MaxBytesPerPage: config.migration.base64MaxBytesPerPage,
    demoteH1ToH2: config.migration.demoteH1ToH2,
    rewriteInternalLinks: config.migration.rewriteInternalLinks,
    needsReviewMarker: config.migration.needsReviewMarker,
    loadAttachment: (filename) => readAttachmentBlob(userDataDir(), pageId, filename),
    attachmentLocalPath: (filename) => attachmentLocalPath(userDataDir(), pageId, filename),
  };

  const result = await convertStorageToHtml(cached.page.bodyStorageXhtml, ctx);

  await writePageCache(userDataDir(), {
    ...cached,
    convertedHtml: result.html,
  });

  transition({
    pageId,
    next: 'converted',
    eventKind: 'convert',
    patch: {
      needsReview: result.needsReview,
      imagesEmbedded: result.imagesEmbedded,
      imagesManual: result.imagesManual,
    },
  });

  return {
    pageId,
    html: result.html,
    needsReview: result.needsReview,
    imagesEmbedded: result.imagesEmbedded,
    imagesManual: result.imagesManual,
    imagePlan: result.imagePlan,
  };
}

export async function readConvertedHtml(pageId: string): Promise<string | null> {
  const cached = await readPageCache(userDataDir(), pageId);
  return cached?.convertedHtml ?? null;
}

export function pageCacheRoot(): string {
  return path.join(userDataDir(), 'pages');
}
