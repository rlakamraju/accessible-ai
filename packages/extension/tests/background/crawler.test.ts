import { describe, expect, it } from 'vitest';
import { shouldEnqueueLink } from '../../src/background/crawler';
import type { CrawlConfig } from '../../src/shared/types';

const BASE_CONFIG: CrawlConfig = {
  maxPages: 20,
  maxDepth: 3,
  respectRobotsTxt: false,
  delayMs: 0,
};

const ORIGIN = 'https://example.com';

describe('shouldEnqueueLink', () => {
  it('accepts a fresh same-origin link', () => {
    expect(shouldEnqueueLink('https://example.com/about', ORIGIN, BASE_CONFIG, new Set(), { disallow: [] })).toBe(
      true,
    );
  });

  it('rejects a cross-origin link', () => {
    expect(shouldEnqueueLink('https://other.com/about', ORIGIN, BASE_CONFIG, new Set(), { disallow: [] })).toBe(
      false,
    );
  });

  it('rejects a link that has already been seen (dedup, including via a different fragment)', () => {
    const seen = new Set(['https://example.com/about']);
    expect(
      shouldEnqueueLink('https://example.com/about#section', ORIGIN, BASE_CONFIG, seen, { disallow: [] }),
    ).toBe(false);
  });

  it('respects excludePatterns', () => {
    const config: CrawlConfig = { ...BASE_CONFIG, excludePatterns: ['https://example.com/admin/*'] };
    expect(shouldEnqueueLink('https://example.com/admin/settings', ORIGIN, config, new Set(), { disallow: [] })).toBe(
      false,
    );
  });

  it('respects includePatterns (only matching links are enqueued)', () => {
    const config: CrawlConfig = { ...BASE_CONFIG, includePatterns: ['https://example.com/blog/*'] };
    expect(shouldEnqueueLink('https://example.com/blog/post-1', ORIGIN, config, new Set(), { disallow: [] })).toBe(
      true,
    );
    expect(shouldEnqueueLink('https://example.com/docs/post-1', ORIGIN, config, new Set(), { disallow: [] })).toBe(
      false,
    );
  });

  it('respects robots.txt disallow rules when respectRobotsTxt is true', () => {
    const config: CrawlConfig = { ...BASE_CONFIG, respectRobotsTxt: true };
    expect(
      shouldEnqueueLink('https://example.com/private/page', ORIGIN, config, new Set(), { disallow: ['/private'] }),
    ).toBe(false);
  });

  it('ignores robots.txt rules when respectRobotsTxt is false', () => {
    expect(
      shouldEnqueueLink('https://example.com/private/page', ORIGIN, BASE_CONFIG, new Set(), {
        disallow: ['/private'],
      }),
    ).toBe(true);
  });
});
