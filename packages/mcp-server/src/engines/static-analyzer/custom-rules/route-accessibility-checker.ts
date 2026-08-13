import { readFile } from 'node:fs/promises';
import type { FrameworkType } from '@accessible-ai/standards';
import type { CustomRuleIssue } from '../types.js';

interface RouteHeuristic {
  routingSignals: RegExp[];
  titleSignals: RegExp[];
  message: string;
}

const HEURISTICS: Partial<Record<FrameworkType, RouteHeuristic>> = {
  react: {
    routingSignals: [/<Route[\s/>]/, /createBrowserRouter\(/],
    titleSignals: [/document\.title\s*=/, /react-helmet/, /<Helmet[\s/>]/, /useTitle\(/],
    message:
      'Routes are defined but no page-title management (document.title, react-helmet, or a useTitle hook) was found anywhere in the project — screen reader users have no cue that the page changed.',
  },
  angular: {
    routingSignals: [/RouterModule\.forRoot\(/, /provideRouter\(/],
    titleSignals: [/\bTitleStrategy\b/, /from ['"]@angular\/platform-browser['"][\s\S]{0,40}\bTitle\b/, /\btitle\s*:\s*['"`]/],
    message:
      "Routing is configured but no TitleStrategy, injected Title service, or per-route `title:` property was found — screen reader users won't be told the page changed on navigation.",
  },
};

/**
 * Project-level check (not per-file/line): flags a routed app with no page-title-on-navigation
 * mechanism anywhere in the scanned files (WCAG 2.4.2 Page Titled).
 */
export async function checkRouteAccessibility(files: string[], framework: FrameworkType): Promise<CustomRuleIssue[]> {
  const heuristic = HEURISTICS[framework];
  if (!heuristic || files.length === 0) return [];

  let routingFile: string | null = null;
  let hasTitleManagement = false;

  for (const filePath of files) {
    let content: string;
    try {
      content = await readFile(filePath, 'utf8');
    } catch {
      continue;
    }

    if (!routingFile && heuristic.routingSignals.some((pattern) => pattern.test(content))) {
      routingFile = filePath;
    }
    if (!hasTitleManagement && heuristic.titleSignals.some((pattern) => pattern.test(content))) {
      hasTitleManagement = true;
    }
    if (routingFile && hasTitleManagement) return []; // both found — nothing to flag, stop early
  }

  if (!routingFile || hasTitleManagement) return [];

  return [
    {
      ruleId: 'custom/route-title-management-missing',
      filePath: routingFile,
      startLine: 1,
      endLine: 1,
      message: heuristic.message,
      wcagCriteria: ['2.4.2'],
      impact: 'moderate',
    },
  ];
}
