import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import type { FrameworkType, Impact, ResolvedStandard, StandardId } from '@accessible-ai/standards';
import type { AccessibilityIssue, AutomationLevel, CodeSnippet, EstimatedEffort } from '../../config/types.js';
import type { CustomRuleIssue, EslintAnalysisResult } from './types.js';

/** Keyed by the bare rule name (no plugin prefix) — the same check carries the same impact across frameworks. */
const IMPACT_BY_RULE_NAME: Record<string, Impact> = {
  'alt-text': 'critical',
  'img-redundant-alt': 'minor',
  'accessible-emoji': 'minor',
  'media-has-caption': 'serious',
  'label-has-associated-control': 'critical',
  'label-has-for': 'serious',
  'control-has-associated-label': 'serious',
  'form-control-has-label': 'critical',
  'no-redundant-roles': 'minor',
  'prefer-tag-over-role': 'minor',
  scope: 'moderate',
  'table-scope': 'moderate',
  'autocomplete-valid': 'minor',
  'click-events-have-key-events': 'serious',
  'mouse-events-have-key-events': 'serious',
  'interactive-supports-focus': 'serious',
  'no-static-element-interactions': 'moderate',
  'no-noninteractive-element-interactions': 'moderate',
  'no-noninteractive-tabindex': 'minor',
  'no-access-key': 'minor',
  'no-distracting-elements': 'moderate',
  'anchor-has-content': 'serious',
  'anchor-ambiguous-text': 'moderate',
  'anchor-is-valid': 'moderate',
  'heading-has-content': 'moderate',
  'html-has-lang': 'serious',
  lang: 'moderate',
  'no-autofocus': 'moderate',
  'no-onchange': 'minor',
  'no-duplicate-attributes': 'minor',
  'aria-props': 'serious',
  'aria-proptypes': 'serious',
  'aria-role': 'serious',
  'aria-unsupported-elements': 'moderate',
  'role-has-required-aria-props': 'serious',
  'role-supports-aria-props': 'moderate',
  'aria-activedescendant-has-tabindex': 'moderate',
  'no-aria-hidden-on-focusable': 'serious',
  'tabindex-no-positive': 'minor',
  'iframe-has-title': 'moderate',
  'no-interactive-element-to-noninteractive-role': 'moderate',
  'no-noninteractive-element-to-interactive-role': 'moderate',
  'role-has-required-aria': 'serious',
  'valid-aria': 'serious',
  'no-positive-tabindex': 'minor',
  'button-has-type': 'minor',
  'elements-content': 'moderate',
  'no-role-presentation-on-focusable': 'moderate',
};

const DEFAULT_REMEDIATION: { automationLevel: AutomationLevel; estimatedEffort: EstimatedEffort } = {
  automationLevel: 'llm-assisted',
  estimatedEffort: 'medium',
};

const REMEDIATION_BY_RULE_NAME: Record<string, { automationLevel: AutomationLevel; estimatedEffort: EstimatedEffort }> = {
  'alt-text': { automationLevel: 'llm-assisted', estimatedEffort: 'trivial' },
  'label-has-associated-control': { automationLevel: 'llm-assisted', estimatedEffort: 'small' },
  'form-control-has-label': { automationLevel: 'llm-assisted', estimatedEffort: 'small' },
  'form-control-missing-label': { automationLevel: 'llm-assisted', estimatedEffort: 'small' },
  'keyboard-handler-required': { automationLevel: 'llm-assisted', estimatedEffort: 'medium' },
  'aria-pattern-required-attrs': { automationLevel: 'llm-assisted', estimatedEffort: 'small' },
  'dialog-missing-aria-modal': { automationLevel: 'auto', estimatedEffort: 'trivial' },
  'heading-level-skipped': { automationLevel: 'manual-review', estimatedEffort: 'medium' },
  'multiple-h1': { automationLevel: 'manual-review', estimatedEffort: 'medium' },
  'route-title-management-missing': { automationLevel: 'manual-review', estimatedEffort: 'medium' },
};

function ruleName(ruleId: string): string {
  return ruleId.split('/').pop() ?? ruleId;
}

