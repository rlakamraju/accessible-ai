import type { ComplianceScore, Principle, ProcessedAuditResult } from '../shared/types';

const LEVEL_WEIGHT: Record<'A' | 'AA' | 'AAA', number> = { A: 3, AA: 2, AAA: 1 };

const PRINCIPLES: Principle[] = ['perceivable', 'operable', 'understandable', 'robust'];

export function calculateComplianceScore(result: ProcessedAuditResult): ComplianceScore {
  let weightedPassed = 0;
  let weightedTotal = 0;
  const principleTotals: Record<Principle, { passed: number; total: number }> = {
    perceivable: { passed: 0, total: 0 },
    operable: { passed: 0, total: 0 },
    understandable: { passed: 0, total: 0 },
    robust: { passed: 0, total: 0 },
  };

  let criticalFailCount = 0;
  let seriousFailCount = 0;

  for (const criterion of result.byCriterion) {
    const isTestable =
      criterion.violationCount > 0 || criterion.passCount > 0 || criterion.incompleteCount > 0;
    if (!isTestable) continue;

    const weight = LEVEL_WEIGHT[criterion.level];
    const score = criterion.violationCount > 0 ? 0 : criterion.incompleteCount > 0 ? 0.5 : 1;

    weightedPassed += score * weight;
    weightedTotal += weight;
    principleTotals[criterion.principle].passed += score * weight;
    principleTotals[criterion.principle].total += weight;

    for (const violation of criterion.violations) {
      const instances = violation.targets.length;
      if (violation.impact === 'critical') criticalFailCount += instances;
      if (violation.impact === 'serious') seriousFailCount += instances;
    }
  }

  const overallScore = weightedTotal > 0 ? Math.round((weightedPassed / weightedTotal) * 100) : 100;

  const byPrinciple = PRINCIPLES.reduce(
    (acc, principle) => {
      const { passed, total } = principleTotals[principle];
      acc[principle] = total > 0 ? Math.round((passed / total) * 100) : 100;
      return acc;
    },
    {} as Record<Principle, number>,
  );

  return { overallScore, byPrinciple, criticalFailCount, seriousFailCount };
}
