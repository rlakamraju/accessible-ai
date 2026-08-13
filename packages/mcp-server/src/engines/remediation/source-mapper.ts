import type { FrameworkType } from '@accessible-ai/standards';
import type { AccessibilityIssue } from '../../config/types.js';
import { mapHtmlSelector } from './framework-mappers/html-mapper.js';
import { mapReactSelector } from './framework-mappers/react-mapper.js';
import { mapVueSelector } from './framework-mappers/vue-mapper.js';
import { mapAngularSelector } from './framework-mappers/angular-mapper.js';
import type { MappedLocation } from './framework-mappers/file-walk.js';

async function mapOne(cssSelector: string, projectPath: string, framework: FrameworkType): Promise<MappedLocation | undefined> {
  switch (framework) {
    case 'angular':
      return mapAngularSelector(cssSelector, projectPath);
    case 'react':
      return mapReactSelector(cssSelector, projectPath);
    case 'vue':
      return mapVueSelector(cssSelector, projectPath);
    default:
      return mapHtmlSelector(cssSelector, projectPath);
  }
}

/**
 * Runtime → source mapper (architecture doc section 5.2). Only fills in issues that don't already have
 * a `sourceLocation` (i.e. runtime/axe issues normalized with a placeholder location) — static issues
 * already know their file/line from Phase 4's analysis and pass through untouched. No real per-framework
 * AST is used (see `templates/types.ts`'s header comment for the repo-wide rationale) — matching is a
 * best-effort CSS-selector-to-source-tag heuristic, so some violations (dynamic content, third-party
 * widgets, `:nth-child`/pseudo-selectors, shadow DOM) will legitimately stay unmapped.
 */
export async function mapViolationsToSource(
  issues: AccessibilityIssue[],
  projectPath: string,
  framework: FrameworkType,
): Promise<AccessibilityIssue[]> {
  const results: AccessibilityIssue[] = [];

  for (const issue of issues) {
    if (issue.sourceLocation.filePath || !issue.runtimeContext) {
      results.push(issue);
      continue;
    }

    const mapped = await mapOne(issue.runtimeContext.cssSelector, projectPath, framework);
    if (!mapped) {
      results.push(issue);
      continue;
    }

    results.push({
      ...issue,
      sourceLocation: {
        filePath: mapped.filePath,
        startLine: mapped.startLine,
        endLine: mapped.endLine,
        framework,
        componentName: mapped.componentName,
      },
    });
  }

  return results;
}
