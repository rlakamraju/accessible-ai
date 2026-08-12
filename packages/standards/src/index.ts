export type {
  FrameworkType,
  WcagLevel,
  WcagVersion,
  StandardId,
  Principle,
  Impact,
  WcagCriterion,
  StandardMapping,
  ComplianceStandard,
  ResolvedStandard,
} from './types';

export { resolveStandard, getAllCriteria } from './resolver';

export {
  validateLicenseKey,
  validateLicenseKeyNode,
  validateLicenseKeyBrowser,
  createLicenseKey,
  hasFeature,
} from './license/validator';
export { isFreeTierFeature, getTierFeatures, FREE_FEATURES, TIER_FEATURES } from './license/features';
export type {
  LicenseValidation,
  LicenseTier,
  FeatureFlag,
  LicensePayload,
} from './license/types';
