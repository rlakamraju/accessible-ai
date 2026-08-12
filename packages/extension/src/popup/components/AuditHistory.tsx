import { useEffect, useState } from 'react';
import { generateHtmlReport, generateSiteHtmlReport } from '../../core/report-generator';
import { calculateComplianceScore } from '../../core/score-calculator';
import { clearAuditHistory, deleteAuditRecord, getAuditHistory, getAuditRecord } from '../../core/storage';
import type { AuditHistoryEntry, ProcessedAuditResult, SiteAuditResult } from '../../shared/types';

interface AuditHistoryProps {
  onClose: () => void;
}

export function AuditHistory({ onClose }: AuditHistoryProps) {
  const [entries, setEntries] = useState<AuditHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  async function refresh(): Promise<void> {
    setEntries(await getAuditHistory());
    setLoading(false);
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function handleView(entry: AuditHistoryEntry): Promise<void> {
    const record = await getAuditRecord(entry.id);
    if (!record) return;

    const html =
      entry.kind === 'site'
        ? generateSiteHtmlReport(record as SiteAuditResult, entry.standardId)
        : generateHtmlReport(
            record as ProcessedAuditResult,
            calculateComplianceScore(record as ProcessedAuditResult),
            entry.standardId,
          );

    chrome.tabs.create({ url: `data:text/html;charset=utf-8,${encodeURIComponent(html)}` });
  }

  async function handleDelete(id: string): Promise<void> {
    await deleteAuditRecord(id);
    await refresh();
  }

  async function handleClear(): Promise<void> {
    await clearAuditHistory();
    await refresh();
  }

  return (
    <div className="audit-history">
      <div className="audit-history-header">
        <h2>Audit History</h2>
        <button type="button" className="link-button" onClick={onClose}>
          Close
        </button>
      </div>

      {loading && <p>Loading…</p>}
      {!loading && entries.length === 0 && <p className="empty-state">No past audits yet.</p>}

      {!loading && entries.length > 0 && (
        <>
          <ul className="audit-history-list">
            {entries.map((entry) => (
              <li key={entry.id} className="audit-history-item">
                <div
                  className="audit-history-info"
                  role="button"
                  tabIndex={0}
                  onClick={() => handleView(entry)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') void handleView(entry);
                  }}
                >
                  <span className="audit-history-kind">{entry.kind === 'site' ? 'Site' : 'Page'}</span>
                  <span className="audit-history-url">{entry.url}</span>
                  <span className="audit-history-meta">
                    {entry.standardId} &middot; {new Date(entry.timestamp).toLocaleString()} &middot; {entry.score}%
                  </span>
                </div>
                <button type="button" className="link-button" onClick={() => handleDelete(entry.id)}>
                  Delete
                </button>
              </li>
            ))}
          </ul>
          <button type="button" className="link-button" onClick={handleClear}>
            Clear all
          </button>
        </>
      )}
    </div>
  );
}
