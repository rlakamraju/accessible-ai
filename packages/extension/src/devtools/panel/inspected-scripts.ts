/**
 * Functions in this file are never called directly — they're serialized via `.toString()` and
 * evaluated inside the inspected page via `chrome.devtools.inspectedWindow.eval()` (see
 * `eval-runner.ts`). Each one must be fully self-contained: no references to module-scope
 * bindings, imports, or closures, since none of that exists in the target page's global scope.
 */

// `inspect()` is part of the DevTools Command Line API, injected into the same evaluation
// context as `chrome.devtools.inspectedWindow.eval()` — it doesn't exist as a real import.
declare function inspect(target: unknown): void;

export interface ViolationSelectorGroup {
  index: number;
  selectors: string[];
}

export interface TreeNode {
  tag: string;
  role: string | null;
  name: string;
  selector: string;
  violationIndexes: number[];
  children: TreeNode[];
}

export interface ElementDetails {
  tag: string;
  role: string | null;
  name: string;
  selector: string;
  focusable: boolean;
  hasClickHandler: boolean;
  hasKeyboardHandler: boolean;
  outerHtml: string;
  violationIndexes: number[];
}

// Heuristic role/name computation and a lightweight CSS-path generator, good enough for a
// DevTools inspector panel — not a substitute for axe-core's own rule engine (which is what
// actually produces the violations this panel annotates).

export function computeAccessibilityTreeInPage(violationGroups: ViolationSelectorGroup[]): TreeNode {
  const IMPLICIT_ROLES: Record<string, string> = {
    a: 'link',
    button: 'button',
    select: 'listbox',
    textarea: 'textbox',
    img: 'img',
    nav: 'navigation',
    main: 'main',
    header: 'banner',
    footer: 'contentinfo',
    aside: 'complementary',
    form: 'form',
    h1: 'heading',
    h2: 'heading',
    h3: 'heading',
    h4: 'heading',
    h5: 'heading',
    h6: 'heading',
    ul: 'list',
    ol: 'list',
    li: 'listitem',
    table: 'table',
    section: 'region',
  };
  const INTERESTING = /^(a|button|input|select|textarea|img|nav|main|header|footer|aside|form|h1|h2|h3|h4|h5|h6|ul|ol|li|table|section)$/i;
  const MAX_NODES = 800;
  let nodeCount = 0;

  function role(el: Element): string | null {
    const explicit = el.getAttribute('role');
    if (explicit) return explicit;
    const tag = el.tagName.toLowerCase();
    if (tag === 'input') {
      const type = (el.getAttribute('type') || 'text').toLowerCase();
      if (type === 'checkbox') return 'checkbox';
      if (type === 'radio') return 'radio';
      if (type === 'button' || type === 'submit' || type === 'reset') return 'button';
      return 'textbox';
    }
    if (tag === 'a' && !el.hasAttribute('href')) return null;
    return IMPLICIT_ROLES[tag] || null;
  }

  function accessibleName(el: Element): string {
    const labelledby = el.getAttribute('aria-labelledby');
    if (labelledby) {
      const text = labelledby
        .split(/\s+/)
        .map((id) => document.getElementById(id)?.textContent || '')
        .join(' ')
        .trim();
      if (text) return text;
    }
    const label = el.getAttribute('aria-label');
    if (label && label.trim()) return label.trim();
    const id = el.getAttribute('id');
    if (id) {
      const escapedId = id.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      const forLabel = document.querySelector(`label[for="${escapedId}"]`);
      if (forLabel?.textContent?.trim()) return forLabel.textContent.trim();
    }
    if (el.tagName === 'IMG') return el.getAttribute('alt') || '';
    const title = el.getAttribute('title');
    if (title && title.trim()) return title.trim();
    const text = el.textContent ? el.textContent.trim().replace(/\s+/g, ' ') : '';
    return text.slice(0, 80);
  }

  function selectorFor(el: Element): string {
    const id = el.getAttribute('id');
    if (id) return `[id="${id.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"]`;
    const path: string[] = [];
    let node: Element | null = el;
    let depth = 0;
    while (node && node.nodeType === 1 && depth < 6) {
      let seg = node.tagName.toLowerCase();
      const classes = Array.from(node.classList).slice(0, 2);
      if (classes.length) seg += `.${classes.join('.')}`;
      const parent: Element | null = node.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children).filter((c) => c.tagName === node!.tagName);
        if (siblings.length > 1) seg += `:nth-of-type(${siblings.indexOf(node) + 1})`;
      }
      path.unshift(seg);
      node = parent;
      depth += 1;
    }
    return path.join(' > ');
  }

  const elementViolationIndexes = new Map<Element, number[]>();
  violationGroups.forEach((group) => {
    group.selectors.forEach((sel) => {
      try {
        document.querySelectorAll(sel).forEach((el) => {
          const existing = elementViolationIndexes.get(el) ?? [];
          if (existing.indexOf(group.index) === -1) existing.push(group.index);
          elementViolationIndexes.set(el, existing);
        });
      } catch {
        // invalid/unsupported selector from the audit source — skip it
      }
    });
  });

  function buildNode(el: Element): TreeNode {
    nodeCount += 1;
    const children: TreeNode[] = [];
    if (nodeCount < MAX_NODES) children.push(...collectInteresting(el));
    return {
      tag: el.tagName.toLowerCase(),
      role: role(el),
      name: accessibleName(el),
      selector: selectorFor(el),
      violationIndexes: elementViolationIndexes.get(el) ?? [],
      children,
    };
  }

  function collectInteresting(el: Element): TreeNode[] {
    const found: TreeNode[] = [];
    for (const child of Array.from(el.children)) {
      if (nodeCount >= MAX_NODES) break;
      if (child.hasAttribute('role') || INTERESTING.test(child.tagName)) {
        found.push(buildNode(child));
      } else {
        found.push(...collectInteresting(child));
      }
    }
    return found;
  }

  return {
    tag: 'html',
    role: 'document',
    name: document.title || '',
    selector: 'html',
    violationIndexes: [],
    children: collectInteresting(document.body),
  };
}

