import { attrValue, hasAttr, scanTags } from '../../static-analyzer/custom-rules/tag-scanner.js';
import type { FixTarget, FixTemplate, TransformResult } from './types.js';
import { attrValueQuoted, insertAttribute, withLine } from './utils.js';

const DECORATIVE_HINTS = /(icon|decorative|decoration|spacer|bullet|divider|ornament)/i;

function looksDecorative(attrs: string): boolean {
  if (attrValue(attrs, 'role') === 'presentation' || attrValue(attrs, 'role') === 'none') return true;
  const className = attrValueQuoted(attrs, 'class') ?? '';
  const src = attrValue(attrs, 'src') ?? '';
  return DECORATIVE_HINTS.test(className) || DECORATIVE_HINTS.test(src);
}

/**
 * WCAG 1.1.1 — adds `alt=""` to images that look decorative (icon/spacer classes, `role="presentation"`).
 * Non-decorative images need genuine alt text, which requires meaning this template can't supply —
 * those stay `llm-assisted` at the rule level (see `engines/remediation/issue-normalizer.ts`).
 */
export const imageAltDecorativeTemplate: FixTemplate = {
  id: 'image-alt-decorative',
  wcagCriteria: ['1.1.1'],
  applicableTo: 'all',
  detect(fileContent, filePath): FixTarget[] {
    return scanTags(fileContent)
      .filter((tag) => tag.tagName === 'img' && !hasAttr(tag.attrs, ['alt']) && looksDecorative(tag.attrs))
      .map((tag) => ({ filePath, line: tag.line, tagName: tag.tagName, attrsRaw: tag.attrs }));
  },
  transform(fileContent, target): TransformResult | null {
    const newContent = withLine(fileContent, target.line, (lineText) => insertAttribute(lineText, 'img', 'alt=""'));
    if (!newContent) return null;
    return { newContent, description: 'Added alt="" to a decorative image.' };
  },
};
