import { createTwoFilesPatch } from 'diff';

/** Unified diff for a `FileChange` — shared by `fix-applier.ts` (template fixes) and `llm-fix-generator.ts` (LLM fixes) so both produce the same diff format. */
export function buildDiff(filePath: string, before: string, after: string): string {
  return createTwoFilesPatch(filePath, filePath, before, after, '', '', { context: 2 });
}
