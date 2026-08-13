import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createLicenseKey } from '@accessible-ai/standards';
import { SessionManager } from '../../src/session/session-manager.js';
import { analyzeCodebaseTool } from '../../src/tools/analyze-codebase.js';
import { requireLicenseForTool } from '../../src/middleware/license-gate.js';

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

describe('analyzeCodebaseTool', () => {
  it('returns an error for an unknown session', async () => {
    const sessions = new SessionManager();
    const result = await analyzeCodebaseTool(sessions, { sessionId: 'nope', projectPath: '.' });
    expect(result.isError).toBe(true);
  });

  it("runs the static analysis for the session's standard and stores the result", async () => {
    const sessions = new SessionManager();
    const sessionId = sessions.createSession({ standard: 'wcag-2.1-aa' });

    const result = await analyzeCodebaseTool(sessions, { sessionId, projectPath: join(FIXTURES, 'sample-react-project') });
    const summary = parse(result);

    expect(summary.framework).toBe('react');
    expect(summary.filesAnalyzed).toBe(5);
    expect(summary.totalIssues).toBeGreaterThan(0);
    expect(sessions.getSession(sessionId)?.codebaseResult).toBeDefined();
  });
});

describe('analyze_codebase license gating', () => {
  beforeEach(() => {
    process.env.LICENSE_SECRET = SECRET;
    delete process.env.LICENSE_KEY;
  });

  afterEach(() => {
    delete process.env.LICENSE_SECRET;
    delete process.env.LICENSE_KEY;
  });

  it('is gated behind the codebase-audit feature', async () => {
    const sessions = new SessionManager();
    const sessionId = sessions.createSession({ standard: 'wcag-2.1-aa' });
    const wrapped = requireLicenseForTool(
      'codebase-audit',
      (args: Parameters<typeof analyzeCodebaseTool>[1]) => analyzeCodebaseTool(sessions, args),
    );

    const denied = await wrapped({ sessionId, projectPath: join(FIXTURES, 'sample-react-project') });
    expect(parse(denied).error).toBe('License required');

    process.env.LICENSE_KEY = makeKey(['codebase-audit']);
    const allowed = await wrapped({ sessionId, projectPath: join(FIXTURES, 'sample-react-project') });
    expect(parse(allowed).framework).toBe('react');
  });
});
