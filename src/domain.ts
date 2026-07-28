export type PositionStatus = 'ready' | 'in-progress' | 'review' | 'blocked' | 'monitoring';
export type OperationalView = 'all' | 'new' | PositionStatus;
export type AccountType = 'Individual' | 'Joint' | 'Entity' | 'Trust';
export type Density = 'compact' | 'standard' | 'comfortable';
export type LayoutMode = 'auto' | 'desktop' | 'mobile';
export type SortDirection = 'asc' | 'desc';
export type SortKey =
  | 'id'
  | 'positionName'
  | 'client'
  | 'accountType'
  | 'nav'
  | 'indicativeMin'
  | 'status'
  | 'stage'
  | 'updatedMinutes';

export interface Position {
  id: string;
  positionName: string;
  manager: string;
  initials: string;
  brandTone: 'wine' | 'blue' | 'green' | 'slate';
  client: string;
  clientId: string;
  accountType: AccountType;
  accountId: string;
  nav: number;
  currency: 'USD';
  valuationDate: string;
  navSource: string;
  indicativeMin: number | null;
  indicativeMax: number | null;
  status: PositionStatus;
  reason: string | null;
  stage: string | null;
  stageProgress: number | null;
  updatedMinutes: number;
  owner: string;
  isNew: boolean;
  followUp: boolean;
  documentProgress: string;
}

export interface TableFilters {
  statuses: PositionStatus[];
  accounts: AccountType[];
  managers: string[];
}

export interface QueryState {
  query: string;
  view: OperationalView;
  filters: TableFilters;
  sortKey: SortKey;
  sortDirection: SortDirection;
  page: number;
  pageSize: number;
}

export interface QueryResult {
  allFiltered: Position[];
  pageRows: Position[];
  total: number;
  pageCount: number;
  page: number;
}

export const statusLabels: Record<PositionStatus, string> = {
  ready: 'Ready to sell',
  'in-progress': 'In progress',
  review: 'Review needed',
  blocked: 'Blocked',
  monitoring: 'Monitoring',
};

export const actionLabels: Record<PositionStatus, string> = {
  ready: 'Sell',
  'in-progress': 'Continue sale',
  review: 'Review consent',
  blocked: 'Review blocker',
  monitoring: 'View details',
};

export const statusOrder: Record<PositionStatus, number> = {
  review: 0,
  blocked: 1,
  'in-progress': 2,
  ready: 3,
  monitoring: 4,
};

export function emptyFilters(): TableFilters {
  return { statuses: [], accounts: [], managers: [] };
}

export function normalizeQuery(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase('en')
    .replaceAll(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function matchesQuery(position: Position, query: string): boolean {
  const normalized = normalizeQuery(query);
  if (!normalized) return true;

  const searchable = normalizeQuery(
    [
      position.positionName,
      position.manager,
      position.client,
      position.clientId,
      position.accountType,
      position.accountId,
    ].join(' '),
  );

  return normalized.split(' ').every((term) => searchable.includes(term));
}

export function matchesView(position: Position, view: OperationalView): boolean {
  if (view === 'all') return true;
  if (view === 'new') return position.isNew;
  return position.status === view;
}

export function matchesFilters(position: Position, filters: TableFilters): boolean {
  return (
    (filters.statuses.length === 0 || filters.statuses.includes(position.status)) &&
    (filters.accounts.length === 0 || filters.accounts.includes(position.accountType)) &&
    (filters.managers.length === 0 || filters.managers.includes(position.manager))
  );
}

function comparableValue(position: Position, key: SortKey): string | number {
  if (key === 'status') return statusOrder[position.status];
  const value = position[key];
  return value ?? Number.NEGATIVE_INFINITY;
}

export function sortPositions(
  positions: readonly Position[],
  key: SortKey,
  direction: SortDirection,
): Position[] {
  const multiplier = direction === 'asc' ? 1 : -1;
  return [...positions].sort((left, right) => {
    const a = comparableValue(left, key);
    const b = comparableValue(right, key);
    const comparison =
      typeof a === 'string' && typeof b === 'string'
        ? a.localeCompare(b, 'en', { numeric: true, sensitivity: 'base' })
        : Number(a) - Number(b);
    return comparison === 0 ? left.id.localeCompare(right.id) : comparison * multiplier;
  });
}

export function queryPositions(positions: readonly Position[], state: QueryState): QueryResult {
  const filtered = positions.filter(
    (position) =>
      matchesView(position, state.view) &&
      matchesQuery(position, state.query) &&
      matchesFilters(position, state.filters),
  );
  const sorted = sortPositions(filtered, state.sortKey, state.sortDirection);
  const pageCount = Math.max(1, Math.ceil(sorted.length / state.pageSize));
  const page = Math.min(Math.max(1, state.page), pageCount);
  const start = (page - 1) * state.pageSize;

  return {
    allFiltered: sorted,
    pageRows: sorted.slice(start, start + state.pageSize),
    total: sorted.length,
    pageCount,
    page,
  };
}

export function countOperationalViews(
  positions: readonly Position[],
): Record<OperationalView, number> {
  return {
    all: positions.length,
    new: positions.filter((position) => position.isNew).length,
    ready: positions.filter((position) => position.status === 'ready').length,
    'in-progress': positions.filter((position) => position.status === 'in-progress').length,
    review: positions.filter((position) => position.status === 'review').length,
    blocked: positions.filter((position) => position.status === 'blocked').length,
    monitoring: positions.filter((position) => position.status === 'monitoring').length,
  };
}

export function activeFilterCount(filters: TableFilters): number {
  return filters.statuses.length + filters.accounts.length + filters.managers.length;
}

export function formatMoney(value: number, includeCode = false): string {
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
  return includeCode ? `USD ${formatted.replace('$', '')}` : formatted;
}

export function formatUpdated(minutes: number): string {
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours} hour${hours === 1 ? '' : 's'} ago`;
}

export function formatRange(position: Position): string {
  if (position.indicativeMin === null || position.indicativeMax === null) return 'Not available';
  return `${position.indicativeMin}–${position.indicativeMax}%`;
}

export function toCsv(rows: readonly Position[], queryState: QueryState): string {
  const metadata = [
    ['Prototype', 'Tangible positions grid — synthetic data'],
    ['Generated', new Date().toISOString()],
    ['Query', queryState.query || 'None'],
    ['Operational view', queryState.view],
    ['Sort', `${queryState.sortKey} ${queryState.sortDirection}`],
    ['Rows', String(rows.length)],
  ];
  const headers = [
    'Position ID',
    'Position',
    'Manager',
    'Client',
    'Client ID',
    'Account type',
    'Account ID',
    'Position NAV (USD)',
    'Valuation date',
    'Indicative minimum (% NAV)',
    'Indicative maximum (% NAV)',
    'Status',
    'Reason',
    'Last update (minutes)',
  ];
  const escape = (value: string | number | null): string =>
    `"${String(value ?? '').replaceAll('"', '""')}"`;
  const lines = [
    ...metadata.map(([label, value]) => `# ${label}: ${value}`),
    headers.map(escape).join(','),
    ...rows.map((position) =>
      [
        position.id,
        position.positionName,
        position.manager,
        position.client,
        position.clientId,
        position.accountType,
        position.accountId,
        position.nav,
        position.valuationDate,
        position.indicativeMin,
        position.indicativeMax,
        statusLabels[position.status],
        position.reason,
        position.updatedMinutes,
      ]
        .map(escape)
        .join(','),
    ),
  ];
  return lines.join('\n');
}
