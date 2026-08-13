import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { AccessibilityIssue } from '../../../src/config/types';
import { applyFixes } from '../../../src/engines/remediation/fix-applier';
import type { FixItem } from '../../../src/engines/remediation/types';

function makeIssue(overrides: Partial<AccessibilityIssue> & { filePath: string; startLine: number }): AccessibilityIssue {
  return {
    id: overrides.id ?? 'issue-x',
    source: 'static',
    wcagCriteria: ['3.1.1'],
    standard: 'wcag-2.1-aa',
    impact: 'serious',
    ruleId: overrides.ruleId ?? 'html-has-lang',
    description: 'desc',
    helpUrl: '',
    sourceLocation: { filePath: overrides.filePath, startLine: overrides.startLine, endLine: overrides.startLine, framework: 'html' },
    codeSnippet: { before: '', violating: '', after: '' },
    remediation: overrides.remediation ?? { automationLevel: 'auto', estimatedEffort: 'trivial', fixTemplateId: 'html-lang', groupId: 'html-has-lang' },
  };
}

function fixItemFor(issue: AccessibilityIssue, type: FixItem['fix']['type'] = 'auto-template'): FixItem {
  return {
    issueId: issue.id,
    priority: 0,
    issue,
    fix: { type, resolvesCriteria: issue.wcagCriteria, resolvesIssueIds: [issue.id] },
    verification: { rerunRules: [issue.ruleId] },
  };
}

describe('applyFixes', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'accessible-ai-fix-applier-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('applies an auto-template fix and reports an accurate diff, without writing when dryRun is true', async () => {
    const filePath = join(dir, 'index.html');
    await writeFile(filePath, '<html>\n<head></head>\n</html>', 'utf8');
    const issue = makeIssue({ filePath, startLine: 1 });

    const { result } = await applyFixes([fixItemFor(issue)], true);

    expect(result.applied[0].status).toBe('applied');
    expect(result.applied[0].diff).toContain('lang="en"');
    expect(result.dryRunNote).toBeTruthy();
    expect(await readFile(filePath, 'utf8')).toBe('<html>\n<head></head>\n</html>'); // unmodified
  });

  it('writes the file when dryRun is false, and returns before/after content for rollback', async () => {
    const filePath = join(dir, 'index.html');
    await writeFile(filePath, '<html>\n<head></head>\n</html>', 'utf8');
    const issue = makeIssue({ filePath, startLine: 1 });

    const { result, fileContents } = await applyFixes([fixItemFor(issue)], false);

    expect(result.applied[0].status).toBe('applied');
    expect(await readFile(filePath, 'utf8')).toContain('lang="en"');
    expect(fileContents.get(filePath)?.before).toBe('<html>\n<head></head>\n</html>');
    expect(fileContents.get(filePath)?.after).toContain('lang="en"');
  });

  it('stacks multiple fixes to the same file within one call', async () => {
    const filePath = join(dir, 'index.html');
    await writeFile(filePath, '<html>\n<div id="box"></div>\n<div id="box"></div>\n</html>', 'utf8');

    const langIssue = makeIssue({ id: 'lang', filePath, startLine: 1 });
    const dupIssue = makeIssue({
      id: 'dup',
      filePath,
      startLine: 3,
      ruleId: 'duplicate-id',
      remediation: { automationLevel: 'auto', estimatedEffort: 'small', fixTemplateId: 'duplicate-id', groupId: 'duplicate-id' },
    });

    const { result } = await applyFixes([fixItemFor(langIssue), fixItemFor(dupIssue)], false);

    expect(result.summary.successfullyApplied).toBe(2);
    const finalContent = await readFile(filePath, 'utf8');
    expect(finalContent).toContain('<html lang="en">');
    expect(finalContent).toContain('id="box-2"');
  });

  it('skips manual-guidance fixes without touching any file', async () => {
    const filePath = join(dir, 'page.html');
    await writeFile(filePath, '<p>contrast issue</p>', 'utf8');
    const issue = makeIssue({ filePath, startLine: 1, ruleId: 'color-contrast', remediation: { automationLevel: 'manual-review', estimatedEffort: 'large' } });
    const item = fixItemFor(issue, 'manual-guidance');
    item.fix.guidance = 'Pick a compliant color pair.';

    const { result } = await applyFixes([item], false);

    expect(result.applied[0].status).toBe('skipped');
    expect(result.applied[0].description).toBe('Pick a compliant color pair.');
    expect(await readFile(filePath, 'utf8')).toBe('<p>contrast issue</p>');
  });

  it('skips with a clear reason when the issue has no mapped source location', async () => {
    const issue = makeIssue({ filePath: '', startLine: 0 });
    const { result } = await applyFixes([fixItemFor(issue)], true);
    expect(result.applied[0].status).toBe('skipped');
    expect(result.applied[0].failureReason).toContain('map_violations_to_source');
  });

  it('skips when the template finds nothing fixable at the issue’s location', async () => {
    const filePath = join(dir, 'index.html');
    await writeFile(filePath, '<html lang="en"></html>', 'utf8'); // already has lang
    const issue = makeIssue({ filePath, startLine: 1 });

    const { result } = await applyFixes([fixItemFor(issue)], true);
    expect(result.applied[0].status).toBe('skipped');
  });

  it('applies pre-computed llm-generated changes verbatim', async () => {
    const filePath = join(dir, 'Button.jsx');
    await writeFile(filePath, '<button></button>', 'utf8');
    const issue = makeIssue({ id: 'llm-1', filePath, startLine: 1, ruleId: 'button-name', remediation: { automationLevel: 'llm-assisted', estimatedEffort: 'small' } });
    const item = fixItemFor(issue, 'llm-generated');
    item.fix.changes = [
      {
        filePath,
        changeType: 'modify',
        diff: '--- diff ---',
        description: 'Added aria-label',
        before: '<button></button>',
        after: '<button aria-label="Close">X</button>',
      },
    ];

    const { result } = await applyFixes([item], false);
    expect(result.applied[0].status).toBe('applied');
    expect(await readFile(filePath, 'utf8')).toBe('<button aria-label="Close">X</button>');
  });
});
