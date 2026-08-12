import { useCallback, useEffect, useState } from 'react';
import { getActiveTabId } from '../../shared/browser-tabs';
import { sendMessage } from '../../shared/messaging';
import type { AuditCompleteMessage, AuditErrorMessage, StartAuditMessage } from '../../shared/messaging';
import type { ComplianceScore, ProcessedAuditResult, StandardId } from '../../shared/types';

export interface AuditResults {
  result: ProcessedAuditResult;
  score: ComplianceScore;
}

function sessionKey(tabId: number): string {
  return `audit:${tabId}`;
}

export function useAudit() {
  const [isAuditing, setIsAuditing] = useState(false);
  const [results, setResults] = useState<AuditResults | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const tabId = await getActiveTabId();
        const key = sessionKey(tabId);
        const stored = await chrome.storage.session.get(key);
        const cached = stored[key] as AuditResults | undefined;
        if (cached && !cancelled) setResults(cached);
      } catch {
        // No active tab available yet — nothing to restore.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const startAudit = useCallback(async (standard: StandardId) => {
    setIsAuditing(true);
    setError(null);
    try {
      const message: StartAuditMessage = { type: 'START_AUDIT', standard };
      const response = await sendMessage<AuditCompleteMessage | AuditErrorMessage>(message);
      if (response.type === 'AUDIT_ERROR') {
        setError(response.error);
        setResults(null);
        return;
      }
      const next: AuditResults = { result: response.result, score: response.score };
      setResults(next);
      const tabId = await getActiveTabId();
      await chrome.storage.session.set({ [sessionKey(tabId)]: next });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsAuditing(false);
    }
  }, []);

  const reset = useCallback(() => {
    setResults(null);
    setError(null);
  }, []);

  return { isAuditing, results, error, startAudit, reset };
}
