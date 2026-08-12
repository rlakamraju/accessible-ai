import { parseArgs } from 'node:util';
import {
  createLicenseKey,
  getTierFeatures,
  type FeatureFlag,
  type LicensePayload,
  type LicenseTier,
} from '@accessible-ai/standards';

const VALID_TIERS: LicenseTier[] = ['PRO', 'TEAM', 'TRIAL'];

function fail(message: string): never {
  console.error(`Error: ${message}`);
  process.exit(1);
}

function main(): void {
  const { values } = parseArgs({
    options: {
      email: { type: 'string' },
      tier: { type: 'string', default: 'PRO' },
      days: { type: 'string', default: '365' },
      features: { type: 'string' },
      secret: { type: 'string' },
    },
  });

  const email = values.email;
  if (!email) fail('--email is required');

  const tier = values.tier as string;
  if (!VALID_TIERS.includes(tier as LicenseTier)) {
    fail(`--tier must be one of ${VALID_TIERS.join(', ')}`);
  }

  const secret = values.secret ?? process.env.LICENSE_SECRET;
  if (!secret) fail('--secret is required (or set LICENSE_SECRET)');

  const days = Number(values.days);
  if (!Number.isFinite(days) || days <= 0) fail('--days must be a positive number');

  const features: FeatureFlag[] = values.features
    ? (values.features.split(',').map((f) => f.trim()) as FeatureFlag[])
    : getTierFeatures(tier as LicenseTier);

  const issuedAt = Math.floor(Date.now() / 1000);
  const expiresAt = issuedAt + Math.round(days * 24 * 60 * 60);

  const payload: LicensePayload = {
    e: email,
    t: tier as LicenseTier,
    f: features,
    i: issuedAt,
    x: expiresAt,
  };

  const key = createLicenseKey(payload, secret);

  console.log(`License Key: ${key}`);
  console.log(`Email:       ${email}`);
  console.log(`Tier:        ${tier}`);
  console.log(`Features:    ${features.join(', ')}`);
  console.log(`Issued:      ${new Date(issuedAt * 1000).toISOString()}`);
  console.log(`Expires:     ${new Date(expiresAt * 1000).toISOString()}`);
}

main();
