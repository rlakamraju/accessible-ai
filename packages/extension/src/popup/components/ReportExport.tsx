import {
  generateHtmlReport,
  generateJsonReport,
  generateMarkdownReport,
  generateSiteHtmlReport,
  generateSiteJsonReport,
  generateSiteMarkdownReport,
  type ReportFormat,
} from '../../core/report-generator';
import type { ComplianceScore, ProcessedAuditResult, SiteAuditResult } from '../../shared/types';

type ReportExportProps =
  | { kind: 'page'; result: ProcessedAuditResult; score: ComplianceScore; standardName: string }
  | { kind: 'site'; result: SiteAuditResult; standardName: string };

const FORMATS: { format: ReportFormat; label: string; mime: string; ext: string }[] = [
  { format: 'json', label: 'JSON', mime: 'application/json', ext: 'json' },
  { format: 'markdown', label: 'Markdown', mime: 'text/markdown', ext: 'md' },
  { format: 'html', label: 'HTML', mime: 'text/html', ext: 'html' },
];

function buildReport(props: ReportExportProps, format: ReportFormat): string {
  if (props.kind === 'page') {
    if (format === 'json') return generateJsonReport(props.result, props.score);
    if (format === 'html') return generateHtmlReport(props.result, props.score, props.standardName);
    return generateMarkdownReport(props.result, props.score, props.standardName);
  }
  if (format === 'json') return generateSiteJsonReport(props.result);
  if (format === 'html') return generateSiteHtmlReport(props.result, props.standardName);
  return generateSiteMarkdownReport(props.result, props.standardName);
}

export function ReportExport(props: ReportExportProps) {
  function handleExport(format: ReportFormat, mime: string, ext: string): void {
    const content = buildReport(props, format);

    if (format === 'html') {
      // Preview HTML reports in a new tab rather than downloading them immediately.
      chrome.tabs.create({ url: `data:text/html;charset=utf-8,${encodeURIComponent(content)}` });
      return;
    }

    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const filename = `accessible-ai-report-${Date.now()}.${ext}`;
    chrome.downloads.download({ url, filename, saveAs: true }, () => {
      URL.revokeObjectURL(url);
    });
  }

  return (
    <div className="report-export">
      <span className="report-export-label">Export Report:</span>
      {FORMATS.map(({ format, label, mime, ext }) => (
        <button key={format} type="button" onClick={() => handleExport(format, mime, ext)}>
          {label}
        </button>
      ))}
    </div>
  );
}
