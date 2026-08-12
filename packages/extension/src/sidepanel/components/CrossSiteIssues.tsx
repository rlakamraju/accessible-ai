import type { CriterionAggregate } from '../../shared/types';

interface CrossSiteIssuesProps {
  criteria: CriterionAggregate[];
}

export function CrossSiteIssues({ criteria }: CrossSiteIssuesProps) {
  if (criteria.length === 0) {
    return <p className="empty-state">No criteria failed across the crawled pages.</p>;
  }

  return (
    <ul className="cross-site-issues">
      {criteria.map((criterion) => (
        <li key={criterion.criterionId} className="cross-site-issue">
          <div className="cross-site-issue-header">
            <span className="criterion-badge">{criterion.criterionId}</span>
            <span>{criterion.criterionName}</span>
          </div>
          <span className="cross-site-issue-meta">
            {criterion.pagesAffected.length} page(s) affected &middot; {criterion.totalInstances} instance(s)
          </span>
        </li>
      ))}
    </ul>
  );
}
