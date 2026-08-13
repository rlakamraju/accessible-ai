import type { AccessibilityIssue } from '../../../config/types.js';
import type { RegressionEntry } from '../types.js';

function issueKey(issue: AccessibilityIssue): string {
  return `${issue.ruleId}|${issue.sourceLocation.filePath}|${issue.sourceLocation.startLine}`;
}

export interface RegressionAnalysis {
  resolved: AccessibilityIssue[];
  unchanged: AccessibilityIssue[];
  newIssues: AccessibilityIssue[];
  regressions: RegressionEntry[];
}

/** Compares a before/after issue snapshot (architecture doc section 5.6). Issues in `before` but not `after` are resolved; issues in `after` but not `before` are regressions. */
export function detectRegressions(before: AccessibilityIssue[], after: AccessibilityIssue[], introducedByFixId = 'unknown'): RegressionAnalysis {
  const beforeKeys = new Set(before.map(issueKey));
  const afterKeys = new Set(after.map(issueKey));

  const resolved = before.filter((issue) => !afterKeys.has(issueKey(issue)));
  const unchanged = after.filter((issue) => beforeKeys.has(issueKey(issue)));
  const newIssues = after.filter((issue) => !beforeKeys.has(issueKey(issue)));

  const regressions: RegressionEntry[] = newIssues.map((issue) => ({
    filePath: issue.sourceLocation.filePath,
    newIssue: `${issue.ruleId}: ${issue.description}`,
    introducedByFixId,
    suggestion: `Review the recent change to ${issue.sourceLocation.filePath || 'this file'} — it introduced a new "${issue.ruleId}" issue.`,
  }));

  return { resolved, unchanged, newIssues, regressions };
}
