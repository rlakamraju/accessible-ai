import type { ResolvedStandard, StandardId } from '@accessible-ai/standards';

export interface AuditConfig {
  standard: StandardId;
  customRules?: string[];
  excludeRules?: string[];
}

export interface AuditSession {
  id: string;
  config: AuditConfig;
  createdAt: number;
  resolvedStandard?: ResolvedStandard;
  deepAnalysis?: DeepAnalysisResult;
  importedViolations?: AxeViolation[];
}

// ---- Deep analysis (Task 3.3) ----

export interface AxeViolationNode {
  target: string[];
  html: string;
  failureSummary?: string;
}

export interface AxeViolation {
  id: string;
  impact: 'critical' | 'serious' | 'moderate' | 'minor' | null;
  description: string;
  help: string;
  helpUrl: string;
  tags: string[];
  nodes: AxeViolationNode[];
}

export interface DeepAnalysisRequest {
  sessionId?: string;
  auditResults: { violations: AxeViolation[] };
  standard: StandardId;
  pageUrl: string;
  pageHtml: string;
  /** Per-request Anthropic key (bring-your-own), forwarded from the extension's `x-anthropic-api-key` header. Falls back to this server's `ANTHROPIC_API_KEY` env var when omitted. */
  anthropicApiKey?: string;
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
  category: 'alt-text-quality' | 'heading-logic' | 'aria-completeness';
  description: string;
  severity: 'critical' | 'serious' | 'moderate' | 'minor';
}

export interface DeepAnalysisResult {
  enrichedFindings: DeepFinding[];
  llmOnlyFindings: LlmOnlyFinding[];
  summary: string;
  pageUrl: string;
  standard: StandardId;
  generatedAt: string;
}
