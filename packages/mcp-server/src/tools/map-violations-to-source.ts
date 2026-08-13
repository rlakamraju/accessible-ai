import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { resolveStandard } from '@accessible-ai/standards';
import type { SessionManager } from '../session/session-manager.js';
import { requireLicenseForTool } from '../middleware/license-gate.js';
import { normalizeRuntimeIssues } from '../engines/remediation/issue-normalizer.js';
import { deduplicateIssues } from '../engines/remediation/deduplicator.js';
import { mapViolationsToSource } from '../engines/remediation/source-mapper.js';
import { detectFramework } from '../engines/static-analyzer/framework-detector.js';

const inputSchema = {
  sessionId: z.string(),
  projectPath: z.string(),
};

export interface MapViolationsToSourceInput {
  sessionId: string;
  projectPath: string;
}

function errorResult(message: string) {
  return { isError: true, content: [{ type: 'text' as const, text: message }] };
}

export async function mapViolationsToSourceTool(sessions: SessionManager, { sessionId, projectPath }: MapViolationsToSourceInput) {
  const session = sessions.getSession(sessionId);
  if (!session) return errorResult(`Unknown or expired session: ${sessionId}. Call configure_audit first.`);

  const runtimeViolations = session.importedViolations ?? [];
  if (runtimeViolations.length === 0 && !session.codebaseResult) {
    return errorResult('No imported violations or codebase analysis found for this session. Call import_audit_results or analyze_codebase first.');
  }

  try {
    const resolved = session.resolvedStandard ?? resolveStandard(session.config.standard);
    const framework = session.codebaseResult?.framework.framework ?? (await detectFramework(projectPath)).framework;

    const runtimeIssues = normalizeRuntimeIssues(runtimeViolations, session.pageUrl ?? '', session.config.standard, resolved);
    const staticIssues = session.codebaseResult?.issues ?? [];

    let combined = deduplicateIssues([...staticIssues, ...runtimeIssues]);
    combined = await mapViolationsToSource(combined, projectPath, framework);

    sessions.updateSession(sessionId, { issues: combined });

    const runtimeInCombined = combined.filter((issue) => issue.source === 'runtime');
    const mapped = runtimeInCombined.filter((issue) => issue.sourceLocation.filePath).length;
    const unmapped = runtimeInCombined.length - mapped;

    const summary = {
      totalViolations: runtimeInCombined.length,
      mapped,
      unmapped,
      unmappedReasons:
        unmapped > 0
          ? [
              `${unmapped} violation(s) could not be matched to a source file — likely dynamic content, a third-party widget, or a selector this mapper doesn't support (:nth-child, shadow DOM).`,
            ]
          : [],
    };
    return { content: [{ type: 'text' as const, text: JSON.stringify(summary) }] };
  } catch (error) {
    return errorResult(error instanceof Error ? error.message : 'Unknown error');
  }
}

export function registerMapViolationsToSourceTool(server: McpServer, sessions: SessionManager): void {
  server.registerTool(
    'map_violations_to_source',
    {
      title: 'Map Violations to Source',
      description:
        'Normalizes imported runtime (axe-core) violations and any static codebase-analysis issues into one unified, deduped issue list, then best-effort maps runtime violations to their source file/line.',
      inputSchema,
    },
    requireLicenseForTool('remediation', (args: MapViolationsToSourceInput) => mapViolationsToSourceTool(sessions, args)),
  );
}
