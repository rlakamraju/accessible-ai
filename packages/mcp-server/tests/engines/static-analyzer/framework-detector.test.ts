import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { detectConventions, detectFramework } from '../../../src/engines/static-analyzer/framework-detector.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, '../../fixtures/framework-detection');

describe('detectFramework', () => {
  it('detects Angular with version and UI library', async () => {
    const result = await detectFramework(join(FIXTURES, 'angular-project'));
    expect(result.framework).toBe('angular');
    expect(result.version).toBe('17.3.0');
    expect(result.uiLibrary).toBe('Angular Material 17.3.0');
    expect(result.hasTests).toBe(true);
    expect(result.testFramework).toBe('jest');
    expect(result.hasA11yTooling).toBe(true);
  });

  it('detects React with version and UI library', async () => {
    const result = await detectFramework(join(FIXTURES, 'react-project'));
    expect(result.framework).toBe('react');
    expect(result.version).toBe('18.3.0');
    expect(result.uiLibrary).toBe('MUI 5.16.0');
    expect(result.testFramework).toBe('vitest');
  });

  it('detects Vue with version and UI library', async () => {
    const result = await detectFramework(join(FIXTURES, 'vue-project'));
    expect(result.framework).toBe('vue');
    expect(result.version).toBe('3.4.0');
    expect(result.uiLibrary).toBe('Vuetify 3.6.0');
    expect(result.testFramework).toBe('karma');
  });

  it('detects WordPress via wp-content directory', async () => {
    const result = await detectFramework(join(FIXTURES, 'wordpress-project'));
    expect(result.framework).toBe('wordpress');
  });

  it('falls back to html when nothing else matches', async () => {
    const result = await detectFramework(join(FIXTURES, 'html-project'));
    expect(result.framework).toBe('html');
    expect(result.hasTests).toBe(false);
  });

  it('finds the nearest package.json in a monorepo subpackage', async () => {
    const result = await detectFramework(join(FIXTURES, 'monorepo-project/packages/app/src'));
    expect(result.framework).toBe('react');
  });
});

describe('detectConventions', () => {
  it('returns naming, import style, and a11y pattern info without throwing', async () => {
    const result = await detectConventions(join(FIXTURES, 'monorepo-project/packages/app'));
    expect(['kebab-case', 'camelCase', 'PascalCase', 'mixed']).toContain(result.fileNaming);
    expect(['relative', 'aliased', 'mixed']).toContain(result.importStyle);
    expect(Array.isArray(result.existingA11yPatterns)).toBe(true);
  });
});
