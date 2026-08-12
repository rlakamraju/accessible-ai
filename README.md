# AccessibleAI

![status](https://img.shields.io/badge/status-under%20development-yellow)

AI-powered accessibility auditing: a Chrome extension for quick, on-page WCAG/ADA/Section 508/EAA audits, backed by an MCP server for deep, LLM-driven analysis and codebase-level remediation.

## Monorepo structure

```
accessible-ai/
├── packages/
│   ├── standards/     @accessible-ai/standards — WCAG/standards mapping + license validation, shared by both packages below
│   ├── mcp-server/    @accessible-ai/mcp-server — MCP server (stdio + HTTP bridge) for AI-powered deep analysis
│   └── extension/     @accessible-ai/extension — Chrome extension (Manifest V3): quick audits, overlays, reports
├── tools/              Admin CLIs (e.g. license key generation)
└── a11y-implementation-plan.md   Phased execution plan
```

## Getting started

```bash
npm install
npm run build
npm test
```

Run a workspace-scoped script with `-w`, e.g. `npm run build -w packages/extension`.

See `a11y-implementation-plan.md` for the phased execution plan.
