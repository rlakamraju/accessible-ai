import { useCallback, useEffect, useState } from 'react';
import type { StandardId } from '@accessible-ai/standards';
import { sendMessage } from '../../shared/messaging';
import type {
  AuditErrorMessage,
  CancelSiteAuditMessage,
  SiteAuditProgressMessage,
  SiteAuditStartedMessage,
  StartSiteAuditMessage,
} from '../../shared/messaging';
import type { CrawlConfig, SiteAuditProgress } from '../../shared/types';

const PROGRESS_STORAGE_KEY = 'siteAuditProgress';

function isActivePhase(progress: SiteAuditProgress | null): boolean {
  return progress?.phase === 'crawling' || progress?.phase === 'auditing' || progress?.phase === 'aggregating';
}

export function useSiteAudit() {
  const [progress, setProgress] = useState<SiteAuditProgress | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    chrome.storage.session.get(PROGRESS_STORAGE_KEY).then((stored) => {
      const cached = stored[PROGRESS_STORAGE_KEY] as SiteAuditProgress | undefined;
      if (cached) setProgress(cached);
    });

    function listener(message: unknown): void {
      const msg = message as SiteAuditProgressMessage;
      if (msg?.type === 'SITE_AUDIT_PROGRESS') setProgress(msg.progress);
    }
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []);

  const startSiteAudit = useCallback(
    async (rootUrl: string, standard: StandardId, crawlConfig: CrawlConfig) => {
      setError(null);
      setStartedAt(Date.now());
      setProgress({ phase: 'crawling', pagesVisited: 0, pagesTotal: crawlConfig.maxPages, currentUrl: rootUrl, discoveredUrls: [] });

      const message: StartSiteAuditMessage = { type: 'START_SITE_AUDIT', rootUrl, standard, crawlConfig };
      const response = await sendMessage<SiteAuditStartedMessage | AuditErrorMessage>(message);
      if (response.type === 'AUDIT_ERROR') {
        setError(response.error);
        setProgress(null);
        setStartedAt(null);
      }
    },
    [],
  );

  const cancelSiteAudit = useCallback(async () => {
    const message: CancelSiteAuditMessage = { type: 'CANCEL_SITE_AUDIT' };
    await sendMessage(message);
  }, []);

  return {
    progress,
    isRunning: isActivePhase(progress),
    startedAt,
    error,
    startSiteAudit,
    cancelSiteAudit,
  };
}
