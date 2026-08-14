# Standards Reference

All standards mapping lives in `@accessible-ai/standards`, curated in `packages/standards/src/data/wcag-criteria.json` (per-criterion metadata) and `standard-mappings.json` (which WCAG version/level each named standard maps to). Both the extension's Quick Audit and the MCP server's static analysis read from this same data, so a score means the same thing in either place.

## Supported standards

| Standard ID | Resolves to | Criteria returned |
| --- | --- | --- |
| `wcag-2.0-a` | WCAG 2.0 A | 25 |
| `wcag-2.0-aa` | WCAG 2.0 AA | 38 |
| `wcag-2.0-aaa` | WCAG 2.0 AAA | 38 * |
| `wcag-2.1-a` | WCAG 2.1 A | 30 |
| `wcag-2.1-aa` | WCAG 2.1 AA | 50 |
| `wcag-2.1-aaa` | WCAG 2.1 AAA | 50 * |
| `wcag-2.2-a` | WCAG 2.2 A | 30 * |
| `wcag-2.2-aa` | WCAG 2.2 AA | 50 * |
| `wcag-2.2-aaa` | WCAG 2.2 AAA | 50 * |
| `ada` | ADA (WCAG 2.1 AA) | 50 |
| `section-508` | Section 508 (WCAG 2.0 AA) | 38 |
| `eaa` | European Accessibility Act (WCAG 2.1 AA) | 50 |

\* **AAA-level and WCAG-2.2-specific criteria aren't curated yet** — a deliberate scope cut. Requesting an AAA standard or 2.2 currently returns the same criteria as the corresponding 2.1/2.0 AA set rather than erroring, so scores under these standards are really "AA compliance," not true AAA/2.2 compliance. Don't rely on them for a strict AAA/2.2 audit yet.

The full dataset covers **50 WCAG success criteria**: all 30 Level A + 20 Level AA criteria across WCAG 2.0/2.1 (WCAG 2.1 added 12 new criteria on top of 2.0's 38; 2.0 itself has 25 A + 13 AA = 38).

## Automated coverage — what's actually machine-checkable

Every criterion in the dataset carries two rule-mapping arrays used to decide what to actually run:

- **`axeCoreRules`** — axe-core rule IDs, used by the extension's runtime Quick Audit. **26 of the 50 curated criteria have no axe-core rule mapping** (things like captions for prerecorded media, consistent navigation, or focus order — genuinely can't be verified by scanning a DOM snapshot; industry-wide, automated tools cover roughly a third to half of WCAG, the rest needs manual/human review). A criterion with zero `axeCoreRules` simply never appears as "tested" in a Quick Audit — it's not a bug, it's an honest gap.
- **`eslintRules`** — ESLint accessibility-plugin rule IDs (`eslint-plugin-jsx-a11y` for React, `@angular-eslint/eslint-plugin-template` for Angular, `eslint-plugin-vuejs-accessibility` for Vue), used by the MCP server's static `analyze_codebase`. **15 of the 50 criteria have an eslintRules mapping** — the ones with a clear, real static-analysis signal (e.g. `1.1.1` Non-text Content → `alt-text`, `4.1.2` Name/Role/Value → the various `aria-*`/role rules). The other 35 have no static-analysis equivalent and are legitimately skipped by codebase analysis, though they may still be reachable by a runtime Quick Audit if they have `axeCoreRules`.

In short: **runtime audit (extension) and static audit (MCP server codebase analysis) cover different, overlapping subsets of the 50 criteria** — run both for the fullest picture, and expect several criteria (things like "Consistent Identification" or "Language of Parts") to require manual review regardless of which tool you use.

## How compliance scores are computed

Both the extension's runtime score (`calculateComplianceScore`) and the MCP server's static score (`calculateStaticComplianceScore`) use the same weighting, applied only to criteria that were actually testable in that run:

- Each testable criterion scores **1** (pass), **0** (fail), or **0.5** (incomplete/needs manual review — runtime audits only; static analysis has no "incomplete" state).
- Criteria are weighted by level: **A × 3, AA × 2, AAA × 1** (lower levels weighted higher, since they're the baseline every standard requires).
- `overallScore = round(Σ(score × weight) / Σ(weight) × 100)` across testable criteria only. A criterion with zero instances tested that run doesn't count toward either side of the ratio — this is why a page with very few interactive elements can still show 100.

The extension's popup also breaks the same calculation down **by WCAG principle** (Perceivable / Operable / Understandable / Robust), and tracks raw `criticalFailCount`/`seriousFailCount` (axe-core's own impact ratings) separately from the weighted score, for prioritization.

### Reading the score

The UI colors scores red (< 50), amber (50-80), or green (> 80) — as a rough compliance signal, not a certification. A 90+ score means "the criteria we could automatically test mostly pass," not "this page/site is legally compliant" — the ~half of WCAG that automated tools can't check (see above) still needs a manual review pass before you can make that claim to a regulator or in a demand-letter response.
