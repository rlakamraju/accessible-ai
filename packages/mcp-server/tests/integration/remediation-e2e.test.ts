import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SessionManager } from '../../src/session/session-manager';
import { configureAudit } from '../../src/tools/configure-audit';
import { analyzeCodebaseTool } from '../../src/tools/analyze-codebase';
import { importAuditResults } from '../../src/tools/import-audit-results';
import { mapViolationsToSourceTool } from '../../src/tools/map-violations-to-source';
import { generateFixPlanTool } from '../../src/tools/generate-fix-plan';
import { applyFixTool } from '../../src/tools/apply-fix';
import { rollbackFixTool } from '../../src/tools/rollback-fix';
import type { AxeViolation } from '../../src/config/types';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, '../fixtures');

function parse(result: { content: Array<{ text: string }> }) {
  return JSON.parse(result.content[0].text);
}

describe('remediation end-to-end', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'accessible-ai-e2e-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  /**
   * Workflow A (full codebase): configure_audit -> analyze_codebase -> generate_fix_plan -> apply_fix ->
   * inspect the result. Note: this repo's only static rule marked `automationLevel: 'auto'`
   * (`dialog-missing-aria-modal`, from Phase 4) has no Level-1 template in Phase 5's fixed 10-template
   * list, and none of `sample-react-project`'s real violations trigger it — so a pure static-analysis
   * fix plan realistically has an empty "Quick Wins" phase here. The Level-1 auto-fixable rules
   * (html-lang, duplicate-id, tabindex, meta-viewport) are all axe-core/*runtime* concerns, exercised
   * below in Workflow B. This test asserts what the codebase-only path actually does rather than
   * asserting a nonempty auto phase that wouldn't reflect real system behavior.
   */
  it('workflow A: configure_audit -> analyze_codebase -> generate_fix_plan -> apply_fix (all-auto)', async () => {
    await cp(join(FIXTURES, 'sample-react-project'), dir, { recursive: true });
    const sessions = new SessionManager();

    const configureResult = parse(await configureAudit(sessions, { standard: 'ada' }));
    const sessionId = configureResult.sessionId;

    const analyzeResult = parse(await analyzeCodebaseTool(sessions, { sessionId, projectPath: dir }));
    expect(analyzeResult.totalIssues).toBeGreaterThan(0);

    const plan = parse(await generateFixPlanTool(sessions, { sessionId, prioritizeBy: 'impact' }));
    expect(plan.phases.length).toBeGreaterThan(0);
    expect(plan.summary.totalIssues).toBe(analyzeResult.totalIssues);
    expect(plan.summary.autoFixable).toBe(0); // see comment above: no template-backed rule fires from static analysis alone here

    // "all-auto" against a plan with zero auto-fixable issues is a legitimate no-op, not a system error.
    const applyResult = await applyFixTool(sessions, { sessionId, projectPath: dir, mode: 'all-auto', dryRun: true });
    expect(applyResult.isError).toBe(true);
    expect(applyResult.content[0].text).toContain('No matching fixes to apply');

    // The llm-assisted/manual-review phases are real and appliable, e.g. as mode: "phase".
    const llmAssistedPhase = plan.phases.find((p: { name: string }) => p.name.includes('AI-Assisted'));
    expect(llmAssistedPhase?.issues.length).toBeGreaterThan(0);
  });

  /**
   * Workflow B (import + map + fix): the actual home of Level-1 auto-fixes. Imports axe-core violations
   * for html-lang / duplicate-id / tabindex / meta-viewport (all auto-fixable) plus image-alt
   * (llm-assisted, since real alt text needs meaning), maps them to source, generates a plan, and
   * applies every auto-fixable one for real.
   */
  it('workflow B: import_audit_results -> map_violations_to_source -> generate_fix_plan -> apply_fix', async () => {
    await cp(join(FIXTURES, 'remediation-html-project'), dir, { recursive: true });
    const indexPath = join(dir, 'index.html');
    const originalContent = await readFile(indexPath, 'utf8');

    const violations: AxeViolation[] = [
      {
        id: 'html-has-lang',
        impact: 'serious',
        description: 'html element must have a lang attribute',
        help: '',
        helpUrl: '',
        tags: ['wcag2a', 'wcag311'],
        nodes: [{ target: ['html'], html: '<html>' }],
      },
      {
        id: 'duplicate-id',
        impact: 'minor',
        description: 'IDs must be unique',
        help: '',
        helpUrl: '',
        tags: ['wcag2a', 'wcag411'],
        nodes: [{ target: ['#box'], html: '<div id="box"></div>' }],
      },
      {
        id: 'tabindex',
        impact: 'serious',
        description: 'Elements should not have a tabindex greater than zero',
        help: '',
        helpUrl: '',
        tags: ['wcag2a', 'wcag243'],
        nodes: [{ target: ['div[tabindex="3"]'], html: '<div tabindex="3">Panel</div>' }],
      },
      {
        id: 'meta-viewport',
        impact: 'critical',
        description: 'Zooming and scaling should not be disabled',
        help: '',
        helpUrl: '',
        tags: ['wcag2aa', 'wcag144'],
        nodes: [{ target: ['meta[name="viewport"]'], html: '<meta name="viewport">' }],
      },
      {
        id: 'image-alt',
        impact: 'critical',
        description: 'Images must have alternate text',
        help: '',
        helpUrl: '',
        tags: ['wcag2a', 'wcag111'],
        nodes: [{ target: ['img'], html: '<img src="/photo-1.jpg">' }],
      },
    ];

    const exportPath = join(dir, 'audit-results.json');
    await writeFile(
      exportPath,
      JSON.stringify({
        version: '1.0',
        source: 'chrome-extension',
        pageUrl: 'https://example.com',
        standard: 'wcag-2.1-aa',
        axeResults: { violations },
      }),
      'utf8',
    );

    const sessions = new SessionManager();
    const importResult = parse(await importAuditResults(sessions, { filePath: exportPath, projectPath: dir }));
    const sessionId = importResult.sessionId;
    expect(importResult.importedViolations).toBe(5);

    const mapResult = parse(await mapViolationsToSourceTool(sessions, { sessionId, projectPath: dir }));
    expect(mapResult.mapped).toBe(5);
    expect(mapResult.unmapped).toBe(0);

    const plan = parse(await generateFixPlanTool(sessions, { sessionId, prioritizeBy: 'impact' }));
    const autoPhase = plan.phases.find((p: { name: string }) => p.name.includes('Quick Wins'));
    const llmPhase = plan.phases.find((p: { name: string }) => p.name.includes('AI-Assisted'));
    expect(autoPhase?.issues).toHaveLength(4); // html-has-lang, duplicate-id, tabindex, meta-viewport
    expect(llmPhase?.issues).toHaveLength(1); // image-alt

    const dryRun = parse(await applyFixTool(sessions, { sessionId, projectPath: dir, mode: 'all-auto', dryRun: true }));
    expect(dryRun.summary.successfullyApplied).toBe(4);
    expect(await readFile(indexPath, 'utf8')).toBe(originalContent); // untouched

    const applied = parse(await applyFixTool(sessions, { sessionId, projectPath: dir, mode: 'all-auto', dryRun: false }));
    expect(applied.summary.successfullyApplied).toBe(4);

    const fixedContent = await readFile(indexPath, 'utf8');
    expect(fixedContent).toContain('<html lang="en">');
    expect(fixedContent).toContain('id="box-2"');
    expect(fixedContent).not.toContain('tabindex="3"');
    expect(fixedContent).not.toContain('maximum-scale');
    expect(fixedContent).not.toContain('user-scalable');

    expect(sessions.getSession(sessionId)?.appliedFixes).toHaveLength(4);
  });

  it('workflow C: rollback restores a fixed file to its exact pre-fix content', async () => {
    await cp(join(FIXTURES, 'remediation-html-project'), dir, { recursive: true });
    const indexPath = join(dir, 'index.html');
    const originalContent = await readFile(indexPath, 'utf8');

    const violation: AxeViolation = {
      id: 'html-has-lang',
      impact: 'serious',
      description: 'html element must have a lang attribute',
      help: '',
      helpUrl: '',
      tags: ['wcag2a', 'wcag311'],
      nodes: [{ target: ['html'], html: '<html>' }],
    };
    const exportPath = join(dir, 'audit-results.json');
    await writeFile(
      exportPath,
      JSON.stringify({ version: '1.0', source: 'chrome-extension', pageUrl: 'https://example.com', standard: 'wcag-2.1-aa', axeResults: { violations: [violation] } }),
      'utf8',
    );

    const sessions = new SessionManager();
    const { sessionId } = parse(await importAuditResults(sessions, { filePath: exportPath, projectPath: dir }));
    await mapViolationsToSourceTool(sessions, { sessionId, projectPath: dir });
    await generateFixPlanTool(sessions, { sessionId, prioritizeBy: 'impact' });
    await applyFixTool(sessions, { sessionId, projectPath: dir, mode: 'all-auto', dryRun: false });

    expect(await readFile(indexPath, 'utf8')).toContain('lang="en"');

    const [fix] = sessions.getSession(sessionId)!.appliedFixes!;
    const rollbackResult = parse(await rollbackFixTool(sessions, { sessionId, fixId: fix.fixId }));

    expect(rollbackResult.rolledBack).toBe(true);
    expect(await readFile(indexPath, 'utf8')).toBe(originalContent);
    expect(sessions.getSession(sessionId)?.appliedFixes?.[0].status).toBe('rolled-back');
  });
});
