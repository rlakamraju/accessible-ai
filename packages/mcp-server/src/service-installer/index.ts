import { execFile } from 'node:child_process';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { promisify } from 'node:util';
import {
  launchdLabel,
  launchdPlist,
  systemdUnit,
  systemdUnitName,
  windowsTaskName,
  windowsTaskXml,
  type ServiceEntry,
} from './templates.js';
import { launchdLogDir, launchdPlistPath, systemdUnitPath } from './paths.js';

const execFileAsync = promisify(execFile);

export interface ServiceInstallResult {
  platform: NodeJS.Platform;
  message: string;
}

async function installWindows(entry: ServiceEntry): Promise<ServiceInstallResult> {
  const xmlPath = join(tmpdir(), 'accessible-ai-mcp-task.xml');
  await writeFile(xmlPath, windowsTaskXml(entry), 'utf16le');
  try {
    await execFileAsync('schtasks', ['/create', '/tn', windowsTaskName(), '/xml', xmlPath, '/f']);
  } finally {
    await rm(xmlPath, { force: true });
  }
  await execFileAsync('schtasks', ['/run', '/tn', windowsTaskName()]);
  return {
    platform: 'win32',
    message: `Scheduled task "${windowsTaskName()}" installed and started. It will relaunch at every logon.`,
  };
}

async function uninstallWindows(): Promise<ServiceInstallResult> {
  await execFileAsync('schtasks', ['/end', '/tn', windowsTaskName()]).catch(() => {});
  await execFileAsync('schtasks', ['/delete', '/tn', windowsTaskName(), '/f']);
  return { platform: 'win32', message: `Scheduled task "${windowsTaskName()}" removed.` };
}

async function installMac(entry: ServiceEntry): Promise<ServiceInstallResult> {
  const logDir = launchdLogDir();
  await mkdir(logDir, { recursive: true });
  const plistPath = launchdPlistPath();
  await mkdir(dirname(plistPath), { recursive: true });
  await writeFile(plistPath, launchdPlist(entry, logDir), 'utf8');
  await execFileAsync('launchctl', ['load', '-w', plistPath]);
  return {
    platform: 'darwin',
    message: `launchd agent "${launchdLabel()}" installed and loaded. It will relaunch at every login.`,
  };
}

async function uninstallMac(): Promise<ServiceInstallResult> {
  const plistPath = launchdPlistPath();
  await execFileAsync('launchctl', ['unload', '-w', plistPath]).catch(() => {});
  await rm(plistPath, { force: true });
  return { platform: 'darwin', message: `launchd agent "${launchdLabel()}" unloaded and removed.` };
}

async function installLinux(entry: ServiceEntry): Promise<ServiceInstallResult> {
  const unitPath = systemdUnitPath();
  await mkdir(dirname(unitPath), { recursive: true });
  await writeFile(unitPath, systemdUnit(entry), 'utf8');
  await execFileAsync('systemctl', ['--user', 'daemon-reload']);
  await execFileAsync('systemctl', ['--user', 'enable', '--now', systemdUnitName()]);
  return {
    platform: 'linux',
    message: `systemd user unit "${systemdUnitName()}" installed and started. It will relaunch at every login.`,
  };
}

async function uninstallLinux(): Promise<ServiceInstallResult> {
  await execFileAsync('systemctl', ['--user', 'disable', '--now', systemdUnitName()]).catch(() => {});
  await rm(systemdUnitPath(), { force: true });
  await execFileAsync('systemctl', ['--user', 'daemon-reload']);
  return { platform: 'linux', message: `systemd user unit "${systemdUnitName()}" stopped and removed.` };
}

export async function installService(entry: ServiceEntry): Promise<ServiceInstallResult> {
  switch (process.platform) {
    case 'win32':
      return installWindows(entry);
    case 'darwin':
      return installMac(entry);
    case 'linux':
      return installLinux(entry);
    default:
      throw new Error(
        `--install-service is not supported on platform "${process.platform}". Run the HTTP bridge under your own process manager instead.`,
      );
  }
}

export async function uninstallService(): Promise<ServiceInstallResult> {
  switch (process.platform) {
    case 'win32':
      return uninstallWindows();
    case 'darwin':
      return uninstallMac();
    case 'linux':
      return uninstallLinux();
    default:
      throw new Error(`--uninstall-service is not supported on platform "${process.platform}".`);
  }
}
