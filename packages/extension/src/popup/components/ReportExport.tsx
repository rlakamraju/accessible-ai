import { generateReport } from '../../core/report-generator';
import type { ComplianceScore, ProcessedAuditResult } from '../../shared/types';

interface ReportExportProps {
  result: ProcessedAuditResult;
  score: ComplianceScore;
  standardName: string;
}

const FORMATS: { format: 'json' | 'markdown'; label: string; mime: string; ext: string }[] = [
  { format: 'json', label: 'JSON', mime: 'application/json', ext: 'json' },
  { format: 'markdown', label: 'Markdown', mime: 'text/markdown', ext: 'md' },
];

export function ReportExport({ result, score, standardName }: ReportExportProps) {
  function handleExport(format: 'json' | 'markdown', mime: string, ext: string): void {
    const content = generateReport(result, score, { format, standardName });
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
