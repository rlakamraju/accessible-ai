import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { analyzeCodebase } from '../engines/static-analyzer/analyzer.js';
import { requireLicenseForTool } from '../middleware/license-gate.js';
import type { SessionManager } from '../session/session-manager.js';

const inputSchema = {
  sessionId: z.string(),
  projectPath: z.string(),
  include: z.array(z.string()).optional(),
  exclude: z.array(z.string()).optional(),
};

export interface AnalyzeCodebaseInput {
  sessionId: string;
  projectPath: string;
  include?: string[];
  exclude?: string[];
}

export async function analyzeCodebaseTool(sessions: SessionManager, { sessionId, projectPath, include, exclude }: AnalyzeCodebaseInput) {
  const session = sessions.getSession(sessionId);
  if (!session) {
    return {
      isError: true,
      content: [{ type: 'text' as const, text: `Unknown or expired session: ${sessionId}. Call configure_audit first.` }],
    };
  }

  try {
    const result = await analyzeCodebase(projectPath, { standard: session.config.standard, include, exclude });
    sessions.updateSession(sessionId, { codebaseResult: result });

    const summary = {
      framework: result.framework.framework,
      frameworkVersion: result.framework.version,
      filesAnalyzed: result.filesAnalyzed,
      totalIssues: result.issues.length,
      bySeverity: result.bySeverity,
      byPrinciple: result.byPrinciple,
      complianceScore: result.complianceScore,
    };
    return { content: [{ type: 'text' as const, text: JSON.stringify(summary) }] };
  } catch (error) {
    return {
      isError: true,
      content: [{ type: 'text' as const, text: error instanceof Error ? error.message : 'Unknown error' }],
    };
  }
}

export function registerAnalyzeCodebaseTool(server: McpServer, sessions: SessionManager): void {
  server.registerTool(
    'analyze_codebase',
    {
      title: 'Analyze Codebase',
      description:
        'Statically analyze a frontend project for accessibility issues: detects the framework, runs its accessibility ESLint plugin, and runs custom structural checks (keyboard handlers, ARIA patterns, heading hierarchy, form labels, route titling).',
      inputSchema,
    },
    requireLicenseForTool('codebase-audit', (args: AnalyzeCodebaseInput) => analyzeCodebaseTool(sessions, args)),
  );
}
