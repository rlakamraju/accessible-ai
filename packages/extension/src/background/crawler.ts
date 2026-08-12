import { extractLinks } from '../content/link-extractor';
import { closeTab, openBackgroundTab, waitForTabComplete } from '../shared/browser-tabs';
import { fetchRobotsRules, isDisallowed, type RobotsRules } from '../shared/robots';
import { isSameOrigin, matchesGlob, normalizeUrl } from '../shared/url-utils';
import type { CrawlConfig, CrawlProgress, PageMeta } from '../shared/types';

export interface Cancellation {
  cancelled: boolean;
}

interface QueueEntry {
  url: string;
  depth: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Pure link-filtering logic, split out so it's testable without mocking chrome.tabs. */
export function shouldEnqueueLink(
  link: string,
  origin: string,
  config: CrawlConfig,
  visitedOrQueued: ReadonlySet<string>,
  robotsRules: RobotsRules,
): boolean {
  if (!isSameOrigin(link, origin)) return false;

  let normalized: string;
  try {
    normalized = normalizeUrl(link);
  } catch {
    return false;
  }

  if (visitedOrQueued.has(normalized)) return false;
  if (config.respectRobotsTxt && isDisallowed(normalized, robotsRules)) return false;
  if (config.includePatterns?.length && !config.includePatterns.some((p) => matchesGlob(normalized, p))) {
    return false;
  }
  if (config.excludePatterns?.some((p) => matchesGlob(normalized, p))) return false;

  return true;
}

async function crawlPage(url: string): Promise<{ meta: PageMeta; links: string[] }> {
  const tabId = await openBackgroundTab(url);
  try {
    await waitForTabComplete(tabId);
    const [injection] = await chrome.scripting.executeScript({
      target: { tabId },
      func: extractLinks,
    });
    return injection.result as { meta: PageMeta; links: string[] };
  } finally {
    await closeTab(tabId);
  }
}

/**
 * BFS crawl of same-origin pages starting from rootUrl. Yields progress after each page and
 * returns the full map of visited URL -> page metadata once the queue drains or maxPages is hit.
 */
export async function* crawlSite(
  rootUrl: string,
  config: CrawlConfig,
  cancellation: Cancellation = { cancelled: false },
): AsyncGenerator<CrawlProgress, Map<string, PageMeta>> {
  const origin = new URL(rootUrl).origin;
  const robotsRules = config.respectRobotsTxt ? await fetchRobotsRules(origin) : { disallow: [] };

  const visited = new Map<string, PageMeta>();
  const rootNormalized = normalizeUrl(rootUrl);
  const queue: QueueEntry[] = [{ url: rootNormalized, depth: 0 }];
  const seen = new Set<string>([rootNormalized]);

  while (queue.length > 0 && visited.size < config.maxPages) {
    if (cancellation.cancelled) break;

    const next = queue.shift();
    if (!next) break;

    const { meta, links } = await crawlPage(next.url);
    visited.set(next.url, meta);

    yield {
      phase: 'crawling',
      pagesVisited: visited.size,
      pagesTotal: Math.min(config.maxPages, visited.size + queue.length),
      currentUrl: next.url,
      discoveredUrls: Array.from(visited.keys()),
    };

    if (next.depth < config.maxDepth) {
      for (const link of links) {
        if (!shouldEnqueueLink(link, origin, config, seen, robotsRules)) continue;
        const normalized = normalizeUrl(link);
        seen.add(normalized);
        queue.push({ url: normalized, depth: next.depth + 1 });
      }
    }

    if (config.delayMs > 0 && queue.length > 0) await sleep(config.delayMs);
  }

  return visited;
}
