import { hasFeature, isFreeTierFeature, validateLicenseKeyBrowser } from '@accessible-ai/standards';
import type { LicenseTier } from '@accessible-ai/standards';

const STORAGE_KEY = 'licenseKey';

export interface FeatureAccessResult {
  allowed: boolean;
  reason?: string;
  tier?: LicenseTier;
}

export interface LicenseStatus {
  hasKey: boolean;
  valid: boolean;
  email?: string;
  tier?: LicenseTier;
  features?: string[];
  expiresAt?: string;
  reason?: string;
  keyPreview?: string;
}

async function getStoredKey(): Promise<string | undefined> {
  const stored = await chrome.storage.sync.get(STORAGE_KEY);
  return stored[STORAGE_KEY] as string | undefined;
}

function previewKey(key: string): string {
  if (key.length <= 24) return key;
  return `${key.slice(0, 12)}…${key.slice(-8)}`;
}

export async function checkFeatureAccess(feature: string): Promise<FeatureAccessResult> {
  if (isFreeTierFeature(feature)) {
    return { allowed: true };
  }

  const key = await getStoredKey();
  if (!key) {
    return { allowed: false, reason: 'License key required' };
  }

  const validation = await validateLicenseKeyBrowser(key, __LICENSE_SECRET__);
  if (!validation.valid) {
    return { allowed: false, reason: validation.reason };
  }

  if (!hasFeature(validation, feature)) {
    return { allowed: false, reason: `Upgrade to PRO for ${feature}`, tier: validation.tier };
  }

  return { allowed: true, tier: validation.tier };
}

export async function getLicenseStatus(): Promise<LicenseStatus> {
  const key = await getStoredKey();
  if (!key) {
    return { hasKey: false, valid: false };
  }

  const validation = await validateLicenseKeyBrowser(key, __LICENSE_SECRET__);
  return {
    hasKey: true,
    valid: validation.valid,
    email: validation.email,
    tier: validation.tier,
    features: validation.features,
    expiresAt: validation.expiresAt,
    reason: validation.reason,
    keyPreview: previewKey(key),
  };
}

export async function saveLicenseKey(key: string): Promise<void> {
  await chrome.storage.sync.set({ [STORAGE_KEY]: key });
}

export async function removeLicenseKey(): Promise<void> {
  await chrome.storage.sync.remove(STORAGE_KEY);
}
