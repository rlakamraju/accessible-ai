import { readFile } from 'node:fs/promises';
import { scanTags } from '../../static-analyzer/custom-rules/tag-scanner.js';
import { bestMatch, parseDeepestSelector, type ScannedTag } from './selector-match.js';
import { componentNameFromPath, walkFiles, type MappedLocation } from './file-walk.js';

/** JSX source uses `className`, but axe's rendered `cssSelector` reports the DOM's `class` — alias one onto the other so the shared selector scorer (which only knows `class=`) can match a plain string `className` value. Dynamic/templated `className` expressions aren't handled (documented blind spot). */
function withClassAlias(attrs: string): string {
  if (/\bclass\s*=/.test(attrs)) return attrs;
  const match = /\bclassName\s*=\s*(["'])([^"']*)\1/.exec(attrs);
  return match ? `${attrs} class="${match[2]}"` : attrs;
}

/** Scans every `*.jsx`/`*.tsx` file under `projectPath`. */
export async function mapReactSelector(cssSelector: string, projectPath: string): Promise<MappedLocation | undefined> {
  const selector = parseDeepestSelector(cssSelector);
  const files = await walkFiles(projectPath, (name) => name.endsWith('.jsx') || name.endsWith('.tsx'));

  const candidates: ScannedTag[] = [];
  for (const filePath of files) {
    let content: string;
    try {
      content = await readFile(filePath, 'utf8');
    } catch {
      continue;
    }
    for (const tag of scanTags(content)) candidates.push({ ...tag, attrs: withClassAlias(tag.attrs), filePath });
  }

  const match = bestMatch(selector, candidates);
  if (!match) return undefined;
  return { filePath: match.filePath, startLine: match.line, endLine: match.line, componentName: componentNameFromPath(match.filePath) };
}