/** Moves the DevTools Elements panel selection ($0) to the element matching `selector`. */
export function selectElementBySelectorInPage(selector: string): void {
  const el = document.querySelector(selector);
  if (el) inspect(el);
}

export function describeSelectedElementInPage(
  el: Element | null,
  violationGroups: ViolationSelectorGroup[],
): ElementDetails | null {
  if (!el || el.nodeType !== 1) return null;

  function role(target: Element): string | null {
    const explicit = target.getAttribute('role');
    if (explicit) return explicit;
    const tag = target.tagName.toLowerCase();
    const map: Record<string, string> = {
      a: 'link',
      button: 'button',
      select: 'listbox',
      textarea: 'textbox',
      img: 'img',
      nav: 'navigation',
      main: 'main',
      header: 'banner',
      footer: 'contentinfo',
      aside: 'complementary',
      form: 'form',
      h1: 'heading',
      h2: 'heading',
      h3: 'heading',
      h4: 'heading',
      h5: 'heading',
      h6: 'heading',
    };
    if (tag === 'input') {
      const type = (target.getAttribute('type') || 'text').toLowerCase();
      if (type === 'checkbox') return 'checkbox';
      if (type === 'radio') return 'radio';
      if (type === 'button' || type === 'submit' || type === 'reset') return 'button';
      return 'textbox';
    }
    if (tag === 'a' && !target.hasAttribute('href')) return null;
    return map[tag] || null;
  }

  function accessibleName(target: Element): string {
    const labelledby = target.getAttribute('aria-labelledby');
    if (labelledby) {
      const text = labelledby
        .split(/\s+/)
        .map((id) => document.getElementById(id)?.textContent || '')
        .join(' ')
        .trim();
      if (text) return text;
    }
    const label = target.getAttribute('aria-label');
    if (label && label.trim()) return label.trim();
    const id = target.getAttribute('id');
    if (id) {
      const escapedId = id.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      const forLabel = document.querySelector(`label[for="${escapedId}"]`);
      if (forLabel?.textContent?.trim()) return forLabel.textContent.trim();
    }
    if (target.tagName === 'IMG') return target.getAttribute('alt') || '';
    const title = target.getAttribute('title');
    if (title && title.trim()) return title.trim();
    const text = target.textContent ? target.textContent.trim().replace(/\s+/g, ' ') : '';
    return text.slice(0, 80);
  }

  function selectorFor(target: Element): string {
    const id = target.getAttribute('id');
    if (id) return `[id="${id.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"]`;
    const path: string[] = [];
    let node: Element | null = target;
    let depth = 0;
    while (node && node.nodeType === 1 && depth < 6) {
      let seg = node.tagName.toLowerCase();
      const classes = Array.from(node.classList).slice(0, 2);
      if (classes.length) seg += `.${classes.join('.')}`;
      const parent: Element | null = node.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children).filter((c) => c.tagName === node!.tagName);
        if (siblings.length > 1) seg += `:nth-of-type(${siblings.indexOf(node) + 1})`;
      }
      path.unshift(seg);
      node = parent;
      depth += 1;
    }
    return path.join(' > ');
  }

  const violationIndexes: number[] = [];
  violationGroups.forEach((group) => {
    const matches = group.selectors.some((sel) => {
      try {
        return Array.from(document.querySelectorAll(sel)).includes(el);
      } catch {
        return false;
      }
    });
    if (matches) violationIndexes.push(group.index);
  });

  const tag = el.tagName.toLowerCase();
  const tabindexAttr = el.getAttribute('tabindex');
  const NATURALLY_FOCUSABLE = /^(a|button|input|select|textarea|summary)$/i;
  const focusable =
    (tabindexAttr !== null && tabindexAttr !== '-1') || NATURALLY_FOCUSABLE.test(tag) || (el as HTMLElement).isContentEditable;

  let hasClick = false;
  let hasKeydown = false;
  try {
    const getListeners = (globalThis as unknown as { getEventListeners?: (e: Element) => Record<string, unknown[]> })
      .getEventListeners;
    if (typeof getListeners === 'function') {
      const listeners = getListeners(el);
      hasClick = Boolean(listeners.click?.length);
      hasKeydown = Boolean(listeners.keydown?.length || listeners.keyup?.length || listeners.keypress?.length);
    }
  } catch {
    // getEventListeners is a DevTools console-only utility; unavailable in some contexts
  }

  return {
    tag,
    role: role(el),
    name: accessibleName(el),
    selector: selectorFor(el),
    focusable,
    hasClickHandler: hasClick || el.hasAttribute('onclick'),
    hasKeyboardHandler: hasKeydown || NATURALLY_FOCUSABLE.test(tag),
    outerHtml: el.outerHTML.slice(0, 2000),
    violationIndexes,
  };
}
