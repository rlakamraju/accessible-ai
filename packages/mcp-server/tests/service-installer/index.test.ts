import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const execFileMock = vi.fn(
  (_file: string, _args: string[], callback: (error: Error | null, stdout?: string, stderr?: string) => void) => {
    callback(null, '', '');
  },
);
const writeFileMock = vi.fn().mockResolvedValue(undefined);
const mkdirMock = vi.fn().mockResolvedValue(undefined);
const rmMock = vi.fn().mockResolvedValue(undefined);

vi.mock('node:child_process', () => ({ execFile: execFileMock }));
vi.mock('node:fs/promises', () => ({ writeFile: writeFileMock, mkdir: mkdirMock, rm: rmMock }));

const entry = { nodePath: '/usr/bin/node', entryPath: '/opt/mcp-server/dist/index.js' };
const originalPlatform = process.platform;

function setPlatform(platform: NodeJS.Platform): void {
  Object.defineProperty(process, 'platform', { value: platform, configurable: true });
}

describe('service-installer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  afterEach(() => {
    setPlatform(originalPlatform);
  });

  it('installService on win32 writes a task XML, registers it via schtasks, and runs it', async () => {
    setPlatform('win32');
    const { installService } = await import('../../src/service-installer/index');

    const result = await installService(entry);

    expect(writeFileMock).toHaveBeenCalledWith(expect.stringContaining('accessible-ai-mcp-task.xml'), expect.any(String), 'utf16le');
    expect(execFileMock).toHaveBeenCalledWith(
      'schtasks',
      expect.arrayContaining(['/create', '/tn', 'AccessibleAI MCP Server', '/f']),
      expect.any(Function),
    );
    expect(execFileMock).toHaveBeenCalledWith('schtasks', ['/run', '/tn', 'AccessibleAI MCP Server'], expect.any(Function));
    expect(rmMock).toHaveBeenCalledWith(expect.stringContaining('accessible-ai-mcp-task.xml'), { force: true });
    expect(result.platform).toBe('win32');
  });

  it('uninstallService on win32 ends and deletes the scheduled task', async () => {
    setPlatform('win32');
    const { uninstallService } = await import('../../src/service-installer/index');

    await uninstallService();

    expect(execFileMock).toHaveBeenCalledWith('schtasks', ['/end', '/tn', 'AccessibleAI MCP Server'], expect.any(Function));
    expect(execFileMock).toHaveBeenCalledWith(
      'schtasks',
      ['/delete', '/tn', 'AccessibleAI MCP Server', '/f'],
      expect.any(Function),
    );
  });

  it('installService on darwin writes the plist and loads it via launchctl', async () => {
    setPlatform('darwin');
    const { installService } = await import('../../src/service-installer/index');

    const result = await installService(entry);

    expect(mkdirMock).toHaveBeenCalled();
    expect(writeFileMock).toHaveBeenCalledWith(expect.stringContaining('com.accessible-ai.mcp-server.plist'), expect.any(String), 'utf8');
    expect(execFileMock).toHaveBeenCalledWith(
      'launchctl',
      ['load', '-w', expect.stringContaining('com.accessible-ai.mcp-server.plist')],
      expect.any(Function),
    );
    expect(result.platform).toBe('darwin');
  });

  it('uninstallService on darwin unloads and removes the plist', async () => {
    setPlatform('darwin');
    const { uninstallService } = await import('../../src/service-installer/index');

    await uninstallService();

    expect(execFileMock).toHaveBeenCalledWith(
      'launchctl',
      ['unload', '-w', expect.stringContaining('com.accessible-ai.mcp-server.plist')],
      expect.any(Function),
    );
    expect(rmMock).toHaveBeenCalledWith(expect.stringContaining('com.accessible-ai.mcp-server.plist'), { force: true });
  });

  it('installService on linux writes the unit file and enables it via systemctl', async () => {
    setPlatform('linux');
    const { installService } = await import('../../src/service-installer/index');

    const result = await installService(entry);

    expect(writeFileMock).toHaveBeenCalledWith(expect.stringContaining('accessible-ai-mcp.service'), expect.any(String), 'utf8');
    expect(execFileMock).toHaveBeenCalledWith('systemctl', ['--user', 'daemon-reload'], expect.any(Function));
    expect(execFileMock).toHaveBeenCalledWith(
      'systemctl',
      ['--user', 'enable', '--now', 'accessible-ai-mcp.service'],
      expect.any(Function),
    );
    expect(result.platform).toBe('linux');
  });

  it('uninstallService on linux disables the unit, removes it, and reloads systemd', async () => {
    setPlatform('linux');
    const { uninstallService } = await import('../../src/service-installer/index');

    await uninstallService();

    expect(execFileMock).toHaveBeenCalledWith(
      'systemctl',
      ['--user', 'disable', '--now', 'accessible-ai-mcp.service'],
      expect.any(Function),
    );
    expect(rmMock).toHaveBeenCalledWith(expect.stringContaining('accessible-ai-mcp.service'), { force: true });
    expect(execFileMock).toHaveBeenCalledWith('systemctl', ['--user', 'daemon-reload'], expect.any(Function));
  });

  it('installService rejects on an unsupported platform', async () => {
    setPlatform('sunos');
    const { installService } = await import('../../src/service-installer/index');

    await expect(installService(entry)).rejects.toThrow(/not supported/);
  });

  it('uninstallService rejects on an unsupported platform', async () => {
    setPlatform('sunos');
    const { uninstallService } = await import('../../src/service-installer/index');

    await expect(uninstallService()).rejects.toThrow(/not supported/);
  });
});
