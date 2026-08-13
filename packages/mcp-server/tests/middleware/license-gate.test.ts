import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createLicenseKey } from '@accessible-ai/standards';
import { readKeyFromDisk, requireLicense, requireLicenseForTool } from '../../src/middleware/license-gate';

const SECRET = 'test-secret';

function makeKey(overrides: { tier?: 'PRO' | 'TRIAL' | 'TEAM'; features?: string[]; expiresInSeconds?: number } = {}) {
  const now = Math.floor(Date.now() / 1000);
  return createLicenseKey(
    {
      e: 'user@test.dev',
      t: overrides.tier ?? 'PRO',
      f: overrides.features ?? ['deep-analysis'],
      i: now,
      x: now + (overrides.expiresInSeconds ?? 3600),
    },
    SECRET,
  );
}

function runMiddleware(headers: Record<string, string>) {
  const req = { headers } as never;
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  const res = { status } as never;
  const next = vi.fn();
  requireLicense('deep-analysis')(req, res, next);
  return { next, status: status as unknown as ReturnType<typeof vi.fn>, json };
}

describe('requireLicense (HTTP middleware)', () => {
  beforeEach(() => {
    process.env.LICENSE_SECRET = SECRET;
    delete process.env.LICENSE_KEY;
  });

  afterEach(() => {
    delete process.env.LICENSE_SECRET;
    delete process.env.LICENSE_KEY;
  });

  it('passes through with a valid key header', () => {
    const { next, status } = runMiddleware({ 'x-license-key': makeKey() });
    expect(next).toHaveBeenCalledOnce();
    expect(status).not.toHaveBeenCalled();
  });

  it('rejects with 403 and a structured error when no key is present', () => {
    const { next, status, json } = runMiddleware({});
    expect(next).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ feature: 'deep-analysis' }));
  });

  it('rejects an expired key with expiry info in the reason', () => {
    const { status, json } = runMiddleware({ 'x-license-key': makeKey({ expiresInSeconds: -10 }) });
    expect(status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ error: 'License expired' }));
  });

  it('rejects a valid key whose tier lacks the required feature', () => {
    const { status } = runMiddleware({ 'x-license-key': makeKey({ tier: 'TRIAL', features: [] }) });
    expect(status).toHaveBeenCalledWith(403);
  });

  it('falls back to the LICENSE_KEY env var when no header is present', () => {
    process.env.LICENSE_KEY = makeKey();
    const { next } = runMiddleware({});
    expect(next).toHaveBeenCalledOnce();
  });

  it('prioritizes the header over the env var', () => {
    process.env.LICENSE_KEY = makeKey({ tier: 'TRIAL', features: [] });
    const { next } = runMiddleware({ 'x-license-key': makeKey() });
    expect(next).toHaveBeenCalledOnce();
  });
});

describe('requireLicenseForTool (MCP tool guard)', () => {
  beforeEach(() => {
    process.env.LICENSE_SECRET = SECRET;
    delete process.env.LICENSE_KEY;
  });

  afterEach(() => {
    delete process.env.LICENSE_SECRET;
    delete process.env.LICENSE_KEY;
  });

  it('executes the handler when the env key is valid for the feature', async () => {
    process.env.LICENSE_KEY = makeKey();
    const handler = vi.fn().mockResolvedValue({ content: [{ type: 'text', text: 'ok' }] });
    const wrapped = requireLicenseForTool('deep-analysis', handler);

    const result = await wrapped({});
    expect(handler).toHaveBeenCalledOnce();
    expect(result.content[0].text).toBe('ok');
  });

  it('returns a license-required message without calling the handler when no key is set', async () => {
    const handler = vi.fn();
    const wrapped = requireLicenseForTool('deep-analysis', handler);

    const result = await wrapped({});
    expect(handler).not.toHaveBeenCalled();
    const payload = JSON.parse(result.content[0].text as string);
    expect(payload.error).toBe('License required');
    expect(payload.feature).toBe('deep-analysis');
  });
});

describe('readKeyFromDisk', () => {
  it('returns null when the license file does not exist', () => {
    expect(readKeyFromDisk()).toBeNull();
  });
});
