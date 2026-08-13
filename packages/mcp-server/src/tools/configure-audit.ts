import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { resolveStandard, type StandardId } from '@accessible-ai/standards';
import type { SessionManager } from '../session/session-manager.js';

const STANDARD_IDS = [
  'wcag-2.0-a',
  'wcag-2.0-aa',
  'wcag-2.0-aaa',
  'wcag-2.1-a',
  'wcag-2.1-aa',
  'wcag-2.1-aaa',
  'wcag-2.2-a',
  'wcag-2.2-aa',
  'wcag-2.2-aaa',
  'ada',
  'section-508',
  'eaa',
] as const satisfies readonly StandardId[];

const inputSchema = {
  standard: z.enum(STANDARD_IDS),
  customRules: z.array(z.string()).optional(),
  excludeRules: z.array(z.string()).optional(),
};

export interface ConfigureAuditInput {
  standard: StandardId;
  customRules?: string[];
  excludeRules?: string[];
}

export async function configureAudit(sessions: SessionManager, { standard, customRules, excludeRules }: ConfigureAuditInput) {
  try {
    const resolved = resolveStandard(standard);
    let axeRuleIds = resolved.axeCoreRuleIds;
    if (excludeRules?.length) {
      const excluded = new Set(excludeRules);
      axeRuleIds = axeRuleIds.filter((id) => !excluded.has(id));
    }
    if (customRules?.length) {
      axeRuleIds = Array.from(new Set([...axeRuleIds, ...customRules]));
    }

    const sessionId = sessions.createSession({ standard, customRules, excludeRules });
    sessions.updateSession(sessionId, { resolvedStandard: resolved });

    const summary = {
      sessionId,
      standard: resolved.standard.name,
      criteriaCount: resolved.criteria.length,
      axeRuleCount: axeRuleIds.length,
      eslintRuleCount: resolved.eslintRules.length,
    };
    return { content: [{ type: 'text' as const, text: JSON.stringify(summary) }] };
  } catch (error) {
    return {
      isError: true,
      content: [{ type: 'text' as const, text: error instanceof Error ? error.message : 'Unknown error' }],
    };
  }
}

export function registerConfigureAuditTool(server: McpServer, sessions: SessionManager): void {
  server.registerTool(
    'configure_audit',
    {
      title: 'Configure Audit',
      description: 'Resolve a compliance standard (WCAG level, ADA, Section 508, EAA) and start a new audit session.',
      inputSchema,
    },
    (args) => configureAudit(sessions, args),
  );
}
