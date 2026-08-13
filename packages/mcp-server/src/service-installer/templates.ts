export interface ServiceEntry {
  nodePath: string;
  entryPath: string;
}

const TASK_NAME = 'AccessibleAI MCP Server';
const LAUNCHD_LABEL = 'com.accessible-ai.mcp-server';
const SYSTEMD_UNIT_NAME = 'accessible-ai-mcp.service';

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Escapes systemd's `%` specifier character so literal paths containing it aren't misinterpreted. */
function escapeSystemd(value: string): string {
  return value.replace(/%/g, '%%');
}

export function windowsTaskName(): string {
  return TASK_NAME;
}

/** A Task Scheduler XML definition: relaunches at every logon and retries up to 3 times, 1 minute apart, on failure. */
export function windowsTaskXml({ nodePath, entryPath }: ServiceEntry): string {
  const command = escapeXml(nodePath);
  const args = `"${escapeXml(entryPath)}" --http`;
  return `<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <Triggers>
    <LogonTrigger>
      <Enabled>true</Enabled>
    </LogonTrigger>
  </Triggers>
  <Principals>
    <Principal id="Author">
      <LogonType>InteractiveToken</LogonType>
      <RunLevel>LeastPrivilege</RunLevel>
    </Principal>
  </Principals>
  <Settings>
    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <StartWhenAvailable>true</StartWhenAvailable>
    <RestartOnFailure>
      <Interval>PT1M</Interval>
      <Count>3</Count>
    </RestartOnFailure>
  </Settings>
  <Actions Context="Author">
    <Exec>
      <Command>"${command}"</Command>
      <Arguments>${args}</Arguments>
    </Exec>
  </Actions>
</Task>
`;
}

export function launchdLabel(): string {
  return LAUNCHD_LABEL;
}

/** A launchd agent plist: relaunches at login and whenever the process exits (KeepAlive). */
export function launchdPlist({ nodePath, entryPath }: ServiceEntry, logDir: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>${escapeXml(LAUNCHD_LABEL)}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${escapeXml(nodePath)}</string>
    <string>${escapeXml(entryPath)}</string>
    <string>--http</string>
  </array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>${escapeXml(logDir)}/mcp-server.log</string>
  <key>StandardErrorPath</key><string>${escapeXml(logDir)}/mcp-server.error.log</string>
</dict>
</plist>
`;
}

export function systemdUnitName(): string {
  return SYSTEMD_UNIT_NAME;
}

/** A systemd user unit: relaunches at every login (via `default.target`) and restarts on failure. */
export function systemdUnit({ nodePath, entryPath }: ServiceEntry): string {
  const node = escapeSystemd(nodePath);
  const entry = escapeSystemd(entryPath);
  return `[Unit]
Description=AccessibleAI MCP Server (HTTP bridge)

[Service]
ExecStart="${node}" "${entry}" --http
Restart=on-failure
RestartSec=5

[Install]
WantedBy=default.target
`;
}
