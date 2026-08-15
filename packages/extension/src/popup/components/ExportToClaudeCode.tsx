import { useState } from 'react';
import { toWireViolations, type DeepAnalysisResult } from '../../background/mcp-bridge';
import { toBase64 } from '../../shared/base64';
import type { ProcessedAuditResult } from '../../shared/types';

interface ExportToClaudeCodeProps {
  result: ProcessedAuditResult;
  deepAnalysis: DeepAnalysisResult;
}

const EXPORT_VERSION = '1.0';
const MAX_DOM_SNAPSHOT_CHARS = 500_000;
// chrome.downloads.download() rejects any suggested filename with a path segment starting with
// a dot ("Invalid filename") — and a relative filename only ever resolves against the browser's
// configured Downloads directory anyway, never an arbitrary project folder. saveAs: true is what
// actually lets the user redirect it to their project's .accessible-ai/ folder in the dialog.
const SUGGESTED_FILENAME = 'audit-results.json';
const PROJECT_RELATIVE_PATH = '.accessible-ai/audit-results.json';

// A Blob URL (URL.createObjectURL) is scoped to the document that created it — the extension
// popup — and stops working the moment that popup closes. Opening the "Save As" dialog
// (saveAs: true) steals focus, which is exactly the kind of event that closes a popup, so the
// download would silently fail right as it started. A data: URL embeds the whole payload in the
// URL string itself, so it survives the popup closing.

export function ExportToClaudeCode({ result, deepAnalysis }: ExportToClaudeCodeProps) {
  const [savedPath, setSavedPath] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleExport(): Promise<void> {
    setError(null);
    setSavedPath(null);
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

    const dataUrl = `data:application/json;base64,${toBase64(JSON.stringify(payload, null, 2))}`;
    chrome.downloads.download({ url: dataUrl, filename: SUGGESTED_FILENAME, saveAs: true }, (downloadId) => {
      if (chrome.runtime.lastError || downloadId === undefined) {
        setError(chrome.runtime.lastError?.message ?? 'Export failed — please try again.');
        return;
      }
      setSavedPath(PROJECT_RELATIVE_PATH);
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
      {error && (
        <p className="audit-error" role="alert">
          {error}
        </p>
      )}
      {savedPath && (
        <p className="export-instructions">
          Saved as <code>{SUGGESTED_FILENAME}</code> wherever you chose in the dialog. If that
          wasn't your project's <code>.accessible-ai</code> folder, move it there now (create the
          folder if it doesn't exist). Then open your project in Claude Code and say: "Import the
          accessibility audit from <code>{savedPath}</code> and fix the issues."
        </p>
      )}
    </div>
  );
}
