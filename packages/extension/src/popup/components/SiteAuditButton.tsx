import { useState } from 'react';

interface SiteAuditButtonProps {
  isRunning: boolean;
  onStart: (maxPages: number) => void;
}

export function SiteAuditButton({ isRunning, onStart }: SiteAuditButtonProps) {
  const [maxPages, setMaxPages] = useState(20);

  return (
    <div className="site-audit-row">
      <input
        type="number"
        className="site-audit-max-pages"
        min={1}
        max={200}
        value={maxPages}
        aria-label="Max pages to crawl"
        disabled={isRunning}
        onChange={(e) => setMaxPages(Math.max(1, Number(e.target.value) || 1))}
      />
      <button
        type="button"
        className="site-audit-button"
        disabled={isRunning}
        onClick={() => onStart(maxPages)}
      >
        {isRunning ? 'Auditing Site…' : 'Audit Entire Site'}
      </button>
    </div>
  );
}