function helpUrlFor(ruleId: string): string {
  const name = ruleName(ruleId);
  if (ruleId.startsWith('jsx-a11y/')) return `https://github.com/jsx-eslint/eslint-plugin-jsx-a11y/blob/main/docs/rules/${name}.md`;
  if (ruleId.startsWith('@angular-eslint/template/')) {
    return `https://github.com/angular-eslint/angular-eslint/blob/main/packages/eslint-plugin-template/docs/rules/${name}.md`;
  }
  if (ruleId.startsWith('vuejs-accessibility/')) return `https://vue-a11y.github.io/eslint-plugin-vuejs-accessibility/rules/${name}.html`;
  return '';
}

function componentNameFor(filePath: string): string {
  let base = basename(filePath);
  base = base.replace(/\.component\.(html|ts)$/, '');
  base = base.replace(/\.(jsx|tsx|vue|html|ts)$/, '');
  return base
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

function snippetFor(lines: string[], startLine: number, endLine: number): CodeSnippet {
  return {
    before: lines.slice(Math.max(0, startLine - 3), startLine - 1).join('\n'),
    violating: lines.slice(startLine - 1, endLine).join('\n'),
    after: lines.slice(endLine, endLine + 2).join('\n'),
  };
}

interface NormalizeParams {
  eslintResult: EslintAnalysisResult;
  customIssues: CustomRuleIssue[];
  framework: FrameworkType;
  standard: StandardId;
  resolved: ResolvedStandard;
}

/** Merges ESLint + custom-rule findings into the unified `AccessibilityIssue[]` shape (architecture doc section 5.2). */
export async function normalizeIssues({ eslintResult, customIssues, framework, standard, resolved }: NormalizeParams): Promise<AccessibilityIssue[]> {
  const criteriaByEslintRule = new Map<string, string[]>();
  for (const criterion of resolved.criteria) {
    for (const ruleId of criterion.eslintRules) {
      const list = criteriaByEslintRule.get(ruleId) ?? [];
      list.push(criterion.id);
      criteriaByEslintRule.set(ruleId, list);
    }
  }

  const fileLinesCache = new Map<string, string[]>();
  async function getLines(filePath: string): Promise<string[]> {
    let lines = fileLinesCache.get(filePath);
    if (!lines) {
      try {
        lines = (await readFile(filePath, 'utf8')).split('\n');
      } catch {
        lines = [];
      }
      fileLinesCache.set(filePath, lines);
    }
    return lines;
  }

  const issues: AccessibilityIssue[] = [];
  let counter = 1;
  const nextId = () => `issue-${String(counter++).padStart(3, '0')}`;

  for (const eslintIssue of eslintResult.issues) {
    if (!eslintIssue.ruleId) continue;
    const lines = await getLines(eslintIssue.filePath);
    issues.push({
      id: nextId(),
      source: 'static',
      wcagCriteria: criteriaByEslintRule.get(eslintIssue.ruleId) ?? [],
      standard,
      impact: IMPACT_BY_RULE_NAME[ruleName(eslintIssue.ruleId)] ?? 'moderate',
      ruleId: eslintIssue.ruleId,
      description: eslintIssue.message,
      helpUrl: helpUrlFor(eslintIssue.ruleId),
      sourceLocation: {
        filePath: eslintIssue.filePath,
        startLine: eslintIssue.line,
        endLine: eslintIssue.line,
        column: eslintIssue.column,
        framework,
        componentName: componentNameFor(eslintIssue.filePath),
      },
      codeSnippet: snippetFor(lines, eslintIssue.line, eslintIssue.line),
      remediation: {
        ...(REMEDIATION_BY_RULE_NAME[ruleName(eslintIssue.ruleId)] ?? DEFAULT_REMEDIATION),
        groupId: eslintIssue.ruleId,
      },
    });
  }

  for (const customIssue of customIssues) {
    const lines = await getLines(customIssue.filePath);
    issues.push({
      id: nextId(),
      source: 'static',
      wcagCriteria: customIssue.wcagCriteria,
      standard,
      impact: customIssue.impact,
      ruleId: customIssue.ruleId,
      description: customIssue.message,
      helpUrl: '',
      sourceLocation: {
        filePath: customIssue.filePath,
        startLine: customIssue.startLine,
        endLine: customIssue.endLine,
        framework,
        componentName: componentNameFor(customIssue.filePath),
      },
      codeSnippet: snippetFor(lines, customIssue.startLine, customIssue.endLine),
      remediation: {
        ...(REMEDIATION_BY_RULE_NAME[ruleName(customIssue.ruleId)] ?? DEFAULT_REMEDIATION),
        groupId: customIssue.ruleId,
      },
    });
  }

  return issues;
}
