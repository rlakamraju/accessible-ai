/** Shared line-level text helpers for the Level-1 fix templates — see `types.ts` for why these operate on raw text rather than an AST. */

/** Rewrites a single 1-indexed line via `fn`. Returns the whole new file content, or `null` if `fn` made no change. */
export function withLine(content: string, line: number, fn: (lineText: string) => string | null): string | null {
  const lines = content.split('\n');
  const idx = line - 1;
  if (idx < 0 || idx >= lines.length) return null;
  const updated = fn(lines[idx]);
  if (updated === null || updated === lines[idx]) return null;
  lines[idx] = updated;
  return lines.join('\n');
}

/** Inserts a new line of text immediately before the given 1-indexed line, preserving its indentation. */
export function insertLineBefore(content: string, line: number, newLineText: string): string | null {
  const lines = content.split('\n');
  const idx = line - 1;
  if (idx < 0 || idx >= lines.length) return null;
  const indentMatch = /^\s*/.exec(lines[idx]);
  const indent = indentMatch ? indentMatch[0] : '';
  lines.splice(idx, 0, `${indent}${newLineText}`);
  return lines.join('\n');
}

/** Inserts `attrString` right after the opening `<tagName` on the given line (before any existing attributes). */
export function insertAttribute(lineText: string, tagName: string, attrString: string): string | null {
  const pattern = new RegExp(`<${tagName}(\\s|>|/)`, 'i');
  if (!pattern.test(lineText)) return null;
  return lineText.replace(pattern, `<${tagName} ${attrString}$1`);
}

/**
 * Like `tag-scanner.ts`'s `attrValue`, but captures the *full* quoted value even when it contains
 * spaces (e.g. `content="width=device-width, maximum-scale=1"` or `class="icon btn"`). `attrValue`
 * stops at the first whitespace, which is fine for its Phase-4 callers (single-token values) but wrong
 * for these templates — kept as a separate helper rather than changing `attrValue` itself, since that's
 * shared with the static analyzer's custom rules.
 */
export function attrValueQuoted(attrs: string, name: string): string | undefined {
  const match = new RegExp(`\\b${name}\\s*=\\s*(["'])([^"']*)\\1`, 'i').exec(attrs);
  return match?.[2];
}
