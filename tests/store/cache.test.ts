import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  attachmentLocalPath,
  readAttachmentBlob,
  readPageCache,
  writeAttachmentBlob,
  writePageCache,
  type PageCacheEntry,
} from '@main/store/cache';

describe('store/cache', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'loopbridge-cache-'));
  });

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => undefined);
  });

  const entry: PageCacheEntry = {
    pageId: 'p1',
    fetchedAt: '2026-05-16T00:00:00Z',
    page: {
      id: 'p1',
      title: 'Hello',
      spaceId: 'DOCS',
      spaceKey: 'DOCS',
      versionNumber: 1,
      webUrl: 'https://example.com/p1',
      ancestors: [],
      bodyStorageXhtml: '<p>hi</p>',
      attachments: [],
    },
  };

  it('writePageCache then readPageCache roundtrip', async () => {
    await writePageCache(dir, entry);
    const got = await readPageCache(dir, 'p1');
    expect(got).not.toBeNull();
    expect(got?.page.title).toBe('Hello');
    expect(got?.page.bodyStorageXhtml).toBe('<p>hi</p>');
  });

  it('readPageCache returns null when missing', async () => {
    const got = await readPageCache(dir, 'ghost');
    expect(got).toBeNull();
  });

  it('writeAttachmentBlob + readAttachmentBlob roundtrip', async () => {
    const data = Buffer.from('image-bytes');
    const target = await writeAttachmentBlob(dir, 'p1', 'foo.png', data);
    expect(target).toContain('foo.png');
    const got = await readAttachmentBlob(dir, 'p1', 'foo.png');
    expect(got?.equals(data)).toBe(true);
  });

  it('attachmentLocalPath sanitizes filename', () => {
    const p = attachmentLocalPath(dir, 'p1', 'weird:/name*?.png');
    // Strip the OS path prefix; only the final basename should reflect
    // sanitization (Windows paths legitimately contain ":" in the drive letter).
    const basename = path.basename(p);
    expect(basename).not.toContain(':');
    expect(basename).not.toContain('*');
    expect(basename).not.toContain('?');
    expect(basename).toContain('.png');
  });

  it('readAttachmentBlob returns null for missing file', async () => {
    const got = await readAttachmentBlob(dir, 'p1', 'nope.png');
    expect(got).toBeNull();
  });

  it('page.json is written as compact JSON (no pretty-print)', async () => {
    await writePageCache(dir, entry);
    const raw = await fs.readFile(path.join(dir, 'pages', 'p1', 'page.json'), 'utf8');
    // Compact: no newline indent. Pretty-print would contain `\n  "`.
    expect(raw).not.toMatch(/\n\s+"/);
  });
});
