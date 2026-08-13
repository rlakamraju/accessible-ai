import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkKeyboardHandlers } from '../../../../src/engines/static-analyzer/custom-rules/keyboard-handler-checker.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, '../../../fixtures');

describe('checkKeyboardHandlers', () => {
  it('flags a div with a click handler but no keyboard handler (React)', async () => {
    const issues = await checkKeyboardHandlers(join(FIXTURES, 'sample-react-project/src/components/ClickableCard.jsx'));
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ ruleId: 'custom/keyboard-handler-required', wcagCriteria: ['2.1.1'] });
  });

  it('flags a div with (click) but no (keydown) (Angular)', async () => {
    const issues = await checkKeyboardHandlers(
      join(FIXTURES, 'sample-angular-project/src/app/clickable-card/clickable-card.component.html'),
    );
    expect(issues).toHaveLength(1);
  });

  it('flags a div with @click but no @keydown (Vue)', async () => {
    const issues = await checkKeyboardHandlers(join(FIXTURES, 'sample-vue-project/src/components/ClickableCard.vue'));
    expect(issues).toHaveLength(1);
  });

  it('does not flag a native <button> with onClick', async () => {
    const issues = await checkKeyboardHandlers(join(FIXTURES, 'sample-react-project/src/components/CleanButton.jsx'));
    expect(issues).toHaveLength(0);
  });

  it('does not flag a clean widget with both click and keydown handlers', async () => {
    const issues = await checkKeyboardHandlers(
      join(FIXTURES, 'sample-angular-project/src/app/clean-widget/clean-widget.component.html'),
    );
    expect(issues).toHaveLength(0);
  });
});
