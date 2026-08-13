import { attrValue, scanTags } from '../../static-analyzer/custom-rules/tag-scanner.js';
import type { FixTarget, FixTemplate, TransformResult } from './types.js';
import { attrValueQuoted, withLine } from './utils.js';

const RESTRICTIVE_TOKEN = /\s*(maximum-scale\s*=\s*[^,]+|user-scalable\s*=\s*(no|0))\s*,?/gi;

/** WCAG 1.4.4 — removes `maximum-scale`/`user-scalable=no` from the viewport meta tag so users can zoom. */
export const metaViewportTemplate: FixTemplate = {
  id: 'meta-viewport',
  wcagCriteria: ['1.4.4'],
  applicableTo: 'all',
  detect(fileContent, filePath): FixTarget[] {
    return scanTags(fileContent)
      .filter((tag) => {
        if (tag.tagName !== 'meta' || attrValue(tag.attrs, 'name') !== 'viewport') return false;
        const content = attrValueQuoted(tag.attrs, 'content') ?? '';
        return /maximum-scale\s*=|user-scalable\s*=\s*(no|0)/i.test(content);
      })
      .map((tag) => ({ filePath, line: tag.line, tagName: tag.tagName, attrsRaw: tag.attrs }));
  },
  transform(fileContent, target): TransformResult | null {
    const newContent = withLine(fileContent, target.line, (lineText) => {
      const contentMatch = /content\s*=\s*(["'])([^"']*)\1/i.exec(lineText);
      if (!contentMatch) return null;
      const cleaned = contentMatch[2].replace(RESTRICTIVE_TOKEN, '').replace(/,\s*$/, '').trim();
      if (cleaned === contentMatch[2]) return null;
      return lineText.replace(contentMatch[0], `content=${contentMatch[1]}${cleaned}${contentMatch[1]}`);
    });
    if (!newContent) return null;
    return { newContent, description: 'Removed maximum-scale/user-scalable restrictions from the viewport meta tag.' };
  },
};
