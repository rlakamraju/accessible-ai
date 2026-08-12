import { describe, expect, it } from 'vitest';
import { calculateComplianceScore } from '../../src/core/score-calculator';
import type { CriterionResult, ProcessedAuditResult, ViolationNode } from '../../src/shared/types';

function makeCriterion(overrides: Partial<CriterionResult>): CriterionResult {
  return {
    criterionId: '1.1.1',
    criterionName: 'Non-text Content',
    level: 'A',
    principle: 'perceivable',
    violations: [],
    violationCount: 0,
    passCount: 1,
    incompleteCount: 0,
    inapplicableCount: 0,
    ...overrides,
  };
}

function makeResult(byCriterion: CriterionResult[]): ProcessedAuditResult {
  return {
    standardId: 'wcag-2.1-aa',
    timestamp: new Date().toISOString(),
    url: 'https://example.com',
    byCriterion,
    totals: { violations: 0, passes: 0, incomplete: 0, inapplicable: 0 },
    violations: [],
  };
}

function makeViolation(overrides: Partial<ViolationNode>): ViolationNode {
  return {
    id: 'mock-rule',
    impact: 'critical',
    description: '',
    help: '',
    helpUrl: '',
    criterionIds: ['1.1.1'],
    targets: [{ cssSelector: 'div', html: '<div></div>' }],
    ...overrides,
  };
}

describe('calculateComplianceScore', () => {
  it('returns 100 when every testable criterion passes', () => {
    const result = makeResult([
      makeCriterion({ criterionId: '1.1.1', level: 'A', passCount: 1 }),
      makeCriterion({ criterionId: '1.4.3', level: 'AA', principle: 'perceivable', passCount: 1 }),
    ]);

    const score = calculateComplianceScore(result);

    expect(score.overallScore).toBe(100);
    expect(score.byPrinciple.perceivable).toBe(100);
  });

  it('returns 0 when every testable criterion fails', () => {
    const result = makeResult([
      makeCriterion({ criterionId: '1.1.1', level: 'A', passCount: 0, violationCount: 1 }),
    ]);

    const score = calculateComplianceScore(result);

    expect(score.overallScore).toBe(0);
  });

  it('weights A-level criteria higher than AA-level criteria', () => {
    // One A criterion fails, one AA criterion passes — A is weighted 3, AA weighted 2.
    const result = makeResult([
      makeCriterion({ criterionId: '2.1.1', level: 'A', principle: 'operable', violationCount: 1, passCount: 0 }),
      makeCriterion({ criterionId: '2.4.7', level: 'AA', principle: 'operable', violationCount: 0, passCount: 1 }),
    ]);

    const score = calculateComplianceScore(result);

    // weighted passed = 0*3 + 1*2 = 2, weighted total = 3 + 2 = 5 -> 40%
    expect(score.overallScore).toBe(40);
  });

  it('scores an incomplete-only criterion as 0.5', () => {
    const result = makeResult([
      makeCriterion({ criterionId: '1.1.1', level: 'A', passCount: 0, incompleteCount: 1 }),
    ]);

    const score = calculateComplianceScore(result);

    expect(score.overallScore).toBe(50);
  });

  it('ignores criteria that were never exercised on the page', () => {
    const result = makeResult([
      makeCriterion({ criterionId: '1.1.1', level: 'A', passCount: 1 }),
      makeCriterion({
        criterionId: '1.2.4',
        level: 'AA',
        passCount: 0,
        violationCount: 0,
        incompleteCount: 0,
        inapplicableCount: 5,
      }),
    ]);

    const score = calculateComplianceScore(result);

    expect(score.overallScore).toBe(100);
  });

  it('counts critical and serious violation instances', () => {
    const result = makeResult([
      makeCriterion({
        criterionId: '1.1.1',
        violationCount: 3,
        passCount: 0,
        violations: [
          makeViolation({ impact: 'critical', targets: [{ cssSelector: 'a', html: '' }, { cssSelector: 'b', html: '' }] }),
          makeViolation({ impact: 'serious', targets: [{ cssSelector: 'c', html: '' }] }),
        ],
      }),
    ]);

    const score = calculateComplianceScore(result);

    expect(score.criticalFailCount).toBe(2);
    expect(score.seriousFailCount).toBe(1);
  });

  it('returns 100 for a result with no testable criteria at all', () => {
    const score = calculateComplianceScore(makeResult([]));
    expect(score.overallScore).toBe(100);
  });
});
