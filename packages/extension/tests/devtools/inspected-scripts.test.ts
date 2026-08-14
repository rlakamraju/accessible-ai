// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
  computeAccessibilityTreeInPage,
  describeSelectedElementInPage,
  type ViolationSelectorGroup,
} from '../../src/devtools/panel/inspected-scripts';

function setBody(html: string): void {
  document.body.innerHTML = html;
}

describe('computeAccessibilityTreeInPage', () => {
  it('collects only interesting landmark/interactive/heading nodes, skipping plain wrappers', () => {
    setBody(`
      <div class="wrapper">
        <header><nav><a href="/">Home</a></nav></header>
        <main>
          <h1>Title</h1>
          <div class="plain"><button>Submit</button></div>
        </main>
      </div>
    `);

    const tree = computeAccessibilityTreeInPage([]);

    expect(tree.role).toBe('document');
    expect(tree.children.map((n) => n.tag)).toEqual(['header', 'main']);
    const main = tree.children.find((n) => n.tag === 'main')!;
    // the plain wrapper div is skipped; its button is pulled up as a direct child of main
    expect(main.children.map((n) => n.tag)).toEqual(['h1', 'button']);
  });

  it('computes accessible name from aria-label, then <label for>, then text content', () => {
    setBody(`
      <button aria-label="Close dialog">X</button>
      <label for="email">Email address</label>
      <input id="email" type="text" />
      <a href="/pricing">Learn more</a>
    `);

    const tree = computeAccessibilityTreeInPage([]);
    // the standalone <label> isn't itself an interesting node, so it contributes no tree entry —
    // its text instead surfaces as the associated <input>'s accessible name, found via id lookup
    const names = tree.children.map((n) => `${n.tag}:${n.name}`);
    expect(names).toEqual(['button:Close dialog', 'input:Email address', 'a:Learn more']);
  });

  it('flags nodes whose selector is matched by a violation group', () => {
    setBody('<button id="checkout-btn">Buy</button>');
    const groups: ViolationSelectorGroup[] = [{ index: 0, selectors: ['#checkout-btn'] }];

    const tree = computeAccessibilityTreeInPage(groups);
    const button = tree.children[0];
    expect(button.violationIndexes).toEqual([0]);
  });
});

describe('describeSelectedElementInPage', () => {
  it('returns null for a null element', () => {
    expect(describeSelectedElementInPage(null, [])).toBeNull();
  });

  it('reports focusability, matched violations, and a trimmed outerHTML', () => {
    setBody('<button id="icon-btn" tabindex="0"><svg></svg></button>');
    const el = document.getElementById('icon-btn')!;
    const groups: ViolationSelectorGroup[] = [{ index: 2, selectors: ['#icon-btn'] }];

    const details = describeSelectedElementInPage(el, groups);

    expect(details).not.toBeNull();
    expect(details!.tag).toBe('button');
    expect(details!.role).toBe('button');
    expect(details!.focusable).toBe(true);
    expect(details!.violationIndexes).toEqual([2]);
    expect(details!.outerHtml).toContain('icon-btn');
  });

  it('does not match violation groups whose selector misses the element', () => {
    setBody('<button id="a">A</button><button id="b">B</button>');
    const el = document.getElementById('a')!;
    const groups: ViolationSelectorGroup[] = [{ index: 0, selectors: ['#b'] }];

    const details = describeSelectedElementInPage(el, groups);
    expect(details!.violationIndexes).toEqual([]);
  });
});
