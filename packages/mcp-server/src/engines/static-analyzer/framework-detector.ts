import { readFile, readdir, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { FrameworkType } from '@accessible-ai/standards';
import type { DetectedFramework, ProjectConventions } from './types.js';

interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

/** Walks up from `startPath` looking for the nearest `package.json` (handles monorepo subpackages). */
async function findNearestPackageJson(startPath: string, maxLevels = 8): Promise<string | null> {
  let current = startPath;
  for (let i = 0; i < maxLevels; i++) {
    const candidate = join(current, 'package.json');
    if (await pathExists(candidate)) return candidate;
    const parent = dirname(current);
    if (parent === current) return null;
    current = parent;
  }
  return null;
}

function depVersion(deps: Record<string, string> | undefined, name: string): string | undefined {
  const raw = deps?.[name];
  return raw?.replace(/^[\^~>=<]+/, '');
}

const TEST_FRAMEWORKS = ['jest', 'vitest', 'karma', 'mocha'] as const;
const A11Y_TOOLING = ['eslint-plugin-jsx-a11y', '@angular-eslint/eslint-plugin-template', 'pa11y'];

export async function detectFramework(projectPath: string): Promise<DetectedFramework> {
  const packageJsonPath = await findNearestPackageJson(projectPath);
  const allDeps: Record<string, string> = {};
  let scripts: Record<string, string> = {};

  if (packageJsonPath) {
    try {
      const raw = await readFile(packageJsonPath, 'utf8');
      const pkg = JSON.parse(raw) as PackageJson;
      Object.assign(allDeps, pkg.dependencies, pkg.devDependencies);
      scripts = pkg.scripts ?? {};
    } catch {
      // Malformed package.json — fall through to HTML fallback below.
    }
  }

  let framework: FrameworkType = 'html';
  let version: string | undefined;
  let uiLibrary: string | undefined;

  if (allDeps['@angular/core']) {
    framework = 'angular';
    version = depVersion(allDeps, '@angular/core');
    if (allDeps['@angular/material']) uiLibrary = `Angular Material ${depVersion(allDeps, '@angular/material')}`;
  } else if (allDeps.react || allDeps['react-dom']) {
    framework = 'react';
    version = depVersion(allDeps, 'react') ?? depVersion(allDeps, 'react-dom');
    if (allDeps['@mui/material']) uiLibrary = `MUI ${depVersion(allDeps, '@mui/material')}`;
  } else if (allDeps.vue) {
    framework = 'vue';
    version = depVersion(allDeps, 'vue');
    if (allDeps.vuetify) uiLibrary = `Vuetify ${depVersion(allDeps, 'vuetify')}`;
  } else if (allDeps.svelte) {
    framework = 'svelte';
    version = depVersion(allDeps, 'svelte');
  } else if (await pathExists(join(projectPath, 'wp-content'))) {
    framework = 'wordpress';
  }

  const testFramework = TEST_FRAMEWORKS.find((name) => allDeps[name]);
  const hasTests = Boolean(testFramework) || Boolean(scripts.test);
  const hasA11yTooling = A11Y_TOOLING.some((name) => allDeps[name]);

  return { framework, version, uiLibrary, hasTests, testFramework, hasA11yTooling };
}

const NAMING_IGNORE_DIRS = new Set(['node_modules', 'dist', 'build', '.git', 'coverage', '.turbo']);
const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.vue', '.html'];
const MAX_FILES_SCANNED = 500;

async function collectSourceFiles(root: string): Promise<string[]> {
  const results: string[] = [];
  const queue: string[] = [root];

  while (queue.length && results.length < MAX_FILES_SCANNED) {
    const dir = queue.shift()!;
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (!NAMING_IGNORE_DIRS.has(entry.name)) queue.push(join(dir, entry.name));
      } else if (SOURCE_EXTENSIONS.some((ext) => entry.name.endsWith(ext))) {
        results.push(join(dir, entry.name));
        if (results.length >= MAX_FILES_SCANNED) break;
      }
    }
  }
  return results;
}

function classifyFileName(baseName: string): 'kebab-case' | 'camelCase' | 'PascalCase' | null {
  const stem = baseName.replace(/\.[^.]+$/, '').replace(/\.component$|\.service$|\.module$/, '');
  if (/^[a-z][a-z0-9]*(-[a-z0-9]+)+$/.test(stem)) return 'kebab-case';
  if (/^[A-Z][a-zA-Z0-9]*$/.test(stem)) return 'PascalCase';
  if (/^[a-z][a-zA-Z0-9]*$/.test(stem)) return 'camelCase';
  return null;
}

export async function detectConventions(projectPath: string): Promise<ProjectConventions> {
  const files = await collectSourceFiles(projectPath);

  const namingCounts = { 'kebab-case': 0, camelCase: 0, PascalCase: 0 };
  let relativeImports = 0;
  let aliasedImports = 0;
  const a11yPatterns = new Set<string>();

  for (const filePath of files) {
    const baseName = filePath.split(/[/\\]/).pop()!;
    const classification = classifyFileName(baseName);
    if (classification) namingCounts[classification]++;

    let content: string;
    try {
      content = await readFile(filePath, 'utf8');
    } catch {
      continue;
    }

    for (const match of content.matchAll(/from\s+['"]([^'"]+)['"]/g)) {
      const source = match[1];
      if (source.startsWith('.')) relativeImports++;
      else if (source.startsWith('@/') || source.startsWith('~/')) aliasedImports++;
    }

    if (/@angular\/cdk\/a11y/.test(content)) a11yPatterns.add('@angular/cdk/a11y');
    if (/\baria-[a-z]+=/.test(content)) a11yPatterns.add('aria-attributes');
    if (/\brole=/.test(content)) a11yPatterns.add('role-attribute');
  }

  const namingEntries = Object.entries(namingCounts) as Array<[keyof typeof namingCounts, number]>;
  const totalNamingMatches = namingEntries.reduce((sum, [, count]) => sum + count, 0);
  const [topNaming, topCount] = namingEntries.reduce((best, entry) => (entry[1] > best[1] ? entry : best));
  const fileNaming = totalNamingMatches === 0 || topCount < totalNamingMatches * 0.6 ? 'mixed' : topNaming;

  const totalImports = relativeImports + aliasedImports;
  const importStyle =
    totalImports === 0
      ? 'relative'
      : relativeImports === 0
        ? 'aliased'
        : aliasedImports === 0
          ? 'relative'
          : 'mixed';

  return { fileNaming, importStyle, existingA11yPatterns: Array.from(a11yPatterns) };
}
