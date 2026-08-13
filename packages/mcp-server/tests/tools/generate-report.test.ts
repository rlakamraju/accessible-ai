import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createLicenseKey } from '@accessible-ai/standards';
import { SessionManager } from '../../src/session/session-manager.js';
import { analyzeCodebaseTool } from '../../src/tools/analyze-codebase.js';
import { generateReportTool } from '../../src/tools/generate-report.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, '../fixtures');
const SECRET = 'test-secret';

function makeKey(features: string[]) {
  const now = Math.floor(Date.now() / 1000);
  return createLicenseKey({ e: 'user@test.dev', t: 'PRO', f: features as never, i: now, x: now + 3600 }, SECRET);
}

function parse(result: { content: Array<{ text: string }> }) {
  return JSON.parse(result.content[0].text);
}

async function analyzedSession(sessions: SessionManager) {
  const sessionId = sessions.createSession({ standard: 'wcag-2.1-aa' });
  await analyzeCodebaseTool(sessions, { sessionId, projectPath: join(FIXTURES, 'sample-react-project') });
  return sessionId;
}

describe('generateReportTool', () => {
  it('errors when no codebase analysis has been run for the session', async () => {
    const sessions = new SessionManager();
    const sessionId = sessions.createSession({ standard: 'wcag-2.1-aa' });
    const result = await generateReportTool(sessions, { sessionId, format: 'json' });
    expect(result.isError).toBe(true);
  });

  it('errors for an unknown session', async () => {
    const sessions = new SessionManager();
    const result = await generateReportTool(sessions, { sessionId: 'nope', format: 'json' });
    expect(result.isError).toBe(true);
  });

  it('generates an inline JSON report with no license required', async () => {
    const sessions = new SessionManager();
    const sessionId = await analyzedSession(sessions);

    const result = await generateReportTool(sessions, { sessionId, format: 'json' });
    const payload = parse(result);
    expect(payload.summary.violations).toBeGreaterThan(0);
    const report = JSON.parse(payload.report);
    expect(report.issues).toHaveLength(payload.summary.violations);
  });

  it('generates an inline Markdown report with no license required', async () => {
    const sessions = new SessionManager();
    const sessionId = await analyzedSession(sessions);

    const result = await generateReportTool(sessions, { sessionId, format: 'markdown', groupBy: 'severity' });
    const payload = parse(result);
    expect(payload.report).toContain('# Accessibility Compliance Report');
    expect(payload.report).toContain('### Findings by severity');
  });

  describe('with a projectPath', () => {
    let tmpDir: string;

    beforeEach(async () => {
      tmpDir = await mkdtemp(join(tmpdir(), 'aai-report-'));
    });

    afterEach(async () => {
      await rm(tmpDir, { recursive: true, force: true });
    });

    it('writes the Markdown report to .accessible-ai/report.md and returns its path', async () => {
      const sessions = new SessionManager();
      const sessionId = await analyzedSession(sessions);

      const result = await generateReportTool(sessions, { sessionId, format: 'markdown', projectPath: tmpDir });
      const payload = parse(result);
      expect(payload.reportPath).toBe(join(tmpDir, '.accessible-ai', 'report.md'));

      const written = await readFile(payload.reportPath, 'utf8');
      expect(written).toContain('# Accessibility Compliance Report');
    });
  });

  describe('html format gating (report-export feature)', () => {
    beforeEach(() => {
      process.env.LICENSE_SECRET = SECRET;
      delete process.env.LICENSE_KEY;
    });

    afterEach(() => {
      delete process.env.LICENSE_SECRET;
      delete process.env.LICENSE_KEY;
    });

    it('refuses an HTML report with no license', async () => {
      const sessions = new SessionManager();
      const sessionId = await analyzedSession(sessions);

      const result = await generateReportTool(sessions, { sessionId, format: 'html' });
      const payload = parse(result);
      expect(payload.error).toBe('License required');
      expect(payload.feature).toBe('report-export');
    });

    it('produces an HTML report once report-export is licensed', async () => {
      process.env.LICENSE_KEY = makeKey(['report-export']);
      const sessions = new SessionManager();
      const sessionId = await analyzedSession(sessions);

      const result = await generateReportTool(sessions, { sessionId, format: 'html' });
      const payload = parse(result);
      expect(payload.report).toContain('<!doctype html>');
    });
  });
});
