import { attrValue, scanTags } from '../../static-analyzer/custom-rules/tag-scanner.js';
import type { FixTarget, FixTemplate, TransformResult } from './types.js';
import { withLine } from './utils.js';

const NATURALLY_FOCUSABLE = new Set(['button', 'a', 'input', 'select', 'textarea']);

/** WCAG 2.4.3 — removes positive `tabindex` on naturally-focusable elements, sets others to `tabindex="0"`. */
export const tabindexFixTemplate: FixTemplate = {
  id: 'tabindex-fix',
  wcagCriteria: ['2.4.3'],
  applicableTo: 'all',
  detect(fileContent, filePath): FixTarget[] {
    return scanTags(fileContent)
      .filter((tag) => {
        const value = attrValue(tag.attrs, 'tabindex');
        return value !== undefined && Number.parseInt(value, 10) > 0;
      })
      .map((tag) => ({ filePath, line: tag.line, tagName: tag.tagName, attrsRaw: tag.attrs }));
  },
  transform(fileContent, target): TransformResult | null {
    const tabindexPattern = /\btabindex\s*=\s*["']?-?\d+["']?/i;
    const removeInstead = NATURALLY_FOCUSABLE.has(target.tagName);

    const newContent = withLine(fileContent, target.line, (lineText) => {
      if (!tabindexPattern.test(lineText)) return null;
      if (removeInstead) return lineText.replace(new RegExp(`\\s*${tabindexPattern.source}`, 'i'), '');
      return lineText.replace(tabindexPattern, 'tabindex="0"');
    });
    if (!newContent) return null;
    return {
      newContent,
      description: removeInstead ? `Removed positive tabindex from <${target.tagName}>.` : `Reset positive tabindex to 0 on <${target.tagName}>.`,
    };
  },
};
