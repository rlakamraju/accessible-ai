import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkHeadingHierarchy } from '../../../../src/engines/static-analyzer/custom-rules/heading-hierarchy-checker.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, '../../../fixtures');

describe('checkHeadingHierarchy', () => {
  it('flags an h1 -> h3 gap', async () => {
    const issues = await checkHeadingHierarchy(join(FIXTURES, 'sample-react-project/src/components/ArticlePage.jsx'));
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ ruleId: 'custom/heading-level-skipped' });
  });

  it('does not flag a clean sequential h1 -> h2 hierarchy', async () => {
    const issues = await checkHeadingHierarchy(
      join(FIXTURES, 'sample-angular-project/src/app/clean-widget/clean-widget.component.html'),
    );
    expect(issues).toHaveLength(0);
  });
});
