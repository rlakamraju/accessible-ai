import { describe, expect, it } from 'vitest';
import { resolveStandard } from '@accessible-ai/standards';
import type { AxeViolation } from '../../../src/config/types';
import { normalizeRuntimeIssues } from '../../../src/engines/remediation/issue-normalizer';

const imageAlt: AxeViolation = {
  id: 'image-alt',
  impact: 'critical',
  description: 'Images must have alternate text',
  help: 'Images must have alternate text',
  helpUrl: 'https://dequeuniversity.com/rules/axe/image-alt',
  tags: ['wcag2a', 'wcag111'],
  nodes: [
    { target: ['#logo'], html: '<img id="logo">' },
    { target: ['.hero img'], html: '<img class="hero-img">' },
  ],
};

const htmlLang: AxeViolation = {
  id: 'html-has-lang',
  impact: 'serious',
  description: 'html element must have a lang attribute',
  help: 'html element must have a lang attribute',
  helpUrl: 'https://dequeuniversity.com/rules/axe/html-has-lang',
  tags: ['wcag2a', 'wcag311'],
  nodes: [{ target: ['html'], html: '<html>' }],
};

describe('normalizeRuntimeIssues', () => {
  const resolved = resolveStandard('wcag-2.1-aa');

  it('produces one issue per violation node', () => {
    const issues = normalizeRuntimeIssues([imageAlt], 'https://example.com', 'wcag-2.1-aa', resolved);
    expect(issues).toHaveLength(2);
    expect(issues[0].runtimeContext?.cssSelector).toBe('#logo');
    expect(issues[1].runtimeContext?.cssSelector).toBe('.hero img');
  });

  it('maps wcag criteria via the resolved standard’s axeCoreRules', () => {
    const [issue] = normalizeRuntimeIssues([imageAlt], 'https://example.com', 'wcag-2.1-aa', resolved);
    expect(issue.wcagCriteria).toContain('1.1.1');
  });

  it('leaves sourceLocation unmapped until map_violations_to_source runs', () => {
    const [issue] = normalizeRuntimeIssues([imageAlt], 'https://example.com', 'wcag-2.1-aa', resolved);
    expect(issue.sourceLocation.filePath).toBe('');
  });

  it('assigns automationLevel "auto" and a fixTemplateId for rules with a Level-1 template', () => {
    const [issue] = normalizeRuntimeIssues([htmlLang], 'https://example.com', 'wcag-2.1-aa', resolved);
    expect(issue.remediation.automationLevel).toBe('auto');
    expect(issue.remediation.fixTemplateId).toBe('html-lang');
  });

  it('assigns "llm-assisted" (not "auto") to image-alt, since real alt text needs meaning', () => {
    const [issue] = normalizeRuntimeIssues([imageAlt], 'https://example.com', 'wcag-2.1-aa', resolved);
    expect(issue.remediation.automationLevel).toBe('llm-assisted');
    expect(issue.remediation.fixTemplateId).toBe('image-alt-decorative');
  });

  it('falls back to a moderate impact when axe reports impact: null', () => {
    const violation: AxeViolation = { ...imageAlt, impact: null, nodes: [imageAlt.nodes[0]] };
    const [issue] = normalizeRuntimeIssues([violation], 'https://example.com', 'wcag-2.1-aa', resolved);
    expect(issue.impact).toBe('moderate');
  });

  it('groups issues from the same rule under the same groupId', () => {
    const issues = normalizeRuntimeIssues([imageAlt], 'https://example.com', 'wcag-2.1-aa', resolved);
    expect(issues[0].remediation.groupId).toBe('image-alt');
    expect(issues[1].remediation.groupId).toBe('image-alt');
  });

  it('assigns unique, sequential ids across all normalized issues', () => {
    const issues = normalizeRuntimeIssues([imageAlt, htmlLang], 'https://example.com', 'wcag-2.1-aa', resolved);
    const ids = issues.map((issue) => issue.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
