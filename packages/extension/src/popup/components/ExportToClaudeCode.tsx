import { useState } from 'react';
import { toWireViolations, type DeepAnalysisResult } from '../../background/mcp-bridge';
import type { ProcessedAuditResult } from '../../shared/types';

interface ExportToClaudeCodeProps {
  result: ProcessedAuditResult;
  deepAnalysis: DeepAnalysisResult;
}

const EXPORT_VERSION = '1.0';
const MAX_DOM_SNAPSHOT_CHARS = 500_000;

export function ExportToClaudeCode({ result, deepAnalysis }: ExportToClaudeCodeProps) {
  const [savedPath, setSavedPath] = useState<string | null>(null);

  async function handleExport(): Promise<void> {
    const domSnapshot = await captureDomSnapshot();
    const payload = {
      version: EXPORT_VERSION,
      exportedAt: new Date().toISOString(),
      source: 'chrome-extension' as const,
      pageUrl: result.url,
      standard: result.standardId,
      axeResults: { violations: toWireViolations(result.violations) },
      deepAnalysis,
      domSnapshot: domSnapshot && domSnapshot.length <= MAX_DOM_SNAPSHOT_CHARS ? domSnapshot : undefined,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    chrome.downloads.download({ url, filename: '.accessible-ai/audit-results.json', saveAs: true }, () => {
      URL.revokeObjectURL(url);
      setSavedPath('.accessible-ai/audit-results.json');
    });
  }

  async function captureDomSnapshot(): Promise<string | undefined> {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) return undefined;
      const [injection] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => document.documentElement.outerHTML,
      });
      return injection.result as string;
    } catch {
      return undefined;
    }
  }

  return (
    <div className="export-to-claude-code">
      <button type="button" onClick={() => void handleExport()}>
        Export for Claude Code
      </button>
      {savedPath && (
        <p className="export-instructions">
          Open your project in Claude Code and say: "Import the accessibility audit from{' '}
          <code>{savedPath}</code> and fix the issues."
        </p>
      )}
    </div>
  );
}
