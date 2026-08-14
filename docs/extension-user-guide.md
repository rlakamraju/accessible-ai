# Extension User Guide

## Installation

The extension isn't published to the Chrome Web Store yet — install it unpacked:

1. `npm install && npm run build -w packages/extension` from the repo root.
2. Open `chrome://extensions` in Chrome.
3. Enable **Developer mode** (top-right toggle).
4. Click **Load unpacked** and select `packages/extension/dist`.
5. Pin the AccessibleAI icon to your toolbar for quick access.

After changing extension code, re-run `npm run build -w packages/extension` and click the refresh icon on the extension's card in `chrome://extensions`.

## Quick Audit

1. Navigate to any page.
2. Click the AccessibleAI icon to open the popup.
3. Pick a standard from the dropdown: WCAG 2.1 AA (default), WCAG 2.2 AA, ADA, Section 508, EAA, or expand "Advanced" to pick a specific WCAG version + level.
4. Click **Audit This Page**.
5. The popup shows:
   - An overall compliance score (0-100), colored red/amber/green
   - Violation counts by severity (critical → minor) and by WCAG principle (Perceivable/Operable/Understandable/Robust)
   - A filterable violation list — click any item to scroll to and pulse-highlight that element on the page
6. A floating badge appears in the page's bottom-right corner with the score and violation count; colored borders mark every violating element. Close the popup or click "Clear" to remove the overlay.

## Auditing an entire site

1. In the popup, below the single-page audit button, set **max pages** (default 20) and click **Audit Entire Site**.
2. A progress bar tracks phases: discovering pages (BFS crawl, same-origin only) → auditing each one → aggregating results.
3. When it finishes, the side panel opens automatically with:
   - A site-wide score gauge
   - A sortable per-page table (URL, title, score, violation count) — click a row to drill into that page's violations
   - A cross-site issues view: the same rule/criterion failing across multiple pages, ranked by frequency
4. Auditing more than 5 pages requires a license (see [Licensing](#licensing) below) — Quick Audit and single-page crawls stay free.
5. Cancel a running crawl any time from the progress bar.

## Deep Analysis (AI)

Deep Analysis sends the current page's audit results and HTML to Claude (via the MCP server running on your machine) for plain-English explanations, severity/legal-risk notes, fix suggestions, and an "AI-Detected Issues" section for things axe-core's rule engine can't catch (alt-text quality, heading logic, ARIA completeness).

1. Start the MCP server's HTTP bridge: `npx @accessible-ai/mcp-server --http` (see [`mcp-server-setup.md`](mcp-server-setup.md)).
2. The popup's connection indicator turns green once it detects the server (checked on open and every 30s): red = not connected, yellow = connected but unlicensed, green = connected and licensed.
3. Click **Deep Analysis (AI)**. If you don't have a license yet, you'll see an upgrade prompt instead of a cryptic error.
4. Add your own Anthropic API key in Settings (gear icon) — Claude usage is billed to your account, not the vendor's.

## Report export

Click **Export Report** (page audits) or use the side panel's export (site audits) and pick JSON, Markdown, or HTML. HTML reports open in a new tab for a print-ready preview before download. Reports for a Deep Analysis result also include a **"Export for Claude Code"** button, which writes a `.accessible-ai/audit-results.json` file you can hand to the MCP server's `import_audit_results` tool to continue the workflow in your codebase (see the MCP server guide).

## Audit history

The popup's History tab lists your last 20 audits (page or site), each showing URL, standard, date, and score — click to reopen the full results, or delete entries individually.

## DevTools panel

Open Chrome DevTools (F12) on any page and select the **AccessibleAI** tab:

- **Left pane** — an accessibility tree of landmarks, headings, and interactive elements (not every DOM node), each showing its computed role and accessible name. Elements flagged by your most recent Quick Audit for that URL show a ⚠️ badge with the violation count.
- **Right pane** — details for whatever's selected (in our tree, or in Chrome's own Elements panel — selection stays in sync both ways): role, computed name, focusability, and whether it responds to keyboard as well as mouse.
- **AI Suggest** — enabled once an element has at least one matched violation. Requires the MCP server running and a `deep-analysis` license, same as Deep Analysis above; sends just that element's HTML and violations to Claude.
- Click **Refresh** after re-running a Quick Audit, or navigate — the panel auto-refreshes on page navigation.

The tree uses a lightweight in-house role/name heuristic (not a full accessibility-tree implementation), and violation matching is by CSS selector against your last stored Quick Audit — run one first if the tree shows no ⚠️ badges you expect.

## Licensing

Quick Audit, the overlay, the standard picker, basic export, and crawling up to 5 pages are free, no key required. Everything else (unlimited site crawl, Deep Analysis, codebase audit, remediation, HTML/PDF report export) needs a license key.

- Open **Settings** (gear icon in the popup header) to paste a license key and see its status: valid (tier + expiry), invalid, expired, or none.
- "Get a License Key" links out to pricing; there's no self-serve purchase flow wired up yet in this repo.
- The same Settings screen is where you add your **Anthropic API key**, needed separately from the license key — the license unlocks the feature, the API key pays for the Claude calls it makes.

## FAQ

**The extension can't find violations on a single-page app that loads content dynamically.**
Re-run the audit after the app has finished rendering — Quick Audit snapshots the DOM at the moment you click "Audit This Page."

**Deep Analysis / AI Suggest says "MCP server not running."**
Start `npx @accessible-ai/mcp-server --http` and make sure nothing else is bound to port 3100 (override with `PORT=3101 npx @accessible-ai/mcp-server --http` if needed, matching the port in the extension's requests — see [`mcp-server-setup.md`](mcp-server-setup.md)).

**Why does auditing "Entire Site" open a background tab per page?**
The crawler loads each discovered page in a background tab to run axe-core against real rendered DOM, then closes it — this is why it can be slower than a single-page audit and why very large sites should set a lower max-pages limit.

**Is my page content sent anywhere by default?**
No — Quick Audit, crawling, and the overlay are 100% local (axe-core runs in-page). Data only leaves your machine when you explicitly click Deep Analysis or AI Suggest, and even then it goes to your own local MCP server, which forwards it to Anthropic using your own API key.
