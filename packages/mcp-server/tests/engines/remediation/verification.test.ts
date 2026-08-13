import { describe, expect, it } from 'vitest';
import type { AccessibilityIssue } from '../../../src/config/types';
import { detectRegressions } from '../../../src/engines/remediation/verification/regression-detector';
import { buildVerificationResult } from '../../../src/engines/remediation/verification/report';
import type { AppliedFix } from '../../../src/engines/remediation/types';
import type { CodebaseAnalysisResult } from '../../../src/engines/static-analyzer/types';

function makeIssue(overrides: Partial<AccessibilityIssue> & { filePath: string; startLine: number; ruleId: string }): AccessibilityIssue {
  return {
    id: overrides.id ?? `${overrides.ruleId}-${overrides.filePath}-${overrides.startLine}`,
    source: 'static',
    wcagCriteria: [],
    standard: 'wcag-2.1-aa',
    impact: 'serious',
    ruleId: overrides.ruleId,
    description: 'desc',
    helpUrl: '',
    sourceLocation: { filePath: overrides.filePath, startLine: overrides.startLine, endLine: overrides.startLine, framework: 'html' },
    codeSnippet: { before: '', violating: '', after: '' },
    remediation: { automationLevel: 'auto', estimatedEffort: 'trivial' },
  };
}

describe('detectRegressions', () => {
  it('marks an issue present before but not after as resolved', () => {
    const before = [makeIssue({ filePath: 'a.html', startLine: 1, ruleId: 'html-has-lang' })];
    const { resolved, regressions } = detectRegressions(before, []);
    expect(resolved).toHaveLength(1);
    expect(regressions).toHaveLength(0);
  });

  it('flags an issue present after but not before as a regression', () => {
    const after = [makeIssue({ filePath: 'a.html', startLine: 5, ruleId: 'duplicate-id' })];
    const { regressions } = detectRegressions([], after, 'fix-123');
    expect(regressions).toHaveLength(1);
    expect(regressions[0].introducedByFixId).toBe('fix-123');
  });

  it('treats an issue present in both as unchanged', () => {
    const issue = makeIssue({ filePath: 'a.html', startLine: 1, ruleId: 'html-has-lang' });
    const { unchanged, resolved, regressions } = detectRegressions([issue], [issue]);
    expect(unchanged).toHaveLength(1);
    expect(resolved).toHaveLength(0);
    expect(regressions).toHaveLength(0);
  });
});

function emptyCodebaseResult(issues: AccessibilityIssue[], score: number): CodebaseAnalysisResult {
  return {
    framework: { framework: 'html', hasTests: false, hasA11yTooling: false },
    filesAnalyzed: 1,
    issues,
    bySeverity: { critical: 0, serious: issues.length, moderate: 0, minor: 0 },
    byPrinciple: {},
    complianceScore: score,
  };
}

describe('buildVerificationResult', () => {
  it('reports a resolved fix as such, and computes the compliance delta', () => {
    const fixedIssue = makeIssue({ filePath: 'a.html', startLine: 1, ruleId: 'html-has-lang' });
    const before = emptyCodebaseResult([fixedIssue], 60);
    const after = emptyCodebaseResult([], 80);
    const appliedFix: AppliedFix = {
      fixId: 'fix-1',
      issueId: fixedIssue.id,
      ruleId: 'html-has-lang',
      filePath: 'a.html',
      before: '<html>',
      after: '<html lang="en">',
      diff: '--- diff ---',
      description: 'Added lang',
      status: 'applied',
      appliedAt: new Date().toISOString(),
    };

    const result = buildVerificationResult({ appliedFixes: [appliedFix], before, after, standard: 'wcag-2.1-aa' });

    expect(result.fixes[0].status).toBe('resolved');
    expect(result.complianceDelta.before.score).toBe(60);
    expect(result.complianceDelta.after.score).toBe(80);
    expect(result.complianceDelta.improvement).toContain('60%');
    expect(result.complianceDelta.improvement).toContain('80%');
    expect(result.regressions).toHaveLength(0);
    expect(result.commitMessage).toContain('html-has-lang');
  });

  it('flags a regression when a new issue appears at the fixed file after applying', () => {
    const fixedIssue = makeIssue({ filePath: 'a.html', startLine: 1, ruleId: 'html-has-lang' });
    const newIssue = makeIssue({ filePath: 'a.html', startLine: 1, ruleId: 'duplicate-id' });
    const before = emptyCodebaseResult([fixedIssue], 60);
    const after = emptyCodebaseResult([newIssue], 55);
    const appliedFix: AppliedFix = {
      fixId: 'fix-1',
      issueId: fixedIssue.id,
      ruleId: 'html-has-lang',
      filePath: 'a.html',
      before: '<html>',
      after: '<html lang="en">',
      diff: '--- diff ---',
      description: 'Added lang',
      status: 'applied',
      appliedAt: new Date().toISOString(),
    };

    const result = buildVerificationResult({ appliedFixes: [appliedFix], before, after, standard: 'wcag-2.1-aa' });
    expect(result.regressions).toHaveLength(1);
    expect(result.regressions[0].newIssue).toContain('duplicate-id');
  });

  it('carries through deviation notes (e.g. runtime verification unavailable)', () => {
    const before = emptyCodebaseResult([], 100);
    const after = emptyCodebaseResult([], 100);
    const result = buildVerificationResult({ appliedFixes: [], before, after, standard: 'wcag-2.1-aa', notes: ['runtime unavailable'] });
    expect(result.notes).toEqual(['runtime unavailable']);
  });
});
