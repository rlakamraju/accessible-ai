import type { FrameworkType, Impact, ResolvedStandard, StandardId } from '@accessible-ai/standards';
import type { CodebaseAnalysisResult } from '../engines/static-analyzer/types.js';

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
  codebaseResult?: CodebaseAnalysisResult;
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

// ---- Unified issue format (Phase 4/5, architecture doc section 5.2) ----

export interface SourceLocation {
  filePath: string;
  startLine: number;
  endLine: number;
  column?: number;
  framework: FrameworkType;
  componentName?: string;
}

export interface CodeSnippet {
  before: string;
  violating: string;
  after: string;
}

export interface RuntimeContext {
  pageUrl: string;
  cssSelector: string;
  renderedHtml: string;
  screenshot?: string;
}

export type AutomationLevel = 'auto' | 'llm-assisted' | 'manual-review';
export type EstimatedEffort = 'trivial' | 'small' | 'medium' | 'large';

export interface RemediationMetadata {
  automationLevel: AutomationLevel;
  fixTemplateId?: string;
  estimatedEffort: EstimatedEffort;
  groupId?: string;
}

/** Both runtime (axe-core) and static (ESLint/AST) findings are normalized into this shape before entering remediation. */
export interface AccessibilityIssue {
  id: string;
  source: 'runtime' | 'static';
  wcagCriteria: string[];
  standard: string;
  impact: Impact;
  ruleId: string;
  description: string;
  helpUrl: string;
  sourceLocation: SourceLocation;
  codeSnippet: CodeSnippet;
  runtimeContext?: RuntimeContext;
  remediation: RemediationMetadata;
}

export type { CodebaseAnalysisResult };
