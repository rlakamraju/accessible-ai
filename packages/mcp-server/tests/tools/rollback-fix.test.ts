import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SessionManager } from '../../src/session/session-manager';
import { rollbackFixTool } from '../../src/tools/rollback-fix';
import type { AppliedFix } from '../../src/engines/remediation/types';

describe('rollbackFixTool', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'accessible-ai-rollback-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('returns an error for an unknown session', async () => {
    const sessions = new SessionManager();
    const result = await rollbackFixTool(sessions, { sessionId: 'nope', fixId: 'x' });
    expect(result.isError).toBe(true);
  });

  it('errors when the fixId is unknown', async () => {
    const sessions = new SessionManager();
    const sessionId = sessions.createSession({ standard: 'wcag-2.1-aa' });
    const result = await rollbackFixTool(sessions, { sessionId, fixId: 'nope' });
    expect(result.isError).toBe(true);
  });

  it('restores the file to its pre-fix content and marks the fix rolled-back', async () => {
    const filePath = join(dir, 'index.html');
    await writeFile(filePath, '<html lang="en">\n<head></head>\n</html>', 'utf8');

    const sessions = new SessionManager();
    const sessionId = sessions.createSession({ standard: 'wcag-2.1-aa' });
    const appliedFix: AppliedFix = {
      fixId: 'fix-1',
      issueId: 'issue-001',
      ruleId: 'html-has-lang',
      filePath,
      before: '<html>\n<head></head>\n</html>',
      after: '<html lang="en">\n<head></head>\n</html>',
      diff: '--- diff ---',
      description: 'Added lang',
      status: 'applied',
      appliedAt: new Date().toISOString(),
    };
    sessions.updateSession(sessionId, { appliedFixes: [appliedFix] });

    const result = await rollbackFixTool(sessions, { sessionId, fixId: 'fix-1' });
    expect(result.isError).toBeUndefined();
    expect(await readFile(filePath, 'utf8')).toBe('<html>\n<head></head>\n</html>');
    expect(sessions.getSession(sessionId)?.appliedFixes?.[0].status).toBe('rolled-back');
  });

  it('refuses to roll back an already-rolled-back fix', async () => {
    const filePath = join(dir, 'index.html');
    await writeFile(filePath, 'current', 'utf8');
    const sessions = new SessionManager();
    const sessionId = sessions.createSession({ standard: 'wcag-2.1-aa' });
    const appliedFix: AppliedFix = {
      fixId: 'fix-1',
      issueId: 'issue-001',
      ruleId: 'html-has-lang',
      filePath,
      before: 'original',
      after: 'current',
      diff: '',
      description: '',
      status: 'rolled-back',
      appliedAt: new Date().toISOString(),
    };
    sessions.updateSession(sessionId, { appliedFixes: [appliedFix] });

    const result = await rollbackFixTool(sessions, { sessionId, fixId: 'fix-1' });
    expect(result.isError).toBe(true);
  });
});
