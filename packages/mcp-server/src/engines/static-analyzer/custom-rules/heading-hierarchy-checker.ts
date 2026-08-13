import { readFile } from 'node:fs/promises';
import type { CustomRuleIssue } from '../types.js';
import { scanTags } from './tag-scanner.js';

const HEADING_PATTERN = /^h([1-6])$/;

/** Flags heading-level gaps and duplicate h1s in document order (WCAG 1.3.1 / 2.4.6). */
export async function checkHeadingHierarchy(filePath: string): Promise<CustomRuleIssue[]> {
  const source = await readFile(filePath, 'utf8');
  const issues: CustomRuleIssue[] = [];

  let previousLevel: number | null = null;
  let h1Count = 0;

  for (const tag of scanTags(source)) {
    const match = HEADING_PATTERN.exec(tag.tagName);
    if (!match) continue;
    const level = Number(match[1]);

    if (level === 1) {
      h1Count++;
      if (h1Count > 1) {
        issues.push({
          ruleId: 'custom/multiple-h1',
          filePath,
          startLine: tag.line,
          endLine: tag.line,
          message: 'Multiple <h1> elements found. A page/component should generally have a single top-level heading.',
          wcagCriteria: ['1.3.1'],
          impact: 'moderate',
        });
      }
    }

    if (previousLevel !== null && level > previousLevel + 1) {
      issues.push({
        ruleId: 'custom/heading-level-skipped',
        filePath,
        startLine: tag.line,
        endLine: tag.line,
        message: `Heading level jumps from h${previousLevel} to h${level}, skipping level(s) in between.`,
        wcagCriteria: ['1.3.1', '2.4.6'],
        impact: 'moderate',
      });
    }

    previousLevel = level;
  }

  return issues;
}
