import type { Impact, Principle, StandardId, WcagLevel } from '@accessible-ai/standards';

export type { Impact, Principle, StandardId, WcagLevel };

export interface ViolationTarget {
  cssSelector: string;
  html: string;
  failureSummary?: string;
}

export interface ViolationNode {
  id: string; // axe-core rule id
  impact: Impact | null;
  description: string;
  help: string;
  helpUrl: string;
  criterionIds: string[];
  targets: ViolationTarget[];
}

export interface CriterionResult {
  criterionId: string;
  criterionName: string;
  level: WcagLevel;
  principle: Principle;
  violations: ViolationNode[];
  violationCount: number;
  passCount: number;
  incompleteCount: number;
  inapplicableCount: number;
}

export interface AuditTotals {
  violations: number;
  passes: number;
  incomplete: number;
  inapplicable: number;
}

export interface ProcessedAuditResult {
  standardId: StandardId;
  timestamp: string;
  url: string;
  byCriterion: CriterionResult[];
  totals: AuditTotals;
  violations: ViolationNode[];
}

export interface ComplianceScore {
  overallScore: number;
  byPrinciple: Record<Principle, number>;
  criticalFailCount: number;
  seriousFailCount: number;
}

export interface AxeRunConfig {
  tags: string[];
}
