import { createHmac } from 'node:crypto';
import type { FeatureFlag, LicensePayload, LicenseTier, LicenseValidation } from './types';

const KEY_PATTERN = /^AAI-(PRO|TEAM|TRIAL)-([A-Za-z0-9_-]+)\.([a-f0-9]+)$/;
const SIGNATURE_LENGTH = 16;

interface ParsedKey {
  tierFromKey: LicenseTier;
  payloadB64: string;
  signature: string;
  signedMessage: string;
}

function parseLicenseKey(key: string): ParsedKey | null {
  const match = KEY_PATTERN.exec(key);
  if (!match) return null;
  const [, tierFromKey, payloadB64, signature] = match;
  return {
    tierFromKey: tierFromKey as LicenseTier,
    payloadB64,
    signature,
    signedMessage: `AAI-${tierFromKey}-${payloadB64}`,
  };
}

function base64UrlToBase64(input: string): string {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/');
  const padLength = (4 - (padded.length % 4)) % 4;
  return padded + '='.repeat(padLength);
}

function encodePayload(payload: LicensePayload): string {
  return Buffer.from(JSON.stringify(payload), 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function decodePayload(payloadB64: string): LicensePayload | null {
  try {
    const base64 = base64UrlToBase64(payloadB64);
    const json =
      typeof atob === 'function'
        ? decodeURIComponent(
            Array.from(atob(base64))
              .map((c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'))
              .join(''),
          )
        : Buffer.from(base64, 'base64').toString('utf8');
    return JSON.parse(json) as LicensePayload;
  } catch {
    return null;
  }
}

function finalize(
  parsed: ParsedKey,
  expectedSignature: string,
): LicenseValidation {
  if (parsed.signature.slice(0, SIGNATURE_LENGTH) !== expectedSignature.slice(0, SIGNATURE_LENGTH)) {
    return { valid: false, reason: 'Invalid license key' };
  }

  const payload = decodePayload(parsed.payloadB64);
  if (!payload) {
    return { valid: false, reason: 'Malformed license key' };
  }

  if (payload.t !== parsed.tierFromKey) {
    return { valid: false, reason: 'Invalid license key' };
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (payload.x < nowSeconds) {
    return { valid: false, reason: 'License expired' };
  }

  return {
    valid: true,
    email: payload.e,
    tier: payload.t,
    features: payload.f,
    expiresAt: new Date(payload.x * 1000).toISOString(),
  };
}

/** Node.js variant — synchronous, uses `node:crypto`. */
export function validateLicenseKeyNode(key: string, secret: string): LicenseValidation {
  const parsed = parseLicenseKey(key);
  if (!parsed) return { valid: false, reason: 'Malformed license key' };

  const expectedSignature = createHmac('sha256', secret)
    .update(parsed.signedMessage)
    .digest('hex')
    .slice(0, SIGNATURE_LENGTH);

  return finalize(parsed, expectedSignature);
}

/** Alias kept for the plan's `validateLicenseKey` name — Node/sync entry point. */
export const validateLicenseKey = validateLicenseKeyNode;

/** Signs a payload into a full license key string. Node-only (used by the CLI + tests). */
export function createLicenseKey(payload: LicensePayload, secret: string): string {
  const payloadB64 = encodePayload(payload);
  const signedMessage = `AAI-${payload.t}-${payloadB64}`;
  const signature = createHmac('sha256', secret)
    .update(signedMessage)
    .digest('hex')
    .slice(0, SIGNATURE_LENGTH);
  return `${signedMessage}.${signature}`;
}

/** Browser variant — asynchronous, uses the Web Crypto API. */
export async function validateLicenseKeyBrowser(
  key: string,
  secret: string,
): Promise<LicenseValidation> {
  const parsed = parseLicenseKey(key);
  if (!parsed) return { valid: false, reason: 'Malformed license key' };

  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signatureBuffer = await crypto.subtle.sign(
    'HMAC',
    cryptoKey,
    encoder.encode(parsed.signedMessage),
  );
  const expectedSignature = Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, SIGNATURE_LENGTH);

  return finalize(parsed, expectedSignature);
}

export function hasFeature(validation: LicenseValidation, feature: string): boolean {
  return validation.valid && (validation.features?.includes(feature as FeatureFlag) ?? false);
}
