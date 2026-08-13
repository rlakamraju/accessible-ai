import { useCallback, useEffect, useState } from 'react';
import { mcpBridge, type ServerStatus } from '../../background/mcp-bridge';

const POLL_INTERVAL_MS = 30_000;

export function useMcpConnection() {
  const [isConnected, setIsConnected] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [serverStatus, setServerStatus] = useState<ServerStatus | null>(null);

  const checkConnection = useCallback(async () => {
    setIsChecking(true);
    const status = await mcpBridge.getServerStatus();
    setServerStatus(status);
    setIsConnected(status.available);
    setIsChecking(false);
  }, []);

  useEffect(() => {
    void checkConnection();
    const interval = setInterval(() => void checkConnection(), POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [checkConnection]);

  return { isConnected, isChecking, serverStatus, checkConnection };
}
