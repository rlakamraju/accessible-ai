import { getAuditHistory, getAuditRecord } from '../../core/storage';
import type { ProcessedAuditResult } from '../../shared/types';
import type { ViolationSelectorGroup } from './inspected-scripts';

/** Most recent page-level (not site-wide) audit recorded for this exact URL, if any. */
export async function findLatestPageAudit(url: string): Promise<ProcessedAuditResult | null> {
  const history = await getAuditHistory();
  const entry = history.find((e) => e.kind === 'page' && e.url === url);
  if (!entry) return null;

  const record = await getAuditRecord(entry.id);
  return record && 'violations' in record ? (record as ProcessedAuditResult) : null;
}

export function toViolationSelectorGroups(result: ProcessedAuditResult): ViolationSelectorGroup[] {
  return result.violations.map((violation, index) => ({
    index,
    selectors: violation.targets.map((t) => t.cssSelector),
  }));
}
