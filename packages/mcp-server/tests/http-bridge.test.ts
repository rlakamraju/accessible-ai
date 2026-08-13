import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createLicenseKey } from '@accessible-ai/standards';
import { createHttpBridge } from '../src/http-bridge';
import { SessionManager } from '../src/session/session-manager';

const { mockDeepAnalyze } = vi.hoisted(() => ({
  mockDeepAnalyze: vi.fn().mockResolvedValue({
    enrichedFindings: [],
    llmOnlyFindings: [],
    summary: 'mocked summary',
    pageUrl: 'https://example.com',
    standard: 'ada',
    generatedAt: new Date().toISOString(),
  }),
}));

vi.mock('../src/engines/deep-analyzer', () => ({
  deepAnalyze: mockDeepAnalyze,
}));

const SECRET = 'test-secret';

function proLicenseKey(): string {
  const now = Math.floor(Date.now() / 1000);
  return createLicenseKey(
    { e: 'user@test.dev', t: 'PRO', f: ['deep-analysis'], i: now, x: now + 3600 },
    SECRET,
  );
}

describe('HTTP bridge', () => {
  beforeEach(() => {
    process.env.LICENSE_SECRET = SECRET;
    delete process.env.LICENSE_KEY;
  });

  afterEach(() => {
    delete process.env.LICENSE_SECRET;
    delete process.env.LICENSE_KEY;
  });

  it('POST /health returns { status: "ok" }', async () => {
    const app = createHttpBridge(new SessionManager());
    const res = await request(app).post('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('GET /status reports the active session count', async () => {
    const sessions = new SessionManager();
    sessions.createSession({ standard: 'ada' });
    const app = createHttpBridge(sessions);

    const res = await request(app).get('/status');
    expect(res.status).toBe(200);
    expect(res.body.activeSessions).toBe(1);
  });

  it('POST /analyze without a license key returns 403', async () => {
    const app = createHttpBridge(new SessionManager());
    const res = await request(app)
      .post('/analyze')
      .send({ auditResults: { violations: [] }, standard: 'ada', pageUrl: 'https://example.com', pageHtml: '<html></html>' });

    expect(res.status).toBe(403);
  });

  it('POST /analyze with a valid license key returns structured analysis', async () => {
    const app = createHttpBridge(new SessionManager());
    const res = await request(app)
      .post('/analyze')
      .set('x-license-key', proLicenseKey())
      .send({ auditResults: { violations: [] }, standard: 'ada', pageUrl: 'https://example.com', pageHtml: '<html></html>' });

    expect(res.status).toBe(200);
    expect(res.body.summary).toBe('mocked summary');
  });

  it('forwards the x-anthropic-api-key header to deepAnalyze as anthropicApiKey', async () => {
    mockDeepAnalyze.mockClear();
    const app = createHttpBridge(new SessionManager());
    await request(app)
      .post('/analyze')
      .set('x-license-key', proLicenseKey())
      .set('x-anthropic-api-key', 'sk-ant-client-key')
      .send({ auditResults: { violations: [] }, standard: 'ada', pageUrl: 'https://example.com', pageHtml: '<html></html>' });

    expect(mockDeepAnalyze).toHaveBeenCalledWith(expect.objectContaining({ anthropicApiKey: 'sk-ant-client-key' }));
  });

  it('omits anthropicApiKey from the deepAnalyze call when no header is sent', async () => {
    mockDeepAnalyze.mockClear();
    const app = createHttpBridge(new SessionManager());
    await request(app)
      .post('/analyze')
      .set('x-license-key', proLicenseKey())
      .send({ auditResults: { violations: [] }, standard: 'ada', pageUrl: 'https://example.com', pageHtml: '<html></html>' });

    expect(mockDeepAnalyze).toHaveBeenCalledWith(expect.objectContaining({ anthropicApiKey: undefined }));
  });
});
