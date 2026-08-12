import overlayCss from './overlay.css?raw';
import type { Impact, ViolationNode } from '../shared/types';

const HOST_ID = 'accessible-ai-overlay-host';
const PULSE_DURATION_MS = 2000;
const SCROLL_SETTLE_MS = 300;

let shadowRoot: ShadowRoot | null = null;
let highlightContainer: HTMLDivElement | null = null;
let badgeContainer: HTMLDivElement | null = null;
let tooltipEl: HTMLDivElement | null = null;
let currentViolations: ViolationNode[] = [];
let repositionScheduled = false;

function ensureShadowRoot(): ShadowRoot {
  if (shadowRoot) return shadowRoot;

  const host = document.createElement('div');
  host.id = HOST_ID;
  host.style.all = 'initial';
  document.body.appendChild(host);

  shadowRoot = host.attachShadow({ mode: 'open' });

  const style = document.createElement('style');
  style.textContent = overlayCss;
  shadowRoot.appendChild(style);

  highlightContainer = document.createElement('div');
  highlightContainer.className = 'aai-highlights';
  shadowRoot.appendChild(highlightContainer);

  badgeContainer = document.createElement('div');
  badgeContainer.className = 'aai-badge-container';
  shadowRoot.appendChild(badgeContainer);

  tooltipEl = document.createElement('div');
  tooltipEl.className = 'aai-tooltip';
  tooltipEl.hidden = true;
  shadowRoot.appendChild(tooltipEl);

  window.addEventListener('scroll', scheduleReposition, true);
  window.addEventListener('resize', scheduleReposition);
  new ResizeObserver(scheduleReposition).observe(document.documentElement);

  return shadowRoot;
}

function scheduleReposition(): void {
  if (repositionScheduled) return;
  repositionScheduled = true;
  requestAnimationFrame(() => {
    repositionScheduled = false;
    renderHighlights(currentViolations);
  });
}

function impactRank(impact: Impact | null): number {
  switch (impact) {
    case 'critical':
      return 0;
    case 'serious':
      return 1;
    case 'moderate':
      return 2;
    case 'minor':
      return 3;
    default:
      return 4;
  }
}

function worstImpact(violations: ViolationNode[]): Impact | null {
  let worst: Impact | null = violations[0]?.impact ?? null;
  for (const violation of violations) {
    if (impactRank(violation.impact) < impactRank(worst)) worst = violation.impact;
  }
  return worst;
}

function querySelectorSafe(cssSelector: string): Element | null {
  try {
    return document.querySelector(cssSelector);
  } catch {
    return null; // invalid or unsupported selector (e.g. cross-frame path) — skip silently
  }
}

interface ResolvedTarget {
  element: Element;
  violations: ViolationNode[];
}

function resolveTargets(violations: ViolationNode[]): ResolvedTarget[] {
  const byElement = new Map<Element, ResolvedTarget>();
  for (const violation of violations) {
    for (const target of violation.targets) {
      const element = querySelectorSafe(target.cssSelector);
      if (!element) continue; // removed from the DOM since the audit ran

      const existing = byElement.get(element);
      if (existing) {
        existing.violations.push(violation);
      } else {
        byElement.set(element, { element, violations: [violation] });
      }
    }
  }
  return Array.from(byElement.values());
}

function escapeHtml(input: string): string {
  const div = document.createElement('div');
  div.textContent = input;
  return div.innerHTML;
}

function showTooltip(anchor: HTMLElement, violations: ViolationNode[]): void {
  if (!tooltipEl) return;
  const rect = anchor.getBoundingClientRect();
  tooltipEl.innerHTML = violations
    .map(
      (v) =>
        `<div><strong>${escapeHtml(v.criterionIds.join(', ') || v.id)}</strong>: ${escapeHtml(v.description)}</div>`,
    )
    .join('');
  tooltipEl.style.top = `${rect.bottom + 4}px`;
  tooltipEl.style.left = `${rect.left}px`;
  tooltipEl.hidden = false;
}

function hideTooltip(): void {
  if (tooltipEl) tooltipEl.hidden = true;
}

function renderHighlights(violations: ViolationNode[]): void {
  ensureShadowRoot();
  if (!highlightContainer) return;
  highlightContainer.innerHTML = '';

  for (const { element, violations: elementViolations } of resolveTargets(violations)) {
    const rect = element.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) continue; // hidden/collapsed element

    const impact = worstImpact(elementViolations);
    const box = document.createElement('div');
    box.className = `aai-highlight aai-impact-${impact ?? 'unknown'}`;
    box.style.top = `${rect.top}px`;
    box.style.left = `${rect.left}px`;
    box.style.width = `${rect.width}px`;
    box.style.height = `${rect.height}px`;

    if (elementViolations.length > 1) {
      const badge = document.createElement('span');
      badge.className = 'aai-count-badge';
      badge.textContent = String(elementViolations.length);
      box.appendChild(badge);
    }

    box.addEventListener('mouseenter', () => showTooltip(box, elementViolations));
    box.addEventListener('mouseleave', hideTooltip);

    highlightContainer.appendChild(box);
  }
}

export function highlightViolations(violations: ViolationNode[]): void {
  currentViolations = violations;
  renderHighlights(violations);
}

export function highlightSingle(cssSelector: string): void {
  ensureShadowRoot();
  const element = querySelectorSafe(cssSelector);
  if (!element || !highlightContainer) return;

  element.scrollIntoView({ behavior: 'smooth', block: 'center' });

  window.setTimeout(() => {
    const rect = element.getBoundingClientRect();
    const pulse = document.createElement('div');
    pulse.className = 'aai-pulse';
    pulse.style.top = `${rect.top}px`;
    pulse.style.left = `${rect.left}px`;
    pulse.style.width = `${rect.width}px`;
    pulse.style.height = `${rect.height}px`;
    highlightContainer!.appendChild(pulse);
    window.setTimeout(() => pulse.remove(), PULSE_DURATION_MS);
  }, SCROLL_SETTLE_MS);
}

export function clearOverlay(): void {
  currentViolations = [];
  if (highlightContainer) highlightContainer.innerHTML = '';
  if (badgeContainer) badgeContainer.innerHTML = '';
  hideTooltip();
}

export function showBadge(score: number, violationCount: number): void {
  ensureShadowRoot();
  if (!badgeContainer) return;
  badgeContainer.innerHTML = '';

  const badge = document.createElement('div');
  badge.className = 'aai-score-badge';
  badge.textContent = `${score} · ${violationCount}`;
  badge.title = `AccessibleAI: compliance score ${score}, ${violationCount} violation${violationCount === 1 ? '' : 's'}`;
  badgeContainer.appendChild(badge);
}
