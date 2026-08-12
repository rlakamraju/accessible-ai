import { describe, expect, it } from 'vitest';
import {
  createLicenseKey,
  hasFeature,
  isFreeTierFeature,
  validateLicenseKeyBrowser,
  validateLicenseKeyNode,
} from '../src/index';
import type { LicensePayload } from '../src/license/types';

const SECRET = 'test-secret';
const OTHER_SECRET = 'other-secret';

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

describe('validateLicenseKeyNode', () => {
  it('returns valid for a correctly signed key', () => {
    const payload = makePayload();
    const key = createLicenseKey(payload, SECRET);

    const result = validateLicenseKeyNode(key, SECRET);

    expect(result.valid).toBe(true);
    expect(result.email).toBe(payload.e);
    expect(result.tier).toBe('PRO');
    expect(result.features).toEqual(payload.f);
    expect(result.expiresAt).toBe(new Date(payload.x * 1000).toISOString());
  });

  it('rejects a key signed with a different secret', () => {
    const key = createLicenseKey(makePayload(), SECRET);

    const result = validateLicenseKeyNode(key, OTHER_SECRET);

    expect(result).toEqual({ valid: false, reason: 'Invalid license key' });
  });

  it('rejects an expired key', () => {
    const now = Math.floor(Date.now() / 1000);
    const payload = makePayload({ i: now - 1000, x: now - 500 });
    const key = createLicenseKey(payload, SECRET);

    const result = validateLicenseKeyNode(key, SECRET);

    expect(result).toEqual({ valid: false, reason: 'License expired' });
  });

  it('rejects a malformed key (missing parts)', () => {
    expect(validateLicenseKeyNode('not-a-license-key', SECRET)).toEqual({
      valid: false,
      reason: 'Malformed license key',
    });
    expect(validateLicenseKeyNode('AAI-PRO-abc123', SECRET)).toEqual({
      valid: false,
      reason: 'Malformed license key',
    });
  });

  it('rejects a key with a tampered payload but original signature', () => {
    const key = createLicenseKey(makePayload(), SECRET);
    const [prefix, signature] = key.split('.');
    const [aai, tier, payloadB64] = prefix.split('-');
    const tamperedPayloadB64 = payloadB64.slice(0, -4) + 'xxxx';
    const tamperedKey = `${aai}-${tier}-${tamperedPayloadB64}.${signature}`;

    const result = validateLicenseKeyNode(tamperedKey, SECRET);

    expect(result.valid).toBe(false);
  });

  it('rejects a key whose tier prefix does not match the payload tier', () => {
    // Sign the message as PRO, then swap the prefix tier to TEAM without re-signing.
    const payload = makePayload({ t: 'PRO' });
    const key = createLicenseKey(payload, SECRET);
    const tamperedKey = key.replace('AAI-PRO-', 'AAI-TEAM-');

    const result = validateLicenseKeyNode(tamperedKey, SECRET);

    expect(result.valid).toBe(false);
  });

  it('hasFeature returns true for included features and false for excluded ones', () => {
    const payload = makePayload({ f: ['deep-analysis'] });
    const key = createLicenseKey(payload, SECRET);
    const result = validateLicenseKeyNode(key, SECRET);

    expect(hasFeature(result, 'deep-analysis')).toBe(true);
    expect(hasFeature(result, 'codebase-audit')).toBe(false);
  });

  it('hasFeature returns false for an invalid validation result', () => {
    const invalid = validateLicenseKeyNode('garbage', SECRET);
    expect(hasFeature(invalid, 'deep-analysis')).toBe(false);
  });

  it('isFreeTierFeature correctly identifies free vs paid features', () => {
    expect(isFreeTierFeature('quick-audit')).toBe(true);
    expect(isFreeTierFeature('overlay')).toBe(true);
    expect(isFreeTierFeature('deep-analysis')).toBe(false);
    expect(isFreeTierFeature('codebase-audit')).toBe(false);
  });
});

describe('validateLicenseKeyBrowser', () => {
  it('returns the same result as the Node variant for a valid key', async () => {
    const payload = makePayload();
    const key = createLicenseKey(payload, SECRET);

    const result = await validateLicenseKeyBrowser(key, SECRET);

    expect(result.valid).toBe(true);
    expect(result.email).toBe(payload.e);
    expect(result.tier).toBe('PRO');
  });

  it('rejects a key signed with a different secret', async () => {
    const key = createLicenseKey(makePayload(), SECRET);

    const result = await validateLicenseKeyBrowser(key, OTHER_SECRET);

    expect(result).toEqual({ valid: false, reason: 'Invalid license key' });
  });
});
