import type { FeatureFlag, LicenseTier } from './types';

export const FREE_FEATURES: string[] = [
  'quick-audit',
  'overlay',
  'standard-picker',
  'basic-export',
  'site-crawl-5',
];

export const TIER_FEATURES: Record<LicenseTier, FeatureFlag[]> = {
  TRIAL: ['deep-analysis'],
  PRO: ['deep-analysis', 'codebase-audit', 'remediation', 'report-export', 'site-crawl-unlimited'],
  TEAM: [
    'deep-analysis',
    'codebase-audit',
    'remediation',
    'report-export',
    'site-crawl-unlimited',
    'priority-support',
  ],
};

export function isFreeTierFeature(feature: string): boolean {
  return FREE_FEATURES.includes(feature);
}

export function getTierFeatures(tier: LicenseTier): FeatureFlag[] {
  return TIER_FEATURES[tier];
}
