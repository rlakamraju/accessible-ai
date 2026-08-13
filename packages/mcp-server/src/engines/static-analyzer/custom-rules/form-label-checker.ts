import { readFile } from 'node:fs/promises';
import type { CustomRuleIssue } from '../types.js';
import { attrValue, hasAttr, scanTags } from './tag-scanner.js';

const LABELABLE_TAGS = new Set(['input', 'select', 'textarea']);
const SKIP_INPUT_TYPES = new Set(['hidden', 'submit', 'button', 'reset', 'image']);
const LABEL_WRAP_WINDOW = 400;

/** True if `index` (a control's position in `source`) sits inside an unclosed `<label>...</label>` pair. */
function isWrappedInLabel(source: string, index: number): boolean {
  const before = source.slice(Math.max(0, index - LABEL_WRAP_WINDOW), index);
  const after = source.slice(index, index + LABEL_WRAP_WINDOW);

  const lastOpenTag = before.lastIndexOf('<label');
  if (lastOpenTag === -1) return false;
  if (before.indexOf('</label>', lastOpenTag) !== -1) return false; // already closed before our control
  return after.includes('</label>');
}

/** Finds form controls with no discoverable accessible label (WCAG 1.3.1 / 4.1.2). */
export async function checkFormLabels(filePath: string): Promise<CustomRuleIssue[]> {
  const source = await readFile(filePath, 'utf8');
  const tags = scanTags(source);

  const labelFors = new Set<string>();
  for (const tag of tags) {
    if (tag.tagName !== 'label') continue;
    const forId = attrValue(tag.attrs, 'for') ?? attrValue(tag.attrs, 'htmlFor');
    if (forId) labelFors.add(forId);
  }

  const issues: CustomRuleIssue[] = [];
  for (const tag of tags) {
    if (!LABELABLE_TAGS.has(tag.tagName)) continue;

    const type = attrValue(tag.attrs, 'type')?.toLowerCase();
    if (type && SKIP_INPUT_TYPES.has(type)) continue;
    if (hasAttr(tag.attrs, ['aria-label', 'aria-labelledby'])) continue;

    const id = attrValue(tag.attrs, 'id');
    if (id && labelFors.has(id)) continue;
    if (isWrappedInLabel(source, tag.index)) continue;

    issues.push({
      ruleId: 'custom/form-control-missing-label',
      filePath,
      startLine: tag.line,
      endLine: tag.line,
      message: `<${tag.tagName}> has no discoverable accessible label (no <label for>, wrapping <label>, aria-label, or aria-labelledby).`,
      wcagCriteria: ['1.3.1', '4.1.2'],
      impact: 'critical',
    });
  }

  return issues;
}
