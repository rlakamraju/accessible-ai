import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SessionManager } from '../../src/session/session-manager';
import { applyFixTool } from '../../src/tools/apply-fix';
import type { AccessibilityIssue } from '../../src/config/types';
import type { FixPlan } from '../../src/engines/remediation/types';

function planFor(issue: AccessibilityIssue): FixPlan {
  return {
    id: 'plan-test',
    standard: 'wcag-2.1-aa',
    generatedAt: new Date().toISOString(),
    summary: {
      totalIssues: 1,
      autoFixable: 1,
      llmAssisted: 0,
      manualReview: 0,
      estimatedTotalEffort: '0.1-0.2 developer days',
      complianceScoreBefore: 50,
      projectedScoreAfter: 100,
    },
    phases: [
      {
        phase: 1,
        name: 'Quick Wins — Automated Fixes',
        description: 'test phase',
        estimatedEffort: '0.1-0.2 developer days',
        issues: [
          {
            issueId: issue.id,
            priority: 100,
            issue,
            fix: { type: 'auto-template', resolvesCriteria: issue.wcagCriteria, resolvesIssueIds: [issue.id] },
            verification: { rerunRules: [issue.ruleId] },
          },
        ],
      },
    ],
  };
}

function htmlLangIssue(filePath: string): AccessibilityIssue {
  return {
    id: 'issue-001',
    source: 'static',
    wcagCriteria: ['3.1.1'],
    standard: 'wcag-2.1-aa',
    impact: 'serious',
    ruleId: 'html-has-lang',
    description: 'html element must have a lang attribute',
    helpUrl: '',
    sourceLocation: { filePath, startLine: 1, endLine: 1, framework: 'html' },
    codeSnippet: { before: '', violating: '<html>', after: '' },
    remediation: { automationLevel: 'auto', estimatedEffort: 'trivial', fixTemplateId: 'html-lang', groupId: 'html-has-lang' },
  };
}

describe('applyFixTool', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'accessible-ai-apply-fix-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('returns an error when there is no fix plan yet', async () => {
    const sessions = new SessionManager();
    const sessionId = sessions.createSession({ standard: 'wcag-2.1-aa' });
    const result = await applyFixTool(sessions, { sessionId, projectPath: dir, mode: 'all-auto', dryRun: true });
    expect(result.isError).toBe(true);
  });

  it('dry run reports the diff without writing the file', async () => {
    const filePath = join(dir, 'index.html');
    await writeFile(filePath, '<html>\n<head></head>\n</html>', 'utf8');

    const sessions = new SessionManager();
    const sessionId = sessions.createSession({ standard: 'wcag-2.1-aa' });
    sessions.updateSession(sessionId, { fixPlan: planFor(htmlLangIssue(filePath)) });

    const result = await applyFixTool(sessions, { sessionId, projectPath: dir, mode: 'all-auto', dryRun: true });
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.summary.successfullyApplied).toBe(1);
    expect(parsed.dryRunNote).toBeTruthy();
    expect(await readFile(filePath, 'utf8')).not.toContain('lang="en"');
    expect(sessions.getSession(sessionId)?.appliedFixes).toBeUndefined();
  });

  it('writes the file and records appliedFixes when dryRun is false', async () => {
    const filePath = join(dir, 'index.html');
    await writeFile(filePath, '<html>\n<head></head>\n</html>', 'utf8');

    const sessions = new SessionManager();
    const sessionId = sessions.createSession({ standard: 'wcag-2.1-aa' });
    sessions.updateSession(sessionId, { fixPlan: planFor(htmlLangIssue(filePath)) });

    const result = await applyFixTool(sessions, { sessionId, projectPath: dir, mode: 'all-auto', dryRun: false });
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.summary.successfullyApplied).toBe(1);
    expect(await readFile(filePath, 'utf8')).toContain('lang="en"');

    const applied = sessions.getSession(sessionId)?.appliedFixes;
    expect(applied).toHaveLength(1);
    expect(applied?.[0].ruleId).toBe('html-has-lang');
    expect(applied?.[0].before).toBe('<html>\n<head></head>\n</html>');
  });

  it('mode "single" applies only the matching fixId', async () => {
    const filePath = join(dir, 'index.html');
    await writeFile(filePath, '<html>\n<head></head>\n</html>', 'utf8');

    const sessions = new SessionManager();
    const sessionId = sessions.createSession({ standard: 'wcag-2.1-aa' });
    sessions.updateSession(sessionId, { fixPlan: planFor(htmlLangIssue(filePath)) });

    const result = await applyFixTool(sessions, { sessionId, projectPath: dir, mode: 'single', fixId: 'issue-001', dryRun: false });
    expect(result.isError).toBeUndefined();
    expect(await readFile(filePath, 'utf8')).toContain('lang="en"');
  });

  it('errors when mode "single" is given an unknown fixId', async () => {
    const filePath = join(dir, 'index.html');
    await writeFile(filePath, '<html></html>', 'utf8');
    const sessions = new SessionManager();
    const sessionId = sessions.createSession({ standard: 'wcag-2.1-aa' });
    sessions.updateSession(sessionId, { fixPlan: planFor(htmlLangIssue(filePath)) });

    const result = await applyFixTool(sessions, { sessionId, projectPath: dir, mode: 'single', fixId: 'does-not-exist', dryRun: true });
    expect(result.isError).toBe(true);
  });
});
