import { describe, expect, it } from 'vitest';
import { isSameOrigin, matchesGlob, normalizeUrl } from '../../src/shared/url-utils';

describe('normalizeUrl', () => {
  it('strips the fragment', () => {
    expect(normalizeUrl('https://example.com/page#section')).toBe('https://example.com/page');
  });

  it('strips a trailing slash from non-root paths', () => {
    expect(normalizeUrl('https://example.com/page/')).toBe('https://example.com/page');
  });

  it('keeps the root path slash', () => {
    expect(normalizeUrl('https://example.com/')).toBe('https://example.com/');
  });

  it('sorts query params so equivalent URLs normalize identically', () => {
    expect(normalizeUrl('https://example.com/page?b=2&a=1')).toBe(
      normalizeUrl('https://example.com/page?a=1&b=2'),
    );
  });
});

describe('isSameOrigin', () => {
  it('returns true for matching origins regardless of path', () => {
    expect(isSameOrigin('https://example.com/a', 'https://example.com/b')).toBe(true);
  });

  it('returns false for different hosts', () => {
    expect(isSameOrigin('https://other.com/a', 'https://example.com/b')).toBe(false);
  });

  it('returns false for different schemes', () => {
    expect(isSameOrigin('http://example.com', 'https://example.com')).toBe(false);
  });

  it('returns false for an unparseable URL', () => {
    expect(isSameOrigin('not-a-url', 'https://example.com')).toBe(false);
  });
});

describe('matchesGlob', () => {
  it('matches a wildcard suffix', () => {
    expect(matchesGlob('https://example.com/blog/post-1', 'https://example.com/blog/*')).toBe(true);
  });

  it('does not match outside the pattern', () => {
    expect(matchesGlob('https://example.com/docs/post-1', 'https://example.com/blog/*')).toBe(false);
  });

  it('matches an exact literal pattern', () => {
    expect(matchesGlob('https://example.com/page', 'https://example.com/page')).toBe(true);
  });
});
