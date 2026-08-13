type ConnectionState = 'connected-licensed' | 'connected-unlicensed' | 'disconnected';

interface ConnectionIndicatorProps {
  isConnected: boolean;
  isLicensed: boolean;
}

function stateOf(isConnected: boolean, isLicensed: boolean): ConnectionState {
  if (!isConnected) return 'disconnected';
  return isLicensed ? 'connected-licensed' : 'connected-unlicensed';
}

const LABELS: Record<ConnectionState, string> = {
  'connected-licensed': 'MCP server connected — Deep Analysis licensed',
  'connected-unlicensed': 'MCP server connected — free tier (no Deep Analysis license)',
  disconnected: 'MCP server not connected',
};

const COLORS: Record<ConnectionState, string> = {
  'connected-licensed': '#22c55e',
  'connected-unlicensed': '#eab308',
  disconnected: '#ef4444',
};

export function ConnectionIndicator({ isConnected, isLicensed }: ConnectionIndicatorProps) {
  const state = stateOf(isConnected, isLicensed);
  return (
    <span
      className="connection-indicator"
      role="status"
      title={LABELS[state]}
      aria-label={LABELS[state]}
      style={{ backgroundColor: COLORS[state] }}
    />
  );
}
