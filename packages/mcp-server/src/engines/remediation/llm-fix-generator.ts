import { readFile } from 'node:fs/promises';
import { callClaude } from '../../llm/client.js';
import { ACCESSIBILITY_EXPERT_SYSTEM_PROMPT, buildFixGenerationPrompt } from '../../llm/prompts.js';
import { parseFixResponse } from '../../llm/response-parser.js';
import type { AccessibilityIssue } from '../../config/types.js';
import { buildDiff } from './diff-utils.js';
import type { FileChange, ProjectContext } from './types.js';

export type LlmFixResult = { status: 'generated'; changes: FileChange[] } | { status: 'manual-guidance'; guidance: string };

/**
 * Cache key includes the file path (not just `ruleId + codeSnippet.violating`, unlike
 * `deep-analyzer.ts`'s `analysisCache`) — a cached fix's `FileChange.filePath` came from the LLM
 * response for a specific file, and remapping it onto a different file for a "same pattern, different
 * file" cache hit would risk writing the wrong file. Still avoids re-calling Claude for repeated
 * instances of the same violation within one file.
 */
const fixCache = new Map<string, LlmFixResult>();

function cacheKey(issue: AccessibilityIssue): string {
  return `${issue.ruleId}|${issue.sourceLocation.filePath}|${issue.codeSnippet.violating || issue.runtimeContext?.renderedHtml || ''}`;
}

/** Level-2 fix generation (architecture doc section 5.4). Falls back to `manual-guidance` if the LLM's response doesn't parse, or its `searchBlock`s don't actually occur in the target file. */
export async function generateLlmFix(issue: AccessibilityIssue, context: ProjectContext, apiKey?: string): Promise<LlmFixResult> {
  const key = cacheKey(issue);
  const cached = fixCache.get(key);
  if (cached) return cached;

  const filePath = issue.sourceLocation.filePath;
  if (!filePath) {
    const result: LlmFixResult = { status: 'manual-guidance', guidance: 'No source location mapped — run map_violations_to_source first.' };
    fixCache.set(key, result);
    return result;
  }

  let fileContent: string;
  try {
    fileContent = await readFile(filePath, 'utf8');
  } catch (error) {
    const result: LlmFixResult = {
      status: 'manual-guidance',
      guidance: `Could not read ${filePath}: ${error instanceof Error ? error.message : 'unknown error'}`,
    };
    fixCache.set(key, result);
    return result;
  }

  const raw = await callClaude({
    system: ACCESSIBILITY_EXPERT_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: buildFixGenerationPrompt(issue, context, fileContent) }],
    maxTokens: 2048,
    apiKey,
  });

  const parsed = parseFixResponse(raw);
  if (!parsed) {
    const result: LlmFixResult = { status: 'manual-guidance', guidance: raw.trim() || 'The AI response could not be parsed into a fix.' };
    fixCache.set(key, result);
    return result;
  }

  const changes: FileChange[] = [];
  for (const change of parsed.changes ?? []) {
    if (change.filePath !== filePath) continue; // only the target file's own content is loaded above to validate against
    if (!fileContent.includes(change.searchBlock)) continue;
    const after = fileContent.replace(change.searchBlock, change.replaceBlock);
    changes.push({
      filePath: change.filePath,
      changeType: 'modify',
      diff: buildDiff(change.filePath, fileContent, after),
      description: change.description,
      before: fileContent,
      after,
    });
  }

  for (const newFile of parsed.newFiles ?? []) {
    changes.push({
      filePath: newFile.filePath,
      changeType: 'create',
      diff: buildDiff(newFile.filePath, '', newFile.content),
      description: newFile.description,
      before: '',
      after: newFile.content,
    });
  }

  const result: LlmFixResult =
    changes.length > 0
      ? { status: 'generated', changes }
      : { status: 'manual-guidance', guidance: parsed.explanation || 'The AI could not produce a verifiable fix — none of its search blocks matched the file.' };

  fixCache.set(key, result);
  return result;
}
