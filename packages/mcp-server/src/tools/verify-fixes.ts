import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { SessionManager } from '../session/session-manager.js';
import { requireLicenseForTool } from '../middleware/license-gate.js';
import { verifyStaticFixes } from '../engines/remediation/verification/static-verifier.js';
import { buildVerificationResult } from '../engines/remediation/verification/report.js';
import type { VerificationLevel } from '../engines/remediation/types.js';

const inputSchema = {
  sessionId: z.string(),
  projectPath: z.string(),
  verificationLevel: z.enum(['static-only', 'static-and-runtime']).default('static-only'),
  fixIds: z.array(z.string()).optional(),
};

export interface VerifyFixesInput {
  sessionId: string;
  projectPath: string;
  verificationLevel: VerificationLevel;
  fixIds?: string[];
}

function errorResult(message: string) {
  return { isError: true, content: [{ type: 'text' as const, text: message }] };
}

export async function verifyFixesTool(sessions: SessionManager, { sessionId, projectPath, verificationLevel, fixIds }: VerifyFixesInput) {
  const session = sessions.getSession(sessionId);
  if (!session) return errorResult(`Unknown or expired session: ${sessionId}. Call configure_audit first.`);
  if (!session.codebaseResult) return errorResult('No codebase analysis found for this session. Call analyze_codebase first.');

  const appliedFixes = (session.appliedFixes ?? []).filter(
    (fix) => fix.status === 'applied' && (!fixIds || fixIds.includes(fix.fixId)),
  );
  if (appliedFixes.length === 0) return errorResult('No applied fixes to verify (matching the given fixIds, if provided).');

  try {
    const before = session.codebaseResult;
    const after = await verifyStaticFixes(projectPath, { standard: session.config.standard });

    // Runtime re-verification (build + serve + re-run axe-core via a headless browser) is spec'd in the
    // architecture doc but not implemented here — no browser binary is bundled with this server, matching
    // this repo's broader "avoid heavy deps" stance (see templates/types.ts). Static verification always
    // runs and is fully implemented; this note surfaces the gap instead of silently ignoring the request.
    const notes =
      verificationLevel === 'static-and-runtime'
        ? [
            "Runtime re-verification isn't available in this build (no bundled headless browser) — ran static-only verification instead. Re-run the Chrome extension's Quick Audit on the live site to verify visually.",
          ]
        : undefined;

    const result = buildVerificationResult({ appliedFixes, before, after, standard: session.config.standard, notes });
    sessions.updateSession(sessionId, { codebaseResult: after });

    return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
  } catch (error) {
    return errorResult(error instanceof Error ? error.message : 'Unknown error');
  }
}

export function registerVerifyFixesTool(server: McpServer, sessions: SessionManager): void {
  server.registerTool(
    'verify_fixes',
    {
      title: 'Verify Fixes',
      description: 'Re-runs static analysis after fixes were applied, reports the compliance delta, flags regressions, and produces a commit message.',
      inputSchema,
    },
    requireLicenseForTool('remediation', (args: VerifyFixesInput) => verifyFixesTool(sessions, args)),
  );
}
