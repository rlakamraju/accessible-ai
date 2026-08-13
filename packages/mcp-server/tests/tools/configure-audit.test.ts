import { describe, expect, it } from 'vitest';
import { SessionManager } from '../../src/session/session-manager';
import { configureAudit } from '../../src/tools/configure-audit';

function parseResult(result: { content: Array<{ text: string }> }) {
  return JSON.parse(result.content[0].text);
}

describe('configureAudit', () => {
  it('resolves a valid standard and returns a session ID with resolved counts', async () => {
    const sessions = new SessionManager();
    const result = await configureAudit(sessions, { standard: 'ada' });
    const summary = parseResult(result);

    expect(summary.sessionId).toBeTruthy();
    expect(summary.criteriaCount).toBeGreaterThan(0);
    expect(summary.axeRuleCount).toBeGreaterThan(0);
    expect(sessions.getSession(summary.sessionId)).toBeDefined();
  });

  it('merges custom rules into the resolved rule set', async () => {
    const sessions = new SessionManager();
    const baseline = parseResult(await configureAudit(sessions, { standard: 'wcag-2.1-aa' }));
    const withCustom = parseResult(
      await configureAudit(sessions, { standard: 'wcag-2.1-aa', customRules: ['my-custom-rule'] }),
    );

    expect(withCustom.axeRuleCount).toBe(baseline.axeRuleCount + 1);
  });

  it('removes excluded rules from the resolved rule set', async () => {
    const sessions = new SessionManager();
    const resolved = await import('@accessible-ai/standards').then((m) => m.resolveStandard('wcag-2.1-aa'));
    const excludedRule = resolved.axeCoreRuleIds[0];

    const summary = parseResult(
      await configureAudit(sessions, { standard: 'wcag-2.1-aa', excludeRules: [excludedRule] }),
    );

    expect(summary.axeRuleCount).toBe(resolved.axeCoreRuleIds.length - 1);
  });

  it('returns an error for an unknown standard', async () => {
    const sessions = new SessionManager();
    const result = await configureAudit(sessions, { standard: 'not-a-real-standard' as never });
    expect(result.isError).toBe(true);
  });
});
