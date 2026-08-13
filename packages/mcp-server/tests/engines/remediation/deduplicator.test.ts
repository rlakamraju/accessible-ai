import { describe, expect, it } from 'vitest';
import type { AccessibilityIssue } from '../../../src/config/types';
import { deduplicateIssues, getGroupSize } from '../../../src/engines/remediation/deduplicator';

function makeIssue(overrides: Partial<AccessibilityIssue> = {}): AccessibilityIssue {
  return {
    id: overrides.id ?? 'issue-x',
    source: overrides.source ?? 'static',
    wcagCriteria: overrides.wcagCriteria ?? ['1.1.1'],
    standard: 'wcag-2.1-aa',
    impact: overrides.impact ?? 'serious',
    ruleId: overrides.ruleId ?? 'image-alt',
    description: 'desc',
    helpUrl: '',
    sourceLocation: overrides.sourceLocation ?? { filePath: 'a.tsx', startLine: 1, endLine: 1, framework: 'react' },
    codeSnippet: { before: '', violating: '', after: '' },
    runtimeContext: overrides.runtimeContext,
    remediation: overrides.remediation ?? { automationLevel: 'llm-assisted', estimatedEffort: 'trivial', groupId: overrides.ruleId ?? 'image-alt' },
  };
}

describe('deduplicateIssues', () => {
  it('drops exact duplicates at the same file/line', () => {
    const issues = [makeIssue({ id: 'a' }), makeIssue({ id: 'b' })];
    expect(deduplicateIssues(issues)).toHaveLength(1);
  });

  it('keeps distinct instances of the same rule at different locations', () => {
    const issues = [makeIssue({ id: 'a' }), makeIssue({ id: 'b', sourceLocation: { filePath: 'b.tsx', startLine: 1, endLine: 1, framework: 'react' } })];
    expect(deduplicateIssues(issues)).toHaveLength(2);
  });

  it('dedupes runtime issues by cssSelector when filePath is still unmapped', () => {
    const runtimeA = makeIssue({
      id: 'a',
      source: 'runtime',
      sourceLocation: { filePath: '', startLine: 0, endLine: 0, framework: 'auto' },
      runtimeContext: { pageUrl: 'https://x.com', cssSelector: '#logo', renderedHtml: '<img id="logo">' },
    });
    const runtimeB = makeIssue({
      id: 'b',
      source: 'runtime',
      sourceLocation: { filePath: '', startLine: 0, endLine: 0, framework: 'auto' },
      runtimeContext: { pageUrl: 'https://x.com', cssSelector: '#logo', renderedHtml: '<img id="logo">' },
    });
    expect(deduplicateIssues([runtimeA, runtimeB])).toHaveLength(1);
  });

  it('re-assigns globally-unique sequential ids across the merged list', () => {
    const deduped = deduplicateIssues([
      makeIssue({ id: 'dup-1' }),
      makeIssue({ id: 'dup-1', sourceLocation: { filePath: 'b.tsx', startLine: 1, endLine: 1, framework: 'react' } }),
    ]);
    expect(deduped.map((i) => i.id)).toEqual(['issue-001', 'issue-002']);
  });
});

describe('getGroupSize', () => {
  it('counts issues sharing a groupId', () => {
    const issues = [
      makeIssue({ id: 'a', remediation: { automationLevel: 'auto', estimatedEffort: 'trivial', groupId: 'html-has-lang' } }),
      makeIssue({ id: 'b', remediation: { automationLevel: 'auto', estimatedEffort: 'trivial', groupId: 'html-has-lang' } }),
      makeIssue({ id: 'c', remediation: { automationLevel: 'auto', estimatedEffort: 'trivial', groupId: 'other-rule' } }),
    ];
    expect(getGroupSize('html-has-lang', issues)).toBe(2);
    expect(getGroupSize('other-rule', issues)).toBe(1);
  });
});
