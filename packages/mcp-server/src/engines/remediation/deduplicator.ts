import type { AccessibilityIssue } from '../../config/types.js';

function dedupeKey(issue: AccessibilityIssue): string {
  return [
    issue.ruleId,
    issue.sourceLocation.filePath,
    issue.sourceLocation.startLine,
    issue.runtimeContext?.cssSelector ?? '',
  ].join('|');
}

/**
 * Merges static + runtime issue lists, drops exact duplicates (same rule at the same file/line, or the
 * same rule on the same live-page CSS selector), and re-assigns globally-unique sequential ids across
 * the merged result. Does not collapse *different* instances of the same rule into one row — that's
 * `remediation.groupId` (set to `ruleId` by both normalizers) and `getGroupSize`'s job, used by the fix
 * planner for prioritization, not by this function.
 */
export function deduplicateIssues(issues: AccessibilityIssue[]): AccessibilityIssue[] {
  const seen = new Set<string>();
  const deduped: AccessibilityIssue[] = [];

  for (const issue of issues) {
    const key = dedupeKey(issue);
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(issue);
  }

  return deduped.map((issue, index) => ({ ...issue, id: `issue-${String(index + 1).padStart(3, '0')}` }));
}

/** Counts issues sharing a `remediation.groupId` — feeds the fix planner's "blast radius" priority term. */
export function getGroupSize(groupId: string, issues: AccessibilityIssue[]): number {
  return issues.filter((issue) => issue.remediation.groupId === groupId).length;
}
