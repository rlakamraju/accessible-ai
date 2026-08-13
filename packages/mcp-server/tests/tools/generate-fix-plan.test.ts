import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SessionManager } from '../../src/session/session-manager';
import { analyzeCodebaseTool } from '../../src/tools/analyze-codebase';
import { generateFixPlanTool } from '../../src/tools/generate-fix-plan';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, '../fixtures');

function parse(result: { content: Array<{ text: string }> }) {
  return JSON.parse(result.content[0].text);
}

describe('generateFixPlanTool', () => {
  it('returns an error for an unknown session', async () => {
    const sessions = new SessionManager();
    const result = await generateFixPlanTool(sessions, { sessionId: 'nope', prioritizeBy: 'impact' });
    expect(result.isError).toBe(true);
  });

  it('errors when the session has no issues yet', async () => {
    const sessions = new SessionManager();
    const sessionId = sessions.createSession({ standard: 'wcag-2.1-aa' });
    const result = await generateFixPlanTool(sessions, { sessionId, prioritizeBy: 'impact' });
    expect(result.isError).toBe(true);
  });

  it('builds a plan from a session’s codebase analysis and stores it', async () => {
    const sessions = new SessionManager();
    const sessionId = sessions.createSession({ standard: 'wcag-2.1-aa' });
    await analyzeCodebaseTool(sessions, { sessionId, projectPath: join(FIXTURES, 'sample-react-project') });

    const result = await generateFixPlanTool(sessions, { sessionId, prioritizeBy: 'impact' });
    const plan = parse(result);

    expect(plan.phases.length).toBeGreaterThan(0);
    expect(plan.summary.totalIssues).toBeGreaterThan(0);
    expect(sessions.getSession(sessionId)?.fixPlan).toBeDefined();
  });
});
