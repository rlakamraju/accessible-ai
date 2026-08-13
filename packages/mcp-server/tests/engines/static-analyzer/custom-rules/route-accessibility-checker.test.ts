import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkRouteAccessibility } from '../../../../src/engines/static-analyzer/custom-rules/route-accessibility-checker.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, '../../../fixtures/custom-rules/routes');

describe('checkRouteAccessibility', () => {
  it('flags a React app with routes but no title management', async () => {
    const file = join(FIXTURES, 'react-no-title/App.tsx');
    const issues = await checkRouteAccessibility([file], 'react');
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ ruleId: 'custom/route-title-management-missing', wcagCriteria: ['2.4.2'] });
  });

  it('does not flag a React app that sets document.title', async () => {
    const file = join(FIXTURES, 'react-with-title/App.tsx');
    const issues = await checkRouteAccessibility([file], 'react');
    expect(issues).toHaveLength(0);
  });

  it('flags an Angular app with routing but no TitleStrategy/title', async () => {
    const file = join(FIXTURES, 'angular-no-title/app.module.ts');
    const issues = await checkRouteAccessibility([file], 'angular');
    expect(issues).toHaveLength(1);
  });

  it('does not flag an Angular app with per-route title properties', async () => {
    const file = join(FIXTURES, 'angular-with-title/app.module.ts');
    const issues = await checkRouteAccessibility([file], 'angular');
    expect(issues).toHaveLength(0);
  });

  it('does not flag a project with no routing at all', async () => {
    const issues = await checkRouteAccessibility([join(FIXTURES, 'react-with-title/App.tsx')], 'vue');
    expect(issues).toHaveLength(0);
  });
});
