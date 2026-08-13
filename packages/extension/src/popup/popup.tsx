import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import { resolveStandard, type StandardId } from '@accessible-ai/standards';
import { StandardPicker } from './components/StandardPicker';
import { AuditButton } from './components/AuditButton';
import { Dashboard } from './components/Dashboard';
import { ViolationList } from './components/ViolationList';
import { ReportExport } from './components/ReportExport';
import { LicenseSettings } from './components/LicenseSettings';
import { UpgradePrompt } from './components/UpgradePrompt';
import { SiteAuditButton } from './components/SiteAuditButton';
import { CrawlProgress } from './components/CrawlProgress';
import { AuditHistory } from './components/AuditHistory';
import { useAudit } from './hooks/useAudit';
import { useSiteAudit } from './hooks/useSiteAudit';
import { useMcpConnection } from './hooks/useMcpConnection';
import { useLicense } from './hooks/useLicense';
import { checkFeatureAccess, type FeatureAccessResult } from '../core/license-gate';
import { getActiveTabId, getActiveTabUrl } from '../shared/browser-tabs';
import type { HighlightSingleMessage } from '../shared/messaging';
import { DeepAnalysis } from './components/DeepAnalysis';
import { ConnectionIndicator } from './components/ConnectionIndicator';
import './styles/popup.css';

type View = 'audit' | 'settings' | 'history';

function Popup() {
  const [standard, setStandard] = useState<StandardId>('wcag-2.1-aa');
  const [view, setView] = useState<View>('audit');
  const [siteAuditAccess, setSiteAuditAccess] = useState<FeatureAccessResult | null>(null);
  const { isAuditing, results, error, startAudit } = useAudit();
  const { isConnected: isMcpConnected } = useMcpConnection();
  const { licenseStatus } = useLicense();
  const isDeepAnalysisLicensed = Boolean(
    licenseStatus?.valid && licenseStatus.features?.includes('deep-analysis'),
  );
  const {
    progress: siteProgress,
    isRunning: isSiteAuditing,
    startedAt: siteAuditStartedAt,
    startSiteAudit,
    cancelSiteAudit,
  } = useSiteAudit();

  async function handleAudit(): Promise<void> {
    await startAudit(standard);
  }

  async function handleSelectViolation(cssSelector: string): Promise<void> {
    try {
      const tabId = await getActiveTabId();
      const message: HighlightSingleMessage = { type: 'HIGHLIGHT_SINGLE', cssSelector };
      await chrome.tabs.sendMessage(tabId, message);
    } catch {
      // Best-effort — the overlay may not be injected on this page.
    }
  }

  async function handleStartSiteAudit(maxPages: number): Promise<void> {
    setSiteAuditAccess(null);
    if (maxPages > 5) {
      const access = await checkFeatureAccess('site-crawl-unlimited');
      if (!access.allowed) {
        setSiteAuditAccess(access);
        return;
      }
    }
    const rootUrl = await getActiveTabUrl();
    await startSiteAudit(rootUrl, standard, {
      maxPages,
      maxDepth: 3,
      respectRobotsTxt: true,
      delayMs: 500,
    });
  }

  const standardName = results ? resolveStandard(standard).standard.name : '';

  return (
    <div className="popup-app">
      <header className="popup-header">
        <h1>AccessibleAI</h1>
        <div className="popup-header-actions">
          <ConnectionIndicator isConnected={isMcpConnected} isLicensed={isDeepAnalysisLicensed} />
          <button
            type="button"
            className="settings-gear"
            aria-label="Audit history"
            onClick={() => setView((v) => (v === 'history' ? 'audit' : 'history'))}
          >
            🕘
          </button>
          <button
            type="button"
            className="settings-gear"
            aria-label="License settings"
            onClick={() => setView((v) => (v === 'settings' ? 'audit' : 'settings'))}
          >
            ⚙
          </button>
        </div>
      </header>

      {view === 'settings' && <LicenseSettings onClose={() => setView('audit')} />}
      {view === 'history' && <AuditHistory onClose={() => setView('audit')} />}

      {view === 'audit' && (
        <>
          <StandardPicker onStandardChange={setStandard} />
          <AuditButton isAuditing={isAuditing} onAudit={handleAudit} />

          {error && (
            <p className="audit-error" role="alert">
              {error}
            </p>
          )}

          {results && (
            <>
              <Dashboard result={results.result} score={results.score} />

              <DeepAnalysis
                result={results.result}
                isConnected={isMcpConnected}
                onOpenSettings={() => setView('settings')}
              />

              <ViolationList result={results.result} onSelectViolation={handleSelectViolation} />
              <ReportExport kind="page" result={results.result} score={results.score} standardName={standardName} />
            </>
          )}

          <SiteAuditButton isRunning={isSiteAuditing} onStart={handleStartSiteAudit} />
          {siteAuditAccess && !siteAuditAccess.allowed && (
            <UpgradePrompt
              feature="site-crawl-unlimited"
              reason={siteAuditAccess.reason}
              onOpenSettings={() => setView('settings')}
            />
          )}
          {siteProgress && (
            <CrawlProgress progress={siteProgress} startedAt={siteAuditStartedAt} onCancel={cancelSiteAudit} />
          )}
        </>
      )}
    </div>
  );
}

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(<Popup />);
}
