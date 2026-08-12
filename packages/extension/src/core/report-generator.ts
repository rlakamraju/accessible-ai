import type { ComplianceScore, ProcessedAuditResult } from '../shared/types';

export interface ReportConfig {
  format: 'json' | 'markdown';
  standardName: string;
}

export function generateReport(
  result: ProcessedAuditResult,
  score: ComplianceScore,
  config: ReportConfig,
): string {
  return config.format === 'json'
    ? generateJsonReport(result, score)
    : generateMarkdownReport(result, score, config.standardName);
}

export function generateJsonReport(result: ProcessedAuditResult, score: ComplianceScore): string {
  return JSON.stringify(
    {
      tool: 'AccessibleAI',
      generatedAt: new Date().toISOString(),
      result,
      score,
    },
    null,
    2,
  );
}

export function generateMarkdownReport(
  result: ProcessedAuditResult,
  score: ComplianceScore,
  standardName: string,
): string {
  const failing = result.byCriterion.filter((c) => c.violationCount > 0);
  const passing = result.byCriterion.filter((c) => c.violationCount === 0 && c.passCount > 0);

  const lines: string[] = [
    '# Accessibility Compliance Report',
    `## Standard: ${standardName}`,
    `## Page: ${result.url}`,
    `## Date: ${result.timestamp}`,
    `## Overall Score: ${score.overallScore}%`,
    '',
    '### Executive Summary',
    `- ${result.totals.violations} violation instance(s) across ${failing.length} failing criteria`,
    `- ${score.criticalFailCount} critical, ${score.seriousFailCount} serious`,
    `- ${passing.length} criteria passed, ${failing.length} criteria failed`,
    '',
    '### Findings by WCAG Criterion',
  ];

  for (const criterion of failing) {
    lines.push(`#### ${criterion.criterionId} ${criterion.criterionName} — FAIL`);
    for (const violation of criterion.violations) {
      lines.push(`- **${violation.id}** (impact: ${violation.impact ?? 'n/a'}) — ${violation.description}`);
      lines.push(`  - Instances: ${violation.targets.length}`);
      lines.push(`  - Remediation: ${violation.helpUrl}`);
    }
    lines.push('');
  }

  lines.push('### Passed Criteria');
  for (const criterion of passing) {
    lines.push(`- ${criterion.criterionId} ${criterion.criterionName}`);
  }

  lines.push('', '### Methodology');
  lines.push('- Tool: AccessibleAI (axe-core)');
  lines.push(`- Standard: ${standardName}`);
  lines.push(`- Date: ${result.timestamp}`);

  return lines.join('\n');
}
