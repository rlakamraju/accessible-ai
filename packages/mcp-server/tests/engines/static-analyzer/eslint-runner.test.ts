import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { runEslintAnalysis } from '../../../src/engines/static-analyzer/eslint-runner.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, '../../fixtures');

const REACT_RULES = ['jsx-a11y/alt-text', 'jsx-a11y/click-events-have-key-events', 'jsx-a11y/label-has-associated-control'];
const ANGULAR_RULES = [
  '@angular-eslint/template/alt-text',
  '@angular-eslint/template/click-events-have-key-events',
  '@angular-eslint/template/label-has-associated-control',
];
const VUE_RULES = ['vuejs-accessibility/alt-text', 'vuejs-accessibility/click-events-have-key-events', 'vuejs-accessibility/form-control-has-label'];

describe('runEslintAnalysis', () => {
  it('finds jsx-a11y violations in the sample React project', async () => {
    const result = await runEslintAnalysis(join(FIXTURES, 'sample-react-project'), 'react', REACT_RULES);
    const rulesHit = result.issues.map((i) => i.ruleId);
    expect(rulesHit).toContain('jsx-a11y/alt-text');
    expect(rulesHit).toContain('jsx-a11y/click-events-have-key-events');
    expect(result.summary.totalIssues).toBe(result.issues.length);
    expect(result.summary.byRule['jsx-a11y/alt-text']).toBe(1);
  });

  it('produces no violations for clean React components', async () => {
    const result = await runEslintAnalysis(join(FIXTURES, 'sample-react-project'), 'react', REACT_RULES);
    const cleanFileIssues = result.issues.filter((i) => i.filePath.includes('CleanButton'));
    expect(cleanFileIssues).toHaveLength(0);
  });

  it('finds @angular-eslint/template violations in the sample Angular project', async () => {
    const result = await runEslintAnalysis(join(FIXTURES, 'sample-angular-project'), 'angular', ANGULAR_RULES);
    const rulesHit = result.issues.map((i) => i.ruleId);
    expect(rulesHit).toContain('@angular-eslint/template/alt-text');
    expect(rulesHit).toContain('@angular-eslint/template/click-events-have-key-events');
    const cleanFileIssues = result.issues.filter((i) => i.filePath.includes('clean-widget'));
    expect(cleanFileIssues).toHaveLength(0);
  });

  it('finds vuejs-accessibility violations in the sample Vue project', async () => {
    const result = await runEslintAnalysis(join(FIXTURES, 'sample-vue-project'), 'vue', VUE_RULES);
    const rulesHit = result.issues.map((i) => i.ruleId);
    expect(rulesHit).toContain('vuejs-accessibility/alt-text');
    expect(rulesHit).toContain('vuejs-accessibility/click-events-have-key-events');
    const cleanFileIssues = result.issues.filter((i) => i.filePath.includes('CleanWidget'));
    expect(cleanFileIssues).toHaveLength(0);
  });

  it('only activates rules present in ruleIds (rule filtering)', async () => {
    const result = await runEslintAnalysis(join(FIXTURES, 'sample-react-project'), 'react', ['jsx-a11y/alt-text']);
    const rulesHit = new Set(result.issues.map((i) => i.ruleId));
    expect(rulesHit).toEqual(new Set(['jsx-a11y/alt-text']));
  });

  it('returns an empty result when no rules match the framework', async () => {
    const result = await runEslintAnalysis(join(FIXTURES, 'sample-react-project'), 'react', ANGULAR_RULES);
    expect(result).toEqual({ issues: [], summary: { totalFiles: 0, filesWithIssues: 0, totalIssues: 0, byRule: {} } });
  });

  it('returns an empty result for frameworks with no ESLint coverage yet', async () => {
    const result = await runEslintAnalysis(join(FIXTURES, 'framework-detection/html-project'), 'html', ['jsx-a11y/alt-text']);
    expect(result).toEqual({ issues: [], summary: { totalFiles: 0, filesWithIssues: 0, totalIssues: 0, byRule: {} } });
  });
});
