import type { AxeResults } from 'axe-core';
import { resolveStandard, type StandardId } from '@accessible-ai/standards';
import { runAxeAudit } from '../core/axe-runner';
import { processResults } from '../core/result-processor';
import { calculateComplianceScore } from '../core/score-calculator';
import { getActiveTabId } from '../shared/browser-tabs';
import type {
  AuditCompleteMessage,
  AuditErrorMessage,
  ExtensionMessage,
  ShowOverlayMessage,
} from '../shared/messaging';
import type { ComplianceScore, ProcessedAuditResult } from '../shared/types';

chrome.runtime.onInstalled.addListener(() => {
  console.log('AccessibleAI installed');
});

chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
  if (message.type === 'START_AUDIT') {
    handleStartAudit(message.standard)
      .then(sendResponse)
      .catch((error: unknown) => {
        const response: AuditErrorMessage = {
          type: 'AUDIT_ERROR',
          error: error instanceof Error ? error.message : String(error),
        };
        sendResponse(response);
      });
    return true; // keep the message channel open for the async response
  }
  return undefined;
});

async function handleStartAudit(
  standard: StandardId,
): Promise<AuditCompleteMessage | AuditErrorMessage> {
  const tabId = await getActiveTabId();
  const resolved = resolveStandard(standard);

  await chrome.scripting.executeScript({
    target: { tabId },
    files: ['vendor/axe.min.js'],
    world: 'MAIN',
  });

  const [injection] = await chrome.scripting.executeScript({
    target: { tabId },
    world: 'MAIN',
    func: runAxeAudit,
    args: [{ tags: resolved.axeCoreRuleTags }],
  });

  const raw = injection.result as AxeResults;
  const result = processResults(raw, resolved);
  const score = calculateComplianceScore(result);

  await showOverlay(tabId, result, score);

  return { type: 'AUDIT_COMPLETE', result, score };
}

async function showOverlay(
  tabId: number,
  result: ProcessedAuditResult,
  score: ComplianceScore,
): Promise<void> {
  try {
    await chrome.scripting.executeScript({ target: { tabId }, files: ['content/injector.js'] });
    const message: ShowOverlayMessage = {
      type: 'SHOW_OVERLAY',
      violations: result.violations,
      score: score.overallScore,
      violationCount: result.totals.violations,
    };
    await chrome.tabs.sendMessage(tabId, message);
  } catch {
    // Overlay is best-effort — e.g. the active tab may be a chrome:// page that disallows injection.
  }
}
