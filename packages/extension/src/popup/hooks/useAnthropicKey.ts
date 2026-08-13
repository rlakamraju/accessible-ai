import { useCallback, useEffect, useState } from 'react';
import {
  getAnthropicKeyStatus,
  removeAnthropicApiKey as removeStoredAnthropicKey,
  saveAnthropicApiKey as saveStoredAnthropicKey,
  type AnthropicKeyStatus,
} from '../../core/anthropic-key';

export function useAnthropicKey() {
  const [status, setStatus] = useState<AnthropicKeyStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setStatus(await getAnthropicKeyStatus());
    setIsLoading(false);
  }, []);

  useEffect(() => {
    void refresh();

    function handleStorageChange(
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: string,
    ): void {
      if (areaName === 'sync' && 'anthropicApiKey' in changes) void refresh();
    }

    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => chrome.storage.onChanged.removeListener(handleStorageChange);
  }, [refresh]);

  const saveAnthropicKey = useCallback(
    async (key: string) => {
      await saveStoredAnthropicKey(key);
      await refresh();
    },
    [refresh],
  );

  const removeAnthropicKey = useCallback(async () => {
    await removeStoredAnthropicKey();
    await refresh();
  }, [refresh]);

  return { status, isLoading, saveAnthropicKey, removeAnthropicKey };
}
