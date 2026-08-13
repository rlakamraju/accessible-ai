import type { FrameworkType } from '@accessible-ai/standards';
import { attrValue, hasAttr, scanTags } from '../../static-analyzer/custom-rules/tag-scanner.js';
import type { FixTarget, FixTemplate, TransformResult } from './types.js';
import { insertAttribute, insertLineBefore, withLine } from './utils.js';

const FIELD_TAGS = new Set(['input', 'select', 'textarea']);
const SKIP_TYPES = new Set(['hidden', 'submit', 'button', 'image', 'reset']);

function forAttrName(framework: FrameworkType): string {
  if (framework === 'angular') return '[attr.for]';
  if (framework === 'vue') return ':for';
  if (framework === 'react') return 'htmlFor';
  return 'for';
}

function forAttrValue(framework: FrameworkType, id: string): string {
  if (framework === 'angular' || framework === 'vue') return `="'${id}'"`;
  return `="${id}"`;
}

/** WCAG 1.3.1 / 4.1.2 — inserts a `<label for="...">` before an unlabeled form field, generating an id if needed. */
export const formLabelAssociationTemplate: FixTemplate = {
  id: 'form-label-association',
  wcagCriteria: ['1.3.1', '4.1.2'],
  applicableTo: 'all',
  detect(fileContent, filePath): FixTarget[] {
    const tags = scanTags(fileContent);
    const labeledIds = new Set(
      tags.filter((tag) => tag.tagName === 'label').map((tag) => attrValue(tag.attrs, 'for')).filter((id): id is string => Boolean(id)),
    );

    return tags
      .filter((tag) => {
        if (!FIELD_TAGS.has(tag.tagName)) return false;
        const type = attrValue(tag.attrs, 'type');
        if (type && SKIP_TYPES.has(type)) return false;
        if (hasAttr(tag.attrs, ['aria-label', 'aria-labelledby'])) return false;
        const id = attrValue(tag.attrs, 'id');
        return !id || !labeledIds.has(id);
      })
      .map((tag) => ({ filePath, line: tag.line, tagName: tag.tagName, attrsRaw: tag.attrs }));
  },
  transform(fileContent, target, framework): TransformResult | null {
    let id = attrValue(target.attrsRaw, 'id');
    let working = fileContent;

    if (!id) {
      id = `field-${target.line}`;
      const withId = withLine(working, target.line, (lineText) => insertAttribute(lineText, target.tagName, `id="${id}"`));
      if (!withId) return null;
      working = withId;
    }

    const labelTag = `<label ${forAttrName(framework)}${forAttrValue(framework, id)}>TODO: label text</label>`;
    const withLabel = insertLineBefore(working, target.line, labelTag);
    if (!withLabel) return null;

    return { newContent: withLabel, description: `Added a <label> for <${target.tagName} id="${id}"> — replace the placeholder text.` };
  },
};
