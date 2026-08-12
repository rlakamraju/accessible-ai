import { calculateComplianceScore } from './score-calculator';
import type {
  CriterionAggregate,
  PageMeta,
  PageScore,
  ProcessedAuditResult,
  SiteAuditResult,
  StandardId,
} from '../shared/types';

export function aggregateResults(
  pageResults: Map<string, ProcessedAuditResult>,
  pageMeta: Map<string, PageMeta>,
  standard: StandardId,
  rootUrl: string,
): SiteAuditResult {
  const pageScores: PageScore[] = [];
  const criterionMap = new Map<string, CriterionAggregate>();
  const pageResultsRecord: Record<string, ProcessedAuditResult> = {};

  let scoreSum = 0;
  let totalViolations = 0;

  for (const [url, result] of pageResults) {
    const score = calculateComplianceScore(result);
    pageScores.push({
      url,
      title: pageMeta.get(url)?.title ?? url,
      score: score.overallScore,
      violationCount: result.totals.violations,
    });
    pageResultsRecord[url] = result;
    scoreSum += score.overallScore;
    totalViolations += result.totals.violations;

    for (const criterion of result.byCriterion) {
      if (criterion.violationCount === 0) continue;
      const existing = criterionMap.get(criterion.criterionId);
      if (existing) {
        if (!existing.pagesAffected.includes(url)) existing.pagesAffected.push(url);
        existing.totalInstances += criterion.violationCount;
      } else {
        criterionMap.set(criterion.criterionId, {
          criterionId: criterion.criterionId,
          criterionName: criterion.criterionName,
          pagesAffected: [url],
          totalInstances: criterion.violationCount,
        });
      }
    }
  }

  const siteScore = pageScores.length > 0 ? Math.round(scoreSum / pageScores.length) : 100;

  return {
    standardId: standard,
    rootUrl,
    timestamp: new Date().toISOString(),
    siteScore,
    totalViolations,
    pageScores,
    byCriterion: Array.from(criterionMap.values()).sort((a, b) => b.totalInstances - a.totalInstances),
    pageResults: pageResultsRecord,
  };
}
