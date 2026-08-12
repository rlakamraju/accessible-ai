import { describe, expect, it } from 'vitest';
import type { AxeResults, Result } from 'axe-core';
import { resolveStandard } from '@accessible-ai/standards';
import { processResults } from '../../src/core/result-processor';

function makeRule(overrides: Partial<Result>): Result {
  return {
    id: 'mock-rule',
    impact: 'moderate',
    tags: [],
    description: 'mock description',
    help: 'mock help',
    helpUrl: 'https://example.com/mock',
    nodes: [
      {
        html: '<div></div>',
        target: ['div'],
        failureSummary: 'Fix this',
      } as never,
    ],
    ...overrides,
  } as Result;
}

function makeAxeResults(overrides: Partial<AxeResults>): AxeResults {
  return {
    url: 'https://example.com/page',
    timestamp: new Date().toISOString(),
    violations: [],
    passes: [],
    incomplete: [],
    inapplicable: [],
    ...overrides,
  } as unknown as AxeResults;
}

describe('processResults', () => {
  const resolved = resolveStandard('wcag-2.1-aa');

  it('maps a violation to its WCAG criterion via the axe wcag tag', () => {
    const raw = makeAxeResults({
      violations: [
        makeRule({ id: 'color-contrast', impact: 'serious', tags: ['wcag2aa', 'wcag143'] }),
      ],
    });

    const result = processResults(raw, resolved);

    const contrastCriterion = result.byCriterion.find((c) => c.criterionId === '1.4.3');
    expect(contrastCriterion?.violationCount).toBe(1);
    expect(contrastCriterion?.violations[0].id).toBe('color-contrast');
  });

  it('falls back to the curated axeCoreRules id when the axe tag is absent', () => {
    // 'image-alt' isn't tagged 'wcag111' here, but it's in criterion 1.1.1's curated axeCoreRules list.
    const raw = makeAxeResults({
      violations: [makeRule({ id: 'image-alt', impact: 'critical', tags: ['wcag2a'] })],
    });

    const result = processResults(raw, resolved);

    const altTextCriterion = result.byCriterion.find((c) => c.criterionId === '1.1.1');
    expect(altTextCriterion?.violationCount).toBe(1);
  });

  it('counts violation/pass/incomplete instances by DOM node, not by rule', () => {
    const raw = makeAxeResults({
      violations: [
        makeRule({
          id: 'color-contrast',
          tags: ['wcag143'],
          nodes: [{ html: '<a>', target: ['a'] } as never, { html: '<p>', target: ['p'] } as never],
        }),
      ],
    });

    const result = processResults(raw, resolved);

    expect(result.totals.violations).toBe(2);
    const contrastCriterion = result.byCriterion.find((c) => c.criterionId === '1.4.3');
    expect(contrastCriterion?.violationCount).toBe(2);
  });

  it('produces a flattened, deduplicated violations list', () => {
    const raw = makeAxeResults({
      violations: [makeRule({ id: 'color-contrast', tags: ['wcag143'] })],
    });

    const result = processResults(raw, resolved);

    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].id).toBe('color-contrast');
  });

  it('carries the page url and totals through from the raw axe results', () => {
    const raw = makeAxeResults({
      url: 'https://example.com/specific-page',
      passes: [makeRule({ id: 'html-has-lang', tags: ['wcag311'] })],
    });

    const result = processResults(raw, resolved);

    expect(result.url).toBe('https://example.com/specific-page');
    expect(result.totals.passes).toBe(1);
  });
});
