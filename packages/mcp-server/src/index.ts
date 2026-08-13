#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { validateLicenseKeyNode } from '@accessible-ai/standards';
import { createMcpServer, registerTools } from './server.js';
import { createHttpBridge } from './http-bridge.js';
import { SessionManager } from './session/session-manager.js';
import { readKeyFromDisk } from './middleware/license-gate.js';
import { installService, uninstallService } from './service-installer/index.js';

const HTTP_PORT = Number(process.env.PORT) || 3100;

function logLicenseStatus(): void {
  const key = process.env.LICENSE_KEY || readKeyFromDisk();
  const secret = process.env.LICENSE_SECRET;

  if (!key) {
    console.log('License: not configured (free tier tools only)');
    return;
  }
  if (!secret) {
    console.warn('License: LICENSE_SECRET is missing — refusing to validate gated features');
    return;
  }

  const validation = validateLicenseKeyNode(key, secret);
  if (validation.valid) {
    console.log(`License: ${validation.tier} (${validation.email}, expires ${validation.expiresAt})`);
  } else {
    console.log(`License: invalid (${validation.reason})`);
  }
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      http: { type: 'boolean', default: false },
      stdio: { type: 'boolean', default: false },
      'install-service': { type: 'boolean', default: false },
      'uninstall-service': { type: 'boolean', default: false },
    },
  });

  if (values['install-service']) {
    const result = await installService({ nodePath: process.execPath, entryPath: process.argv[1]! });
    console.log(result.message);
    return;
  }

  if (values['uninstall-service']) {
    const result = await uninstallService();
    console.log(result.message);
    return;
  }

  // stdio is the safe default: an MCP client (Claude Desktop/Code) spawns its own process instance
  // per connection, so an unflagged launch must never also try to bind the HTTP port — that would
  // collide with the standalone --http daemon a client keeps running for the Chrome extension.
  // --http must be requested explicitly; pass both flags together to run one process doing both.
  const runHttp = values.http;
  const runStdio = values.stdio || !values.http;

  logLicenseStatus();

  const sessions = new SessionManager();

  if (runStdio) {
    const mcpServer = createMcpServer();
    registerTools(mcpServer, sessions);
    const transport = new StdioServerTransport();
    await mcpServer.connect(transport);
    console.log('MCP stdio transport ready');
  }

  if (runHttp) {
    const app = createHttpBridge(sessions);
    app.listen(HTTP_PORT, () => {
      console.log(`HTTP bridge listening on ${HTTP_PORT}`);
    });
  }
}

main().catch((error) => {
  console.error('Failed to start AccessibleAI MCP Server:', error);
  process.exit(1);
});
