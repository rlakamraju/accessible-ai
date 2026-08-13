import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { AccessibilityIssue } from '../../../src/config/types';
import { mapViolationsToSource } from '../../../src/engines/remediation/source-mapper';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, '../../fixtures');

function unmappedRuntimeIssue(cssSelector: string): AccessibilityIssue {
  return {
    id: 'issue-001',
    source: 'runtime',
    wcagCriteria: [],
    standard: 'wcag-2.1-aa',
    impact: 'serious',
    ruleId: 'test-rule',
    description: 'desc',
    helpUrl: '',
    sourceLocation: { filePath: '', startLine: 0, endLine: 0, framework: 'auto' },
    codeSnippet: { before: '', violating: '', after: '' },
    runtimeContext: { pageUrl: 'https://example.com', cssSelector, renderedHtml: '' },
    remediation: { automationLevel: 'llm-assisted', estimatedEffort: 'medium' },
  };
}

describe('mapViolationsToSource', () => {
  it('maps a React selector using the aliased className attribute', async () => {
    const [mapped] = await mapViolationsToSource([unmappedRuntimeIssue('div.card')], join(FIXTURES, 'sample-react-project'), 'react');
    expect(mapped.sourceLocation.filePath).toMatch(/ClickableCard\.jsx$/);
    expect(mapped.sourceLocation.startLine).toBe(3);
  });

  it('maps a Vue selector inside the <template> block only', async () => {
    const [mapped] = await mapViolationsToSource([unmappedRuntimeIssue('div.card')], join(FIXTURES, 'sample-vue-project'), 'vue');
    expect(mapped.sourceLocation.filePath).toMatch(/ClickableCard\.vue$/);
    expect(mapped.sourceLocation.startLine).toBe(2);
  });

  it('maps an Angular selector by resolving the component’s custom-element tag to its template', async () => {
    const [mapped] = await mapViolationsToSource(
      [unmappedRuntimeIssue('app-clickable-card div.card')],
      join(FIXTURES, 'sample-angular-project'),
      'angular',
    );
    expect(mapped.sourceLocation.filePath).toMatch(/clickable-card\.component\.html$/);
    expect(mapped.sourceLocation.componentName).toBe('app-clickable-card');
  });

  it('maps a plain HTML selector by id', async () => {
    const [mapped] = await mapViolationsToSource([unmappedRuntimeIssue('#email')], join(FIXTURES, 'sample-angular-project'), 'html');
    expect(mapped.sourceLocation.filePath).toMatch(/signup-form\.component\.html$/);
  });

  it('leaves an issue unmapped when nothing scores above zero', async () => {
    const [mapped] = await mapViolationsToSource([unmappedRuntimeIssue('#totally-nonexistent-id')], join(FIXTURES, 'sample-react-project'), 'react');
    expect(mapped.sourceLocation.filePath).toBe('');
  });

  it('passes through static issues (already have a sourceLocation) untouched', async () => {
    const staticIssue: AccessibilityIssue = {
      ...unmappedRuntimeIssue('#email'),
      source: 'static',
      runtimeContext: undefined,
      sourceLocation: { filePath: 'already-known.jsx', startLine: 4, endLine: 4, framework: 'react' },
    };
    const [mapped] = await mapViolationsToSource([staticIssue], join(FIXTURES, 'sample-react-project'), 'react');
    expect(mapped.sourceLocation.filePath).toBe('already-known.jsx');
  });
});
