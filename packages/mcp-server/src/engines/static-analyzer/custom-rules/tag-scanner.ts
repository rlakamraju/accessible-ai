/**
 * Lightweight regex-based tag/attribute scanner shared by the custom accessibility checks.
 *
 * This is a deliberate simplification: building real per-framework ASTs (the Angular compiler,
 * the Vue SFC compiler, a full JSX/Babel parser) just to run five small structural checks would add
 * a lot of dependency weight and complexity for what these checks need. A regex tag scanner handles
 * HTML, Angular templates, and JSX/Vue templates well enough for attribute-presence checks. Its known
 * blind spot: a `>` inside a JSX/Vue expression attribute (e.g. `style={{ x: a > b }}`) can terminate a
 * tag match early. Fine for the structural checks here; revisit with a real parser if that turns out
 * to matter in practice.
 */

export interface TagMatch {
  tagName: string;
  /** Raw attribute string between the tag name and the closing `>`/`/>`. */
  attrs: string;
  line: number;
  index: number;
}

const TAG_PATTERN = /<([a-zA-Z][\w-]*)((?:\s+[^<>]*?)?)\/?>/g;

function buildLineStarts(source: string): number[] {
  const starts = [0];
  for (let i = 0; i < source.length; i++) {
    if (source.charCodeAt(i) === 10) starts.push(i + 1);
  }
  return starts;
}

function lineForIndex(lineStarts: number[], index: number): number {
  let lo = 0;
  let hi = lineStarts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (lineStarts[mid] <= index) lo = mid;
    else hi = mid - 1;
  }
  return lo + 1;
}

export function scanTags(source: string): TagMatch[] {
  const lineStarts = buildLineStarts(source);
  const matches: TagMatch[] = [];
  TAG_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = TAG_PATTERN.exec(source))) {
    matches.push({
      tagName: match[1].toLowerCase(),
      attrs: match[2] ?? '',
      line: lineForIndex(lineStarts, match.index),
      index: match.index,
    });
  }
  return matches;
}

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Matches an event/attribute binding by base name, tolerant of Vue modifiers (e.g. `@keydown.enter=`). */
export function hasEventAttr(attrs: string, baseNames: string[]): boolean {
  return baseNames.some((name) => new RegExp(`(^|\\s)${escapeRegExp(name)}(\\.[\\w-]+)*\\s*=`, 'i').test(attrs));
}

/** Matches a plain (non-event) attribute by name, with or without a value. */
export function hasAttr(attrs: string, names: string[]): boolean {
  return names.some((name) => new RegExp(`(^|\\s)${escapeRegExp(name)}(\\s*=|\\s|$)`, 'i').test(attrs));
}

export function attrValue(attrs: string, name: string): string | undefined {
  const match = new RegExp(`\\b${escapeRegExp(name)}\\s*=\\s*["']?([^"'\\s>]+)`, 'i').exec(attrs);
  return match?.[1];
}
