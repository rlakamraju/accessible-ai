import { describe, expect, it } from 'vitest';
import { aggregateResults } from '../../src/core/aggregator';
import type { CriterionResult, PageMeta, ProcessedAuditResult } from '../../src/shared/types';

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

function makeResult(url: string, byCriterion: CriterionResult[], violations = 0): ProcessedAuditResult {
  return {
    standardId: 'wcag-2.1-aa',
    timestamp: new Date().toISOString(),
    url,
    byCriterion,
    totals: { violations, passes: 0, incomplete: 0, inapplicable: 0 },
    violations: [],
  };
}

describe('aggregateResults', () => {
  it('averages page scores into a site score', () => {
    const pageResults = new Map<string, ProcessedAuditResult>([
      ['https://example.com/', makeResult('https://example.com/', [makeCriterion({ passCount: 1 })])], // 100
      [
        'https://example.com/about',
        makeResult('https://example.com/about', [makeCriterion({ violationCount: 1, passCount: 0 })], 1),
      ], // 0
    ]);
    const meta = new Map<string, PageMeta>();

    const result = aggregateResults(pageResults, meta, 'wcag-2.1-aa', 'https://example.com/');

    expect(result.siteScore).toBe(50);
    expect(result.pageScores).toHaveLength(2);
  });

  it('sums violation totals and fills in page titles from metadata', () => {
    const pageResults = new Map<string, ProcessedAuditResult>([
      ['https://example.com/', makeResult('https://example.com/', [], 3)],
      ['https://example.com/about', makeResult('https://example.com/about', [], 2)],
    ]);
    const meta = new Map<string, PageMeta>([
      ['https://example.com/', { title: 'Home', url: 'https://example.com/' }],
    ]);

    const result = aggregateResults(pageResults, meta, 'wcag-2.1-aa', 'https://example.com/');

    expect(result.totalViolations).toBe(5);
    const home = result.pageScores.find((p) => p.url === 'https://example.com/');
    const about = result.pageScores.find((p) => p.url === 'https://example.com/about');
    expect(home?.title).toBe('Home');
    expect(about?.title).toBe('https://example.com/about');
  });

  it('aggregates a failing criterion across pages, tracking affected pages and total instances', () => {
    const pageResults = new Map<string, ProcessedAuditResult>([
      [
        'https://example.com/',
        makeResult('https://example.com/', [makeCriterion({ criterionId: '1.1.1', violationCount: 2 })], 2),
      ],
      [
        'https://example.com/about',
        makeResult('https://example.com/about', [makeCriterion({ criterionId: '1.1.1', violationCount: 1 })], 1),
      ],
    ]);

    const result = aggregateResults(pageResults, new Map(), 'wcag-2.1-aa', 'https://example.com/');

    expect(result.byCriterion).toHaveLength(1);
    expect(result.byCriterion[0]).toMatchObject({
      criterionId: '1.1.1',
      totalInstances: 3,
      pagesAffected: ['https://example.com/', 'https://example.com/about'],
    });
  });

  it('excludes passing criteria from byCriterion', () => {
    const pageResults = new Map<string, ProcessedAuditResult>([
      ['https://example.com/', makeResult('https://example.com/', [makeCriterion({ violationCount: 0 })])],
    ]);

    const result = aggregateResults(pageResults, new Map(), 'wcag-2.1-aa', 'https://example.com/');

    expect(result.byCriterion).toHaveLength(0);
  });

  it('returns a 100 site score and empty breakdowns for zero pages', () => {
    const result = aggregateResults(new Map(), new Map(), 'wcag-2.1-aa', 'https://example.com/');
    expect(result.siteScore).toBe(100);
    expect(result.pageScores).toHaveLength(0);
    expect(result.byCriterion).toHaveLength(0);
  });
});
