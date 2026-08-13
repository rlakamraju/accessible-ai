import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkFormLabels } from '../../../../src/engines/static-analyzer/custom-rules/form-label-checker.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, '../../../fixtures');

describe('checkFormLabels', () => {
  it('flags an input with no label (React)', async () => {
    const issues = await checkFormLabels(join(FIXTURES, 'sample-react-project/src/components/SignupForm.jsx'));
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ ruleId: 'custom/form-control-missing-label' });
  });

  it('flags an input with no label (Angular)', async () => {
    const issues = await checkFormLabels(join(FIXTURES, 'sample-angular-project/src/app/signup-form/signup-form.component.html'));
    expect(issues).toHaveLength(1);
  });

  it('flags an input with no label (Vue)', async () => {
    const issues = await checkFormLabels(join(FIXTURES, 'sample-vue-project/src/components/SignupForm.vue'));
    expect(issues).toHaveLength(1);
  });

  it('does not flag an input with a for-associated label', async () => {
    const issues = await checkFormLabels(join(FIXTURES, 'sample-angular-project/src/app/clean-widget/clean-widget.component.html'));
    expect(issues).toHaveLength(0);
  });
});
