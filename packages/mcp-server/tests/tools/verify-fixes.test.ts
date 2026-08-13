import { cp, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SessionManager } from '../../src/session/session-manager';
import { analyzeCodebaseTool } from '../../src/tools/analyze-codebase';
import { verifyFixesTool } from '../../src/tools/verify-fixes';
import type { AppliedFix } from '../../src/engines/remediation/types';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, '../fixtures');

function parse(result: { content: Array<{ text: string }> }) {
  return JSON.parse(result.content[0].text);
}

describe('verifyFixesTool', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'accessible-ai-verify-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('returns an error for an unknown session', async () => {
    const sessions = new SessionManager();
    const result = await verifyFixesTool(sessions, { sessionId: 'nope', projectPath: dir, verificationLevel: 'static-only' });
    expect(result.isError).toBe(true);
  });

  it('errors when there is no codebase analysis to compare against', async () => {
    const sessions = new SessionManager();
    const sessionId = sessions.createSession({ standard: 'wcag-2.1-aa' });
    const result = await verifyFixesTool(sessions, { sessionId, projectPath: dir, verificationLevel: 'static-only' });
    expect(result.isError).toBe(true);
  });

  it('errors when there are no applied fixes to verify', async () => {
    await cp(join(FIXTURES, 'sample-react-project'), dir, { recursive: true });
    const sessions = new SessionManager();
    const sessionId = sessions.createSession({ standard: 'wcag-2.1-aa' });
    await analyzeCodebaseTool(sessions, { sessionId, projectPath: dir });

    const result = await verifyFixesTool(sessions, { sessionId, projectPath: dir, verificationLevel: 'static-only' });
    expect(result.isError).toBe(true);
  });

  it('reports a resolved fix and an improved compliance score after fixing a real issue in place', async () => {
    await cp(join(FIXTURES, 'sample-react-project'), dir, { recursive: true });
    const filePath = join(dir, 'src/components/ClickableCard.jsx');

    const sessions = new SessionManager();
    const sessionId = sessions.createSession({ standard: 'wcag-2.1-aa' });
    await analyzeCodebaseTool(sessions, { sessionId, projectPath: dir });

    const before = sessions.getSession(sessionId)!.codebaseResult!;
    const clickIssue = before.issues.find((issue) => issue.sourceLocation.filePath === filePath && issue.ruleId === 'jsx-a11y/click-events-have-key-events');
    expect(clickIssue).toBeDefined();

    // Actually fix the file (native <button> is keyboard-operable and interactive by default) so the re-analysis finds it resolved.
    await writeFile(
      filePath,
      `export function ClickableCard({ onSelect }) {\n  return (\n    <button className="card" onClick={onSelect}>\n      Select this plan\n    </button>\n  );\n}\n`,
      'utf8',
    );

    const appliedFix: AppliedFix = {
      fixId: 'fix-1',
      issueId: clickIssue!.id,
      ruleId: clickIssue!.ruleId,
      filePath,
      before: 'original',
      after: 'fixed',
      diff: '--- diff ---',
      description: 'Changed the clickable div to a native button',
      status: 'applied',
      appliedAt: new Date().toISOString(),
    };
    sessions.updateSession(sessionId, { appliedFixes: [appliedFix] });

    const result = await verifyFixesTool(sessions, { sessionId, projectPath: dir, verificationLevel: 'static-only' });
    const verification = parse(result);

    expect(verification.fixes[0].status).toBe('resolved');
    expect(verification.complianceDelta.after.score).toBeGreaterThanOrEqual(verification.complianceDelta.before.score);
    expect(sessions.getSession(sessionId)?.codebaseResult?.complianceScore).toBe(verification.complianceDelta.after.score);
  });

  it('surfaces a note instead of attempting an unavailable runtime re-verification', async () => {
    await cp(join(FIXTURES, 'sample-react-project'), dir, { recursive: true });
    const filePath = join(dir, 'src/components/SignupForm.jsx');

    const sessions = new SessionManager();
    const sessionId = sessions.createSession({ standard: 'wcag-2.1-aa' });
    await analyzeCodebaseTool(sessions, { sessionId, projectPath: dir });
    const before = sessions.getSession(sessionId)!.codebaseResult!;
    const anyIssue = before.issues[0];

    sessions.updateSession(sessionId, {
      appliedFixes: [
        {
          fixId: 'fix-1',
          issueId: anyIssue.id,
          ruleId: anyIssue.ruleId,
          filePath,
          before: 'x',
          after: 'y',
          diff: '',
          description: '',
          status: 'applied',
          appliedAt: new Date().toISOString(),
        },
      ],
    });

    const result = await verifyFixesTool(sessions, { sessionId, projectPath: dir, verificationLevel: 'static-and-runtime' });
    const verification = parse(result);
    expect(verification.notes?.[0]).toContain("isn't available");
  });
});
