import { homedir } from 'node:os';
import { join } from 'node:path';

export function launchdPlistPath(): string {
  return join(homedir(), 'Library', 'LaunchAgents', 'com.accessible-ai.mcp-server.plist');
}

export function launchdLogDir(): string {
  return join(homedir(), 'Library', 'Logs', 'accessible-ai');
}

export function systemdUnitPath(): string {
  return join(homedir(), '.config', 'systemd', 'user', 'accessible-ai-mcp.service');
}
