// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import axe from 'axe-core';
import { resolveStandard } from '@accessible-ai/standards';
import { processResults } from '../../src/core/result-processor';
import { calculateComplianceScore } from '../../src/core/score-calculator';

const resolved = resolveStandard('wcag-2.1-aa');

function loadFixture(name: string): void {
  const html = readFileSync(path.join(__dirname, '../fixtures', name), 'utf8');
  document.open();
  document.write(html);
  document.close();
}

async function runAudit() {
  const raw = await axe.run(document, {
    runOnly: { type: 'tag', values: resolved.axeCoreRuleTags },
    resultTypes: ['violations', 'passes', 'incomplete', 'inapplicable'],
    // jsdom has no real layout/rendering engine (and no canvas), so color-contrast's internal
    // icon-ligature check crashes here. This is a jsdom-only limitation, not a product decision —
    // color-contrast still runs normally in the real browser extension.
    rules: { 'color-contrast': { enabled: false } },
    preload: false, // jsdom can't serve axe-core's preload assets; skip the ~10s timeout for them
  });
  const result = processResults(raw, resolved);
  const score = calculateComplianceScore(result);
  return { result, score };
}

describe('audit pipeline against real fixtures', () => {
  it('scores the intentionally-broken fixture low and surfaces many violations', async () => {
    loadFixture('test-page-violations.html');

    const { result, score } = await runAudit();

    expect(result.totals.violations).toBeGreaterThan(5);
    expect(result.byCriterion.filter((c) => c.violationCount > 0).length).toBeGreaterThan(4);
    expect(score.overallScore).toBeLessThan(60);
  });

  it('scores the clean fixture high with no violations', async () => {
    loadFixture('test-page-clean.html');

    const { result, score } = await runAudit();

    expect(result.totals.violations).toBe(0);
    expect(score.overallScore).toBeGreaterThan(90);
  });
});
