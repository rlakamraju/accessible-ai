import type { AxeResults, NodeResult, Result } from 'axe-core';
import type { ResolvedStandard, WcagCriterion } from '@accessible-ai/standards';
import type {
  AuditTotals,
  CriterionResult,
  Impact,
  ProcessedAuditResult,
  ViolationNode,
  ViolationTarget,
} from '../shared/types';

function criterionTag(criterionId: string): string {
  return `wcag${criterionId.replace(/\./g, '')}`;
}

function matchesCriterion(rule: Result, criterion: WcagCriterion): boolean {
  return rule.tags.includes(criterionTag(criterion.id)) || criterion.axeCoreRules.includes(rule.id);
}

function toTarget(node: NodeResult): ViolationTarget {
  return {
    cssSelector: node.target.join(', '),
    html: node.html,
    failureSummary: node.failureSummary,
  };
}

function toViolationNode(rule: Result, criterionIds: string[]): ViolationNode {
  return {
    id: rule.id,
    impact: (rule.impact as Impact | null | undefined) ?? null,
    description: rule.description,
    help: rule.help,
    helpUrl: rule.helpUrl,
    criterionIds,
    targets: rule.nodes.map(toTarget),
  };
}

function nodeCount(rules: Result[]): number {
  return rules.reduce((sum, rule) => sum + rule.nodes.length, 0);
}

export function processResults(raw: AxeResults, resolved: ResolvedStandard): ProcessedAuditResult {
  const byCriterion: CriterionResult[] = resolved.criteria.map((criterion) => {
    const violationRules = raw.violations.filter((r) => matchesCriterion(r, criterion));
    const passRules = raw.passes.filter((r) => matchesCriterion(r, criterion));
    const incompleteRules = raw.incomplete.filter((r) => matchesCriterion(r, criterion));
    const inapplicableRules = raw.inapplicable.filter((r) => matchesCriterion(r, criterion));

    return {
      criterionId: criterion.id,
      criterionName: criterion.name,
      level: criterion.level,
      principle: criterion.principle,
      violations: violationRules.map((r) => toViolationNode(r, [criterion.id])),
      violationCount: nodeCount(violationRules),
      passCount: nodeCount(passRules),
      incompleteCount: nodeCount(incompleteRules),
      inapplicableCount: inapplicableRules.length,
    };
  });

  const violationsByRuleId = new Map<string, ViolationNode>();
  for (const rule of raw.violations) {
    const criterionIds = resolved.criteria.filter((c) => matchesCriterion(rule, c)).map((c) => c.id);
    violationsByRuleId.set(rule.id, toViolationNode(rule, criterionIds));
  }

  const totals: AuditTotals = {
    violations: nodeCount(raw.violations),
    passes: nodeCount(raw.passes),
    incomplete: nodeCount(raw.incomplete),
    inapplicable: raw.inapplicable.length,
  };

  return {
    standardId: resolved.standard.id,
    timestamp: new Date().toISOString(),
    url: raw.url,
    byCriterion,
    totals,
    violations: Array.from(violationsByRuleId.values()),
  };
}
