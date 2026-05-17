import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { convertStorageToHtml } from '@main/converter';
import type { ConvertContext } from '@main/converter';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FIXTURES_DIR = path.resolve(__dirname, '../../resources/fixtures');

function loadFixture(name: string): string {
  return fs.readFileSync(path.join(FIXTURES_DIR, name), 'utf8');
}

function baseContext(): ConvertContext {
  return {
    baseUrl: 'https://confluence.example.com',
    spaceKey: 'DOCS',
    attachments: [
      {
        id: 'a1',
        pageId: 'p1',
        filename: 'report.pdf',
        mediaType: 'application/pdf',
        sizeBytes: 12_345,
        downloadHref: 'https://confluence.example.com/download/attachments/p1/report.pdf',
        versionNumber: 1,
      },
    ],
    imageStrategy: 'manual',
    base64MaxBytesPerImage: 1_000_000,
    base64MaxBytesPerPage: 8_000_000,
    demoteH1ToH2: true,
    rewriteInternalLinks: 'keep-confluence',
    needsReviewMarker: true,
  };
}

describe('converter macros — extra fixtures', () => {
  it('jira macro: key-only renders <a>, jqlQuery flags needs-review', async () => {
    const result = await convertStorageToHtml(
      loadFixture('07-jira-macro.storage.xhtml'),
      baseContext(),
    );
    expect(result.html).toContain('PROJ-123');
    expect(result.html).toMatch(/<a [^>]*href="[^"]*PROJ-123"/);
    // Comment markers are stripped by sanitize-html; the visible <mark>
    // tag remains, and needsReview is bumped.
    expect(result.html).toContain('[needs review: jira-jql]');
    expect(result.needsReview).toBeGreaterThanOrEqual(1);
  });

  it('attachments macro lists every attachment from context', async () => {
    const result = await convertStorageToHtml(
      loadFixture('08-attachments-macro.storage.xhtml'),
      baseContext(),
    );
    expect(result.html).toContain('<strong>Attachments</strong>');
    expect(result.html).toContain('report.pdf');
    // Size formatted (12,345 → "12.1 KB").
    expect(result.html).toMatch(/\d+(\.\d+)?\s?KB/);
  });

  it('attachments macro is dropped when there are no attachments', async () => {
    const ctx = baseContext();
    ctx.attachments = [];
    const result = await convertStorageToHtml(
      loadFixture('08-attachments-macro.storage.xhtml'),
      ctx,
    );
    // sanitize-html strips HTML comments; the assertion is that the macro
    // is replaced (no ac:structured-macro residue) and no Attachments list
    // is rendered.
    expect(result.html).not.toContain('ac:structured-macro');
    expect(result.html).not.toContain('<strong>Attachments</strong>');
  });

  it('expand macro renders title + body, escapes entities in title', async () => {
    const result = await convertStorageToHtml(
      loadFixture('09-expand-macro.storage.xhtml'),
      baseContext(),
    );
    expect(result.html).toContain('<blockquote>');
    expect(result.html).toContain('Hidden details inside.');
    // & in title is preserved as &amp; (input had & escaped already).
    expect(result.html).toMatch(/Click to reveal\s*&amp;\s*learn/);
  });

  it('panel macro: with title renders <strong>; without title renders body only', async () => {
    const result = await convertStorageToHtml(
      loadFixture('10-panel-macro.storage.xhtml'),
      baseContext(),
    );
    expect(result.html).toContain('<strong>Heads up</strong>');
    expect(result.html).toContain('Panel body content.');
    expect(result.html).toContain('Panel without title.');
  });

  it('children macro emits review placeholder and bumps needsReview', async () => {
    const xhtml = `<p>Before</p><ac:structured-macro ac:name="children"/><p>After</p>`;
    const result = await convertStorageToHtml(xhtml, baseContext());
    expect(result.html).toContain('[Child pages');
    expect(result.html).not.toContain('children macro removed');
    expect(result.needsReview).toBeGreaterThanOrEqual(1);
  });

  it('toc macro emits review placeholder and bumps needsReview', async () => {
    const xhtml = `<ac:structured-macro ac:name="toc"/><h2>Section</h2>`;
    const result = await convertStorageToHtml(xhtml, baseContext());
    expect(result.html).toContain('Table of contents');
    expect(result.html).not.toContain('toc removed');
    expect(result.needsReview).toBeGreaterThanOrEqual(1);
  });

  it('status macro renders color: title in brackets when color present', async () => {
    const result = await convertStorageToHtml(
      loadFixture('11-status-macro.storage.xhtml'),
      baseContext(),
    );
    expect(result.html).toContain('[Green: Passing]');
    expect(result.html).toContain('[In progress]');
  });

  it('link variants: page, user, attachment, anchor', async () => {
    const ctx = baseContext();
    // Simulate the leak scenario: attachmentLocalPath returns an absolute
    // userData path. Output must not embed it in the clipboard HTML.
    ctx.attachmentLocalPath = (f: string) =>
      `C:\\Users\\someone\\AppData\\Roaming\\loopbridge\\pages\\p1\\${f}`;
    const result = await convertStorageToHtml(loadFixture('12-link-variants.storage.xhtml'), ctx);
    // Page link → keep-confluence rewrite. The encoded path may contain
    // either "Other+Page" or "Other%2BPage" depending on encoder.
    expect(result.html).toMatch(/<a [^>]*href="[^"]*display\/DOCS\/(Other\+Page|Other%2BPage)"/);
    // User mention rendered as @label with needs-review marker.
    expect(result.html).toContain('@Jane');
    // Attachment link → placeholder marker, NOT a local filesystem path.
    expect(result.html).toContain('[attachment: report.pdf]');
    expect(result.html).not.toMatch(/C:\\Users/);
    expect(result.html).not.toContain('AppData');
    // Anchor-only link → href="#section-a".
    expect(result.html).toMatch(/href="#section-a"/);
    // Attachment placeholder + user mention each bump needsReview.
    expect(result.needsReview).toBeGreaterThanOrEqual(2);
  });
});
