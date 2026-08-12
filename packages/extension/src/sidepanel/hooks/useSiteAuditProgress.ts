import { useEffect, useState } from 'react';
import type { SiteAuditProgress } from '../../shared/types';

const PROGRESS_STORAGE_KEY = 'siteAuditProgress';

export function useSiteAuditProgress(): SiteAuditProgress | null {
  const [progress, setProgress] = useState<SiteAuditProgress | null>(null);

  useEffect(() => {
    chrome.storage.session.get(PROGRESS_STORAGE_KEY).then((stored) => {
      const cached = stored[PROGRESS_STORAGE_KEY] as SiteAuditProgress | undefined;
      if (cached) setProgress(cached);
    });

    function listener(message: unknown): void {
      const msg = message as { type?: string; progress?: SiteAuditProgress };
      if (msg?.type === 'SITE_AUDIT_PROGRESS' && msg.progress) setProgress(msg.progress);
    }
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []);

  return progress;
}
