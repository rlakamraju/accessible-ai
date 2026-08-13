import type { FrameworkType } from '@accessible-ai/standards';
import { attrValue, hasAttr } from '../../static-analyzer/custom-rules/tag-scanner.js';
import type { FixTarget, FixTemplate, TransformResult } from './types.js';
import { withLine } from './utils.js';

const EMPTY_ANCHOR = /<a\s([^<>]*)>\s*<\/a>/i;

function slugFromHref(href: string | undefined): string {
  if (!href) return 'Link';
  const clean = href.replace(/^[#/]+|[#/]+$/g, '').split(/[/?#]/).pop() ?? href;
  const words = clean.replace(/[-_]+/g, ' ').trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : 'Link';
}

/**
 * WCAG 2.4.4 — adds an `aria-label` (derived from the `href`) to anchors with no accessible text at all.
 * Anchors with generic text ("click here", "read more") need genuinely meaningful text, which this
 * template deliberately doesn't attempt — `detect` only matches the fully-empty case.
 */
export const linkPurposeTemplate: FixTemplate = {
  id: 'link-purpose',
  wcagCriteria: ['2.4.4'],
  applicableTo: 'all',
  detect(fileContent, filePath): FixTarget[] {
    const targets: FixTarget[] = [];
    const lines = fileContent.split('\n');
    lines.forEach((lineText, index) => {
      const match = EMPTY_ANCHOR.exec(lineText);
      EMPTY_ANCHOR.lastIndex = 0;
      if (!match) return;
      const attrs = match[1];
      if (hasAttr(attrs, ['aria-label', 'aria-labelledby'])) return;
      targets.push({ filePath, line: index + 1, tagName: 'a', attrsRaw: attrs });
    });
    return targets;
  },
  transform(fileContent, target, _framework: FrameworkType): TransformResult | null {
    const label = slugFromHref(attrValue(target.attrsRaw, 'href'));
    const newContent = withLine(fileContent, target.line, (lineText) => {
      const match = EMPTY_ANCHOR.exec(lineText);
      EMPTY_ANCHOR.lastIndex = 0;
      if (!match) return null;
      return lineText.replace(match[0], `<a ${match[1]} aria-label="${label}"></a>`);
    });
    if (!newContent) return null;
    return { newContent, description: `Added aria-label="${label}" to an empty link.` };
  },
};
