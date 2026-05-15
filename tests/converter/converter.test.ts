import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { convertStorageToHtml } from '@main/converter';
import type { ConvertContext } from '@main/converter';

const FIXTURES_DIR = path.resolve(__dirname, '../../resources/fixtures');

function loadFixture(name: string): string {
  return fs.readFileSync(path.join(FIXTURES_DIR, name), 'utf8');
}

function baseContext(): ConvertContext {
  return {
    baseUrl: 'https://confluence.example.com',
    spaceKey: 'DOCS',
    attachments: [],
    imageStrategy: 'manual',
    base64MaxBytesPerImage: 1_000_000,
    base64MaxBytesPerPage: 8_000_000,
    demoteH1ToH2: true,
    rewriteInternalLinks: 'keep-confluence',
    needsReviewMarker: true,
  };
}

describe('converter', () => {
  it('handles simple paragraphs', async () => {
    const result = await convertStorageToHtml(loadFixture('01-simple-paragraphs.storage.xhtml'), baseContext());
    expect(result.html).toContain('<strong>bold</strong>');
    expect(result.html).toContain('<em>italic</em>');
    expect(result.needsReview).toBe(0);
  });

  it('rewrites info/warning macros to blockquotes', async () => {
    const result = await convertStorageToHtml(loadFixture('02-info-macro.storage.xhtml'), baseContext());
    expect(result.html).toContain('<blockquote>');
    expect(result.html).toContain('Info:');
    expect(result.html).toContain('Warning:');
  });

  it('renders code macro as <pre><code> with language class', async () => {
    const result = await convertStorageToHtml(loadFixture('03-code-macro.storage.xhtml'), baseContext());
    expect(result.html).toContain('<pre>');
    expect(result.html).toContain('class="language-typescript"');
    expect(result.html).toContain('console.log');
  });

  it('preserves table structure and colspan', async () => {
    const result = await convertStorageToHtml(loadFixture('04-table.storage.xhtml'), baseContext());
    expect(result.html).toContain('<table>');
    expect(result.html).toContain('<th>Name</th>');
    expect(result.html).toContain('<td>Alpha</td>');
  });

  it('converts task lists to checkboxes', async () => {
    const result = await convertStorageToHtml(loadFixture('05-task-list.storage.xhtml'), baseContext());
    expect(result.html).toContain('<input');
    expect(result.html).toContain('type="checkbox"');
    expect(result.html).toContain('Set up environment');
    expect(result.html).toContain('Install dependencies');
  });

  it('flags unknown macros with visible marker and needsReview counter', async () => {
    const result = await convertStorageToHtml(loadFixture('06-unknown-macro.storage.xhtml'), baseContext());
    expect(result.html).toContain('unsupported macro');
    expect(result.html).toContain('gliffy');
    expect(result.needsReview).toBeGreaterThan(0);
    expect(result.html).toContain('Inner content');
  });
});
