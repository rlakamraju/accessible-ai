import type { FrameworkType, Impact, StandardId } from '@accessible-ai/standards';
import type { AccessibilityIssue } from '../../config/types.js';

export interface DetectedFramework {
  framework: FrameworkType;
  version?: string;
  uiLibrary?: string;
  hasTests: boolean;
  testFramework?: string;
  /** Whether the project already has some accessibility tooling installed (jsx-a11y, @angular-eslint, pa11y). */
  hasA11yTooling: boolean;
}

export interface ProjectConventions {
  fileNaming: 'kebab-case' | 'camelCase' | 'PascalCase' | 'mixed';
  importStyle: 'relative' | 'aliased' | 'mixed';
  existingA11yPatterns: string[];
}

export interface EslintAnalysisIssue {
  filePath: string;
  line: number;
  column: number;
  ruleId: string | null;
  message: string;
  severity: 1 | 2;
  fixable: boolean;
}

export interface EslintAnalysisResult {
  issues: EslintAnalysisIssue[];
  summary: {
    totalFiles: number;
    filesWithIssues: number;
    totalIssues: number;
    byRule: Record<string, number>;
  };
}

export interface CustomRuleIssue {
  ruleId: string;
  filePath: string;
  startLine: number;
  endLine: number;
  message: string;
  wcagCriteria: string[];
  impact: Impact;
}

export interface AnalysisConfig {
  standard: StandardId;
  include?: string[];
  exclude?: string[];
}

export interface CodebaseAnalysisResult {
  framework: DetectedFramework;
  filesAnalyzed: number;
  issues: AccessibilityIssue[];
  bySeverity: Record<Impact, number>;
  byPrinciple: Record<string, number>;
  complianceScore: number;
}
