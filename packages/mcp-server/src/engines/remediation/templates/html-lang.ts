import { hasAttr, scanTags } from '../../static-analyzer/custom-rules/tag-scanner.js';
import type { FixTarget, FixTemplate, TransformResult } from './types.js';
import { withLine } from './utils.js';

/** WCAG 3.1.1 — adds a default `lang="en"` to an `<html>` element missing one. */
export const htmlLangTemplate: FixTemplate = {
  id: 'html-lang',
  wcagCriteria: ['3.1.1'],
  applicableTo: 'all',
  detect(fileContent, filePath): FixTarget[] {
    return scanTags(fileContent)
      .filter((tag) => tag.tagName === 'html' && !hasAttr(tag.attrs, ['lang']))
      .map((tag) => ({ filePath, line: tag.line, tagName: tag.tagName, attrsRaw: tag.attrs }));
  },
  transform(fileContent, target): TransformResult | null {
    const newContent = withLine(fileContent, target.line, (lineText) => {
      if (!/<html(\s|>|\/)/i.test(lineText) || /\blang\s*=/i.test(lineText)) return null;
      return lineText.replace(/<html(\s|>|\/)/i, '<html lang="en"$1');
    });
    if (!newContent) return null;
    return { newContent, description: 'Added lang="en" to the <html> element.' };
  },
};
