import { readFile } from 'node:fs/promises';
import type { CustomRuleIssue } from '../types.js';
import { attrValue, hasEventAttr, scanTags } from './tag-scanner.js';

const CLICK_ATTRS = ['onclick', '(click)', '@click', 'v-on:click'];
const KEY_ATTRS = [
  'onkeydown',
  'onkeyup',
  'onkeypress',
  '(keydown)',
  '(keyup)',
  '(keypress)',
  '@keydown',
  '@keyup',
  '@keypress',
  'v-on:keydown',
  'v-on:keyup',
  'v-on:keypress',
];
/** Natively keyboard-operable elements that don't need an explicit keydown/keyup handler. */
const NATIVE_INTERACTIVE = new Set(['button', 'a', 'input', 'select', 'textarea', 'option', 'summary', 'label']);

/** Finds elements with a click handler but no matching keyboard handler (WCAG 2.1.1 Keyboard). */
export async function checkKeyboardHandlers(filePath: string): Promise<CustomRuleIssue[]> {
  const source = await readFile(filePath, 'utf8');
  const issues: CustomRuleIssue[] = [];

  for (const tag of scanTags(source)) {
    if (NATIVE_INTERACTIVE.has(tag.tagName)) continue;
    if (!hasEventAttr(tag.attrs, CLICK_ATTRS)) continue;
    if (hasEventAttr(tag.attrs, KEY_ATTRS)) continue;
    if (attrValue(tag.attrs, 'role')?.toLowerCase() === 'presentation') continue;

    issues.push({
      ruleId: 'custom/keyboard-handler-required',
      filePath,
      startLine: tag.line,
      endLine: tag.line,
      message: `<${tag.tagName}> has a click handler but no matching keyboard handler (keydown/keyup/keypress). Non-mouse users can't activate it.`,
      wcagCriteria: ['2.1.1'],
      impact: 'serious',
    });
  }

  return issues;
}
