import type { AutomationLevel, AxeViolation, EstimatedEffort, AccessibilityIssue } from '../../config/types.js';
import type { ResolvedStandard, StandardId, Impact } from '@accessible-ai/standards';
import { getTemplateIdForRule } from './templates/registry.js';

const DEFAULT_REMEDIATION: { automationLevel: AutomationLevel; estimatedEffort: EstimatedEffort } = {
  automationLevel: 'llm-assisted',
  estimatedEffort: 'medium',
};

/**
 * Keyed by the bare axe-core rule id. Mirrors `static-analyzer/issue-normalizer.ts`'s
 * `REMEDIATION_BY_RULE_NAME` table: rules with an unambiguous, safe Level-1 template are `'auto'`;
 * rules that need real content/meaning are `'llm-assisted'`; rules whose "fix" is a judgment call
 * (heading restructuring, contrast/color choices) are `'manual-review'`.
 */
const REMEDIATION_BY_AXE_RULE: Record<string, { automationLevel: AutomationLevel; estimatedEffort: EstimatedEffort }> = {
  'html-has-lang': { automationLevel: 'auto', estimatedEffort: 'trivial' },
  'html-lang-valid': { automationLevel: 'auto', estimatedEffort: 'trivial' },
  'duplicate-id': { automationLevel: 'auto', estimatedEffort: 'small' },
  'duplicate-id-active': { automationLevel: 'auto', estimatedEffort: 'small' },
  'duplicate-id-aria': { automationLevel: 'auto', estimatedEffort: 'small' },
  tabindex: { automationLevel: 'auto', estimatedEffort: 'trivial' },
  'meta-viewport': { automationLevel: 'auto', estimatedEffort: 'trivial' },
  'meta-viewport-large': { automationLevel: 'auto', estimatedEffort: 'trivial' },
  'image-alt': { automationLevel: 'llm-assisted', estimatedEffort: 'trivial' },
  'input-image-alt': { automationLevel: 'llm-assisted', estimatedEffort: 'trivial' },
  'area-alt': { automationLevel: 'llm-assisted', estimatedEffort: 'trivial' },
  'object-alt': { automationLevel: 'llm-assisted', estimatedEffort: 'trivial' },
  'role-img-alt': { automationLevel: 'llm-assisted', estimatedEffort: 'trivial' },
  'svg-img-alt': { automationLevel: 'llm-assisted', estimatedEffort: 'trivial' },
  'link-name': { automationLevel: 'llm-assisted', estimatedEffort: 'small' },
  'link-in-text-block': { automationLevel: 'llm-assisted', estimatedEffort: 'small' },
  'button-name': { automationLevel: 'llm-assisted', estimatedEffort: 'small' },
  'form-field-multiple-labels': { automationLevel: 'llm-assisted', estimatedEffort: 'small' },
  'label-title-only': { automationLevel: 'llm-assisted', estimatedEffort: 'small' },
  'heading-order': { automationLevel: 'manual-review', estimatedEffort: 'medium' },
  'empty-heading': { automationLevel: 'manual-review', estimatedEffort: 'medium' },
  'color-contrast': { automationLevel: 'manual-review', estimatedEffort: 'large' },
};

/** Runtime (axe-core) counterpart to `static-analyzer/issue-normalizer.ts`'s `normalizeIssues` — see architecture doc section 5.2. */
export function normalizeRuntimeIssues(
  violations: AxeViolation[],
  pageUrl: string,
  standard: StandardId,
  resolved: ResolvedStandard,
): AccessibilityIssue[] {
  const criteriaByAxeRule = new Map<string, string[]>();
  for (const criterion of resolved.criteria) {
    for (const ruleId of criterion.axeCoreRules) {
      const list = criteriaByAxeRule.get(ruleId) ?? [];
      list.push(criterion.id);
      criteriaByAxeRule.set(ruleId, list);
    }
  }

  const issues: AccessibilityIssue[] = [];
  let counter = 1;

  for (const violation of violations) {
    const remediation = REMEDIATION_BY_AXE_RULE[violation.id] ?? DEFAULT_REMEDIATION;
    const fixTemplateId = getTemplateIdForRule(violation.id);

    for (const node of violation.nodes) {
      const cssSelector = node.target.at(-1) ?? node.target.join(' ');
      issues.push({
        id: `issue-${String(counter++).padStart(3, '0')}`,
        source: 'runtime',
        wcagCriteria: criteriaByAxeRule.get(violation.id) ?? [],
        standard,
        impact: (violation.impact ?? 'moderate') as Impact,
        ruleId: violation.id,
        description: node.failureSummary ?? violation.description,
        helpUrl: violation.helpUrl,
        sourceLocation: {
          filePath: '',
          startLine: 0,
          endLine: 0,
          framework: 'auto',
        },
        codeSnippet: { before: '', violating: node.html, after: '' },
        runtimeContext: { pageUrl, cssSelector, renderedHtml: node.html },
        remediation: {
          ...remediation,
          fixTemplateId,
          groupId: violation.id,
        },
      });
    }
  }

  return issues;
}
