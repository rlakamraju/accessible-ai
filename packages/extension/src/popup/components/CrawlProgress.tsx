import type { SiteAuditProgress } from '../../shared/types';

interface CrawlProgressProps {
  progress: SiteAuditProgress;
  startedAt: number | null;
  onCancel: () => void;
}

function phaseLabel(progress: SiteAuditProgress): string {
  switch (progress.phase) {
    case 'crawling':
      return 'Discovering pages';
    case 'auditing':
      return 'Auditing pages';
    case 'aggregating':
      return 'Aggregating results';
    case 'complete':
      return 'Complete';
    case 'error':
      return 'Error';
    case 'cancelled':
      return 'Cancelled';
    default:
      return '';
  }
}

function progressFraction(progress: SiteAuditProgress): number {
  if (progress.phase === 'crawling') {
    return progress.pagesTotal > 0 ? progress.pagesVisited / (progress.pagesTotal * 2) : 0;
  }
  if (progress.phase === 'auditing') {
    return progress.pagesTotal > 0 ? 0.5 + progress.pagesAudited / (progress.pagesTotal * 2) : 0.5;
  }
  if (progress.phase === 'aggregating') return 0.95;
  if (progress.phase === 'complete') return 1;
  return 0;
}

function pagesDoneAndTotal(progress: SiteAuditProgress): { done: number; total: number } | null {
  if (progress.phase === 'crawling') return { done: progress.pagesVisited, total: progress.pagesTotal * 2 };
  if (progress.phase === 'auditing') {
    return { done: progress.pagesTotal + progress.pagesAudited, total: progress.pagesTotal * 2 };
  }
  return null;
}

function formatEta(ms: number): string {
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `~${seconds}s remaining`;
  return `~${Math.round(seconds / 60)}m remaining`;
}

function estimateEta(progress: SiteAuditProgress, startedAt: number | null): string | null {
  if (!startedAt) return null;
  const counts = pagesDoneAndTotal(progress);
  if (!counts || counts.done <= 0 || counts.total <= 0) return null;
  const elapsed = Date.now() - startedAt;
  const perStep = elapsed / counts.done;
  const remaining = Math.max(0, perStep * (counts.total - counts.done));
  return formatEta(remaining);
}

export function CrawlProgress({ progress, startedAt, onCancel }: CrawlProgressProps) {
  const active = progress.phase === 'crawling' || progress.phase === 'auditing' || progress.phase === 'aggregating';
  const pct = Math.round(progressFraction(progress) * 100);
  const eta = active ? estimateEta(progress, startedAt) : null;

  return (
    <div className="crawl-progress">
      <div className="crawl-progress-header">
        <span>{phaseLabel(progress)}</span>
        {active && (
          <button type="button" className="link-button" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
      <div className="bar-track">
        <div className="bar-fill" style={{ width: `${pct}%` }} />
      </div>
      {progress.phase === 'crawling' && (
        <p className="crawl-progress-detail">
          {progress.pagesVisited} page(s) discovered &middot; {progress.currentUrl}
        </p>
      )}
      {progress.phase === 'auditing' && (
        <p className="crawl-progress-detail">
          {progress.pagesAudited}/{progress.pagesTotal} audited &middot; {progress.currentUrl}
        </p>
      )}
      {eta && <p className="crawl-progress-eta">{eta}</p>}
      {progress.phase === 'error' && (
        <p className="audit-error" role="alert">
          {progress.error}
        </p>
      )}
      {progress.phase === 'cancelled' && <p className="crawl-progress-detail">Crawl cancelled.</p>}
      {progress.phase === 'complete' && (
        <p className="crawl-progress-detail">
          Done — {progress.result.pageScores.length} page(s) audited. View the full report in the side panel.
        </p>
      )}
    </div>
  );
}
