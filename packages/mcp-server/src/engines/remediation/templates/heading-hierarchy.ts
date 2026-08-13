import { scanTags } from '../../static-analyzer/custom-rules/tag-scanner.js';
import type { FixTarget, FixTemplate, TransformResult } from './types.js';
import { withLine } from './utils.js';

const HEADING_PATTERN = /^h([1-6])$/;

interface HeadingLine {
  line: number;
  level: number;
  correctedLevel: number;
}

/** Walks the document's headings in order, flattening any jump of more than one level down to `previous + 1`. */
function correctedHeadings(fileContent: string): HeadingLine[] {
  const result: HeadingLine[] = [];
  let previous = 0;
  for (const tag of scanTags(fileContent)) {
    const match = HEADING_PATTERN.exec(tag.tagName);
    if (!match) continue;
    const level = Number(match[1]);
    const correctedLevel = previous === 0 || level <= previous + 1 ? level : previous + 1;
    result.push({ line: tag.line, level, correctedLevel });
    previous = correctedLevel;
  }
  return result;
}

/**
 * WCAG 1.3.1 — flattens heading-level jumps (e.g. h1 -> h3) down to one level below the prior heading.
 * Only rewrites headings whose open+close tags share a line — multi-line heading markup is left alone
 * (flagged for manual review, same trade-off as the rest of this repo's regex-based checks).
 */
export const headingHierarchyTemplate: FixTemplate = {
  id: 'heading-hierarchy',
  wcagCriteria: ['1.3.1'],
  applicableTo: 'all',
  detect(fileContent, filePath): FixTarget[] {
    return correctedHeadings(fileContent)
      .filter((h) => h.correctedLevel !== h.level)
      .map((h) => ({ filePath, line: h.line, tagName: `h${h.level}`, attrsRaw: '' }));
  },
  transform(fileContent, target): TransformResult | null {
    const currentLevel = Number(HEADING_PATTERN.exec(target.tagName)?.[1]);
    const heading = correctedHeadings(fileContent).find((h) => h.line === target.line);
    if (!heading || heading.correctedLevel === currentLevel) return null;
    const newLevel = heading.correctedLevel;

    const openClose = new RegExp(`<(/?)h${currentLevel}([\\s>])`, 'gi');
    const newContent = withLine(fileContent, target.line, (lineText) => {
      if (!openClose.test(lineText)) return null;
      openClose.lastIndex = 0;
      return lineText.replace(openClose, `<$1h${newLevel}$2`);
    });
    if (!newContent) return null;
    return { newContent, description: `Changed <h${currentLevel}> to <h${newLevel}> to avoid skipping a heading level.` };
  },
};
