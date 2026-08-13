import { describe, expect, it } from 'vitest';
import { SessionManager } from '../../src/session/session-manager';
import { getFixHistoryTool } from '../../src/tools/get-fix-history';
import type { AppliedFix } from '../../src/engines/remediation/types';

describe('getFixHistoryTool', () => {
  it('returns an error for an unknown session', async () => {
    const sessions = new SessionManager();
    const result = await getFixHistoryTool(sessions, { sessionId: 'nope' });
    expect(result.isError).toBe(true);
  });

  it('returns an empty list when no fixes have been applied yet', async () => {
    const sessions = new SessionManager();
    const sessionId = sessions.createSession({ standard: 'wcag-2.1-aa' });
    const result = await getFixHistoryTool(sessions, { sessionId });
    expect(JSON.parse(result.content[0].text)).toEqual([]);
  });

  it('lists every applied fix with its diff and status', async () => {
    const sessions = new SessionManager();
    const sessionId = sessions.createSession({ standard: 'wcag-2.1-aa' });
    const fix: AppliedFix = {
      fixId: 'fix-1',
      issueId: 'issue-001',
      ruleId: 'html-has-lang',
      filePath: 'index.html',
      before: '<html>',
      after: '<html lang="en">',
      diff: '--- diff ---',
      description: 'Added lang',
      status: 'applied',
      appliedAt: new Date().toISOString(),
    };
    sessions.updateSession(sessionId, { appliedFixes: [fix] });

    const result = await getFixHistoryTool(sessions, { sessionId });
    const history = JSON.parse(result.content[0].text);
    expect(history).toHaveLength(1);
    expect(history[0].fixId).toBe('fix-1');
  });
});
