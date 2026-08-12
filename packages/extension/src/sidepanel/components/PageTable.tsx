import { useMemo, useState } from 'react';
import type { PageScore } from '../../shared/types';

type SortKey = 'title' | 'score' | 'violationCount';

interface PageTableProps {
  pages: PageScore[];
  selectedUrl: string | null;
  onSelect: (url: string) => void;
}

export function PageTable({ pages, selectedUrl, onSelect }: PageTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('score');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const sorted = useMemo(() => {
    const copy = [...pages];
    copy.sort((a, b) => {
      const diff = sortKey === 'title' ? a.title.localeCompare(b.title) : a[sortKey] - b[sortKey];
      return sortDir === 'asc' ? diff : -diff;
    });
    return copy;
  }, [pages, sortKey, sortDir]);

  function toggleSort(key: SortKey): void {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  function sortIndicator(key: SortKey): string {
    if (key !== sortKey) return '';
    return sortDir === 'asc' ? ' ▲' : ' ▼';
  }

  if (pages.length === 0) {
    return <p className="empty-state">No pages were audited.</p>;
  }

  return (
    <table className="page-table">
      <thead>
        <tr>
          <th role="button" tabIndex={0} onClick={() => toggleSort('title')}>
            Page{sortIndicator('title')}
          </th>
          <th role="button" tabIndex={0} onClick={() => toggleSort('score')}>
            Score{sortIndicator('score')}
          </th>
          <th role="button" tabIndex={0} onClick={() => toggleSort('violationCount')}>
            Violations{sortIndicator('violationCount')}
          </th>
        </tr>
      </thead>
      <tbody>
        {sorted.map((page) => (
          <tr
            key={page.url}
            className={page.url === selectedUrl ? 'page-row selected' : 'page-row'}
            onClick={() => onSelect(page.url)}
          >
            <td>
              <div className="page-title">{page.title}</div>
              <div className="page-url">{page.url}</div>
            </td>
            <td>{page.score}%</td>
            <td>{page.violationCount}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
