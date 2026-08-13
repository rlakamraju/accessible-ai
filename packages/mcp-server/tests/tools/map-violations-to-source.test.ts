import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SessionManager } from '../../src/session/session-manager';
import { mapViolationsToSourceTool } from '../../src/tools/map-violations-to-source';
import type { AxeViolation } from '../../src/config/types';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, '../fixtures');

function parse(result: { content: Array<{ text: string }> }) {
  return JSON.parse(result.content[0].text);
}

const cardClickViolation: AxeViolation = {
  id: 'click-events-have-key-events',
  impact: 'serious',
  description: 'Clickable elements must be keyboard-operable',
  help: 'Clickable elements must be keyboard-operable',
  helpUrl: '',
  tags: ['wcag2a', 'wcag211'],
  nodes: [{ target: ['div.card'], html: '<div class="card">Select this plan</div>' }],
};

describe('mapViolationsToSourceTool', () => {
  it('returns an error for an unknown session', async () => {
    const sessions = new SessionManager();
    const result = await mapViolationsToSourceTool(sessions, { sessionId: 'nope', projectPath: '.' });
    expect(result.isError).toBe(true);
  });

  it('errors when the session has no imported violations or codebase result', async () => {
    const sessions = new SessionManager();
    const sessionId = sessions.createSession({ standard: 'wcag-2.1-aa' });
    const result = await mapViolationsToSourceTool(sessions, { sessionId, projectPath: '.' });
    expect(result.isError).toBe(true);
  });

  it('normalizes, dedupes, and maps imported runtime violations, storing the result on the session', async () => {
    const sessions = new SessionManager();
    const sessionId = sessions.createSession({ standard: 'wcag-2.1-aa' });
    sessions.updateSession(sessionId, { importedViolations: [cardClickViolation], pageUrl: 'https://example.com' });

    const result = await mapViolationsToSourceTool(sessions, { sessionId, projectPath: join(FIXTURES, 'sample-react-project') });
    const summary = parse(result);

    expect(summary.totalViolations).toBe(1);
    expect(summary.mapped).toBe(1);
    expect(summary.unmapped).toBe(0);

    const session = sessions.getSession(sessionId);
    expect(session?.issues).toHaveLength(1);
    expect(session?.issues?.[0].sourceLocation.filePath).toMatch(/ClickableCard\.jsx$/);
  });

  it('reports unmapped violations with a reason', async () => {
    const sessions = new SessionManager();
    const sessionId = sessions.createSession({ standard: 'wcag-2.1-aa' });
    const nonMatching: AxeViolation = { ...cardClickViolation, nodes: [{ target: ['#does-not-exist-anywhere'], html: '<div></div>' }] };
    sessions.updateSession(sessionId, { importedViolations: [nonMatching] });

    const result = await mapViolationsToSourceTool(sessions, { sessionId, projectPath: join(FIXTURES, 'sample-react-project') });
    const summary = parse(result);

    expect(summary.unmapped).toBe(1);
    expect(summary.unmappedReasons).toHaveLength(1);
  });
});
