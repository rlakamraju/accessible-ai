import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LicenseError, mcpBridge } from '../../src/background/mcp-bridge';
import type { ProcessedAuditResult } from '../../src/shared/types';

const auditResult: ProcessedAuditResult = {
  standardId: 'ada',
  timestamp: new Date().toISOString(),
  url: 'https://example.com',
  byCriterion: [],
  totals: { violations: 1, passes: 0, incomplete: 0, inapplicable: 0 },
  violations: [
    {
      id: 'image-alt',
      impact: 'critical',
      description: 'Images must have alternate text',
      help: 'Images must have alternate text',
      helpUrl: 'https://dequeuniversity.com/rules/axe/image-alt',
      criterionIds: ['1.1.1'],
      targets: [{ cssSelector: '#logo', html: '<img id="logo">' }],
    },
  ],
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('mcpBridge', () => {
  beforeEach(async () => {
    await chrome.storage.sync.remove('licenseKey');
    await chrome.storage.sync.remove('anthropicApiKey');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('isServerAvailable returns true when /health responds ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(200, { status: 'ok' })));
    expect(await mcpBridge.isServerAvailable()).toBe(true);
  });

  it('isServerAvailable returns false when fetch throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('connection refused')));
    expect(await mcpBridge.isServerAvailable()).toBe(false);
  });

  it('getServerStatus reports unavailable when the server is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('connection refused')));
    const status = await mcpBridge.getServerStatus();
    expect(status.available).toBe(false);
    expect(status.reason).toBe('MCP server not running');
  });

  it('getServerStatus reports server details when reachable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse(200, { name: 'accessible-ai', version: '1.0.0', activeSessions: 2 })),
    );
    const status = await mcpBridge.getServerStatus();
    expect(status).toEqual({ available: true, name: 'accessible-ai', version: '1.0.0', activeSessions: 2 });
  });

  it('requestDeepAnalysis posts the adapted violation shape and forwards the license key header', async () => {
    await chrome.storage.sync.set({ licenseKey: 'AAI-PRO-fake.key' });
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        enrichedFindings: [],
        llmOnlyFindings: [],
        summary: 'ok',
        pageUrl: auditResult.url,
        standard: auditResult.standardId,
        generatedAt: new Date().toISOString(),
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await mcpBridge.requestDeepAnalysis(auditResult, '<html></html>');

    expect(result.summary).toBe('ok');
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('http://localhost:3100/analyze');
    expect(options.headers['x-license-key']).toBe('AAI-PRO-fake.key');
    const body = JSON.parse(options.body);
    expect(body.standard).toBe('ada');
    expect(body.auditResults.violations[0].nodes[0].html).toBe('<img id="logo">');
  });

  it('requestDeepAnalysis forwards the Anthropic key header only when one is stored', async () => {
    await chrome.storage.sync.set({ anthropicApiKey: 'sk-ant-client-key' });
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        enrichedFindings: [],
        llmOnlyFindings: [],
        summary: 'ok',
        pageUrl: auditResult.url,
        standard: auditResult.standardId,
        generatedAt: new Date().toISOString(),
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await mcpBridge.requestDeepAnalysis(auditResult, '<html></html>');

    const [, options] = fetchMock.mock.calls[0];
    expect(options.headers['x-anthropic-api-key']).toBe('sk-ant-client-key');
  });

  it('requestDeepAnalysis omits the Anthropic key header when none is stored', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        enrichedFindings: [],
        llmOnlyFindings: [],
        summary: 'ok',
        pageUrl: auditResult.url,
        standard: auditResult.standardId,
        generatedAt: new Date().toISOString(),
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await mcpBridge.requestDeepAnalysis(auditResult, '<html></html>');

    const [, options] = fetchMock.mock.calls[0];
    expect(options.headers).not.toHaveProperty('x-anthropic-api-key');
  });

  it('requestDeepAnalysis throws a LicenseError on a 403 response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse(403, { error: 'License required', requiredTier: 'deep-analysis' })),
    );

    await expect(mcpBridge.requestDeepAnalysis(auditResult, '<html></html>')).rejects.toThrow(LicenseError);
  });

  it('requestDeepAnalysis reports "MCP server not running" when the fetch fails outright', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('connection refused')));

    await expect(mcpBridge.requestDeepAnalysis(auditResult, '<html></html>')).rejects.toThrow(
      'MCP server not running',
    );
  });
});
