import type { AppliedFix } from '../types.js';
import type { CodebaseAnalysisResult } from '../../static-analyzer/types.js';
import type { VerificationResult } from '../types.js';
import { detectRegressions } from './regression-detector.js';

function statusFor(fix: AppliedFix, before: CodebaseAnalysisResult, after: CodebaseAnalysisResult): 'resolved' | 'partially-resolved' | 'unresolved' | 'regression' {
  const countAt = (result: CodebaseAnalysisResult) =>
    result.issues.filter((issue) => issue.ruleId === fix.ruleId && issue.sourceLocation.filePath === fix.filePath).length;

  const beforeCount = countAt(before);
  const afterCount = countAt(after);
  if (afterCount === 0) return 'resolved';
  if (afterCount > beforeCount) return 'regression';
  if (afterCount < beforeCount) return 'partially-resolved';
  return 'unresolved';
}

function buildCommitMessage(fixes: AppliedFix[], resolvedCount: number): string {
  const byRule = new Map<string, number>();
  const files = new Set<string>();
  for (const fix of fixes) {
    byRule.set(fix.ruleId, (byRule.get(fix.ruleId) ?? 0) + 1);
    if (fix.filePath) files.add(fix.filePath);
  }

  const bullets = Array.from(byRule.entries()).map(([ruleId, count]) => `- ${ruleId} (${count} instance${count > 1 ? 's' : ''})`);
  const header = `fix(a11y): resolve ${resolvedCount} accessibility issue${resolvedCount === 1 ? '' : 's'}`;
  return [header, '', ...bullets, '', `Files changed: ${Array.from(files).join(', ') || '(none)'}`].join('\n');
}

/** Assembles the `verify_fixes` tool's response (architecture doc section 5.6). */
export function buildVerificationResult(params: {
  appliedFixes: AppliedFix[];
  before: CodebaseAnalysisResult;
  after: CodebaseAnalysisResult;
  standard: string;
  notes?: string[];
}): VerificationResult {
  const { appliedFixes, before, after, standard } = params;
  const { resolved, regressions } = detectRegressions(before.issues, after.issues);

  const fixes = appliedFixes
    .filter((fix) => fix.status === 'applied')
    .map((fix) => {
      const status = statusFor(fix, before, after);
      return {
        fixId: fix.fixId,
        issueId: fix.issueId,
        status,
        details: status === 'resolved' ? `${fix.ruleId} is no longer flagged in ${fix.filePath}.` : `${fix.ruleId} status in ${fix.filePath}: ${status}.`,
      };
    });

  const before_ = { score: before.complianceScore, violations: before.issues.length, standard };
  const after_ = { score: after.complianceScore, violations: after.issues.length, standard };

  return {
    fixes,
    complianceDelta: {
      before: before_,
      after: after_,
      improvement: `${after_.score >= before_.score ? '+' : ''}${after_.score - before_.score}% compliance (${before_.score}% → ${after_.score}%)`,
    },
    regressions,
    commitMessage: buildCommitMessage(
      appliedFixes.filter((fix) => fix.status === 'applied'),
      resolved.length,
    ),
    notes: params.notes,
  };
}
