import { createRoot } from 'react-dom/client';
import { useState, type CSSProperties } from 'react';
import { resolveStandard } from '@accessible-ai/standards';
import { ViolationList } from '../popup/components/ViolationList';
import { CrawlProgress } from '../popup/components/CrawlProgress';
import { ReportExport } from '../popup/components/ReportExport';
import { PageTable } from './components/PageTable';
import { CrossSiteIssues } from './components/CrossSiteIssues';
import { useSiteAuditProgress } from './hooks/useSiteAuditProgress';
import { sendMessage } from '../shared/messaging';
import type { CancelSiteAuditMessage } from '../shared/messaging';
import './styles/sidepanel.css';

function scoreColor(score: number): string {
  if (score < 50) return '#dc2626';
  if (score < 80) return '#d97706';
  return '#16a34a';
}

function openPage(url: string): void {
  chrome.tabs.create({ url });
}

async function cancelSiteAudit(): Promise<void> {
  const message: CancelSiteAuditMessage = { type: 'CANCEL_SITE_AUDIT' };
  await sendMessage(message);
}

function SidePanel() {
  const progress = useSiteAuditProgress();
  const [selectedUrl, setSelectedUrl] = useState<string | null>(null);

  if (!progress) {
    return (
      <div className="sidepanel-app">
        <h1>AccessibleAI — Site Report</h1>
        <p className="empty-state">
          No site audit has run yet. Start one from the extension popup with "Audit Entire Site".
        </p>
      </div>
    );
  }

  if (progress.phase !== 'complete') {
    return (
      <div className="sidepanel-app">
        <h1>AccessibleAI — Site Report</h1>
        <CrawlProgress progress={progress} startedAt={null} onCancel={cancelSiteAudit} />
      </div>
    );
  }

  const { result } = progress;
  const selectedPage = selectedUrl ? result.pageResults[selectedUrl] : undefined;
  const standardName = resolveStandard(result.standardId).standard.name;
  const gaugeStyle = {
    '--gauge-color': scoreColor(result.siteScore),
    '--gauge-value': result.siteScore,
  } as CSSProperties;

  return (
    <div className="sidepanel-app">
      <h1>AccessibleAI — Site Report</h1>

      <div className="site-summary">
        <div className="score-gauge" style={gaugeStyle}>
          <div className="score-gauge-inner">
            <span className="score-value">{result.siteScore}</span>
            <span className="score-label">Site score</span>
          </div>
        </div>
        <div className="site-summary-meta">
          <p>
            <strong>Site:</strong> {result.rootUrl}
          </p>
          <p>
            <strong>Standard:</strong> {standardName}
          </p>
          <p>
            <strong>Pages audited:</strong> {result.pageScores.length}
          </p>
          <p>
            <strong>Total violations:</strong> {result.totalViolations}
          </p>
        </div>
      </div>

      <ReportExport kind="site" result={result} standardName={standardName} />

      <h2>Pages</h2>
      <PageTable pages={result.pageScores} selectedUrl={selectedUrl} onSelect={setSelectedUrl} />

      {selectedPage && (
        <div className="selected-page-panel">
          <div className="selected-page-header">
            <h2>{selectedUrl}</h2>
            <button type="button" className="link-button" onClick={() => selectedUrl && openPage(selectedUrl)}>
              Open page
            </button>
          </div>
          {/* Crawl tabs are closed once the site audit completes, so live in-page highlighting
              isn't available here — selecting a violation opens the page instead. */}
          <ViolationList result={selectedPage} onSelectViolation={() => selectedUrl && openPage(selectedUrl)} />
        </div>
      )}

      <h2>Cross-Site Issues</h2>
      <CrossSiteIssues criteria={result.byCriterion} />
    </div>
  );
}

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(<SidePanel />);
}
