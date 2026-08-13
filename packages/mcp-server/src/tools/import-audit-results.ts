import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { StandardId } from '@accessible-ai/standards';
import type { SessionManager } from '../session/session-manager.js';
import type { AxeViolation } from '../config/types.js';

const inputSchema = {
  filePath: z.string(),
  projectPath: z.string().optional(),
};

interface AuditExport {
  version: string;
  source: string;
  pageUrl: string;
  standard: StandardId;
  axeResults: { violations: AxeViolation[] };
}

function isAuditExport(value: unknown): value is AuditExport {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<AuditExport>;
  return (
    typeof candidate.version === 'string' &&
    candidate.source === 'chrome-extension' &&
    typeof candidate.standard === 'string' &&
    Array.isArray(candidate.axeResults?.violations)
  );
}

export interface ImportAuditResultsInput {
  filePath: string;
  projectPath?: string;
}

export async function importAuditResults(sessions: SessionManager, { filePath, projectPath }: ImportAuditResultsInput) {
  try {
    const raw = await readFile(filePath, 'utf8');
    const parsed: unknown = JSON.parse(raw);

    if (!isAuditExport(parsed)) {
      return {
        isError: true,
        content: [{ type: 'text' as const, text: 'Not a valid AccessibleAI export file' }],
      };
    }

    const sessionId = sessions.createSession({ standard: parsed.standard });
    sessions.updateSession(sessionId, { importedViolations: parsed.axeResults.violations });

    const importedViolations = parsed.axeResults.violations.length;
    // Runtime -> source mapping (Task 5.2) ships in Phase 5; every violation is unmapped until then.
    const mappedToSource = 0;
    const unmapped = projectPath ? importedViolations : 0;

    const summary = { sessionId, importedViolations, mappedToSource, unmapped };
    return { content: [{ type: 'text' as const, text: JSON.stringify(summary) }] };
  } catch (error) {
    return {
      isError: true,
      content: [{ type: 'text' as const, text: error instanceof Error ? error.message : 'Unknown error' }],
    };
  }
}

export function registerImportAuditResultsTool(server: McpServer, sessions: SessionManager): void {
  server.registerTool(
    'import_audit_results',
    {
      title: 'Import Audit Results',
      description: 'Import a Chrome extension audit export (.accessible-ai/audit-results.json) into a new session.',
      inputSchema,
    },
    (args) => importAuditResults(sessions, args),
  );
}
