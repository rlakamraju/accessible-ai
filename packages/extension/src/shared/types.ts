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

// ---- Site-wide crawl + audit (Phase 2) ----

export interface CrawlConfig {
  maxPages: number;
  maxDepth: number;
  includePatterns?: string[];
  excludePatterns?: string[];
  respectRobotsTxt: boolean;
  delayMs: number;
}

export interface PageMeta {
  title: string;
  url: string;
  metaDescription?: string;
  h1Text?: string;
}

export interface CrawlProgress {
  phase: 'crawling';
  pagesVisited: number;
  pagesTotal: number;
  currentUrl: string;
  discoveredUrls: string[];
}

export interface AuditingProgress {
  phase: 'auditing';
  pagesAudited: number;
  pagesTotal: number;
  currentUrl: string;
}

export interface AggregatingProgress {
  phase: 'aggregating';
}

export interface PageScore {
  url: string;
  title: string;
  score: number;
  violationCount: number;
}

export interface CriterionAggregate {
  criterionId: string;
  criterionName: string;
  pagesAffected: string[];
  totalInstances: number;
}

export interface SiteAuditResult {
  standardId: StandardId;
  rootUrl: string;
  timestamp: string;
  siteScore: number;
  totalViolations: number;
  pageScores: PageScore[];
  byCriterion: CriterionAggregate[];
  pageResults: Record<string, ProcessedAuditResult>;
}

export interface SiteAuditCompleteProgress {
  phase: 'complete';
  result: SiteAuditResult;
}

export interface SiteAuditErrorProgress {
  phase: 'error';
  error: string;
}

export interface SiteAuditCancelledProgress {
  phase: 'cancelled';
}

export type SiteAuditProgress =
  | CrawlProgress
  | AuditingProgress
  | AggregatingProgress
  | SiteAuditCompleteProgress
  | SiteAuditErrorProgress
  | SiteAuditCancelledProgress;

export interface AuditHistoryEntry {
  id: string;
  kind: 'page' | 'site';
  url: string;
  standardId: StandardId;
  timestamp: string;
  score: number;
}
