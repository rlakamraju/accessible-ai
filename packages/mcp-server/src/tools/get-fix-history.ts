import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { SessionManager } from '../session/session-manager.js';

const inputSchema = {
  sessionId: z.string(),
};

export interface GetFixHistoryInput {
  sessionId: string;
}

function errorResult(message: string) {
  return { isError: true, content: [{ type: 'text' as const, text: message }] };
}

export async function getFixHistoryTool(sessions: SessionManager, { sessionId }: GetFixHistoryInput) {
  const session = sessions.getSession(sessionId);
  if (!session) return errorResult(`Unknown or expired session: ${sessionId}. Call configure_audit first.`);

  return { content: [{ type: 'text' as const, text: JSON.stringify(session.appliedFixes ?? []) }] };
}

/** Read-only introspection — ungated, matching `configure_audit`'s free-exploration precedent (the fixes it lists only exist if `apply_fix` was already licensed and used). */
export function registerGetFixHistoryTool(server: McpServer, sessions: SessionManager): void {
  server.registerTool(
    'get_fix_history',
    {
      title: 'Get Fix History',
      description: 'Lists every fix applied so far in this session, with diffs and status.',
      inputSchema,
    },
    (args) => getFixHistoryTool(sessions, args),
  );
}
