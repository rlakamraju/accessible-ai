import type { FrameworkType } from '@accessible-ai/standards';
import type { AccessibilityIssue } from '../../config/types.js';

// ---- Fix plan (architecture doc section 5.3) ----

export type PrioritizeBy = 'impact' | 'effort' | 'wcag-level' | 'legal-risk';

export interface PlanConfig {
  prioritizeBy: PrioritizeBy;
  maxItems?: number;
}

export type FixType = 'auto-template' | 'llm-generated' | 'manual-guidance';

export interface FileChange {
  filePath: string;
  changeType: 'modify' | 'create' | 'delete';
  diff: string;
  description: string;
  before: string;
  after: string;
}

export interface FixItem {
  issueId: string;
  priority: number;
  issue: AccessibilityIssue;
  fix: {
    type: FixType;
    changes?: FileChange[];
    guidance?: string;
    resolvesCriteria: string[];
    resolvesIssueIds: string[];
  };
  verification: {
    rerunRules: string[];
    manualCheckDescription?: string;
  };
}

export interface FixPhase {
  phase: number;
  name: string;
  description: string;
  estimatedEffort: string;
  issues: FixItem[];
}

export interface FixPlan {
  id: string;
  standard: string;
  generatedAt: string;
  summary: {
    totalIssues: number;
    autoFixable: number;
    llmAssisted: number;
    manualReview: number;
    estimatedTotalEffort: string;
    complianceScoreBefore: number;
    projectedScoreAfter: number;
  };
  phases: FixPhase[];
}

// ---- Apply fix (architecture doc section 5.5) ----

export type ApplyFixMode = 'single' | 'phase' | 'all-auto';

export interface AppliedFixEntry {
  fixId: string;
  filePath: string;
  diff: string;
  description: string;
  status: 'applied' | 'skipped' | 'failed';
  failureReason?: string;
}

export interface ApplyFixResult {
  applied: AppliedFixEntry[];
  summary: {
    totalAttempted: number;
    successfullyApplied: number;
    skipped: number;
    failed: number;
  };
  verification: {
    issuesResolvedCount: number;
    issuesRemainingCount: number;
    newIssuesIntroduced: number;
    complianceScoreBefore: number;
    complianceScoreAfter: number;
  };
  warnings: string[];
  dryRunNote?: string;
}

/** Persisted per applied fix so `rollback_fix`/`get_fix_history` can restore original content and show history. */
export interface AppliedFix {
  fixId: string;
  issueId: string;
  ruleId: string;
  filePath: string;
  before: string;
  after: string;
  diff: string;
  description: string;
  status: 'applied' | 'skipped' | 'failed' | 'rolled-back';
  failureReason?: string;
  appliedAt: string;
}

// ---- Verification (architecture doc section 5.6) ----

export type VerificationLevel = 'static-only' | 'static-and-runtime';

export interface RegressionEntry {
  filePath: string;
  newIssue: string;
  introducedByFixId: string;
  suggestion: string;
}

export interface VerificationResult {
  fixes: Array<{
    fixId: string;
    issueId: string;
    status: 'resolved' | 'partially-resolved' | 'unresolved' | 'regression';
    details: string;
  }>;
  complianceDelta: {
    before: { score: number; violations: number; standard: string };
    after: { score: number; violations: number; standard: string };
    improvement: string;
  };
  regressions: RegressionEntry[];
  commitMessage: string;
  /** Deviations from the requested verification level (e.g. runtime re-verification unavailable) surface here rather than as an error. */
  notes?: string[];
}

// ---- LLM fix generation (architecture doc section 5.4, Level 2) ----

export interface ProjectContext {
  framework: FrameworkType;
  frameworkVersion?: string;
  uiLibrary?: string;
  namingConvention: 'kebab-case' | 'camelCase' | 'PascalCase' | 'mixed';
  hasTests: boolean;
  existingA11yImports: string[];
  relatedFiles: string[];
}

export interface ManualReviewGuidance {
  issueId: string;
  title: string;
  wcagCriteria: string[];
  steps: Array<{ description: string; filePath?: string; codeExample?: string; testInstructions?: string }>;
  referencePattern?: { description: string; code: string; source: string };
}
