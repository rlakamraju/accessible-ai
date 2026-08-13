import { attrValue, hasAttr, scanTags } from '../../static-analyzer/custom-rules/tag-scanner.js';
import type { FixTarget, FixTemplate, TransformResult } from './types.js';
import { insertAttribute, withLine } from './utils.js';

/** Heuristic field-name/type → autocomplete token. Not tied to any axe/eslint rule (no static check flags a *missing* autocomplete attribute) — used opportunistically, not part of the automated rule→template pipeline. */
const AUTOCOMPLETE_BY_HINT: Array<[RegExp, string]> = [
  [/email/i, 'email'],
  [/first.?name|fname|given.?name/i, 'given-name'],
  [/last.?name|lname|family.?name|surname/i, 'family-name'],
  [/^name$/i, 'name'],
  [/phone|tel/i, 'tel'],
  [/zip|postal/i, 'postal-code'],
  [/^address$|street/i, 'street-address'],
  [/^city$/i, 'address-level2'],
  [/^state$|^province$/i, 'address-level1'],
  [/^country$/i, 'country'],
  [/cc.?number|card.?number/i, 'cc-number'],
  [/cc.?exp|expir/i, 'cc-exp'],
  [/cvv|cvc|cc.?csc/i, 'cc-csc'],
  [/^username$/i, 'username'],
  [/^password$/i, 'current-password'],
];

function guessAutocomplete(attrs: string): string | undefined {
  const type = attrValue(attrs, 'type') ?? '';
  if (type === 'email') return 'email';
  if (type === 'tel') return 'tel';
  const hint = `${attrValue(attrs, 'name') ?? ''} ${attrValue(attrs, 'id') ?? ''}`;
  for (const [pattern, value] of AUTOCOMPLETE_BY_HINT) {
    if (pattern.test(hint)) return value;
  }
  return undefined;
}

/** WCAG 1.3.5 — adds an inferred `autocomplete` value to common form fields that are missing one. */
export const autocompleteAttributeTemplate: FixTemplate = {
  id: 'autocomplete-attribute',
  wcagCriteria: ['1.3.5'],
  applicableTo: 'all',
  detect(fileContent, filePath): FixTarget[] {
    return scanTags(fileContent)
      .filter((tag) => tag.tagName === 'input' && !hasAttr(tag.attrs, ['autocomplete']) && guessAutocomplete(tag.attrs) !== undefined)
      .map((tag) => ({ filePath, line: tag.line, tagName: tag.tagName, attrsRaw: tag.attrs }));
  },
  transform(fileContent, target): TransformResult | null {
    const value = guessAutocomplete(target.attrsRaw);
    if (!value) return null;
    const newContent = withLine(fileContent, target.line, (lineText) => insertAttribute(lineText, 'input', `autocomplete="${value}"`));
    if (!newContent) return null;
    return { newContent, description: `Added autocomplete="${value}" based on the field's name.` };
  },
};
