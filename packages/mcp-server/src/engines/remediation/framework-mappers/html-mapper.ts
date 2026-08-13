import { readFile } from 'node:fs/promises';
import { scanTags } from '../../static-analyzer/custom-rules/tag-scanner.js';
import { bestMatch, parseDeepestSelector, type ScannedTag } from './selector-match.js';
import { componentNameFromPath, walkFiles, type MappedLocation } from './file-walk.js';

/** Scans every `*.html` file under `projectPath` for the tag matching `cssSelector`'s deepest compound. */
export async function mapHtmlSelector(cssSelector: string, projectPath: string): Promise<MappedLocation | undefined> {
  const selector = parseDeepestSelector(cssSelector);
  const files = await walkFiles(projectPath, (name) => name.endsWith('.html'));

  const candidates: ScannedTag[] = [];
  for (const filePath of files) {
    let content: string;
    try {
      content = await readFile(filePath, 'utf8');
    } catch {
      continue;
    }
    for (const tag of scanTags(content)) candidates.push({ ...tag, filePath });
  }

  const match = bestMatch(selector, candidates);
  if (!match) return undefined;
  return { filePath: match.filePath, startLine: match.line, endLine: match.line, componentName: componentNameFromPath(match.filePath) };
}
