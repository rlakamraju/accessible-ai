import type { StandardId } from '@accessible-ai/standards';
import type { AccessibilityIssue, CodebaseAnalysisResult } from '../../config/types.js';

export type ReportFormat = 'json' | 'markdown' | 'html';
export type ReportGroupBy = 'criterion' | 'page' | 'severity' | 'component';

export interface ReportConfig {
  format: ReportFormat;
  groupBy: ReportGroupBy;
  standard: StandardId;
}

function groupKeyFor(issue: AccessibilityIssue, groupBy: ReportGroupBy): string {
  switch (groupBy) {
    case 'criterion':
      return issue.wcagCriteria[0] ?? 'Unmapped';
    case 'severity':
      return issue.impact;
    case 'component':
    case 'page': // Static analysis has no runtime "page" concept — group by source file instead.
      return issue.sourceLocation.componentName || issue.sourceLocation.filePath;
    default:
      return 'All';
  }
}

function groupIssues(issues: AccessibilityIssue[], groupBy: ReportGroupBy): Map<string, AccessibilityIssue[]> {
  const groups = new Map<string, AccessibilityIssue[]>();
  for (const issue of issues) {
    const key = groupKeyFor(issue, groupBy);
    const list = groups.get(key) ?? [];
    list.push(issue);
    groups.set(key, list);
  }
  return groups;
}

export function generateReport(result: CodebaseAnalysisResult, config: ReportConfig): string {
  switch (config.format) {
    case 'json':
      return generateJsonReport(result, config);
    case 'html':
      return generateHtmlReport(result, config);
    case 'markdown':
    default:
      return generateMarkdownReport(result, config);
  }
}

function generateJsonReport(result: CodebaseAnalysisResult, config: ReportConfig): string {
  return JSON.stringify({ standard: config.standard, generatedAt: new Date().toISOString(), ...result }, null, 2);
}

function generateMarkdownReport(result: CodebaseAnalysisResult, config: ReportConfig): string {
  const generatedAt = new Date().toISOString();
  const groups = groupIssues(result.issues, config.groupBy);

  const lines: string[] = [
    '# Accessibility Compliance Report',
    `## Standard: ${config.standard}`,
    `## Framework: ${result.framework.framework}${result.framework.version ? ` ${result.framework.version}` : ''}`,
    `## Date: ${generatedAt}`,
    `## Overall Score: ${result.complianceScore}%`,
    '',
    '### Executive Summary',
    `- ${result.filesAnalyzed} files analyzed`,
    `- ${result.issues.length} issues found (${result.bySeverity.critical} critical, ${result.bySeverity.serious} serious, ${result.bySeverity.moderate} moderate, ${result.bySeverity.minor} minor)`,
    '',
    `### Findings by ${config.groupBy}`,
  ];

  for (const [group, issues] of groups) {
    lines.push(`#### ${group} (${issues.length})`);
    for (const issue of issues) {
      lines.push(`- **${issue.ruleId}** — ${issue.description}`);
      lines.push(`  - Impact: ${issue.impact}`);
      lines.push(`  - Location: ${issue.sourceLocation.filePath}:${issue.sourceLocation.startLine}`);
      if (issue.helpUrl) lines.push(`  - [Rule documentation](${issue.helpUrl})`);
    }
    lines.push('');
  }

  lines.push('### Methodology');
  lines.push('- Tool: AccessibleAI static analyzer (framework-aware ESLint a11y rules + custom structural checks)');
  lines.push(`- Standard: ${config.standard}`);
  lines.push(`- Date: ${generatedAt}`);
  lines.push(`- Files analyzed: ${result.filesAnalyzed}`);

  return lines.join('\n');
}

const HTML_ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch] ?? ch);
}

const SEVERITY_COLOR: Record<string, string> = { critical: '#b91c1c', serious: '#c2410c', moderate: '#b45309', minor: '#0369a1' };

function generateHtmlReport(result: CodebaseAnalysisResult, config: ReportConfig): string {
  const generatedAt = new Date().toISOString();
  const groups = groupIssues(result.issues, config.groupBy);

  const sections = Array.from(groups.entries())
    .map(([group, issues]) => {
      const items = issues
        .map(
          (issue) => `
              <li>
                <span class="badge" style="background:${SEVERITY_COLOR[issue.impact] ?? '#555'}">${issue.impact}</span>
                <strong>${escapeHtml(issue.ruleId)}</strong> — ${escapeHtml(issue.description)}<br/>
                <code>${escapeHtml(issue.sourceLocation.filePath)}:${issue.sourceLocation.startLine}</code>
              </li>`,
        )
        .join('');
      return `
        <section>
          <h3>${escapeHtml(group)} (${issues.length})</h3>
          <ul>${items}</ul>
        </section>`;
    })
    .join('');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Accessibility Compliance Report</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 900px; margin: 2rem auto; color: #1f2937; }
  h1 { font-size: 1.5rem; }
  .badge { display: inline-block; color: #fff; font-size: 0.75rem; padding: 0.1rem 0.5rem; border-radius: 0.25rem; margin-right: 0.5rem; }
  section { margin-bottom: 1.5rem; }
  code { background: #f3f4f6; padding: 0.1rem 0.3rem; border-radius: 0.2rem; }
  @media print { body { margin: 0; } }
</style>
</head>
<body>
  <h1>Accessibility Compliance Report</h1>
  <p><strong>Standard:</strong> ${escapeHtml(config.standard)} &middot; <strong>Framework:</strong> ${escapeHtml(result.framework.framework)}${
    result.framework.version ? ` ${escapeHtml(result.framework.version)}` : ''
  } &middot; <strong>Date:</strong> ${generatedAt}</p>
  <p><strong>Overall Score:</strong> ${result.complianceScore}%</p>
  <p>${result.filesAnalyzed} files analyzed &middot; ${result.issues.length} issues found (${result.bySeverity.critical} critical, ${result.bySeverity.serious} serious, ${result.bySeverity.moderate} moderate, ${result.bySeverity.minor} minor)</p>
  ${sections}
</body>
</html>`;
}
