import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { resolveStandard } from '@accessible-ai/standards';
import { generateReport, type ReportFormat, type ReportGroupBy } from '../engines/report-generator/generator.js';
import { hasLicensedFeature } from '../middleware/license-gate.js';
import type { SessionManager } from '../session/session-manager.js';

const inputSchema = {
  sessionId: z.string(),
  format: z.enum(['json', 'markdown', 'html']),
  groupBy: z.enum(['criterion', 'page', 'severity', 'component']).optional(),
  /** Required to persist markdown/html reports to `.accessible-ai/report.*`; omit to get the report body inline instead. */
  projectPath: z.string().optional(),
};

export interface GenerateReportInput {
  sessionId: string;
  format: ReportFormat;
  groupBy?: ReportGroupBy;
  projectPath?: string;
}

function errorResult(message: string) {
  return { isError: true, content: [{ type: 'text' as const, text: message }] };
}

export async function generateReportTool(sessions: SessionManager, { sessionId, format, groupBy, projectPath }: GenerateReportInput) {
  const session = sessions.getSession(sessionId);
  if (!session) return errorResult(`Unknown or expired session: ${sessionId}. Call configure_audit first.`);
  if (!session.codebaseResult) return errorResult('No codebase analysis found for this session. Call analyze_codebase first.');

  // HTML reports are gated; JSON and Markdown stay free (matches the plan's Phase 3 gating table).
  if (format === 'html' && !hasLicensedFeature('report-export')) {
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            error: 'License required',
            feature: 'report-export',
            message: 'HTML reports require a report-export license. JSON and Markdown formats remain free.',
          }),
        },
      ],
    };
  }

  try {
    const reportContent = generateReport(session.codebaseResult, {
      format,
      groupBy: groupBy ?? 'criterion',
      standard: session.config.standard,
    });

    const resolved = resolveStandard(session.config.standard);
    const testable = resolved.criteria.filter((c) => c.eslintRules.length > 0);
    const failedCriteria = new Set(session.codebaseResult.issues.flatMap((i) => i.wcagCriteria));
    const passes = testable.filter((c) => !failedCriteria.has(c.id)).length;

    let reportPath: string | undefined;
    if (format !== 'json' && projectPath) {
      reportPath = join(projectPath, '.accessible-ai', `report.${format === 'html' ? 'html' : 'md'}`);
      await mkdir(dirname(reportPath), { recursive: true });
      await writeFile(reportPath, reportContent, 'utf8');
    }

    const summary = { score: session.codebaseResult.complianceScore, violations: session.codebaseResult.issues.length, passes };
    const responseBody: Record<string, unknown> = { summary };
    if (reportPath) responseBody.reportPath = reportPath;
    else responseBody.report = reportContent;

    return { content: [{ type: 'text' as const, text: JSON.stringify(responseBody) }] };
  } catch (error) {
    return errorResult(error instanceof Error ? error.message : 'Unknown error');
  }
}

export function registerGenerateReportTool(server: McpServer, sessions: SessionManager): void {
  server.registerTool(
    'generate_report',
    {
      title: 'Generate Report',
      description: 'Generate a compliance report (JSON, Markdown, or HTML) from a session’s codebase analysis results.',
      inputSchema,
    },
    (args) => generateReportTool(sessions, args),
  );
}
