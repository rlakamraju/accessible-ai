import { useMemo, useState } from 'react';
import type { Impact, Principle, ProcessedAuditResult, ViolationNode } from '../../shared/types';

interface ViolationListProps {
  result: ProcessedAuditResult;
  onSelectViolation: (cssSelector: string) => void;
}

const SEVERITY_ORDER: (Impact | 'unknown')[] = ['critical', 'serious', 'moderate', 'minor', 'unknown'];

const PRINCIPLE_LABEL: Record<Principle, string> = {
  perceivable: 'Perceivable',
  operable: 'Operable',
  understandable: 'Understandable',
  robust: 'Robust',
};

export function ViolationList({ result, onSelectViolation }: ViolationListProps) {
  const [severityFilter, setSeverityFilter] = useState<Impact | 'all'>('all');
  const [principleFilter, setPrincipleFilter] = useState<Principle | 'all'>('all');
  const [criterionFilter, setCriterionFilter] = useState<string>('all');

  const criterionById = useMemo(
    () => new Map(result.byCriterion.map((c) => [c.criterionId, c])),
    [result],
  );

  const criteriaWithViolations = useMemo(() => {
    const ids = new Set(result.violations.flatMap((v) => v.criterionIds));
    return result.byCriterion.filter((c) => ids.has(c.criterionId));
  }, [result]);

  const filtered = useMemo(() => {
    return result.violations.filter((v) => {
      if (severityFilter !== 'all' && v.impact !== severityFilter) return false;
      if (criterionFilter !== 'all' && !v.criterionIds.includes(criterionFilter)) return false;
      if (principleFilter !== 'all') {
        const matches = v.criterionIds.some((id) => criterionById.get(id)?.principle === principleFilter);
        if (!matches) return false;
      }
      return true;
    });
  }, [result, severityFilter, principleFilter, criterionFilter, criterionById]);

  const grouped = useMemo(() => {
    const groups = new Map<Impact | 'unknown', ViolationNode[]>();
    for (const violation of filtered) {
      const key = violation.impact ?? 'unknown';
      const bucket = groups.get(key) ?? [];
      bucket.push(violation);
      groups.set(key, bucket);
    }
    return groups;
  }, [filtered]);

  function handleActivate(violation: ViolationNode): void {
    const selector = violation.targets[0]?.cssSelector;
    if (selector) onSelectViolation(selector);
  }

  return (
    <div className="violation-list">
      <div className="violation-filters">
        <select
          aria-label="Filter by severity"
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value as Impact | 'all')}
        >
          <option value="all">All severities</option>
          {(['critical', 'serious', 'moderate', 'minor'] as Impact[]).map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter by WCAG principle"
          value={principleFilter}
          onChange={(e) => setPrincipleFilter(e.target.value as Principle | 'all')}
        >
          <option value="all">All principles</option>
          {(Object.keys(PRINCIPLE_LABEL) as Principle[]).map((p) => (
            <option key={p} value={p}>
              {PRINCIPLE_LABEL[p]}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter by WCAG criterion"
          value={criterionFilter}
          onChange={(e) => setCriterionFilter(e.target.value)}
        >
          <option value="all">All criteria</option>
          {criteriaWithViolations.map((c) => (
            <option key={c.criterionId} value={c.criterionId}>
              {c.criterionId} {c.criterionName}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 && <p className="empty-state">No violations match the current filters.</p>}

      {SEVERITY_ORDER.map((severity) => {
        const items = grouped.get(severity);
        if (!items || items.length === 0) return null;
        return (
          <div className="violation-group" key={severity}>
            <h3 className={`severity-heading severity-${severity}`}>
              {severity} ({items.length})
            </h3>
            <ul>
              {items.map((violation) => (
                <li
                  key={violation.id}
                  className="violation-item"
                  role="button"
                  tabIndex={0}
                  onClick={() => handleActivate(violation)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') handleActivate(violation);
                  }}
                >
                  <div className="violation-header">
                    <span className={`impact-badge impact-${violation.impact ?? 'unknown'}`}>
                      {violation.impact ?? 'n/a'}
                    </span>
                    {violation.criterionIds.map((id) => (
                      <span className="criterion-badge" key={id}>
                        {id}
                      </span>
                    ))}
                  </div>
                  <p className="violation-description">{violation.description}</p>
                  <span className="violation-count">
                    {violation.targets.length} element{violation.targets.length === 1 ? '' : 's'}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
