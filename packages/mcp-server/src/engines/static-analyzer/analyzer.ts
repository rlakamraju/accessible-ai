import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { resolveStandard, type FrameworkType, type Impact, type ResolvedStandard } from '@accessible-ai/standards';
import type { AccessibilityIssue } from '../../config/types.js';
import { detectFramework } from './framework-detector.js';
import { runEslintAnalysis } from './eslint-runner.js';
import { checkKeyboardHandlers } from './custom-rules/keyboard-handler-checker.js';
import { checkAriaPatterns } from './custom-rules/aria-pattern-validator.js';
import { checkHeadingHierarchy } from './custom-rules/heading-hierarchy-checker.js';
import { checkFormLabels } from './custom-rules/form-label-checker.js';
import { checkRouteAccessibility } from './custom-rules/route-accessibility-checker.js';
import { normalizeIssues } from './issue-normalizer.js';
import type { AnalysisConfig, CodebaseAnalysisResult, CustomRuleIssue, EslintAnalysisIssue } from './types.js';

const IGNORE_DIRS = new Set(['node_modules', 'dist', 'build', '.git', 'coverage', '.turbo']);

/** File extensions the custom rules scan per framework — kept in sync with eslint-runner's own file patterns. */
const FRAMEWORK_EXTENSIONS: Partial<Record<FrameworkType, string[]>> = {
  react: ['.jsx', '.tsx'],
  angular: ['.component.html'],
  vue: ['.vue'],
};
const DEFAULT_EXTENSIONS = ['.html'];

function matchesExtension(fileName: string, extensions: string[]): boolean {
  return extensions.some((ext) => fileName.endsWith(ext));
}

function isExcluded(filePath: string, exclude: string[] | undefined): boolean {
  return Boolean(exclude?.some((pattern) => filePath.includes(pattern)));
}

/** Drops custom-rule findings that land on the same file+line as an ESLint finding — ESLint's AST-aware check wins. */
function dedupeAgainstEslint(customIssues: CustomRuleIssue[], eslintIssues: EslintAnalysisIssue[]): CustomRuleIssue[] {
  const eslintLocations = new Set(eslintIssues.map((i) => `${i.filePath}:${i.line}`));
  return customIssues.filter((issue) => !eslintLocations.has(`${issue.filePath}:${issue.startLine}`));
}

async function collectAnalyzableFiles(projectPath: string, framework: FrameworkType, exclude: string[] | undefined): Promise<string[]> {
  const extensions = FRAMEWORK_EXTENSIONS[framework] ?? DEFAULT_EXTENSIONS;
  const results: string[] = [];
  const queue: string[] = [projectPath];

  while (queue.length) {
    const dir = queue.shift()!;
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!IGNORE_DIRS.has(entry.name)) queue.push(fullPath);
      } else if (matchesExtension(entry.name, extensions) && !isExcluded(fullPath, exclude)) {
        results.push(fullPath);
      }
    }
  }
  return results;
}

function calculateStaticComplianceScore(issues: AccessibilityIssue[], resolved: ResolvedStandard): number {
  const testable = resolved.criteria.filter((c) => c.eslintRules.length > 0);
  if (testable.length === 0) return 100;

  const failedCriteria = new Set(issues.flatMap((i) => i.wcagCriteria));
  const weight = { A: 3, AA: 2, AAA: 1 } as const;

  let totalWeight = 0;
  let passedWeight = 0;
  for (const criterion of testable) {
    const w = weight[criterion.level];
    totalWeight += w;
    if (!failedCriteria.has(criterion.id)) passedWeight += w;
  }

  return totalWeight === 0 ? 100 : Math.round((passedWeight / totalWeight) * 100);
}

/**
 * Orchestrates static accessibility analysis of a frontend project: detects the framework, runs the
 * framework-appropriate ESLint a11y plugin, runs the custom structural checks, and normalizes both into
 * the unified `AccessibilityIssue[]` format.
 */
export async function analyzeCodebase(projectPath: string, config: AnalysisConfig): Promise<CodebaseAnalysisResult> {
  const framework = await detectFramework(projectPath);
  const resolved = resolveStandard(config.standard);

  const eslintResult = await runEslintAnalysis(projectPath, framework.framework, resolved.eslintRules, {
    include: config.include,
    exclude: config.exclude,
  });

  const files = await collectAnalyzableFiles(projectPath, framework.framework, config.exclude);

  const customIssues: CustomRuleIssue[] = [];
  for (const filePath of files) {
    customIssues.push(...(await checkKeyboardHandlers(filePath)));
    customIssues.push(...(await checkAriaPatterns(filePath)));
    customIssues.push(...(await checkHeadingHierarchy(filePath)));
    customIssues.push(...(await checkFormLabels(filePath)));
  }
  customIssues.push(...(await checkRouteAccessibility(files, framework.framework)));

  const dedupedCustomIssues = dedupeAgainstEslint(customIssues, eslintResult.issues);

  const issues = await normalizeIssues({
    eslintResult,
    customIssues: dedupedCustomIssues,
    framework: framework.framework,
    standard: config.standard,
    resolved,
  });

  const bySeverity: Record<Impact, number> = { critical: 0, serious: 0, moderate: 0, minor: 0 };
  const byPrinciple: Record<string, number> = {};
  for (const issue of issues) {
    bySeverity[issue.impact]++;
    const criterion = resolved.criteria.find((c) => issue.wcagCriteria.includes(c.id));
    if (criterion) byPrinciple[criterion.principle] = (byPrinciple[criterion.principle] ?? 0) + 1;
  }

  return {
    framework,
    filesAnalyzed: files.length,
    issues,
    bySeverity,
    byPrinciple,
    complianceScore: calculateStaticComplianceScore(issues, resolved),
  };
}
