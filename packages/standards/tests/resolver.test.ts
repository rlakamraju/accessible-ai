import { describe, expect, it } from 'vitest';
import { getAllCriteria, resolveStandard } from '../src/index';

describe('resolveStandard', () => {
  it('has 50 curated WCAG 2.1 A+AA criteria in total (30 A + 20 AA)', () => {
    const all = getAllCriteria();
    expect(all).toHaveLength(50);
    expect(all.filter((c) => c.level === 'A')).toHaveLength(30);
    expect(all.filter((c) => c.level === 'AA')).toHaveLength(20);
  });

  it('"ada" (WCAG 2.1 AA) returns only criteria at version <= 2.1 and level A/AA', () => {
    const resolved = resolveStandard('ada');
    expect(resolved.criteria.every((c) => ['2.0', '2.1'].includes(c.version))).toBe(true);
    expect(resolved.criteria.every((c) => ['A', 'AA'].includes(c.level))).toBe(true);
    // 30 A + 20 AA criteria for WCAG 2.1 A+AA.
    expect(resolved.criteria).toHaveLength(50);
    expect(resolved.standard.basedOnVersion).toBe('2.1');
    expect(resolved.standard.level).toBe('AA');
  });

  it('"section-508" (WCAG 2.0 AA) returns only criteria at version <= 2.0', () => {
    const resolved = resolveStandard('section-508');
    expect(resolved.criteria.every((c) => c.version === '2.0')).toBe(true);
    // The 12 criteria introduced in WCAG 2.1 must be excluded.
    expect(resolved.criteria).toHaveLength(38);
  });

  it('"wcag-2.1-a" only includes Level A criteria', () => {
    const resolved = resolveStandard('wcag-2.1-a');
    expect(resolved.criteria.every((c) => c.level === 'A')).toBe(true);
    expect(resolved.criteria).toHaveLength(30);
  });

  it('every resolved standard has non-empty axeCoreRuleTags', () => {
    for (const id of ['ada', 'section-508', 'eaa', 'wcag-2.0-a', 'wcag-2.1-aa'] as const) {
      const resolved = resolveStandard(id);
      expect(resolved.axeCoreRuleTags.length).toBeGreaterThan(0);
    }
  });

  it('"eaa" includes an additionalRequirements array', () => {
    const resolved = resolveStandard('eaa');
    expect(Array.isArray(resolved.standard.additionalRequirements)).toBe(true);
    expect(resolved.standard.additionalRequirements!.length).toBeGreaterThan(0);
  });

  it('"ada" and "section-508" do not carry additionalRequirements', () => {
    expect(resolveStandard('ada').standard.additionalRequirements).toBeUndefined();
    expect(resolveStandard('section-508').standard.additionalRequirements).toBeUndefined();
  });

  it('throws for an unknown standard id', () => {
    // @ts-expect-error - intentionally invalid input
    expect(() => resolveStandard('not-a-real-standard')).toThrow();
  });

  it('axeCoreRuleIds is deduplicated across criteria', () => {
    const resolved = resolveStandard('wcag-2.1-aa');
    expect(new Set(resolved.axeCoreRuleIds).size).toBe(resolved.axeCoreRuleIds.length);
    expect(resolved.axeCoreRuleIds).toContain('color-contrast');
    expect(resolved.axeCoreRuleIds).toContain('image-alt');
  });
});
