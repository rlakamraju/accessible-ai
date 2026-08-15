# MCP Server Setup

`@accessible-ai/mcp-server` isn't published to npm yet — this repo hasn't run `npm publish` (see the implementation plan's Task 6.5). Until it is, run it straight from a local build:

```bash
npm install
npm run build -w packages/mcp-server
node packages/mcp-server/dist/index.js --stdio   # or --http, or both flags together
```

Once published, the equivalent will be `npx @accessible-ai/mcp-server ...` — the CLI flags and env vars below don't change either way.

## Transports

The server has two independent transports, selected by CLI flags:

| Flag | Use it for |
| --- | --- |
| `--stdio` (default when `--http` is absent) | Claude Desktop / Claude Code — they spawn one server process per connection over stdio. |
| `--http` | The Chrome extension's "Deep Analysis" / "AI Suggest" buttons, which call a long-running HTTP bridge on `localhost:3100` (`POST /health`, `GET /status`, `POST /analyze`). |

**Pass both flags together** (`--stdio --http`) to run one process serving both; passing neither defaults to stdio-only (never both), since an MCP client already spawns its own process per connection and must not also collide with the extension's standalone HTTP daemon.

```bash
node dist/index.js --stdio --http
```

Extra flags: `--install-service` / `--uninstall-service` register the `--http` daemon as a real OS-managed background service (Windows Task Scheduler, macOS `launchd`, or Linux `systemd` user unit) so you don't have to keep a terminal open — run once, it restarts on failure and at login.

## Claude Desktop configuration

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "accessible-ai": {
      "command": "node",
      "args": ["/absolute/path/to/accessible-ai/packages/mcp-server/dist/index.js", "--stdio"],
      "env": {
        "ANTHROPIC_API_KEY": "sk-ant-...",
        "LICENSE_KEY": "AAI-PRO-...",
        "LICENSE_SECRET": "accessible-ai-dev-secret-2026"
      }
    }
  }
}
```

Pass `--stdio` explicitly even though it's the default when `--http` is absent — being explicit here avoids surprises if this config is ever copied alongside an `--http` invocation.

`LICENSE_SECRET` must be set on **every** process that validates a key — the `--http` daemon the extension talks to, and separately any stdio process a client spawns — since license validation is HMAC verification against that secret, not a lookup. A valid-looking key with no `LICENSE_SECRET` on the server side always fails closed with "LICENSE_SECRET is not configured," even though the key itself is fine (this is exactly what happens if you launch `--http` without setting it in the same shell, e.g. via `set LICENSE_SECRET=...` first on Windows `cmd.exe`, since `cmd.exe` has no bash-style inline `VAR=value command` syntax).

## Claude Code configuration

Same idea, added to your project or user MCP config (however your Claude Code setup registers MCP servers) — point it at `dist/index.js --stdio` with the same environment variables.

## Environment variables

| Variable | Purpose |
| --- | --- |
| `ANTHROPIC_API_KEY` | Pays for Claude usage in Deep Analysis, codebase-fix generation, and DevTools "AI Suggest". Each user brings their own — the extension can also forward one per-request via its own Settings screen over the HTTP path, see below. |
| `ANTHROPIC_MODEL` | Overrides the default Claude model used for analysis/fix-generation calls. |
| `LICENSE_KEY` | Unlocks gated features (`deep-analysis`, `codebase-audit`, `remediation`, `report-export`, `site-crawl-unlimited`). Resolution order for the HTTP path: `x-license-key` request header → this env var → `~/.accessible-ai/license.key` on disk. For stdio tool calls: this env var → the disk file. |
| `LICENSE_SECRET` | Required to *validate* any license key (HMAC verification). Without it, gated tools refuse to run even with a key present. |
| `PORT` | HTTP bridge port, default `3100`. |

Generate a test license key locally with:
```bash
npx ts-node tools/generate-license.ts --email you@example.com --tier PRO --days 365 --secret <your-LICENSE_SECRET>
```

### BYO Anthropic key from the extension

On the HTTP path (extension → MCP server), the extension's Settings screen lets each user paste their own Anthropic API key, forwarded per-request via an `x-anthropic-api-key` header — the server never falls back to its own `ANTHROPIC_API_KEY` when a request supplies one. On the stdio path (Claude Desktop/Code), there's no per-request header — the client's own `ANTHROPIC_API_KEY` env var is used directly, same as any other MCP server.

## Tool reference

All tools are session-scoped: `configure_audit` or `import_audit_results` starts a session (`sessionId`), and every other tool takes that ID. Sessions evict after 1 hour of inactivity.

| Tool | Input | What it does | License |
| --- | --- | --- | --- |
| `configure_audit` | `standard`, `customRules?`, `excludeRules?` | Resolves a compliance standard (WCAG level, ADA, Section 508, EAA) and opens a session. | Free |
| `import_audit_results` | `filePath`, `projectPath?` | Loads a Chrome extension export (`.accessible-ai/audit-results.json`) into a new session. | Free |
| `analyze_codebase` | `sessionId`, `projectPath`, `include?`, `exclude?` | Static analysis of frontend source (React/Angular/Vue/HTML/WordPress) — framework detection, ESLint a11y rules, custom structural checks. | `codebase-audit` |
| `generate_report` | `sessionId`, `format` (json/markdown/html), `groupBy?`, `projectPath?` | Structured compliance report from a session's codebase analysis. | Free for json/markdown; `report-export` for html |
| `map_violations_to_source` | `sessionId`, `projectPath` | Maps imported runtime (axe-core) violations onto source file locations. | Free |
| `generate_fix_plan` | `sessionId`, `prioritizeBy?` (default `impact`), `maxItems?` | Builds a prioritized, phased fix plan from the session's unified issue list. | `remediation` |
| `apply_fix` | `sessionId`, `projectPath`, `mode` (single/phase/all-auto), `fixId?`, `phaseNumber?`, `dryRun` (default `true`) | Applies fixes — auto-fix templates for the handful of rules that support them, or LLM-generated fixes otherwise. Dry-run returns diffs without touching disk. | `remediation` |
| `rollback_fix` | `sessionId`, `fixId` | Restores a file to its pre-fix content. Rolls back the whole file from that `apply_fix` call, not just one issue, if multiple issues in that file were fixed together. | Free |
| `get_fix_history` | `sessionId` | Lists every fix applied so far in the session, with diffs and status. | Free |
| `verify_fixes` | `sessionId`, `projectPath`, `verificationLevel?` (default `static-only`), `fixIds?` | Re-runs analysis, reports the compliance delta, flags regressions, drafts a commit message. `static-and-runtime` is accepted but currently still runs static-only (no bundled headless browser) — see note below. | `remediation` |

**Known gap:** `verify_fixes`'s `static-and-runtime` verification level doesn't yet re-run a live browser audit — it runs the same whole-project static re-analysis as `static-only` and returns a note explaining that. For a real runtime check after applying fixes, re-run the Chrome extension's Quick Audit on the live page.

## Example workflow: import from the extension → fix → verify

```
configure_audit({ standard: "wcag-2.1-aa" })
import_audit_results({ filePath: ".accessible-ai/audit-results.json", projectPath: "." })
map_violations_to_source({ sessionId, projectPath: "." })
generate_fix_plan({ sessionId })
apply_fix({ sessionId, projectPath: ".", mode: "all-auto", dryRun: true })   // review diffs
apply_fix({ sessionId, projectPath: ".", mode: "all-auto", dryRun: false })  // apply for real
verify_fixes({ sessionId, projectPath: "." })                               // "62% → 94%"
```

## Example workflow: pure codebase audit (no browser involved)

```
configure_audit({ standard: "ada" })
analyze_codebase({ sessionId, projectPath: "." })
generate_report({ sessionId, format: "markdown" })
generate_fix_plan({ sessionId })
```
