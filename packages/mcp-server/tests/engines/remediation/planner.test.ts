import { describe, expect, it } from 'vitest';
import { resolveStandard } from '@accessible-ai/standards';
import type { AccessibilityIssue } from '../../../src/config/types';
import { generateFixPlan } from '../../../src/engines/remediation/planner';

function makeIssue(overrides: Partial<AccessibilityIssue>): AccessibilityIssue {
  return {
    id: overrides.id ?? 'issue-x',
    source: 'static',
    wcagCriteria: overrides.wcagCriteria ?? ['1.1.1'],
    standard: 'wcag-2.1-aa',
    impact: overrides.impact ?? 'serious',
    ruleId: overrides.ruleId ?? 'rule',
    description: 'desc',
    helpUrl: '',
    sourceLocation: { filePath: 'a.tsx', startLine: 1, endLine: 1, framework: 'react' },
    codeSnippet: { before: '', violating: '', after: '' },
    remediation: overrides.remediation ?? { automationLevel: 'llm-assisted', estimatedEffort: 'medium', groupId: overrides.ruleId ?? 'rule' },
  };
}

describe('generateFixPlan', () => {
  const resolved = resolveStandard('wcag-2.1-aa');

  it('splits issues into the 3 fixed phases by automationLevel', () => {
    const issues = [
      makeIssue({ id: 'a', ruleId: 'html-has-lang', remediation: { automationLevel: 'auto', estimatedEffort: 'trivial', groupId: 'html-has-lang' } }),
      makeIssue({ id: 'b', ruleId: 'image-alt', remediation: { automationLevel: 'llm-assisted', estimatedEffort: 'trivial', groupId: 'image-alt' } }),
      makeIssue({ id: 'c', ruleId: 'color-contrast', remediation: { automationLevel: 'manual-review', estimatedEffort: 'large', groupId: 'color-contrast' } }),
    ];

    const plan = generateFixPlan(issues, resolved, 50, { prioritizeBy: 'impact' });

    expect(plan.phases.map((p) => p.phase)).toEqual([1, 2, 3]);
    expect(plan.phases[0].issues[0].fix.type).toBe('auto-template');
    expect(plan.phases[1].issues[0].fix.type).toBe('llm-generated');
    expect(plan.phases[2].issues[0].fix.type).toBe('manual-guidance');
  });

  it('collapses issues sharing a groupId into one FixItem, listing the rest in resolvesIssueIds', () => {
    const issues = [
      makeIssue({ id: 'a', ruleId: 'image-alt', impact: 'critical' }),
      makeIssue({ id: 'b', ruleId: 'image-alt', impact: 'critical' }),
      makeIssue({ id: 'c', ruleId: 'image-alt', impact: 'critical' }),
    ];

    const plan = generateFixPlan(issues, resolved, 50, { prioritizeBy: 'impact' });
    const phase = plan.phases.find((p) => p.name.includes('AI-Assisted'));

    expect(phase?.issues).toHaveLength(1);
    expect(phase?.issues[0].fix.resolvesIssueIds.sort()).toEqual(['a', 'b', 'c']);
  });

  it('orders critical+easy issues ahead of moderate+hard ones under prioritizeBy: "impact"', () => {
    const critical = makeIssue({
      id: 'critical-easy',
      ruleId: 'rule-a',
      impact: 'critical',
      remediation: { automationLevel: 'llm-assisted', estimatedEffort: 'trivial', groupId: 'rule-a' },
    });
    const moderate = makeIssue({
      id: 'moderate-hard',
      ruleId: 'rule-b',
      impact: 'moderate',
      remediation: { automationLevel: 'llm-assisted', estimatedEffort: 'large', groupId: 'rule-b' },
    });

    const plan = generateFixPlan([moderate, critical], resolved, 50, { prioritizeBy: 'impact' });
    const phase = plan.phases.find((p) => p.name.includes('AI-Assisted'))!;

    expect(phase.issues[0].issueId).toBe('critical-easy');
  });

  it('reports summary counts and a compliance score that only rises toward 100%', () => {
    const issues = [
      makeIssue({ id: 'a', ruleId: 'html-has-lang', remediation: { automationLevel: 'auto', estimatedEffort: 'trivial', groupId: 'html-has-lang' } }),
      makeIssue({ id: 'b', ruleId: 'image-alt' }),
    ];

    const plan = generateFixPlan(issues, resolved, 40, { prioritizeBy: 'impact' });

    expect(plan.summary.totalIssues).toBe(2);
    expect(plan.summary.autoFixable).toBe(1);
    expect(plan.summary.llmAssisted).toBe(1);
    expect(plan.summary.complianceScoreBefore).toBe(40);
    expect(plan.summary.projectedScoreAfter).toBeGreaterThanOrEqual(40);
    expect(plan.summary.projectedScoreAfter).toBeLessThanOrEqual(100);
  });

  it('truncates issues per phase to maxItems without dropping phase headers', () => {
    const issues = [
      makeIssue({ id: 'a', ruleId: 'rule-a', remediation: { automationLevel: 'llm-assisted', estimatedEffort: 'medium', groupId: 'rule-a' } }),
      makeIssue({ id: 'b', ruleId: 'rule-b', remediation: { automationLevel: 'llm-assisted', estimatedEffort: 'medium', groupId: 'rule-b' } }),
    ];

    const plan = generateFixPlan(issues, resolved, 50, { prioritizeBy: 'impact', maxItems: 1 });
    const totalReturned = plan.phases.reduce((sum, phase) => sum + phase.issues.length, 0);
    expect(totalReturned).toBe(1);
  });
});
