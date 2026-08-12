import { beforeEach, describe, expect, it } from 'vitest';
import { createLicenseKey } from '@accessible-ai/standards';
import type { LicensePayload } from '@accessible-ai/standards';
import { checkFeatureAccess, getLicenseStatus } from '../../src/core/license-gate';

const SECRET = 'accessible-ai-dev-secret-2026'; // matches vitest.config.ts's __LICENSE_SECRET__ define

function makePayload(overrides: Partial<LicensePayload> = {}): LicensePayload {
  const now = Math.floor(Date.now() / 1000);
  return {
    e: 'user@example.com',
    t: 'PRO',
    f: ['deep-analysis', 'codebase-audit', 'remediation', 'report-export', 'site-crawl-unlimited'],
    i: now,
    x: now + 365 * 24 * 60 * 60,
    ...overrides,
  };
}

async function setStoredKey(key: string): Promise<void> {
  await chrome.storage.sync.set({ licenseKey: key });
}

beforeEach(async () => {
  await chrome.storage.sync.remove('licenseKey');
});

describe('checkFeatureAccess', () => {
  it('allows a free-tier feature without any license key', async () => {
    const result = await checkFeatureAccess('quick-audit');
    expect(result).toEqual({ allowed: true });
  });

  it('denies a paid feature when no key is stored', async () => {
    const result = await checkFeatureAccess('deep-analysis');
    expect(result).toEqual({ allowed: false, reason: 'License key required' });
  });

  it('allows a paid feature with a valid PRO key', async () => {
    await setStoredKey(createLicenseKey(makePayload(), SECRET));

    const result = await checkFeatureAccess('deep-analysis');

    expect(result.allowed).toBe(true);
    expect(result.tier).toBe('PRO');
  });

  it('denies a feature not included in a valid TRIAL key', async () => {
    await setStoredKey(createLicenseKey(makePayload({ t: 'TRIAL', f: ['deep-analysis'] }), SECRET));

    const result = await checkFeatureAccess('codebase-audit');

    expect(result.allowed).toBe(false);
    expect(result.tier).toBe('TRIAL');
    expect(result.reason).toMatch(/upgrade/i);
  });

  it('allows the feature that is included in a valid TRIAL key', async () => {
    await setStoredKey(createLicenseKey(makePayload({ t: 'TRIAL', f: ['deep-analysis'] }), SECRET));

    const result = await checkFeatureAccess('deep-analysis');

    expect(result.allowed).toBe(true);
  });

  it('denies an expired key with an expiry reason', async () => {
    const now = Math.floor(Date.now() / 1000);
    await setStoredKey(createLicenseKey(makePayload({ i: now - 1000, x: now - 500 }), SECRET));

    const result = await checkFeatureAccess('deep-analysis');

    expect(result).toEqual({ allowed: false, reason: 'License expired' });
  });

  it('denies a key signed with the wrong secret', async () => {
    await setStoredKey(createLicenseKey(makePayload(), 'a-different-secret'));

    const result = await checkFeatureAccess('deep-analysis');

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('Invalid license key');
  });
});

describe('getLicenseStatus', () => {
  it('reports no key when none is stored', async () => {
    const status = await getLicenseStatus();
    expect(status).toEqual({ hasKey: false, valid: false });
  });

  it('reports full details for a valid key', async () => {
    await setStoredKey(createLicenseKey(makePayload(), SECRET));

    const status = await getLicenseStatus();

    expect(status.hasKey).toBe(true);
    expect(status.valid).toBe(true);
    expect(status.email).toBe('user@example.com');
    expect(status.tier).toBe('PRO');
    expect(status.keyPreview).toBeDefined();
  });

  it('reports the expiry reason for an expired key', async () => {
    const now = Math.floor(Date.now() / 1000);
    await setStoredKey(createLicenseKey(makePayload({ i: now - 1000, x: now - 500 }), SECRET));

    const status = await getLicenseStatus();

    expect(status.hasKey).toBe(true);
    expect(status.valid).toBe(false);
    expect(status.reason).toBe('License expired');
  });
});
