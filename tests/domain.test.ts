import { describe, expect, it } from 'vitest';
import { createPositions } from '../src/data';
import {
  countOperationalViews,
  emptyFilters,
  formatMoney,
  matchesQuery,
  queryPositions,
  sortPositions,
  toCsv,
  type QueryState,
} from '../src/domain';

function baseQuery(): QueryState {
  return {
    query: '',
    view: 'all',
    filters: emptyFilters(),
    sortKey: 'id',
    sortDirection: 'asc',
    page: 1,
    pageSize: 25,
  };
}

describe('synthetic position fixtures', () => {
  it('creates the complete deterministic population and Figma operational counts', () => {
    const rows = createPositions();
    const counts = countOperationalViews(rows);

    expect(rows).toHaveLength(413);
    expect(new Set(rows.map((row) => row.id)).size).toBe(413);
    expect(counts).toMatchObject({
      all: 413,
      new: 1,
      ready: 15,
      'in-progress': 3,
      review: 51,
      blocked: 2,
    });
  });

  it('keeps all fixtures synthetic and structurally complete', () => {
    const rows = createPositions();

    for (const row of rows) {
      expect(row.id).toMatch(/^POS-\d{6}$/);
      expect(row.accountId).toMatch(/^\d{3}-\d{6}$/);
      expect(row.nav).toBeGreaterThan(0);
      expect(row.currency).toBe('USD');
      expect(row.valuationDate.length).toBeGreaterThan(6);
    }
  });
});

describe('authoritative query model', () => {
  const rows = createPositions();

  it('matches punctuation-tolerant identifiers and known entities', () => {
    const first = rows[0]!;

    expect(matchesQuery(first, first.accountId.replace('-', ' '))).toBe(true);
    expect(matchesQuery(first, 'dremstedt kkr')).toBe(true);
    expect(matchesQuery(first, 'unrelated record')).toBe(false);
  });

  it('combines operational view, search and advanced filters', () => {
    const candidate = rows.find(
      (row) => row.status === 'review' && row.accountType === 'Individual',
    )!;
    const query = baseQuery();
    query.view = 'review';
    query.filters.accounts = ['Individual'];
    query.query = candidate.manager;

    const result = queryPositions(rows, query);

    expect(result.total).toBeGreaterThan(0);
    expect(result.allFiltered.every((row) => row.status === 'review')).toBe(true);
    expect(result.allFiltered.every((row) => row.accountType === 'Individual')).toBe(true);
    expect(result.allFiltered.every((row) => row.manager === candidate.manager)).toBe(true);
  });

  it('sorts stably and paginates the full filtered population', () => {
    const query = baseQuery();
    query.sortKey = 'nav';
    query.sortDirection = 'desc';
    query.page = 2;
    query.pageSize = 10;

    const result = queryPositions(rows, query);
    const sorted = sortPositions(rows, 'nav', 'desc');

    expect(result.pageRows).toEqual(sorted.slice(10, 20));
    expect(result.pageCount).toBe(42);
    expect(result.page).toBe(2);
  });

  it('clamps invalid page numbers after a query narrows the result', () => {
    const query = baseQuery();
    query.view = 'blocked';
    query.page = 42;

    const result = queryPositions(rows, query);

    expect(result.total).toBe(2);
    expect(result.page).toBe(1);
    expect(result.pageRows).toHaveLength(2);
  });
});

describe('controlled export', () => {
  it('includes metadata and exact numeric values', () => {
    const rows = createPositions(2);
    const csv = toCsv(rows, baseQuery());

    expect(csv).toContain('# Prototype: Tangible positions grid — synthetic data');
    expect(csv).toContain('Position NAV (USD)');
    expect(csv).toContain(String(rows[0]!.nav));
    expect(formatMoney(rows[0]!.nav, true)).toMatch(/^USD /);
  });
});
