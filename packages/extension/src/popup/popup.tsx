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
import { useAudit } from './hooks/useAudit';
import { checkFeatureAccess, type FeatureAccessResult } from '../core/license-gate';
import { getActiveTabId } from '../shared/browser-tabs';
import type { HighlightSingleMessage } from '../shared/messaging';
import './styles/popup.css';

function Popup() {
  const [standard, setStandard] = useState<StandardId>('wcag-2.1-aa');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [deepAnalysisAccess, setDeepAnalysisAccess] = useState<FeatureAccessResult | null>(null);
  const { isAuditing, results, error, startAudit } = useAudit();

  async function handleAudit(): Promise<void> {
    setDeepAnalysisAccess(null);
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

  async function handleDeepAnalysisClick(): Promise<void> {
    const access = await checkFeatureAccess('deep-analysis');
    setDeepAnalysisAccess(access);
  }

  const standardName = results ? resolveStandard(standard).standard.name : '';

  return (
    <div className="popup-app">
      <header className="popup-header">
        <h1>AccessibleAI</h1>
        <button
          type="button"
          className="settings-gear"
          aria-label="License settings"
          onClick={() => setSettingsOpen((v) => !v)}
        >
          ⚙
        </button>
      </header>

      {settingsOpen ? (
        <LicenseSettings onClose={() => setSettingsOpen(false)} />
      ) : (
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

              <button type="button" className="deep-analysis-button" onClick={handleDeepAnalysisClick}>
                Deep Analysis (AI)
              </button>
              {deepAnalysisAccess && !deepAnalysisAccess.allowed && (
                <UpgradePrompt
                  feature="deep-analysis"
                  reason={deepAnalysisAccess.reason}
                  onOpenSettings={() => setSettingsOpen(true)}
                />
              )}
              {deepAnalysisAccess?.allowed && (
                <p className="deep-analysis-note">
                  Deep Analysis is unlocked — the MCP server bridge that powers it ships in Phase 3.
                </p>
              )}

              <ViolationList result={results.result} onSelectViolation={handleSelectViolation} />
              <ReportExport result={results.result} score={results.score} standardName={standardName} />
            </>
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
