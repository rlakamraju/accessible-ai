export type LicenseTier = 'PRO' | 'TEAM' | 'TRIAL';

export type FeatureFlag =
  | 'deep-analysis'
  | 'codebase-audit'
  | 'remediation'
  | 'report-export'
  | 'site-crawl-unlimited'
  | 'priority-support';

export interface LicensePayload {
  e: string; // email
  t: LicenseTier; // tier
  f: FeatureFlag[]; // enabled features
  i: number; // issued at (unix seconds)
  x: number; // expires at (unix seconds)
}

export interface LicenseValidation {
  valid: boolean;
  reason?: string;
  email?: string;
  tier?: LicenseTier;
  features?: FeatureFlag[];
  expiresAt?: string;
}
