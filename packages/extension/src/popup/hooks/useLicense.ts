import { useCallback, useEffect, useState } from 'react';
import {
  getLicenseStatus,
  removeLicenseKey as removeStoredLicenseKey,
  saveLicenseKey as saveStoredLicenseKey,
  type LicenseStatus,
} from '../../core/license-gate';

export function useLicense() {
  const [licenseStatus, setLicenseStatus] = useState<LicenseStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    const status = await getLicenseStatus();
    setLicenseStatus(status);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    void refresh();

    function handleStorageChange(
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: string,
    ): void {
      if (areaName === 'sync' && 'licenseKey' in changes) void refresh();
    }

    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => chrome.storage.onChanged.removeListener(handleStorageChange);
  }, [refresh]);

  const saveLicenseKey = useCallback(
    async (key: string) => {
      await saveStoredLicenseKey(key);
      await refresh();
    },
    [refresh],
  );

  const removeLicenseKey = useCallback(async () => {
    await removeStoredLicenseKey();
    await refresh();
  }, [refresh]);

  return { licenseStatus, isLoading, saveLicenseKey, removeLicenseKey };
}
