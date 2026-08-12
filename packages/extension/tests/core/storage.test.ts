import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearAuditHistory,
  deleteAuditRecord,
  getAuditHistory,
  getAuditRecord,
  saveAuditRecord,
} from '../../src/core/storage';
import type { ProcessedAuditResult } from '../../src/shared/types';

function makeResult(url: string): ProcessedAuditResult {
  return {
    standardId: 'wcag-2.1-aa',
    timestamp: new Date().toISOString(),
    url,
    byCriterion: [],
    totals: { violations: 0, passes: 0, incomplete: 0, inapplicable: 0 },
    violations: [],
  };
}

beforeEach(async () => {
  await clearAuditHistory();
});

describe('storage', () => {
  it('saves a record and makes it retrievable from history', async () => {
    const entry = await saveAuditRecord('page', 'wcag-2.1-aa', 'https://example.com', 87, makeResult('https://example.com'));

    const history = await getAuditHistory();
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({ id: entry.id, url: 'https://example.com', score: 87 });

    const record = await getAuditRecord(entry.id);
    expect(record?.url).toBe('https://example.com');
  });

  it('orders history with the newest entry first', async () => {
    await saveAuditRecord('page', 'wcag-2.1-aa', 'https://example.com/a', 50, makeResult('a'));
    const second = await saveAuditRecord('page', 'wcag-2.1-aa', 'https://example.com/b', 90, makeResult('b'));

    const history = await getAuditHistory();
    expect(history[0].id).toBe(second.id);
  });

  it('prunes the oldest entry once more than 20 records are saved', async () => {
    let oldestId = '';
    for (let i = 0; i < 21; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      const entry = await saveAuditRecord('page', 'wcag-2.1-aa', `https://example.com/${i}`, 50, makeResult(`${i}`));
      if (i === 0) oldestId = entry.id;
    }

    const history = await getAuditHistory();
    expect(history).toHaveLength(20);
    expect(history.some((e) => e.id === oldestId)).toBe(false);
    expect(await getAuditRecord(oldestId)).toBeUndefined();
  });

  it('deletes an individual record', async () => {
    const entry = await saveAuditRecord('page', 'wcag-2.1-aa', 'https://example.com', 87, makeResult('x'));
    await deleteAuditRecord(entry.id);

    expect(await getAuditHistory()).toHaveLength(0);
    expect(await getAuditRecord(entry.id)).toBeUndefined();
  });

  it('clears all history', async () => {
    await saveAuditRecord('page', 'wcag-2.1-aa', 'https://example.com/a', 50, makeResult('a'));
    await saveAuditRecord('page', 'wcag-2.1-aa', 'https://example.com/b', 60, makeResult('b'));

    await clearAuditHistory();

    expect(await getAuditHistory()).toHaveLength(0);
  });
});
