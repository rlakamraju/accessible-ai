import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SessionManager } from '../../src/session/session-manager';
import { importAuditResults } from '../../src/tools/import-audit-results';

function parseResult(result: { content: Array<{ text: string }> }) {
  return JSON.parse(result.content[0].text);
}

const validExport = {
  version: '1.0',
  exportedAt: new Date().toISOString(),
  source: 'chrome-extension',
  pageUrl: 'https://example.com',
  standard: 'ada',
  axeResults: {
    violations: [
      {
        id: 'image-alt',
        impact: 'critical',
        description: 'Images must have alternate text',
        help: 'Images must have alternate text',
        helpUrl: 'https://dequeuniversity.com/rules/axe/image-alt',
        tags: ['wcag2a'],
        nodes: [{ target: ['#logo'], html: '<img id="logo">' }],
      },
    ],
  },
  deepAnalysis: { enrichedFindings: [], llmOnlyFindings: [], summary: 'ok' },
};

describe('importAuditResults', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'accessible-ai-import-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('imports a valid export and creates a session', async () => {
    const filePath = join(dir, 'audit-results.json');
    await writeFile(filePath, JSON.stringify(validExport));

    const sessions = new SessionManager();
    const result = await importAuditResults(sessions, { filePath });
    const summary = parseResult(result);

    expect(summary.sessionId).toBeTruthy();
    expect(summary.importedViolations).toBe(1);
    expect(sessions.getSession(summary.sessionId)?.importedViolations).toHaveLength(1);
  });

  it('reports every violation as unmapped when no source mapper has run yet', async () => {
    const filePath = join(dir, 'audit-results.json');
    await writeFile(filePath, JSON.stringify(validExport));

    const sessions = new SessionManager();
    const summary = parseResult(await importAuditResults(sessions, { filePath, projectPath: dir }));

    expect(summary.mappedToSource).toBe(0);
    expect(summary.unmapped).toBe(1);
  });

  it('returns an error for a file that is not a valid AccessibleAI export', async () => {
    const filePath = join(dir, 'not-an-export.json');
    await writeFile(filePath, JSON.stringify({ hello: 'world' }));

    const sessions = new SessionManager();
    const result = await importAuditResults(sessions, { filePath });

    expect(result.isError).toBe(true);
  });

  it('returns an error when the file does not exist', async () => {
    const sessions = new SessionManager();
    const result = await importAuditResults(sessions, { filePath: join(dir, 'missing.json') });

    expect(result.isError).toBe(true);
  });
});
