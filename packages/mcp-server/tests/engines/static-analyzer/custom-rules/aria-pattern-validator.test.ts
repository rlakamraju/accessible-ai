import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkAriaPatterns } from '../../../../src/engines/static-analyzer/custom-rules/aria-pattern-validator.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, '../../../fixtures/custom-rules/aria');

describe('checkAriaPatterns', () => {
  it('flags a dialog missing an accessible name and aria-modal, and a combobox missing aria-expanded', async () => {
    const issues = await checkAriaPatterns(join(FIXTURES, 'bad-dialog.html'));
    const ruleIds = issues.map((i) => i.ruleId);
    expect(ruleIds).toContain('custom/aria-pattern-required-attrs');
    expect(ruleIds).toContain('custom/dialog-missing-aria-modal');
    expect(issues.filter((i) => i.ruleId === 'custom/aria-pattern-required-attrs')).toHaveLength(2); // dialog + combobox
  });

  it('does not flag a properly-attributed dialog and combobox', async () => {
    const issues = await checkAriaPatterns(join(FIXTURES, 'good-dialog.html'));
    expect(issues).toHaveLength(0);
  });
});
