import type { AxeResults } from 'axe-core';
import { resolveStandard, type ResolvedStandard, type StandardId } from '@accessible-ai/standards';
import { crawlSite, type Cancellation } from './crawler';
import { aggregateResults } from '../core/aggregator';
import { runAxeAudit } from '../core/axe-runner';
import { processResults } from '../core/result-processor';
import { closeTab, openBackgroundTab, waitForTabComplete } from '../shared/browser-tabs';
import type { CrawlConfig, ProcessedAuditResult, SiteAuditProgress } from '../shared/types';

export type { Cancellation } from './crawler';

async function auditPage(url: string, resolved: ResolvedStandard): Promise<ProcessedAuditResult> {
  const tabId = await openBackgroundTab(url);
  try {
    await waitForTabComplete(tabId);
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
    return processResults(injection.result as AxeResults, resolved);
  } finally {
    await closeTab(tabId);
  }
}

/**
 * Orchestrates a full site audit: crawl discovery, then a sequential per-page axe-core audit,
 * then aggregation. Audits one page at a time (sequential tabs) to keep resource usage bounded.
 */
export async function* auditSite(
  rootUrl: string,
  standard: StandardId,
  crawlConfig: CrawlConfig,
  cancellation: Cancellation = { cancelled: false },
): AsyncGenerator<SiteAuditProgress> {
  const resolved = resolveStandard(standard);

  const crawler = crawlSite(rootUrl, crawlConfig, cancellation);
  let step = await crawler.next();
  while (!step.done) {
    if (cancellation.cancelled) {
      yield { phase: 'cancelled' };
      return;
    }
    yield step.value;
    step = await crawler.next();
  }
  const pageMeta = step.value;

  if (cancellation.cancelled) {
    yield { phase: 'cancelled' };
    return;
  }

  const pageResults = new Map<string, ProcessedAuditResult>();
  const urls = Array.from(pageMeta.keys());
  for (let i = 0; i < urls.length; i += 1) {
    if (cancellation.cancelled) {
      yield { phase: 'cancelled' };
      return;
    }
    const url = urls[i];
    yield { phase: 'auditing', pagesAudited: i, pagesTotal: urls.length, currentUrl: url };
    pageResults.set(url, await auditPage(url, resolved));
  }

  yield { phase: 'auditing', pagesAudited: urls.length, pagesTotal: urls.length, currentUrl: rootUrl };
  yield { phase: 'aggregating' };

  const result = aggregateResults(pageResults, pageMeta, standard, rootUrl);
  yield { phase: 'complete', result };
}
