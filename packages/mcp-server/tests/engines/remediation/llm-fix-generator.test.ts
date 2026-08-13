import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AccessibilityIssue } from '../../../src/config/types';
import type { ProjectContext } from '../../../src/engines/remediation/types';

const mockCallClaude = vi.fn();
vi.mock('../../../src/llm/client', () => ({ callClaude: mockCallClaude }));

const context: ProjectContext = {
  framework: 'react',
  namingConvention: 'PascalCase',
  hasTests: false,
  existingA11yImports: [],
  relatedFiles: [],
};

function issueAt(filePath: string, ruleId = 'button-name'): AccessibilityIssue {
  return {
    id: `issue-${ruleId}-${filePath}`,
    source: 'static',
    wcagCriteria: ['4.1.2'],
    standard: 'wcag-2.1-aa',
    impact: 'serious',
    ruleId,
    description: 'Button has no accessible name',
    helpUrl: '',
    sourceLocation: { filePath, startLine: 1, endLine: 1, framework: 'react' },
    codeSnippet: { before: '', violating: '<button></button>', after: '' },
    remediation: { automationLevel: 'llm-assisted', estimatedEffort: 'small' },
  };
}

describe('generateLlmFix', () => {
  let dir: string;

  beforeEach(async () => {
    vi.resetModules();
    mockCallClaude.mockReset();
    dir = await mkdtemp(join(tmpdir(), 'accessible-ai-llm-fix-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('turns a well-formed response into a FileChange with a real diff', async () => {
    const filePath = join(dir, 'Button.jsx');
    await writeFile(filePath, '<button></button>', 'utf8');
    mockCallClaude.mockResolvedValue(
      JSON.stringify({
        changes: [{ filePath, searchBlock: '<button></button>', replaceBlock: '<button aria-label="Close">X</button>', description: 'Added aria-label' }],
        explanation: 'Added an accessible name.',
      }),
    );

    const { generateLlmFix } = await import('../../../src/engines/remediation/llm-fix-generator');
    const result = await generateLlmFix(issueAt(filePath), context);

    expect(result.status).toBe('generated');
    if (result.status === 'generated') {
      expect(result.changes[0].after).toBe('<button aria-label="Close">X</button>');
      expect(result.changes[0].diff).toContain('aria-label');
    }
  });

  it('falls back to manual-guidance when the searchBlock does not match the file', async () => {
    const filePath = join(dir, 'Button.jsx');
    await writeFile(filePath, '<button></button>', 'utf8');
    mockCallClaude.mockResolvedValue(
      JSON.stringify({
        changes: [{ filePath, searchBlock: '<button>this text is not in the file</button>', replaceBlock: 'x', description: 'x' }],
        explanation: 'Could not locate the exact code.',
      }),
    );

    const { generateLlmFix } = await import('../../../src/engines/remediation/llm-fix-generator');
    const result = await generateLlmFix(issueAt(filePath), context);

    expect(result.status).toBe('manual-guidance');
  });

  it('falls back to manual-guidance when the response is not valid JSON', async () => {
    const filePath = join(dir, 'Button.jsx');
    await writeFile(filePath, '<button></button>', 'utf8');
    mockCallClaude.mockResolvedValue('Sorry, I cannot help with that.');

    const { generateLlmFix } = await import('../../../src/engines/remediation/llm-fix-generator');
    const result = await generateLlmFix(issueAt(filePath), context);

    expect(result.status).toBe('manual-guidance');
    if (result.status === 'manual-guidance') expect(result.guidance).toContain('cannot help');
  });

  it('caches by rule + file + snippet, avoiding a second Claude call for the same issue', async () => {
    const filePath = join(dir, 'Button.jsx');
    await writeFile(filePath, '<button></button>', 'utf8');
    mockCallClaude.mockResolvedValue(JSON.stringify({ changes: [], explanation: 'no changes' }));

    const { generateLlmFix } = await import('../../../src/engines/remediation/llm-fix-generator');
    const issue = issueAt(filePath);
    await generateLlmFix(issue, context);
    await generateLlmFix(issue, context);

    expect(mockCallClaude).toHaveBeenCalledTimes(1);
  });

  it('returns manual-guidance without calling Claude when the issue has no source location', async () => {
    const { generateLlmFix } = await import('../../../src/engines/remediation/llm-fix-generator');
    const result = await generateLlmFix(issueAt(''), context);

    expect(result.status).toBe('manual-guidance');
    expect(mockCallClaude).not.toHaveBeenCalled();
  });
});
