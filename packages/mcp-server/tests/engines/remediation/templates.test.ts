import { describe, expect, it } from 'vitest';
import { htmlLangTemplate } from '../../../src/engines/remediation/templates/html-lang';
import { duplicateIdTemplate } from '../../../src/engines/remediation/templates/duplicate-id';
import { tabindexFixTemplate } from '../../../src/engines/remediation/templates/tabindex-fix';
import { metaViewportTemplate } from '../../../src/engines/remediation/templates/meta-viewport';
import { imageAltDecorativeTemplate } from '../../../src/engines/remediation/templates/image-alt-decorative';
import { linkPurposeTemplate } from '../../../src/engines/remediation/templates/link-purpose';
import { buttonNameTemplate } from '../../../src/engines/remediation/templates/button-name';
import { formLabelAssociationTemplate } from '../../../src/engines/remediation/templates/form-label-association';
import { headingHierarchyTemplate } from '../../../src/engines/remediation/templates/heading-hierarchy';
import { autocompleteAttributeTemplate } from '../../../src/engines/remediation/templates/autocomplete-attribute';
import { getTemplate, getTemplateIdForRule } from '../../../src/engines/remediation/templates/registry';

describe('html-lang template', () => {
  it('detects and fixes a missing lang attribute', () => {
    const content = '<html>\n<head></head>\n</html>';
    const [target] = htmlLangTemplate.detect(content, 'index.html');
    expect(target.line).toBe(1);

    const result = htmlLangTemplate.transform(content, target, 'html');
    expect(result?.newContent).toContain('<html lang="en">');
  });

  it('finds nothing when lang is already present', () => {
    expect(htmlLangTemplate.detect('<html lang="fr">', 'index.html')).toHaveLength(0);
  });
});

describe('duplicate-id template', () => {
  it('suffixes every occurrence after the first', () => {
    const content = '<div id="box"></div>\n<div id="box"></div>\n<div id="box"></div>';
    const targets = duplicateIdTemplate.detect(content, 'page.html');
    expect(targets).toHaveLength(2);

    let working = content;
    for (const target of targets) {
      const result = duplicateIdTemplate.transform(working, target, 'html');
      expect(result).not.toBeNull();
      working = result!.newContent;
    }

    expect(working).toBe('<div id="box"></div>\n<div id="box-2"></div>\n<div id="box-3"></div>');
  });
});

describe('tabindex-fix template', () => {
  it('removes positive tabindex from a naturally-focusable element', () => {
    const content = '<button tabindex="3">Go</button>';
    const [target] = tabindexFixTemplate.detect(content, 'page.html');
    const result = tabindexFixTemplate.transform(content, target, 'html');
    expect(result?.newContent).toBe('<button>Go</button>');
  });

  it('resets positive tabindex to 0 on a non-focusable element', () => {
    const content = '<div tabindex="5">Panel</div>';
    const [target] = tabindexFixTemplate.detect(content, 'page.html');
    const result = tabindexFixTemplate.transform(content, target, 'html');
    expect(result?.newContent).toBe('<div tabindex="0">Panel</div>');
  });
});

describe('meta-viewport template', () => {
  it('strips maximum-scale and user-scalable restrictions', () => {
    const content = '<meta name="viewport" content="width=device-width, maximum-scale=1, user-scalable=no">';
    const [target] = metaViewportTemplate.detect(content, 'index.html');
    const result = metaViewportTemplate.transform(content, target, 'html');
    expect(result?.newContent).toBe('<meta name="viewport" content="width=device-width">');
  });
});

describe('image-alt-decorative template', () => {
  it('adds alt="" to an image with a decorative class', () => {
    const content = '<img class="icon" src="/star.svg">';
    const [target] = imageAltDecorativeTemplate.detect(content, 'page.html');
    const result = imageAltDecorativeTemplate.transform(content, target, 'html');
    expect(result?.newContent).toBe('<img alt="" class="icon" src="/star.svg">');
  });

  it('does not flag a photo with no decorative signal', () => {
    expect(imageAltDecorativeTemplate.detect('<img src="/photo-1.jpg">', 'page.html')).toHaveLength(0);
  });
});

describe('link-purpose template', () => {
  it('adds an aria-label derived from href to an empty link', () => {
    const content = '<a href="/pricing-plans"></a>';
    const [target] = linkPurposeTemplate.detect(content, 'page.html');
    const result = linkPurposeTemplate.transform(content, target, 'html');
    expect(result?.newContent).toContain('aria-label="Pricing plans"');
  });

  it('does not flag a link that already has visible text', () => {
    expect(linkPurposeTemplate.detect('<a href="/x">Pricing</a>', 'page.html')).toHaveLength(0);
  });
});

describe('button-name template', () => {
  it('adds a placeholder aria-label to an empty button', () => {
    const content = '<button class="icon-btn"></button>';
    const [target] = buttonNameTemplate.detect(content, 'page.html');
    const result = buttonNameTemplate.transform(content, target, 'html');
    expect(result?.newContent).toContain('aria-label="Button"');
  });
});

describe('form-label-association template', () => {
  it('inserts a label before an unlabeled input, generating an id if missing', () => {
    const content = '<form>\n<input type="email">\n</form>';
    const [target] = formLabelAssociationTemplate.detect(content, 'page.html');
    const result = formLabelAssociationTemplate.transform(content, target, 'html');
    expect(result?.newContent).toContain('<label for="field-2">');
    expect(result?.newContent).toContain('id="field-2"');
  });

  it('uses htmlFor for React and [attr.for] for Angular', () => {
    const content = '<input type="email" id="email">';
    const [target] = formLabelAssociationTemplate.detect(content, 'page.html');

    const react = formLabelAssociationTemplate.transform(content, target, 'react');
    expect(react?.newContent).toContain('htmlFor="email"');

    const angular = formLabelAssociationTemplate.transform(content, target, 'angular');
    expect(angular?.newContent).toContain("[attr.for]=\"'email'\"");
  });
});

describe('heading-hierarchy template', () => {
  it('flattens a heading jump down to one level below the previous heading', () => {
    const content = '<h1>Title</h1>\n<h3>Section</h3>';
    const [target] = headingHierarchyTemplate.detect(content, 'page.html');
    const result = headingHierarchyTemplate.transform(content, target, 'html');
    expect(result?.newContent).toBe('<h1>Title</h1>\n<h2>Section</h2>');
  });

  it('does not flag a normal, non-skipping sequence', () => {
    expect(headingHierarchyTemplate.detect('<h1>A</h1>\n<h2>B</h2>\n<h3>C</h3>', 'page.html')).toHaveLength(0);
  });
});

describe('autocomplete-attribute template', () => {
  it('infers autocomplete from a field name', () => {
    const content = '<input type="text" name="email">';
    const [target] = autocompleteAttributeTemplate.detect(content, 'page.html');
    const result = autocompleteAttributeTemplate.transform(content, target, 'html');
    expect(result?.newContent).toContain('autocomplete="email"');
  });
});

describe('template registry', () => {
  it('resolves a template by id', () => {
    expect(getTemplate('html-lang')).toBe(htmlLangTemplate);
    expect(getTemplate('nonexistent')).toBeUndefined();
  });

  it('maps rule ids (with or without a plugin prefix) to their template', () => {
    expect(getTemplateIdForRule('html-has-lang')).toBe('html-lang');
    expect(getTemplateIdForRule('jsx-a11y/label-has-associated-control')).toBe('form-label-association');
    expect(getTemplateIdForRule('color-contrast')).toBeUndefined();
  });
});
