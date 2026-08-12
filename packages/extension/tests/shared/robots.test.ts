import { describe, expect, it } from 'vitest';
import { isDisallowed, parseRobotsTxt } from '../../src/shared/robots';

describe('parseRobotsTxt', () => {
  it('collects Disallow rules under the wildcard user-agent group', () => {
    const text = ['User-agent: *', 'Disallow: /admin', 'Disallow: /private/'].join('\n');
    expect(parseRobotsTxt(text)).toEqual({ disallow: ['/admin', '/private/'] });
  });

  it('ignores rules scoped to a non-wildcard user-agent', () => {
    const text = ['User-agent: Googlebot', 'Disallow: /googlebot-only', 'User-agent: *', 'Disallow: /all-bots'].join(
      '\n',
    );
    expect(parseRobotsTxt(text)).toEqual({ disallow: ['/all-bots'] });
  });

  it('returns no rules when there is no wildcard group', () => {
    const text = ['User-agent: Googlebot', 'Disallow: /googlebot-only'].join('\n');
    expect(parseRobotsTxt(text)).toEqual({ disallow: [] });
  });
});

describe('isDisallowed', () => {
  it('flags a URL whose path starts with a disallowed prefix', () => {
    expect(isDisallowed('https://example.com/admin/settings', { disallow: ['/admin'] })).toBe(true);
  });

  it('allows a URL that does not match any prefix', () => {
    expect(isDisallowed('https://example.com/blog/post', { disallow: ['/admin'] })).toBe(false);
  });

  it('allows everything when there are no rules', () => {
    expect(isDisallowed('https://example.com/anything', { disallow: [] })).toBe(false);
  });
});
