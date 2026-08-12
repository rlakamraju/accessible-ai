import type { AxeResults } from 'axe-core';
import type { AxeRunConfig } from '../shared/types';

// `axe` is loaded as a global by injecting `vendor/axe.min.js` into the page's MAIN world
// before this function runs there — see background/service-worker.ts. This function must stay
// self-contained (no module imports besides types) since chrome.scripting.executeScript
// re-serializes it via `Function.prototype.toString` and evaluates it in that world.
declare const axe: typeof import('axe-core');

export async function runAxeAudit(config: AxeRunConfig): Promise<AxeResults> {
  return axe.run(document, {
    runOnly: { type: 'tag', values: config.tags },
    resultTypes: ['violations', 'passes', 'incomplete', 'inapplicable'],
  });
}
