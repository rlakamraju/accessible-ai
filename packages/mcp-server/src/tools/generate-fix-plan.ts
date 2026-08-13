import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { resolveStandard } from '@accessible-ai/standards';
import type { SessionManager } from '../session/session-manager.js';
import { requireLicenseForTool } from '../middleware/license-gate.js';
import { generateFixPlan } from '../engines/remediation/planner.js';
import type { PrioritizeBy } from '../engines/remediation/types.js';

const PRIORITIZE_BY = ['impact', 'effort', 'wcag-level', 'legal-risk'] as const satisfies readonly PrioritizeBy[];

const inputSchema = {
  sessionId: z.string(),
  prioritizeBy: z.enum(PRIORITIZE_BY).default('impact'),
  maxItems: z.number().int().positive().optional(),
};

export interface GenerateFixPlanInput {
  sessionId: string;
  prioritizeBy: PrioritizeBy;
  maxItems?: number;
}

function errorResult(message: string) {
  return { isError: true, content: [{ type: 'text' as const, text: message }] };
}

export async function generateFixPlanTool(sessions: SessionManager, { sessionId, prioritizeBy, maxItems }: GenerateFixPlanInput) {
  const session = sessions.getSession(sessionId);
  if (!session) return errorResult(`Unknown or expired session: ${sessionId}. Call configure_audit first.`);

  const issues = session.issues ?? session.codebaseResult?.issues ?? [];
  if (issues.length === 0) {
    return errorResult('No issues found for this session. Call analyze_codebase and/or map_violations_to_source first.');
  }

  try {
    const resolved = session.resolvedStandard ?? resolveStandard(session.config.standard);
    const complianceScoreBefore = session.codebaseResult?.complianceScore ?? 0;

    const plan = generateFixPlan(issues, resolved, complianceScoreBefore, { prioritizeBy, maxItems });
    sessions.updateSession(sessionId, { fixPlan: plan, issues });

    return { content: [{ type: 'text' as const, text: JSON.stringify(plan) }] };
  } catch (error) {
    return errorResult(error instanceof Error ? error.message : 'Unknown error');
  }
}

export function registerGenerateFixPlanTool(server: McpServer, sessions: SessionManager): void {
  server.registerTool(
    'generate_fix_plan',
    {
      title: 'Generate Fix Plan',
      description:
        'Builds a prioritized, 3-phase remediation plan (automated / AI-assisted / manual review) from a session’s issues, with effort estimates and a projected compliance score per phase.',
      inputSchema,
    },
    requireLicenseForTool('remediation', (args: GenerateFixPlanInput) => generateFixPlanTool(sessions, args)),
  );
}
