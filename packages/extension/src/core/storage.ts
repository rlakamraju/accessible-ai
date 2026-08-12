import type { AuditHistoryEntry, ProcessedAuditResult, SiteAuditResult, StandardId } from '../shared/types';

const HISTORY_KEY = 'auditHistory';
const MAX_HISTORY = 20;

function recordKey(id: string): string {
  return `auditRecord:${id}`;
}

export async function getAuditHistory(): Promise<AuditHistoryEntry[]> {
  const stored = await chrome.storage.local.get(HISTORY_KEY);
  return (stored[HISTORY_KEY] as AuditHistoryEntry[] | undefined) ?? [];
}

export async function saveAuditRecord(
  kind: 'page' | 'site',
  standardId: StandardId,
  url: string,
  score: number,
  data: ProcessedAuditResult | SiteAuditResult,
): Promise<AuditHistoryEntry> {
  const entry: AuditHistoryEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    kind,
    url,
    standardId,
    timestamp: new Date().toISOString(),
    score,
  };

  const history = await getAuditHistory();
  const updated = [entry, ...history].slice(0, MAX_HISTORY);
  const pruned = history.slice(MAX_HISTORY - 1);

  await chrome.storage.local.set({ [HISTORY_KEY]: updated, [recordKey(entry.id)]: data });
  if (pruned.length > 0) {
    await chrome.storage.local.remove(pruned.map((e) => recordKey(e.id)));
  }

  return entry;
}

export async function getAuditRecord(
  id: string,
): Promise<ProcessedAuditResult | SiteAuditResult | undefined> {
  const stored = await chrome.storage.local.get(recordKey(id));
  return stored[recordKey(id)] as ProcessedAuditResult | SiteAuditResult | undefined;
}

export async function deleteAuditRecord(id: string): Promise<void> {
  const history = await getAuditHistory();
  await chrome.storage.local.set({ [HISTORY_KEY]: history.filter((entry) => entry.id !== id) });
  await chrome.storage.local.remove(recordKey(id));
}

export async function clearAuditHistory(): Promise<void> {
  const history = await getAuditHistory();
  await chrome.storage.local.remove(history.map((entry) => recordKey(entry.id)));
  await chrome.storage.local.remove(HISTORY_KEY);
}
