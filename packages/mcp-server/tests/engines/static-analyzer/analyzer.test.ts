import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { analyzeCodebase } from '../../../src/engines/static-analyzer/analyzer.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, '../../fixtures');

describe('analyzeCodebase', () => {
  it('analyzes the sample React project: ESLint + custom findings, deduped, normalized', async () => {
    const result = await analyzeCodebase(join(FIXTURES, 'sample-react-project'), { standard: 'wcag-2.1-aa' });

    expect(result.framework.framework).toBe('react');
    expect(result.filesAnalyzed).toBe(5);

    const ruleIds = result.issues.map((i) => i.ruleId);
    expect(ruleIds).toContain('jsx-a11y/alt-text');
    expect(ruleIds).toContain('jsx-a11y/click-events-have-key-events');
    expect(ruleIds).toContain('custom/heading-level-skipped');

    // The custom checks and their jsx-a11y equivalents both fire on the same lines (ClickableCard's
    // div, SignupForm's input) — only the ESLint-sourced finding should survive the dedup pass.
    expect(ruleIds).not.toContain('custom/keyboard-handler-required');

    expect(result.complianceScore).toBeGreaterThan(0);
    expect(result.complianceScore).toBeLessThan(100);

    const altTextIssue = result.issues.find((i) => i.ruleId === 'jsx-a11y/alt-text')!;
    expect(altTextIssue.source).toBe('static');
    expect(altTextIssue.wcagCriteria).toContain('1.1.1');
    expect(altTextIssue.sourceLocation.framework).toBe('react');
    expect(altTextIssue.sourceLocation.filePath).toContain('ImageGallery.jsx');
    expect(altTextIssue.codeSnippet.violating).toContain('img');
  });

  it('analyzes the sample Angular project and dedupes the same way', async () => {
    const result = await analyzeCodebase(join(FIXTURES, 'sample-angular-project'), { standard: 'wcag-2.1-aa' });

    expect(result.framework.framework).toBe('angular');
    const ruleIds = result.issues.map((i) => i.ruleId);
    expect(ruleIds).toContain('@angular-eslint/template/alt-text');
    expect(ruleIds).toContain('@angular-eslint/template/click-events-have-key-events');
    expect(ruleIds).toContain('custom/form-control-missing-label');
    expect(ruleIds).not.toContain('custom/keyboard-handler-required');
  });

  it('analyzes the sample Vue project', async () => {
    const result = await analyzeCodebase(join(FIXTURES, 'sample-vue-project'), { standard: 'wcag-2.1-aa' });

    expect(result.framework.framework).toBe('vue');
    const ruleIds = result.issues.map((i) => i.ruleId);
    expect(ruleIds).toContain('vuejs-accessibility/alt-text');
    expect(ruleIds).toContain('custom/form-control-missing-label');
  });

  it('produces zero issues and a perfect score for the fully accessible clean project', async () => {
    const result = await analyzeCodebase(join(FIXTURES, 'sample-clean-project'), { standard: 'wcag-2.1-aa' });

    expect(result.framework.framework).toBe('angular');
    expect(result.issues).toHaveLength(0);
    expect(result.complianceScore).toBe(100);
    expect(result.bySeverity).toEqual({ critical: 0, serious: 0, moderate: 0, minor: 0 });
  });
});
