# AccessibleAI

![status](https://img.shields.io/badge/status-under%20development-yellow)

AI-powered accessibility auditing, from a single click to a fixed codebase:

- **Chrome extension** — audit any page against WCAG 2.0/2.1/2.2, ADA, Section 508, or the EAA in seconds, with violations highlighted directly on the page.
- **MCP server** — plug the same engine into Claude Desktop or Claude Code for LLM-driven deep analysis, static codebase audits, and automated remediation (auto-fixes, LLM-generated fixes, before/after verification).
- **DevTools panel** — inspect any element's accessible role, name, and flagged violations right next to Chrome's own Elements panel, with one-click AI suggestions.

Everything shares one standards-mapping layer (`@accessible-ai/standards`), so a compliance score computed by the extension means the same thing as one computed by the MCP server.

## Feature tour

| Area | What it does |
| --- | --- |
| Quick Audit | Runs axe-core against the current page, scored 0-100 against your chosen standard, with in-page highlights and a floating badge. |
| Site Crawl | BFS-crawls a site from a root URL, audits every discovered page, and aggregates a site-wide report in a side panel. |
| Deep Analysis | Sends violations + page HTML to Claude via the MCP server for plain-English explanations, severity assessment, and fix recommendations — plus LLM-only checks (alt-text quality, heading logic, ARIA completeness) axe-core can't do alone. |
| Codebase Analysis | Static analysis of your frontend source (React/Angular/Vue/HTML/WordPress) via ESLint a11y plugins + custom structural checks, independent of any running page. |
| Remediation | Generates a prioritized, phased fix plan; applies safe auto-fixes and LLM-generated fixes (with dry-run + rollback); re-verifies and reports the compliance delta. |
| DevTools Panel | An accessibility-tree inspector synced with the Elements panel, annotated with your last Quick Audit's violations and an "AI Suggest" button per element. |
| Reports | JSON, Markdown, or HTML compliance reports for a single page, a whole site, or a codebase. |

There's no demo video or screenshots yet — the extension is easiest to try by loading it unpacked (below) against `examples/demo-site`, an intentionally inaccessible Angular app built for exactly this.

## Architecture at a glance

```
Chrome Extension (Manifest V3)              MCP Server (@accessible-ai/mcp-server)
├── popup / side panel / DevTools panel      ├── stdio transport   → Claude Desktop / Claude Code
├── content script (axe-core, world:"MAIN")  ├── HTTP bridge :3100 → Chrome extension ("Deep Analysis")
└── background service worker (crawl,       └── engines: deep-analyzer, static-analyzer,
    site audit, storage, MCP bridge)             remediation (plan / apply / verify)
              │                                            │
              └──────────────── @accessible-ai/standards ──┘
                 (WCAG criteria data, standard resolver, license validation)
```

See [`a11y-suite-architecture.md`](a11y-suite-architecture.md) for the full design (data models, tool schemas, DevTools panel design) and [`a11y-implementation-plan.md`](a11y-implementation-plan.md) for the phase-by-phase build log this repo followed.

## Monorepo structure

```
accessible-ai/
├── packages/
│   ├── standards/      @accessible-ai/standards — WCAG/standards mapping + license validation, shared by both packages below
│   ├── mcp-server/     @accessible-ai/mcp-server — MCP server (stdio + HTTP bridge), static analysis + remediation engines
│   └── extension/      @accessible-ai/extension — Chrome extension (Manifest V3): quick audits, crawl, overlays, DevTools panel
├── examples/
│   └── demo-site/      Intentionally inaccessible Angular app for demoing the whole suite against
├── tools/               Admin CLIs (license key generation)
├── docs/                User-facing setup and reference guides (see below)
├── a11y-suite-architecture.md    Full architecture, data models, tool schemas
└── a11y-implementation-plan.md   Phased execution plan (Phases 0-6)
```

## Quick start

```bash
npm install
npm run build
npm test
```

Run a workspace-scoped script with `-w`, e.g. `npm run build -w packages/extension`.

**Try the extension:**
1. `npm run build -w packages/extension`
2. Chrome → `chrome://extensions` → enable Developer Mode → "Load unpacked" → select `packages/extension/dist`
3. Open any page, click the AccessibleAI icon, pick a standard, click "Audit This Page"

**Try the MCP server + Deep Analysis:**
```bash
npx @accessible-ai/mcp-server --http   # for the extension's "Deep Analysis" button
```
See [`docs/mcp-server-setup.md`](docs/mcp-server-setup.md) for Claude Desktop/Code configuration and the full tool reference.

Full walkthroughs: [`docs/extension-user-guide.md`](docs/extension-user-guide.md) · [`docs/mcp-server-setup.md`](docs/mcp-server-setup.md) · [`docs/standards-reference.md`](docs/standards-reference.md)

## Tech stack

TypeScript monorepo (npm workspaces + Turborepo) · React (extension UI) · axe-core (runtime audits) · ESLint + jsx-a11y/`@angular-eslint`/`vuejs-accessibility` (static audits) · Model Context Protocol SDK + Express (MCP server) · Anthropic API (deep analysis, LLM-generated fixes) · Vitest (tests across all packages).

## Contributing

This is a portfolio project, not yet accepting external contributions. Issues and forks are welcome. If you're picking this repo back up: read `a11y-implementation-plan.md`'s phase you're resuming, and the "Conventions for Claude Code Sessions" section at its end.

## License

MIT for the code in this repository. The product itself (Quick Audit, overlay, standard picker are free; Deep Analysis, codebase audit, remediation, and unlimited site crawl require a license key) — see [`packages/standards/src/license/`](packages/standards/src/license/) for the validation logic and `tools/generate-license.ts` for key generation.
