import { hasAttr } from '../../static-analyzer/custom-rules/tag-scanner.js';
import type { FixTarget, FixTemplate, TransformResult } from './types.js';
import { insertAttribute, withLine } from './utils.js';

const EMPTY_BUTTON = /<button\s([^<>]*)>\s*<\/button>/i;

/**
 * WCAG 4.1.2 — adds a placeholder `aria-label="Button"` to buttons with no text and no accessible name.
 * The placeholder text is intentionally generic; a real description of the button's action needs
 * context this template doesn't have (icon meaning, surrounding UI) — flag for review after applying.
 */
export const buttonNameTemplate: FixTemplate = {
  id: 'button-name',
  wcagCriteria: ['4.1.2'],
  applicableTo: 'all',
  detect(fileContent, filePath): FixTarget[] {
    const targets: FixTarget[] = [];
    fileContent.split('\n').forEach((lineText, index) => {
      const match = EMPTY_BUTTON.exec(lineText);
      EMPTY_BUTTON.lastIndex = 0;
      if (!match) return;
      if (hasAttr(match[1], ['aria-label', 'aria-labelledby'])) return;
      targets.push({ filePath, line: index + 1, tagName: 'button', attrsRaw: match[1] });
    });
    return targets;
  },
  transform(fileContent, target): TransformResult | null {
    const newContent = withLine(fileContent, target.line, (lineText) =>
      insertAttribute(lineText, 'button', 'aria-label="Button"'),
    );
    if (!newContent) return null;
    return { newContent, description: 'Added a placeholder aria-label to an unnamed button — replace with a description of its action.' };
  },
};
