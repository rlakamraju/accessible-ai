import { readFile, writeFile } from 'node:fs/promises';
import { getTemplate } from './templates/registry.js';
import type { FixTarget } from './templates/types.js';
import { buildDiff } from './diff-utils.js';
import type { AppliedFixEntry, ApplyFixResult, FixItem } from './types.js';

function closestTarget(targets: FixTarget[], nearLine: number): FixTarget | undefined {
  if (targets.length === 0) return undefined;
  return targets.reduce((best, target) => (Math.abs(target.line - nearLine) < Math.abs(best.line - nearLine) ? target : best));
}

export interface ApplyFixesOutcome {
  result: ApplyFixResult;
  /** Per-touched-file before/after content, for `apply-fix`'s tool layer to persist as `AppliedFix` rollback state. */
  fileContents: Map<string, { before: string; after: string }>;
}

/**
 * Applies a batch of `FixItem`s (architecture doc section 5.4/5.5). `auto-template` fixes run their
 * registered `FixTemplate` directly against the file. `llm-generated` fixes expect `fix.changes` to
 * already be populated (the caller — `apply-fix` tool — runs `generateLlmFix` first) and are applied
 * verbatim. `manual-guidance` fixes never touch files.
 *
 * Multiple fixes to the same file are applied sequentially against an in-memory running copy (so they
 * stack correctly within one call), and each touched file is written to disk once, only when `!dryRun`.
 */
export async function applyFixes(fixes: FixItem[], dryRun: boolean): Promise<ApplyFixesOutcome> {
  const fileState = new Map<string, { original: string; current: string }>();
  const applied: AppliedFixEntry[] = [];

  for (const { issue, fix } of fixes) {
    const filePath = issue.sourceLocation.filePath;

    if (!filePath) {
      applied.push({
        fixId: issue.id,
        filePath: '',
        diff: '',
        description: '',
        status: 'skipped',
        failureReason: 'No source location mapped — run map_violations_to_source first.',
      });
      continue;
    }

    if (fix.type === 'manual-guidance') {
      applied.push({
        fixId: issue.id,
        filePath,
        diff: '',
        description: fix.guidance ?? 'Manual review required.',
        status: 'skipped',
        failureReason: 'Manual review required.',
      });
      continue;
    }

    let state = fileState.get(filePath);
    if (!state) {
      try {
        const original = await readFile(filePath, 'utf8');
        state = { original, current: original };
        fileState.set(filePath, state);
      } catch (error) {
        applied.push({
          fixId: issue.id,
          filePath,
          diff: '',
          description: '',
          status: 'failed',
          failureReason: `Could not read file: ${error instanceof Error ? error.message : 'unknown error'}`,
        });
        continue;
      }
    }

    if (fix.type === 'auto-template') {
      const template = issue.remediation.fixTemplateId ? getTemplate(issue.remediation.fixTemplateId) : undefined;
      if (!template) {
        applied.push({ fixId: issue.id, filePath, diff: '', description: '', status: 'skipped', failureReason: 'No fix template registered for this rule.' });
        continue;
      }

      const target = closestTarget(template.detect(state.current, filePath), issue.sourceLocation.startLine);
      if (!target) {
        applied.push({ fixId: issue.id, filePath, diff: '', description: '', status: 'skipped', failureReason: 'Template found nothing fixable at this location.' });
        continue;
      }

      const result = template.transform(state.current, target, issue.sourceLocation.framework);
      if (!result) {
        applied.push({ fixId: issue.id, filePath, diff: '', description: '', status: 'skipped', failureReason: 'Template could not safely apply a fix here.' });
        continue;
      }

      const diff = buildDiff(filePath, state.current, result.newContent);
      state.current = result.newContent;
      applied.push({ fixId: issue.id, filePath, diff, description: result.description, status: 'applied' });
      continue;
    }

    // llm-generated
    const changes = (fix.changes ?? []).filter((change) => change.filePath === filePath);
    if (changes.length === 0) {
      applied.push({ fixId: issue.id, filePath, diff: '', description: '', status: 'skipped', failureReason: 'No LLM-generated change available for this file.' });
      continue;
    }
    for (const change of changes) {
      state.current = change.after;
      applied.push({ fixId: issue.id, filePath: change.filePath, diff: change.diff, description: change.description, status: 'applied' });
    }
  }

  if (!dryRun) {
    for (const [filePath, state] of fileState) {
      if (state.current !== state.original) await writeFile(filePath, state.current, 'utf8');
    }
  }

  const successfullyApplied = applied.filter((entry) => entry.status === 'applied').length;
  const skipped = applied.filter((entry) => entry.status === 'skipped').length;
  const failed = applied.filter((entry) => entry.status === 'failed').length;

  const fileContents = new Map<string, { before: string; after: string }>();
  for (const [filePath, state] of fileState) {
    if (state.current !== state.original) fileContents.set(filePath, { before: state.original, after: state.current });
  }

  const result: ApplyFixResult = {
    applied,
    summary: { totalAttempted: applied.length, successfullyApplied, skipped, failed },
    verification: {
      issuesResolvedCount: successfullyApplied,
      issuesRemainingCount: skipped + failed,
      newIssuesIntroduced: 0,
      complianceScoreBefore: 0,
      complianceScoreAfter: 0,
    },
    warnings: [],
    dryRunNote: dryRun ? 'No files were modified. Call again with dryRun: false to apply.' : undefined,
  };

  return { result, fileContents };
}
