import { readFile } from 'node:fs/promises';
import type { CustomRuleIssue } from '../types.js';
import { attrValue, hasAttr, scanTags } from './tag-scanner.js';

const NAME_ATTRS = ['aria-label', 'aria-labelledby'];

interface RolePattern {
  /** Groups of attribute names; each group must have at least one attribute present. */
  requiredAnyOf: string[][];
  message: string;
}

const ROLE_PATTERNS: Record<string, RolePattern> = {
  dialog: { requiredAnyOf: [NAME_ATTRS], message: 'role="dialog" must have an accessible name via aria-label or aria-labelledby.' },
  alertdialog: { requiredAnyOf: [NAME_ATTRS], message: 'role="alertdialog" must have an accessible name via aria-label or aria-labelledby.' },
  tablist: { requiredAnyOf: [NAME_ATTRS], message: 'role="tablist" should have an accessible name via aria-label or aria-labelledby.' },
  combobox: { requiredAnyOf: [['aria-expanded']], message: 'role="combobox" must declare aria-expanded to indicate whether its popup is open.' },
  menu: { requiredAnyOf: [NAME_ATTRS], message: 'role="menu" should have an accessible name via aria-label or aria-labelledby.' },
};

/** Validates that common ARIA widget patterns carry their required attributes (WCAG 4.1.2 Name, Role, Value). */
export async function checkAriaPatterns(filePath: string): Promise<CustomRuleIssue[]> {
  const source = await readFile(filePath, 'utf8');
  const issues: CustomRuleIssue[] = [];

  for (const tag of scanTags(source)) {
    const role = attrValue(tag.attrs, 'role')?.toLowerCase();
    if (!role) continue;

    const pattern = ROLE_PATTERNS[role];
    if (pattern) {
      const satisfied = pattern.requiredAnyOf.every((group) => hasAttr(tag.attrs, group));
      if (!satisfied) {
        issues.push({
          ruleId: 'custom/aria-pattern-required-attrs',
          filePath,
          startLine: tag.line,
          endLine: tag.line,
          message: pattern.message,
          wcagCriteria: ['4.1.2'],
          impact: 'serious',
        });
      }
    }

    if ((role === 'dialog' || role === 'alertdialog') && attrValue(tag.attrs, 'aria-modal')?.toLowerCase() !== 'true') {
      issues.push({
        ruleId: 'custom/dialog-missing-aria-modal',
        filePath,
        startLine: tag.line,
        endLine: tag.line,
        message: `role="${role}" should set aria-modal="true" so assistive tech treats background content as inert.`,
        wcagCriteria: ['4.1.2'],
        impact: 'moderate',
      });
    }
  }

  return issues;
}
