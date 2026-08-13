import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { SessionManager } from './session/session-manager.js';
import { registerConfigureAuditTool } from './tools/configure-audit.js';
import { registerImportAuditResultsTool } from './tools/import-audit-results.js';
import { registerAnalyzeCodebaseTool } from './tools/analyze-codebase.js';
import { registerGenerateReportTool } from './tools/generate-report.js';
import { registerMapViolationsToSourceTool } from './tools/map-violations-to-source.js';
import { registerGenerateFixPlanTool } from './tools/generate-fix-plan.js';
import { registerApplyFixTool } from './tools/apply-fix.js';
import { registerRollbackFixTool } from './tools/rollback-fix.js';
import { registerGetFixHistoryTool } from './tools/get-fix-history.js';
import { registerVerifyFixesTool } from './tools/verify-fixes.js';

export function createMcpServer(): McpServer {
  return new McpServer({ name: 'accessible-ai', version: '1.0.0' });
}

/** Registers all MCP tool handlers on the given server instance. */
export function registerTools(server: McpServer, sessions: SessionManager): void {
  registerConfigureAuditTool(server, sessions);
  registerImportAuditResultsTool(server, sessions);
  registerAnalyzeCodebaseTool(server, sessions);
  registerGenerateReportTool(server, sessions);
  registerMapViolationsToSourceTool(server, sessions);
  registerGenerateFixPlanTool(server, sessions);
  registerApplyFixTool(server, sessions);
  registerRollbackFixTool(server, sessions);
  registerGetFixHistoryTool(server, sessions);
  registerVerifyFixesTool(server, sessions);
}
