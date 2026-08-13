import { readFile, stat } from 'node:fs/promises';
import { dirname, extname, resolve } from 'node:path';
import type { AccessibilityIssue } from '../../config/types.js';
import { detectConventions, detectFramework } from '../static-analyzer/framework-detector.js';
import type { ProjectContext } from './types.js';

/** Package-name substrings that signal existing accessibility *tooling* (as opposed to `detectConventions`'s in-file aria/role attribute patterns) is already in use. */
const A11Y_IMPORT_HINTS = ['@angular/cdk/a11y', 'react-aria', 'focus-trap', 'vue-a11y', '@reach/', 'downshift', 'aria-live'];

const IMPORT_LINE = /(?:import\s+(?:[^'"]+from\s+)?|require\()\s*['"]([^'"]+)['"]/g;

function findExistingA11yImports(fileContent: string): string[] {
  const found = new Set<string>();
  let match: RegExpExecArray | null;
  IMPORT_LINE.lastIndex = 0;
  while ((match = IMPORT_LINE.exec(fileContent))) {
    const source = match[1];
    if (A11Y_IMPORT_HINTS.some((hint) => source.includes(hint))) found.add(source);
  }
  return Array.from(found);
}

async function resolveRelatedFiles(filePath: string, fileContent: string): Promise<string[]> {
  const dir = dirname(filePath);
  const ext = extname(filePath);
  const candidateExts = [ext, '.ts', '.tsx', '.js', '.jsx', '.vue', '.html'];
  const related: string[] = [];

  let match: RegExpExecArray | null;
  IMPORT_LINE.lastIndex = 0;
  while ((match = IMPORT_LINE.exec(fileContent))) {
    const source = match[1];
    if (!source.startsWith('.')) continue;
    const base = resolve(dir, source);
    for (const candidateExt of candidateExts) {
      const candidate = base.endsWith(candidateExt) ? base : `${base}${candidateExt}`;
      try {
        await stat(candidate);
        related.push(candidate);
        break;
      } catch {
        continue;
      }
    }
  }
  return related;
}

/**
 * Gathers the context an LLM fix generator needs to produce a framework-idiomatic fix (architecture
 * doc section 5.4, Level 2). Reuses `framework-detector.ts`'s `detectConventions` (built in Phase 4 but
 * never wired into anything) for naming convention + existing aria/role usage, rather than re-deriving
 * naming heuristics here.
 */
export async function gatherProjectContext(projectPath: string, issue: AccessibilityIssue): Promise<ProjectContext> {
  const [detected, conventions] = await Promise.all([detectFramework(projectPath), detectConventions(projectPath)]);
  const filePath = issue.sourceLocation.filePath;

  let existingA11yImports: string[] = [...conventions.existingA11yPatterns];
  let relatedFiles: string[] = [];

  if (filePath) {
    try {
      const content = await readFile(filePath, 'utf8');
      existingA11yImports = Array.from(new Set([...existingA11yImports, ...findExistingA11yImports(content)]));
      relatedFiles = await resolveRelatedFiles(filePath, content);
    } catch {
      // File unreadable — leave context minimal rather than failing the whole gather.
    }
  }

  return {
    framework: detected.framework,
    frameworkVersion: detected.version,
    uiLibrary: detected.uiLibrary,
    namingConvention: conventions.fileNaming,
    hasTests: detected.hasTests,
    existingA11yImports,
    relatedFiles,
  };
}
