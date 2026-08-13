import { readFile } from 'node:fs/promises';
import { scanTags } from '../../static-analyzer/custom-rules/tag-scanner.js';
import { bestMatch, parseDeepestSelector, type ScannedTag } from './selector-match.js';
import { componentNameFromPath, walkFiles, type MappedLocation } from './file-walk.js';

const TEMPLATE_BLOCK = /<template[^>]*>([\s\S]*?)<\/template>/i;

/** Scans the `<template>` block of every `.vue` SFC under `projectPath` (skips `<script>`/`<style>` so those blocks' unrelated tags never false-match). */
export async function mapVueSelector(cssSelector: string, projectPath: string): Promise<MappedLocation | undefined> {
  const selector = parseDeepestSelector(cssSelector);
  const files = await walkFiles(projectPath, (name) => name.endsWith('.vue'));

  const candidates: ScannedTag[] = [];
  for (const filePath of files) {
    let content: string;
    try {
      content = await readFile(filePath, 'utf8');
    } catch {
      continue;
    }
    const templateMatch = TEMPLATE_BLOCK.exec(content);
    if (!templateMatch) continue;
    const offsetLines = content.slice(0, templateMatch.index).split('\n').length - 1;
    for (const tag of scanTags(templateMatch[1])) {
      candidates.push({ ...tag, line: tag.line + offsetLines, filePath });
    }
  }

  const match = bestMatch(selector, candidates);
  if (!match) return undefined;
  return { filePath: match.filePath, startLine: match.line, endLine: match.line, componentName: componentNameFromPath(match.filePath) };
}
