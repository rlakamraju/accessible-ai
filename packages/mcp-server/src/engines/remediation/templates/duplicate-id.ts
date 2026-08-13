import { attrValue, escapeRegExp, scanTags } from '../../static-analyzer/custom-rules/tag-scanner.js';
import type { FixTarget, FixTemplate, TransformResult } from './types.js';
import { withLine } from './utils.js';

/**
 * WCAG 4.1.1 — de-duplicates repeated `id` attributes by suffixing every occurrence after the first.
 * Does not update `for`/`aria-labelledby` references that pointed at the original id — documented gap,
 * consistent with this repo's regex-over-AST trade-off (see `templates/types.ts`).
 */
export const duplicateIdTemplate: FixTemplate = {
  id: 'duplicate-id',
  wcagCriteria: ['4.1.1'],
  applicableTo: 'all',
  detect(fileContent, filePath): FixTarget[] {
    const tags = scanTags(fileContent);
    const seen = new Map<string, number>();
    const targets: FixTarget[] = [];
    for (const tag of tags) {
      const id = attrValue(tag.attrs, 'id');
      if (!id) continue;
      const occurrence = (seen.get(id) ?? 0) + 1;
      seen.set(id, occurrence);
      if (occurrence > 1) targets.push({ filePath, line: tag.line, tagName: tag.tagName, attrsRaw: tag.attrs });
    }
    return targets;
  },
  transform(fileContent, target): TransformResult | null {
    const id = attrValue(target.attrsRaw, 'id');
    if (!id) return null;

    // Rank by *line number* among every tag whose id is still `id` or already renamed to `id-N` —
    // not by re-scanning for literal matches of `id`, which would collide once an earlier fix in the
    // same batch has already renamed a sibling (fix-applier may process issues in priority order, not
    // line order, and re-runs `detect` against the batch's running content for every issue).
    const groupPattern = new RegExp(`^${escapeRegExp(id)}(-\\d+)?$`);
    const groupLines = scanTags(fileContent)
      .filter((tag) => groupPattern.test(attrValue(tag.attrs, 'id') ?? ''))
      .map((tag) => tag.line)
      .sort((a, b) => a - b);

    const rank = groupLines.indexOf(target.line) + 1; // 1-indexed; the first (canonical) occurrence is never a `detect()` target
    if (rank <= 1) return null;

    const newId = `${id}-${rank}`;
    const idPattern = new RegExp(`\\bid\\s*=\\s*(["'])${escapeRegExp(id)}\\1`, 'i');
    const newContent = withLine(fileContent, target.line, (lineText) => {
      if (!idPattern.test(lineText)) return null;
      return lineText.replace(idPattern, `id="${newId}"`);
    });
    if (!newContent) return null;
    return { newContent, description: `Renamed duplicate id="${id}" to id="${newId}".` };
  },
};
