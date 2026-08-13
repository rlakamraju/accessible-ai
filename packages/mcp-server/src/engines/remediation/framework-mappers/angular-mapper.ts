import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { scanTags } from '../../static-analyzer/custom-rules/tag-scanner.js';
import { bestMatch, findCustomElementToken, parseDeepestSelector, type ScannedTag } from './selector-match.js';
import { componentNameFromPath, walkFiles, type MappedLocation } from './file-walk.js';

const SELECTOR_DECL = /selector\s*:\s*['"]([^'"]+)['"]/;
const TEMPLATE_URL_DECL = /templateUrl\s*:\s*['"]([^'"]+)['"]/;
const INLINE_TEMPLATE_DECL = /template\s*:\s*(['"`])([\s\S]*?)\1/;

interface TemplateSource {
  filePath: string;
  content: string;
  /** Line within `filePath` where `content` starts — 0 for a standalone `.component.html`, >0 for an inline template inside the `.ts` file. */
  lineOffset: number;
}

/** Finds the `.component.ts` declaring `selector: '<componentTag>'` and resolves its template (external or inline). */
async function findComponentTemplate(componentTag: string, projectPath: string): Promise<TemplateSource | undefined> {
  const tsFiles = await walkFiles(projectPath, (name) => name.endsWith('.component.ts'));

  for (const tsPath of tsFiles) {
    let content: string;
    try {
      content = await readFile(tsPath, 'utf8');
    } catch {
      continue;
    }
    const selectorMatch = SELECTOR_DECL.exec(content);
    if (!selectorMatch || selectorMatch[1] !== componentTag) continue;

    const templateUrlMatch = TEMPLATE_URL_DECL.exec(content);
    if (templateUrlMatch) {
      const htmlPath = join(dirname(tsPath), templateUrlMatch[1]);
      try {
        return { filePath: htmlPath, content: await readFile(htmlPath, 'utf8'), lineOffset: 0 };
      } catch {
        continue;
      }
    }

    const inlineMatch = INLINE_TEMPLATE_DECL.exec(content);
    if (inlineMatch) {
      const lineOffset = content.slice(0, inlineMatch.index).split('\n').length - 1;
      return { filePath: tsPath, content: inlineMatch[2], lineOffset };
    }
  }
  return undefined;
}

/**
 * Resolves an Angular custom-element tag in the axe selector chain (e.g. `app-checkout`) to its
 * `@Component` declaration, then scans that component's template. Falls back to scanning every
 * `*.component.html` project-wide if no custom-element ancestor is found (or its template can't be
 * resolved) — still useful for the common case of one component per file in small/medium projects.
 */
export async function mapAngularSelector(cssSelector: string, projectPath: string): Promise<MappedLocation | undefined> {
  const selector = parseDeepestSelector(cssSelector);
  const componentTag = findCustomElementToken(cssSelector);

  if (componentTag) {
    const template = await findComponentTemplate(componentTag, projectPath);
    if (template) {
      const candidates: ScannedTag[] = scanTags(template.content).map((tag) => ({
        ...tag,
        line: tag.line + template.lineOffset,
        filePath: template.filePath,
      }));
      const match = bestMatch(selector, candidates);
      if (match) {
        return { filePath: match.filePath, startLine: match.line, endLine: match.line, componentName: componentTag };
      }
    }
  }

  const files = await walkFiles(projectPath, (name) => name.endsWith('.component.html'));
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
