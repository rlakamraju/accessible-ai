import { attrValue, type TagMatch } from '../../static-analyzer/custom-rules/tag-scanner.js';

export interface ParsedSelector {
  tag?: string;
  id?: string;
  classes: string[];
  attrs: Array<{ name: string; value?: string }>;
}

const COMPOUND_PATTERN = /^([a-zA-Z][\w-]*)?(#[\w-]+)?((?:\.[\w-]+)*)((?:\[[^\]]+\])*)$/;
const ATTR_PATTERN = /\[([\w-]+)(?:=("|')?([^"'\]]*)\2?)?\]/g;

function parseCompound(compound: string): ParsedSelector {
  const match = COMPOUND_PATTERN.exec(compound);
  if (!match) return { classes: [], attrs: [] };
  const [, tag, idPart, classPart, attrPart] = match;
  const classes = classPart ? classPart.split('.').filter(Boolean) : [];
  const attrs: Array<{ name: string; value?: string }> = [];
  let attrMatch: RegExpExecArray | null;
  ATTR_PATTERN.lastIndex = 0;
  while ((attrMatch = ATTR_PATTERN.exec(attrPart ?? ''))) attrs.push({ name: attrMatch[1], value: attrMatch[3] });
  return { tag: tag?.toLowerCase(), id: idPart?.slice(1), classes, attrs };
}

/** Splits a full axe/DOM CSS path (combinators included) into its individual compound tokens, deepest last. */
export function compoundTokens(cssSelector: string): string[] {
  return cssSelector
    .trim()
    .split(/\s+/)
    .filter((token) => token && token !== '>' && token !== '+' && token !== '~');
}

/** Parses the rightmost (deepest / target) compound of a full CSS path. */
export function parseDeepestSelector(cssSelector: string): ParsedSelector {
  const tokens = compoundTokens(cssSelector);
  return parseCompound(tokens.at(-1) ?? '');
}

/** A hyphenated tag name that isn't a standard SVG/custom-data element — heuristic for Angular/Vue/web-component tags. */
export function findCustomElementToken(cssSelector: string): string | undefined {
  for (const token of compoundTokens(cssSelector)) {
    const parsed = parseCompound(token);
    if (parsed.tag?.includes('-')) return parsed.tag;
  }
  return undefined;
}

/**
 * Scores how well a scanned tag matches a parsed selector. Any selector part that's present but doesn't
 * match disqualifies the tag (score 0) — this is a best-effort heuristic, not a real selector engine, so
 * being conservative (no false positives) matters more than matching every case.
 */
export function scoreTagMatch(selector: ParsedSelector, tag: TagMatch): number {
  let score = 0;

  if (selector.tag) {
    if (tag.tagName !== selector.tag) return 0;
    score += 2;
  }
  if (selector.id) {
    if (attrValue(tag.attrs, 'id') !== selector.id) return 0;
    score += 5;
  }
  if (selector.classes.length > 0) {
    const classList = (attrValue(tag.attrs, 'class') ?? '').split(/\s+/).filter(Boolean);
    for (const cls of selector.classes) {
      if (!classList.includes(cls)) return 0;
      score += 1;
    }
  }
  for (const attr of selector.attrs) {
    const value = attrValue(tag.attrs, attr.name);
    if (value === undefined) return 0;
    if (attr.value !== undefined && value !== attr.value) return 0;
    score += 2;
  }

  return score;
}

export interface ScannedTag extends TagMatch {
  filePath: string;
}

/** Finds the best-scoring tag across every `(filePath, tags)` pair. Returns `undefined` if nothing scores above 0. */
export function bestMatch(selector: ParsedSelector, candidates: ScannedTag[]): ScannedTag | undefined {
  let best: ScannedTag | undefined;
  let bestScore = 0;
  for (const candidate of candidates) {
    const score = scoreTagMatch(selector, candidate);
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }
  return best;
}
