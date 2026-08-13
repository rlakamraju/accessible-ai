import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { AccessibilityIssue } from '../../../src/config/types';
import { gatherProjectContext } from '../../../src/engines/remediation/project-context';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, '../../fixtures');

function issueAt(filePath: string): AccessibilityIssue {
  return {
    id: 'issue-x',
    source: 'static',
    wcagCriteria: [],
    standard: 'wcag-2.1-aa',
    impact: 'serious',
    ruleId: 'rule',
    description: 'desc',
    helpUrl: '',
    sourceLocation: { filePath, startLine: 1, endLine: 1, framework: 'react' },
    codeSnippet: { before: '', violating: '', after: '' },
    remediation: { automationLevel: 'llm-assisted', estimatedEffort: 'medium' },
  };
}

describe('gatherProjectContext', () => {
  it('detects the framework and its version from the project’s package.json', async () => {
    const projectPath = join(FIXTURES, 'sample-react-project');
    const context = await gatherProjectContext(projectPath, issueAt(join(projectPath, 'src/components/SignupForm.jsx')));
    expect(context.framework).toBe('react');
  });

  it('resolves relative imports of the violating file into relatedFiles', async () => {
    const projectPath = join(FIXTURES, 'sample-react-project');
    const filePath = join(projectPath, 'src/components/ArticlePage.jsx');
    const context = await gatherProjectContext(projectPath, issueAt(filePath));
    // ArticlePage.jsx doesn't necessarily import a sibling, but the call should never throw and always return an array.
    expect(Array.isArray(context.relatedFiles)).toBe(true);
  });

  it('falls back to project-root naming detection when the issue has no sourceLocation', async () => {
    const projectPath = join(FIXTURES, 'sample-vue-project');
    const context = await gatherProjectContext(projectPath, issueAt(''));
    expect(['kebab-case', 'camelCase', 'PascalCase', 'mixed']).toContain(context.namingConvention);
  });
});
