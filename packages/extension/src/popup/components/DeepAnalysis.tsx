import { useState } from 'react';
import { checkFeatureAccess } from '../../core/license-gate';
import { mcpBridge, LicenseError, type DeepAnalysisResult } from '../../background/mcp-bridge';
import { getActiveTabId } from '../../shared/browser-tabs';
import { useLicense } from '../hooks/useLicense';
import { UpgradePrompt } from './UpgradePrompt';
import { ExportToClaudeCode } from './ExportToClaudeCode';
import type { ProcessedAuditResult } from '../../shared/types';

interface DeepAnalysisProps {
  result: ProcessedAuditResult;
  isConnected: boolean;
  onOpenSettings: () => void;
}

async function capturePageHtml(): Promise<string> {
  const tabId = await getActiveTabId();
  const [injection] = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => document.documentElement.outerHTML,
  });
  return injection.result as string;
}

export function DeepAnalysis({ result, isConnected, onOpenSettings }: DeepAnalysisProps) {
  const { licenseStatus } = useLicense();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [upgradeReason, setUpgradeReason] = useState<string | undefined>(undefined);
  const [analysis, setAnalysis] = useState<DeepAnalysisResult | null>(null);

  const isLicensed = Boolean(licenseStatus?.valid && licenseStatus.features?.includes('deep-analysis'));

  async function handleClick(): Promise<void> {
    setError(null);
    setUpgradeReason(undefined);
    setAnalysis(null);

    const access = await checkFeatureAccess('deep-analysis');
    if (!access.allowed) {
      setUpgradeReason(access.reason);
      return;
    }

    setIsLoading(true);
    try {
      const pageHtml = await capturePageHtml();
      const deepResult = await mcpBridge.requestDeepAnalysis(result, pageHtml);
      setAnalysis(deepResult);
    } catch (err) {
      if (err instanceof LicenseError) {
        setUpgradeReason(err.message);
      } else {
        setError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      setIsLoading(false);
    }
  }

  if (!isConnected) {
    return (
      <div className="deep-analysis-connect" role="status">
        <p>Deep Analysis requires the AccessibleAI MCP server running locally.</p>
        <p>
          Run <code>npx @accessible-ai/mcp-server --http</code>, then reopen this popup.
        </p>
      </div>
    );
  }

  return (
    <div className="deep-analysis">
      <button type="button" className="deep-analysis-button" disabled={isLoading} onClick={() => void handleClick()}>
        {isLoading ? 'Analyzing…' : 'Deep Analysis (AI)'}
      </button>

      {!isLicensed && !isLoading && !upgradeReason && (
        <p className="deep-analysis-note">Requires a license — click to see upgrade options.</p>
      )}

      {upgradeReason && (
        <UpgradePrompt feature="deep-analysis" reason={upgradeReason} onOpenSettings={onOpenSettings} />
      )}

      {error && (
        <p className="audit-error" role="alert">
          {error}
        </p>
      )}

      {analysis && (
        <div className="deep-analysis-results">
          <p className="deep-analysis-summary">{analysis.summary}</p>
          <ul className="deep-analysis-findings">
            {analysis.enrichedFindings.map((finding) => (
              <li key={finding.criterionId}>
                <strong>
                  {finding.criterionId} — {finding.criterionName}
                </strong>
                <p>{finding.aiAnalysis}</p>
              </li>
            ))}
          </ul>
          {analysis.llmOnlyFindings.length > 0 && (
            <div className="ai-detected-issues">
              <h3>AI-Detected Issues</h3>
              <ul>
                {analysis.llmOnlyFindings.map((finding, i) => (
                  <li key={i}>{finding.description}</li>
                ))}
              </ul>
            </div>
          )}
          <ExportToClaudeCode result={result} deepAnalysis={analysis} />
        </div>
      )}
    </div>
  );
}
