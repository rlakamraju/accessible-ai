import { describe, expect, it } from 'vitest';
import { FREE_FEATURES, TIER_FEATURES, getTierFeatures } from '../src/index';

describe('license features', () => {
  it('TRIAL tier has only deep-analysis', () => {
    expect(getTierFeatures('TRIAL')).toEqual(['deep-analysis']);
  });

  it('PRO tier has all expected features', () => {
    expect(getTierFeatures('PRO')).toEqual(
      expect.arrayContaining([
        'deep-analysis',
        'codebase-audit',
        'remediation',
        'report-export',
        'site-crawl-unlimited',
      ]),
    );
    expect(getTierFeatures('PRO')).not.toContain('priority-support');
  });

  it('TEAM tier is a superset of PRO', () => {
    const pro = getTierFeatures('PRO');
    const team = getTierFeatures('TEAM');
    for (const feature of pro) {
      expect(team).toContain(feature);
    }
    expect(team).toContain('priority-support');
  });

  it('free features list is correct', () => {
    expect(FREE_FEATURES).toEqual([
      'quick-audit',
      'overlay',
      'standard-picker',
      'basic-export',
      'site-crawl-5',
    ]);
  });

  it('TIER_FEATURES maps every tier', () => {
    expect(Object.keys(TIER_FEATURES).sort()).toEqual(['PRO', 'TEAM', 'TRIAL']);
  });
});
