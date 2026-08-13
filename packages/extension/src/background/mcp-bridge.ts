import type { ProcessedAuditResult, ViolationNode } from '../shared/types';

const MCP_LOCAL_URL = 'http://localhost:3100';
const ANALYSIS_TIMEOUT_MS = 60_000;
const HEALTH_TIMEOUT_MS = 3_000;

export class LicenseError extends Error {
  constructor(
    message: string,
    public readonly requiredTier?: string,
  ) {
    super(message);
    this.name = 'LicenseError';
  }
}

export interface ServerStatus {
  available: boolean;
  reason?: string;
  name?: string;
  version?: string;
  activeSessions?: number;
}

export interface DeepFinding {
  criterionId: string;
  criterionName: string;
  ruleId: string;
  impact: string;
  instanceCount: number;
  aiAnalysis: string;
}

export interface LlmOnlyFinding {
  category: string;
  description: string;
  severity: string;
}

export interface DeepAnalysisResult {
  enrichedFindings: DeepFinding[];
  llmOnlyFindings: LlmOnlyFinding[];
  summary: string;
  pageUrl: string;
  standard: string;
  generatedAt: string;
}

interface WireViolation {
  id: string;
  impact: string | null;
  description: string;
  help: string;
  helpUrl: string;
  tags: string[];
  nodes: Array<{ target: string[]; html: string; failureSummary?: string }>;
}

/** Adapts the extension's processed violation shape to the wire format the MCP server's deep-analyzer expects. */
export function toWireViolations(violations: ViolationNode[]): WireViolation[] {
  return violations.map((v) => ({
    id: v.id,
    impact: v.impact,
    description: v.description,
    help: v.help,
    helpUrl: v.helpUrl,
    tags: v.criterionIds,
    nodes: v.targets.map((t) => ({ target: [t.cssSelector], html: t.html, failureSummary: t.failureSummary })),
  }));
}

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function getLicenseKey(): Promise<string | undefined> {
  const stored = await chrome.storage.sync.get('licenseKey');
  return stored.licenseKey as string | undefined;
}

async function getAnthropicKey(): Promise<string | undefined> {
  const stored = await chrome.storage.sync.get('anthropicApiKey');
  return stored.anthropicApiKey as string | undefined;
}

async function isServerAvailable(): Promise<boolean> {
  try {
    const response = await fetchWithTimeout(`${MCP_LOCAL_URL}/health`, { method: 'POST' }, HEALTH_TIMEOUT_MS);
    return response.ok;
  } catch {
    return false;
  }
}

async function getServerStatus(): Promise<ServerStatus> {
  try {
    const response = await fetchWithTimeout(`${MCP_LOCAL_URL}/status`, { method: 'GET' }, HEALTH_TIMEOUT_MS);
    if (!response.ok) return { available: false, reason: 'MCP server not running' };
    const status = await response.json();
    return { available: true, ...status };
  } catch {
    return { available: false, reason: 'MCP server not running' };
  }
}

async function requestDeepAnalysis(result: ProcessedAuditResult, pageHtml: string): Promise<DeepAnalysisResult> {
  const [licenseKey, anthropicApiKey] = await Promise.all([getLicenseKey(), getAnthropicKey()]);
  const body = {
    auditResults: { violations: toWireViolations(result.violations) },
    standard: result.standardId,
    pageUrl: result.url,
    pageHtml,
  };

  let response: Response;
  try {
    response = await fetchWithTimeout(
      `${MCP_LOCAL_URL}/analyze`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(licenseKey ? { 'x-license-key': licenseKey } : {}),
          ...(anthropicApiKey ? { 'x-anthropic-api-key': anthropicApiKey } : {}),
        },
        body: JSON.stringify(body),
      },
      ANALYSIS_TIMEOUT_MS,
    );
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('Deep analysis timed out after 60 seconds');
    }
    throw new Error('MCP server not running');
  }

  if (response.status === 403) {
    const error = await response.json();
    throw new LicenseError(error.message ?? error.error ?? 'License required', error.requiredTier);
  }

  if (!response.ok) {
    throw new Error(`Deep analysis failed: ${response.status}`);
  }

  return response.json();
}

export const mcpBridge = { isServerAvailable, requestDeepAnalysis, getServerStatus };
