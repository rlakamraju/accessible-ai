import type { AxeResults } from 'axe-core';
import { resolveStandard, type StandardId } from '@accessible-ai/standards';
import { auditSite, type Cancellation } from './site-auditor';
import { runAxeAudit } from '../core/axe-runner';
import { processResults } from '../core/result-processor';
import { calculateComplianceScore } from '../core/score-calculator';
import { saveAuditRecord } from '../core/storage';
import { getActiveTabId } from '../shared/browser-tabs';
import type {
  AuditCompleteMessage,
  AuditErrorMessage,
  ExtensionMessage,
  ShowOverlayMessage,
  SiteAuditProgressMessage,
  SiteAuditStartedMessage,
  StartSiteAuditMessage,
} from '../shared/messaging';
import type { ComplianceScore, ProcessedAuditResult } from '../shared/types';

const KEEP_ALIVE_ALARM = 'site-audit-keep-alive';
const SITE_AUDIT_PROGRESS_KEY = 'siteAuditProgress';

chrome.runtime.onInstalled.addListener(() => {
  console.log('AccessibleAI installed');
});

// A site crawl can run for minutes across many tab loads; periodic alarms keep the MV3 service
// worker from being torn down for inactivity between chrome.tabs/chrome.scripting calls.
chrome.alarms.onAlarm.addListener(() => {
  // No-op: firing the alarm is enough to wake/keep the service worker alive.
});

let activeSiteAudit: Cancellation | null = null;

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

  if (message.type === 'START_SITE_AUDIT') {
    sendResponse(handleStartSiteAudit(message));
    return false;
  }

  if (message.type === 'CANCEL_SITE_AUDIT') {
    if (activeSiteAudit) activeSiteAudit.cancelled = true;
    sendResponse({ type: 'SITE_AUDIT_STARTED' });
    return false;
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
  await saveAuditRecord('page', standard, result.url, score.overallScore, result);

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

function handleStartSiteAudit(message: StartSiteAuditMessage): SiteAuditStartedMessage | AuditErrorMessage {
  if (activeSiteAudit) {
    return { type: 'AUDIT_ERROR', error: 'A site audit is already running' };
  }

  // Called synchronously (no prior await) in response to a popup button click, so the user
  // gesture context is preserved for chrome.sidePanel.open here — opening it once the crawl
  // has already finished would no longer count as a user gesture.
  void getActiveTabId()
    .then((tabId) => chrome.sidePanel.open({ tabId }))
    .catch(() => {
      // Side panel may already be open, or the active tab may not support it — non-fatal.
    });

  const cancellation: Cancellation = { cancelled: false };
  activeSiteAudit = cancellation;

  void chrome.alarms.create(KEEP_ALIVE_ALARM, { periodInMinutes: 0.4 });

  runSiteAudit(message, cancellation).finally(() => {
    if (activeSiteAudit === cancellation) activeSiteAudit = null;
    void chrome.alarms.clear(KEEP_ALIVE_ALARM);
  });

  return { type: 'SITE_AUDIT_STARTED' };
}

async function runSiteAudit(message: StartSiteAuditMessage, cancellation: Cancellation): Promise<void> {
  try {
    for await (const progress of auditSite(message.rootUrl, message.standard, message.crawlConfig, cancellation)) {
      await chrome.storage.session.set({ [SITE_AUDIT_PROGRESS_KEY]: progress });
      broadcast({ type: 'SITE_AUDIT_PROGRESS', progress });

      if (progress.phase === 'complete') {
        await saveAuditRecord('site', message.standard, message.rootUrl, progress.result.siteScore, progress.result);
      }
    }
  } catch (error) {
    const progress: SiteAuditProgressMessage['progress'] = {
      phase: 'error',
      error: error instanceof Error ? error.message : String(error),
    };
    await chrome.storage.session.set({ [SITE_AUDIT_PROGRESS_KEY]: progress });
    broadcast({ type: 'SITE_AUDIT_PROGRESS', progress });
  }
}

function broadcast(message: ExtensionMessage): void {
  chrome.runtime.sendMessage(message).catch(() => {
    // No listener currently open (popup/sidepanel closed) — progress is already persisted
    // to chrome.storage.session for whoever opens next.
  });
}
