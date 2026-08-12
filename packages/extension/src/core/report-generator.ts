import type { ComplianceScore, ProcessedAuditResult, SiteAuditResult } from '../shared/types';

export type ReportFormat = 'json' | 'markdown' | 'html';

export interface ReportConfig {
  format: ReportFormat;
  standardName: string;
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function reportStyles(): string {
  return `
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1f2937; max-width: 900px; margin: 0 auto; padding: 24px; }
    h1 { font-size: 22px; } h2 { font-size: 17px; margin-top: 28px; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; }
    .subtitle { color: #6b7280; font-size: 13px; }
    .score-banner { display: inline-block; padding: 8px 16px; border-radius: 8px; background: #eef2ff; color: #4338ca; font-weight: 700; font-size: 18px; margin: 8px 0; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 600; color: #fff; }
    .badge.fail { background: #dc2626; }
    .impact-critical { background: #dc2626; } .impact-serious { background: #ea580c; }
    .impact-moderate { background: #ca8a04; } .impact-minor { background: #2563eb; } .impact-unknown { background: #6b7280; }
    details.criterion { border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px 14px; margin-bottom: 10px; }
    details.criterion summary { cursor: pointer; font-weight: 600; }
    .violation { margin: 8px 0; padding-top: 8px; border-top: 1px solid #f3f4f6; }
    .violation .meta { font-size: 12px; color: #6b7280; }
    table { border-collapse: collapse; width: 100%; margin: 12px 0; }
    th, td { border: 1px solid #e5e7eb; padding: 6px 10px; font-size: 13px; text-align: left; }
    th { background: #f9fafb; }
    @media print { body { padding: 0; } details.criterion { break-inside: avoid; } }
  `;
}

// ---- Single-page reports ----

export function generateReport(result: ProcessedAuditResult, score: ComplianceScore, config: ReportConfig): string {
  if (config.format === 'json') return generateJsonReport(result, score);
  if (config.format === 'html') return generateHtmlReport(result, score, config.standardName);
  return generateMarkdownReport(result, score, config.standardName);
}

export function generateJsonReport(result: ProcessedAuditResult, score: ComplianceScore): string {
  return JSON.stringify({ tool: 'AccessibleAI', generatedAt: new Date().toISOString(), result, score }, null, 2);
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

export function generateHtmlReport(
  result: ProcessedAuditResult,
  score: ComplianceScore,
  standardName: string,
): string {
  const failing = result.byCriterion.filter((c) => c.violationCount > 0);
  const passing = result.byCriterion.filter((c) => c.violationCount === 0 && c.passCount > 0);

  const findings = failing
    .map(
      (criterion) => `
    <details class="criterion" open>
      <summary>${escapeHtml(criterion.criterionId)} ${escapeHtml(criterion.criterionName)} — <span class="badge fail">FAIL</span></summary>
      ${criterion.violations
        .map(
          (violation) => `
        <div class="violation">
          <span class="badge impact-${violation.impact ?? 'unknown'}">${violation.impact ?? 'n/a'}</span>
          <strong>${escapeHtml(violation.id)}</strong> — ${escapeHtml(violation.description)}
          <div class="meta">Instances: ${violation.targets.length} &middot; <a href="${escapeHtml(violation.helpUrl)}">Remediation</a></div>
        </div>`,
        )
        .join('')}
    </details>`,
    )
    .join('');

  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8" /><title>Accessibility Compliance Report</title><style>${reportStyles()}</style></head>
<body>
  <h1>Accessibility Compliance Report</h1>
  <p class="subtitle">Standard: ${escapeHtml(standardName)} &middot; Page: ${escapeHtml(result.url)} &middot; Date: ${escapeHtml(result.timestamp)}</p>
  <div class="score-banner">Overall Score: ${score.overallScore}%</div>
  <h2>Executive Summary</h2>
  <ul>
    <li>${result.totals.violations} violation instance(s) across ${failing.length} failing criteria</li>
    <li>${score.criticalFailCount} critical, ${score.seriousFailCount} serious</li>
    <li>${passing.length} criteria passed, ${failing.length} criteria failed</li>
  </ul>
  <h2>Findings by WCAG Criterion</h2>
  ${findings || '<p>No failing criteria.</p>'}
  <h2>Passed Criteria</h2>
  <ul>${passing.map((c) => `<li>${escapeHtml(c.criterionId)} ${escapeHtml(c.criterionName)}</li>`).join('')}</ul>
  <h2>Methodology</h2>
  <ul>
    <li>Tool: AccessibleAI (axe-core)</li>
    <li>Standard: ${escapeHtml(standardName)}</li>
    <li>Date: ${escapeHtml(result.timestamp)}</li>
  </ul>
</body>
</html>`;
}

// ---- Site-wide reports ----

export function generateSiteReport(result: SiteAuditResult, config: ReportConfig): string {
  if (config.format === 'json') return generateSiteJsonReport(result);
  if (config.format === 'html') return generateSiteHtmlReport(result, config.standardName);
  return generateSiteMarkdownReport(result, config.standardName);
}

export function generateSiteJsonReport(result: SiteAuditResult): string {
  return JSON.stringify({ tool: 'AccessibleAI', generatedAt: new Date().toISOString(), result }, null, 2);
}

export function generateSiteMarkdownReport(result: SiteAuditResult, standardName: string): string {
  const lines: string[] = [
    '# Accessibility Compliance Report',
    `## Standard: ${standardName}`,
    `## Site: ${result.rootUrl}`,
    `## Date: ${result.timestamp}`,
    `## Overall Score: ${result.siteScore}%`,
    '',
    '### Executive Summary',
    `- ${result.pageScores.length} page(s) audited`,
    `- ${result.totalViolations} violation instance(s) found`,
    `- ${result.byCriterion.length} WCAG criteria failed on at least one page`,
    '',
    '### Findings by WCAG Criterion',
  ];

  for (const criterion of result.byCriterion) {
    lines.push(`#### ${criterion.criterionId} ${criterion.criterionName} — FAIL`);
    lines.push(`- Pages affected: ${criterion.pagesAffected.length}`);
    lines.push(`- Instances: ${criterion.totalInstances}`);
    lines.push('');
  }

  lines.push('### Pages Breakdown');
  lines.push('| Page | Score | Violations |', '| --- | --- | --- |');
  for (const page of result.pageScores) {
    lines.push(`| ${page.title} (${page.url}) | ${page.score}% | ${page.violationCount} |`);
  }

  lines.push('', '### Methodology');
  lines.push('- Tool: AccessibleAI (axe-core)');
  lines.push(`- Standard: ${standardName}`);
  lines.push(`- Date: ${result.timestamp}`);
  lines.push(`- Pages audited: ${result.pageScores.length}`);

  return lines.join('\n');
}

export function generateSiteHtmlReport(result: SiteAuditResult, standardName: string): string {
  const findings = result.byCriterion
    .map(
      (criterion) => `
    <details class="criterion" open>
      <summary>${escapeHtml(criterion.criterionId)} ${escapeHtml(criterion.criterionName)} — <span class="badge fail">FAIL</span></summary>
      <div class="violation">
        <div class="meta">Pages affected: ${criterion.pagesAffected.length} &middot; Instances: ${criterion.totalInstances}</div>
      </div>
    </details>`,
    )
    .join('');

  const rows = result.pageScores
    .map(
      (page) =>
        `<tr><td>${escapeHtml(page.title)}<br /><small>${escapeHtml(page.url)}</small></td><td>${page.score}%</td><td>${page.violationCount}</td></tr>`,
    )
    .join('');

  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8" /><title>Site Accessibility Compliance Report</title><style>${reportStyles()}</style></head>
<body>
  <h1>Accessibility Compliance Report</h1>
  <p class="subtitle">Standard: ${escapeHtml(standardName)} &middot; Site: ${escapeHtml(result.rootUrl)} &middot; Date: ${escapeHtml(result.timestamp)}</p>
  <div class="score-banner">Overall Score: ${result.siteScore}%</div>
  <h2>Executive Summary</h2>
  <ul>
    <li>${result.pageScores.length} page(s) audited</li>
    <li>${result.totalViolations} violation instance(s) found</li>
    <li>${result.byCriterion.length} WCAG criteria failed on at least one page</li>
  </ul>
  <h2>Findings by WCAG Criterion</h2>
  ${findings || '<p>No failing criteria.</p>'}
  <h2>Pages Breakdown</h2>
  <table><thead><tr><th>Page</th><th>Score</th><th>Violations</th></tr></thead><tbody>${rows}</tbody></table>
  <h2>Methodology</h2>
  <ul>
    <li>Tool: AccessibleAI (axe-core)</li>
    <li>Standard: ${escapeHtml(standardName)}</li>
    <li>Date: ${escapeHtml(result.timestamp)}</li>
    <li>Pages audited: ${result.pageScores.length}</li>
  </ul>
</body>
</html>`;
}
