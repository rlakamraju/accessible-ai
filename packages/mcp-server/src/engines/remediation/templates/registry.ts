import type { FixTemplate } from './types.js';
import { htmlLangTemplate } from './html-lang.js';
import { duplicateIdTemplate } from './duplicate-id.js';
import { tabindexFixTemplate } from './tabindex-fix.js';
import { metaViewportTemplate } from './meta-viewport.js';
import { imageAltDecorativeTemplate } from './image-alt-decorative.js';
import { linkPurposeTemplate } from './link-purpose.js';
import { buttonNameTemplate } from './button-name.js';
import { formLabelAssociationTemplate } from './form-label-association.js';
import { headingHierarchyTemplate } from './heading-hierarchy.js';
import { autocompleteAttributeTemplate } from './autocomplete-attribute.js';

const TEMPLATES: FixTemplate[] = [
  htmlLangTemplate,
  duplicateIdTemplate,
  tabindexFixTemplate,
  metaViewportTemplate,
  imageAltDecorativeTemplate,
  linkPurposeTemplate,
  buttonNameTemplate,
  formLabelAssociationTemplate,
  headingHierarchyTemplate,
  autocompleteAttributeTemplate,
];

const TEMPLATES_BY_ID = new Map(TEMPLATES.map((t) => [t.id, t]));

export function getTemplate(id: string): FixTemplate | undefined {
  return TEMPLATES_BY_ID.get(id);
}

/**
 * Bare axe-core/custom rule name (see `tag-scanner`-style `ruleName()` stripping) → the template that can
 * auto-fix it. Rules mapped here get a `remediation.fixTemplateId` regardless of their assigned
 * `automationLevel` (see `issue-normalizer.ts`'s `REMEDIATION_BY_AXE_RULE`) — the coarse level drives fix
 * *planning*, this map drives what `apply_fix` actually tries.
 */
export const RULE_TO_TEMPLATE: Record<string, string> = {
  'html-has-lang': 'html-lang',
  'html-lang-valid': 'html-lang',
  'duplicate-id': 'duplicate-id',
  'duplicate-id-active': 'duplicate-id',
  'duplicate-id-aria': 'duplicate-id',
  tabindex: 'tabindex-fix',
  'meta-viewport': 'meta-viewport',
  'meta-viewport-large': 'meta-viewport',
  'image-alt': 'image-alt-decorative',
  'input-image-alt': 'image-alt-decorative',
  'area-alt': 'image-alt-decorative',
  'object-alt': 'image-alt-decorative',
  'role-img-alt': 'image-alt-decorative',
  'svg-img-alt': 'image-alt-decorative',
  'alt-text': 'image-alt-decorative',
  'link-name': 'link-purpose',
  'link-in-text-block': 'link-purpose',
  'button-name': 'button-name',
  'form-field-multiple-labels': 'form-label-association',
  'label-title-only': 'form-label-association',
  'label-has-associated-control': 'form-label-association',
  'form-control-has-label': 'form-label-association',
  'form-control-missing-label': 'form-label-association',
  'heading-order': 'heading-hierarchy',
  'empty-heading': 'heading-hierarchy',
  'heading-level-skipped': 'heading-hierarchy',
};

export function getTemplateIdForRule(ruleId: string): string | undefined {
  const name = ruleId.split('/').pop() ?? ruleId;
  return RULE_TO_TEMPLATE[name];
}
