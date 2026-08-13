import { writeFile } from 'node:fs/promises';
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { SessionManager } from '../session/session-manager.js';
import { requireLicenseForTool } from '../middleware/license-gate.js';

const inputSchema = {
  sessionId: z.string(),
  fixId: z.string(),
};

export interface RollbackFixInput {
  sessionId: string;
  fixId: string;
}

function errorResult(message: string) {
  return { isError: true, content: [{ type: 'text' as const, text: message }] };
}

/**
 * Restores a fix's file to its pre-fix content. Note: if that fix shared a file with other fixes
 * applied in the *same* `apply_fix` call, `before` is the file's state prior to that whole batch (see
 * `fix-applier.ts`) — rolling back one fix from a multi-fix-per-file batch restores the other fixes in
 * that batch too, not just the one requested. Rolling back a fix applied in its own `apply_fix` call is
 * always precise.
 */
export async function rollbackFixTool(sessions: SessionManager, { sessionId, fixId }: RollbackFixInput) {
  const session = sessions.getSession(sessionId);
  if (!session) return errorResult(`Unknown or expired session: ${sessionId}. Call configure_audit first.`);

  const fixes = session.appliedFixes ?? [];
  const fix = fixes.find((entry) => entry.fixId === fixId);
  if (!fix) return errorResult(`No applied fix found with id ${fixId}.`);
  if (fix.status === 'rolled-back') return errorResult(`Fix ${fixId} was already rolled back.`);

  try {
    await writeFile(fix.filePath, fix.before, 'utf8');
    const updated = fixes.map((entry) => (entry.fixId === fixId ? { ...entry, status: 'rolled-back' as const } : entry));
    sessions.updateSession(sessionId, { appliedFixes: updated });

    return { content: [{ type: 'text' as const, text: JSON.stringify({ rolledBack: true, filePath: fix.filePath, diff: fix.diff }) }] };
  } catch (error) {
    return errorResult(error instanceof Error ? error.message : 'Unknown error');
  }
}

export function registerRollbackFixTool(server: McpServer, sessions: SessionManager): void {
  server.registerTool(
    'rollback_fix',
    {
      title: 'Rollback Fix',
      description: 'Restores a previously applied fix’s file to its content from before the fix.',
      inputSchema,
    },
    requireLicenseForTool('remediation', (args: RollbackFixInput) => rollbackFixTool(sessions, args)),
  );
}
