import { describe, expect, it } from 'vitest';
import {
  launchdLabel,
  launchdPlist,
  systemdUnit,
  systemdUnitName,
  windowsTaskName,
  windowsTaskXml,
} from '../../src/service-installer/templates';

const entry = { nodePath: 'C:\\Program Files\\nodejs\\node.exe', entryPath: 'C:\\tools\\mcp-server\\dist\\index.js' };

describe('windowsTaskXml', () => {
  it('references the node executable and entry script with the --http flag', () => {
    const xml = windowsTaskXml(entry);
    expect(xml).toContain('<Command>"C:\\Program Files\\nodejs\\node.exe"</Command>');
    expect(xml).toContain('<Arguments>"C:\\tools\\mcp-server\\dist\\index.js" --http</Arguments>');
  });

  it('configures a logon trigger and restart-on-failure', () => {
    const xml = windowsTaskXml(entry);
    expect(xml).toContain('<LogonTrigger>');
    expect(xml).toContain('<RestartOnFailure>');
    expect(xml).toContain('<Count>3</Count>');
  });

  it('escapes XML-special characters in paths', () => {
    const xml = windowsTaskXml({ nodePath: 'C:\\a & b\\node.exe', entryPath: entry.entryPath });
    expect(xml).toContain('C:\\a &amp; b\\node.exe');
    expect(xml).not.toContain('C:\\a & b\\node.exe');
  });

  it('uses a stable, human-readable task name', () => {
    expect(windowsTaskName()).toBe('AccessibleAI MCP Server');
  });
});

describe('launchdPlist', () => {
  it('references the node executable, entry script, and --http flag as separate array entries', () => {
    const plist = launchdPlist(entry, '/tmp/logs');
    expect(plist).toContain('<string>C:\\Program Files\\nodejs\\node.exe</string>');
    expect(plist).toContain('<string>C:\\tools\\mcp-server\\dist\\index.js</string>');
    expect(plist).toContain('<string>--http</string>');
  });

  it('sets RunAtLoad and KeepAlive so the agent relaunches at login and on crash', () => {
    const plist = launchdPlist(entry, '/tmp/logs');
    expect(plist).toContain('<key>RunAtLoad</key><true/>');
    expect(plist).toContain('<key>KeepAlive</key><true/>');
  });

  it('points stdout/stderr at the given log directory', () => {
    const plist = launchdPlist(entry, '/tmp/logs');
    expect(plist).toContain('<string>/tmp/logs/mcp-server.log</string>');
    expect(plist).toContain('<string>/tmp/logs/mcp-server.error.log</string>');
  });

  it('uses a stable bundle label', () => {
    expect(launchdLabel()).toBe('com.accessible-ai.mcp-server');
  });
});

describe('systemdUnit', () => {
  it('quotes the ExecStart command and includes the --http flag', () => {
    const unit = systemdUnit(entry);
    expect(unit).toContain('ExecStart="C:\\Program Files\\nodejs\\node.exe" "C:\\tools\\mcp-server\\dist\\index.js" --http');
  });

  it('restarts on failure and enables at login via default.target', () => {
    const unit = systemdUnit(entry);
    expect(unit).toContain('Restart=on-failure');
    expect(unit).toContain('WantedBy=default.target');
  });

  it('escapes the systemd %-specifier character in paths', () => {
    const unit = systemdUnit({ nodePath: '/opt/100%-node/node', entryPath: entry.entryPath });
    expect(unit).toContain('/opt/100%%-node/node');
  });

  it('uses a stable unit name', () => {
    expect(systemdUnitName()).toBe('accessible-ai-mcp.service');
  });
});
