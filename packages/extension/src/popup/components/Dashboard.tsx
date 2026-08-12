import type { CSSProperties } from 'react';
import type { ComplianceScore, Principle, ProcessedAuditResult } from '../../shared/types';

interface DashboardProps {
  result: ProcessedAuditResult;
  score: ComplianceScore;
}

const PRINCIPLE_LABEL: Record<Principle, string> = {
  perceivable: 'Perceivable',
  operable: 'Operable',
  understandable: 'Understandable',
  robust: 'Robust',
};

const PRINCIPLE_ORDER: Principle[] = ['perceivable', 'operable', 'understandable', 'robust'];

function scoreColor(score: number): string {
  if (score < 50) return '#dc2626';
  if (score < 80) return '#d97706';
  return '#16a34a';
}

export function Dashboard({ result, score }: DashboardProps) {
  const gaugeStyle = {
    '--gauge-color': scoreColor(score.overallScore),
    '--gauge-value': score.overallScore,
  } as CSSProperties;

  return (
    <div className="dashboard">
      <div className="score-gauge" style={gaugeStyle}>
        <div className="score-gauge-inner">
          <span className="score-value">{score.overallScore}</span>
          <span className="score-label">Compliance score</span>
        </div>
      </div>

      <div className="summary-cards">
        <div className="summary-card summary-violations">
          <span className="count">{result.totals.violations}</span>
          <span className="label">violations</span>
        </div>
        <div className="summary-card summary-passes">
          <span className="count">{result.totals.passes}</span>
          <span className="label">passes</span>
        </div>
        <div className="summary-card summary-review">
          <span className="count">{result.totals.incomplete}</span>
          <span className="label">need review</span>
        </div>
      </div>

      <div className="principle-breakdown">
        {PRINCIPLE_ORDER.map((principle) => (
          <div className="principle-bar" key={principle}>
            <span className="principle-name">{PRINCIPLE_LABEL[principle]}</span>
            <div className="bar-track">
              <div className="bar-fill" style={{ width: `${score.byPrinciple[principle]}%` }} />
            </div>
            <span className="principle-score">{score.byPrinciple[principle]}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
