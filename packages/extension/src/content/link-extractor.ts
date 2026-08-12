import type { PageMeta } from '../shared/types';

export interface LinkExtractionResult {
  meta: PageMeta;
  links: string[];
}

// Self-contained: serialized via chrome.scripting.executeScript({ func: extractLinks }) and run
// in the crawled page's context, so it must not import anything besides types — see the same
// constraint documented on core/axe-runner.ts's runAxeAudit.
export function extractLinks(): LinkExtractionResult {
  const anchors = Array.from(document.querySelectorAll('a[href]'));
  const links = anchors
    .map((anchor) => (anchor as HTMLAnchorElement).href)
    .filter((href) => href.startsWith('http://') || href.startsWith('https://'));

  const metaDescription =
    document.querySelector('meta[name="description"]')?.getAttribute('content') ?? undefined;
  const h1Text = document.querySelector('h1')?.textContent?.trim() ?? undefined;

  return {
    meta: {
      title: document.title,
      url: document.location.href,
      metaDescription,
      h1Text,
    },
    links,
  };
}
