import { analyzeCodebase } from '../../static-analyzer/analyzer.js';
import type { AnalysisConfig, CodebaseAnalysisResult } from '../../static-analyzer/types.js';

/**
 * Re-runs the full static analysis (architecture doc section 5.6). Diffs the whole project's before/after
 * issue lists rather than restricting to the files a fix touched — a regression introduced by editing
 * one file can show up anywhere ESLint/custom rules re-evaluate (e.g. a shared template), so a full
 * re-scan catches more than a file-scoped one while still being cheap enough for typical project sizes.
 */
export async function verifyStaticFixes(projectPath: string, config: AnalysisConfig): Promise<CodebaseAnalysisResult> {
  return analyzeCodebase(projectPath, config);
}
