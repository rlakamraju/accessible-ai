import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { SessionManager } from '../session/session-manager.js';
import { requireLicenseForTool } from '../middleware/license-gate.js';
import { applyFixes } from '../engines/remediation/fix-applier.js';
import { gatherProjectContext } from '../engines/remediation/project-context.js';
import { generateLlmFix } from '../engines/remediation/llm-fix-generator.js';
import type { AppliedFix, ApplyFixMode, FixItem } from '../engines/remediation/types.js';

const inputSchema = {
  sessionId: z.string(),
  projectPath: z.string(),
  mode: z.enum(['single', 'phase', 'all-auto']),
  fixId: z.string().optional(),
  phaseNumber: z.number().int().optional(),
  dryRun: z.boolean().default(true),
};

export interface ApplyFixInput {
  sessionId: string;
  projectPath: string;
  mode: ApplyFixMode;
  fixId?: string;
  phaseNumber?: number;
  dryRun: boolean;
}

function errorResult(message: string) {
  return { isError: true, content: [{ type: 'text' as const, text: message }] };
}

function resolveFixItems(mode: ApplyFixMode, phases: { phase: number; issues: FixItem[] }[], fixId?: string, phaseNumber?: number): FixItem[] | string {
  const allItems = phases.flatMap((phase) => phase.issues);

  if (mode === 'single') {
    if (!fixId) return 'mode "single" requires fixId.';
    const item = allItems.find((candidate) => candidate.issueId === fixId);
    return item ? [item] : `No fix found with id ${fixId} in this session's fix plan.`;
  }

  if (mode === 'phase') {
    if (phaseNumber === undefined) return 'mode "phase" requires phaseNumber.';
    const phase = phases.find((candidate) => candidate.phase === phaseNumber);
    return phase ? phase.issues : `No phase ${phaseNumber} in this session's fix plan.`;
  }

  // all-auto
  return allItems.filter((item) => item.fix.type === 'auto-template');
}

/** For `llm-generated` items without pre-computed changes, runs the Level-2 generator now — falling back to `manual-guidance` in place if the LLM can't produce a verifiable fix (architecture doc section 5.4). */
async function materializeLlmFixes(items: FixItem[], projectPath: string): Promise<void> {
  for (const item of items) {
    if (item.fix.type !== 'llm-generated' || item.fix.changes) continue;

    const context = await gatherProjectContext(projectPath, item.issue);
    const result = await generateLlmFix(item.issue, context);
    if (result.status === 'generated') {
      item.fix.changes = result.changes;
    } else {
      item.fix.type = 'manual-guidance';
      item.fix.guidance = result.guidance;
    }
  }
}

export async function applyFixTool(sessions: SessionManager, { sessionId, projectPath, mode, fixId, phaseNumber, dryRun }: ApplyFixInput) {
  const session = sessions.getSession(sessionId);
  if (!session) return errorResult(`Unknown or expired session: ${sessionId}. Call configure_audit first.`);
  if (!session.fixPlan) return errorResult('No fix plan found for this session. Call generate_fix_plan first.');

  const items = resolveFixItems(mode, session.fixPlan.phases, fixId, phaseNumber);
  if (typeof items === 'string') return errorResult(items);
  if (items.length === 0) return errorResult('No matching fixes to apply.');

  try {
    await materializeLlmFixes(items, projectPath);
    const { result, fileContents } = await applyFixes(items, dryRun);

    if (!dryRun) {
      const issueByIssueId = new Map(items.map((item) => [item.issueId, item.issue]));
      const now = new Date().toISOString();
      const newRecords: AppliedFix[] = [];

      for (const entry of result.applied) {
        if (entry.status !== 'applied') continue;
        const contents = fileContents.get(entry.filePath);
        const issue = issueByIssueId.get(entry.fixId);
        if (!contents || !issue) continue;
        newRecords.push({
          fixId: randomUUID(),
          issueId: entry.fixId,
          ruleId: issue.ruleId,
          filePath: entry.filePath,
          before: contents.before,
          after: contents.after,
          diff: entry.diff,
          description: entry.description,
          status: 'applied',
          appliedAt: now,
        });
      }

      sessions.updateSession(sessionId, { appliedFixes: [...(session.appliedFixes ?? []), ...newRecords] });
    }

    return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
  } catch (error) {
    return errorResult(error instanceof Error ? error.message : 'Unknown error');
  }
}

export function registerApplyFixTool(server: McpServer, sessions: SessionManager): void {
  server.registerTool(
    'apply_fix',
    {
      title: 'Apply Fix',
      description:
        'Applies fixes from a session’s fix plan: one fix (mode "single"), an entire phase (mode "phase"), or every auto-fixable issue (mode "all-auto"). Defaults to a dry run — pass dryRun:false to actually write files.',
      inputSchema,
    },
    requireLicenseForTool('remediation', (args: ApplyFixInput) => applyFixTool(sessions, args)),
  );
}
