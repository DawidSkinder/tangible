import { positions } from './data';
import {
  actionLabels,
  activeFilterCount,
  countOperationalViews,
  emptyFilters,
  formatMoney,
  formatRange,
  formatUpdated,
  queryPositions,
  statusLabels,
  toCsv,
  type AccountType,
  type Density,
  type LayoutMode,
  type OperationalView,
  type Position,
  type PositionStatus,
  type QueryState,
  type SortDirection,
  type SortKey,
  type TableFilters,
} from './domain';
import { icon, type IconName } from './icons';
import { finishMotion, MOTION, motionEnabled, playMotion, type MotionKeyframes } from './motion';
import {
  applyDocumentUiTheme,
  isUiTheme,
  readStoredUiTheme,
  storeUiTheme,
  uiThemeLabel,
  uiThemes,
  type UiTheme,
} from './theme';

type Panel = 'design-system' | 'filters' | 'settings' | 'print' | 'sort' | null;
type Overlay = 'details' | 'ai' | 'handoff' | 'diagnostics' | null;
type RenderMotion =
  'none' | 'initial' | 'layout' | 'theme' | 'data' | 'data-soft' | 'filter' | 'chat';
type ViewportMode = 'desktop' | 'tablet' | 'mobile';

interface ChatMessage {
  role: 'assistant' | 'user';
  text: string;
}

interface AppState {
  uiTheme: UiTheme;
  layout: LayoutMode;
  panel: Panel;
  overlay: Overlay;
  selectedId: string | null;
  rowMenuId: string | null;
  mobileSearchOpen: boolean;
  query: QueryState;
  draftFilters: TableFilters;
  density: Density;
  visibleColumns: Set<string>;
  followUps: Set<string>;
  aiMessages: ChatMessage[];
  toast: string | null;
}

interface DiagnosticsSnapshot {
  build: string;
  uiTheme: UiTheme;
  layout: LayoutMode;
  effectiveLayout: 'desktop' | 'mobile';
  viewport: ViewportMode;
  totalSyntheticRows: number;
  visibleRows: number;
  activeFilters: number;
  query: string;
  currentPage: number;
  userAgent: string;
  lastError: string | null;
}

declare global {
  interface Window {
    __TANGIBLE_DIAGNOSTICS__: DiagnosticsSnapshot;
  }
}

const viewOrder: OperationalView[] = ['all', 'new', 'ready', 'in-progress', 'review', 'blocked'];
const automaticMobileLayout = '(max-width: 720px)';
const automaticTabletLayout = '(min-width: 721px) and (max-width: 1220px)';

const viewLabels: Record<OperationalView, string> = {
  all: 'All',
  new: 'New',
  ready: 'Ready to sell',
  'in-progress': 'In progress',
  review: 'Review needed',
  blocked: 'Blocked',
  monitoring: 'Monitoring',
};

const sortableColumns: Array<[SortKey, string]> = [
  ['id', 'Position'],
  ['client', 'Client'],
  ['accountType', 'Account'],
  ['nav', 'Position NAV'],
  ['indicativeMin', 'Indicative range'],
  ['status', 'Status'],
  ['stage', 'Sale stage'],
  ['updatedMinutes', 'Last update'],
];

const optionalColumns = [
  ['account', 'Account'],
  ['nav', 'Position NAV'],
  ['range', 'Indicative range'],
  ['stage', 'Sale stage'],
  ['updated', 'Last update'],
] as const;

const managers = [...new Set(positions.map((position) => position.manager))].sort();
const accountTypes: AccountType[] = ['Individual', 'Joint', 'Entity', 'Trust'];
const filterStatuses: PositionStatus[] = [
  'ready',
  'in-progress',
  'review',
  'blocked',
  'monitoring',
];

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function cloneFilters(filters: TableFilters): TableFilters {
  return {
    statuses: [...filters.statuses],
    accounts: [...filters.accounts],
    managers: [...filters.managers],
  };
}

function button(
  label: string,
  iconName: IconName,
  action: string,
  options: { className?: string; pressed?: boolean; badge?: number; title?: string } = {},
): string {
  const className = options.className ?? 'icon-button';
  const pressed = options.pressed === undefined ? '' : ` aria-pressed="${String(options.pressed)}"`;
  const badge = options.badge ? `<span class="control-badge">${options.badge}</span>` : '';
  return `<button class="${className}" type="button" data-action="${action}" aria-label="${escapeHtml(label)}" title="${escapeHtml(options.title ?? label)}"${pressed}>${icon(iconName)}${badge}</button>`;
}

function copyLink(label: string, value: string, context: string): string {
  return `<button class="copy-link" type="button" data-action="copy" data-copy="${escapeHtml(value)}" aria-label="Copy ${escapeHtml(context)}"><span>${escapeHtml(label)}</span>${icon('copy', 12)}</button>`;
}

function externalRecordLink(
  label: string,
  position: Position,
  kind: 'account' | 'market-value',
): string {
  const context = kind === 'account' ? 'Joint account' : 'Market value';
  return `<a class="external-record-link ${kind}-link" href="#${kind}-${escapeHtml(position.id)}" data-action="open-external-record" data-id="${escapeHtml(position.id)}" data-external-label="${context}" aria-label="Open ${context.toLocaleLowerCase('en')} for ${escapeHtml(position.positionName)}"><span>${escapeHtml(label)}</span>${icon('external-link', 12)}</a>`;
}

function accountType(position: Position): string {
  return position.accountType === 'Joint'
    ? externalRecordLink(position.accountType, position, 'account')
    : escapeHtml(position.accountType);
}

function statusBadge(position: Position, showReason = true): string {
  const reason =
    showReason && position.reason
      ? `<span class="status-reason">${escapeHtml(position.reason)}</span>`
      : '';
  return `<div class="status-stack"><span class="status-badge status-${position.status}">${
    position.status === 'ready'
      ? icon('check', 12)
      : position.status === 'review'
        ? icon('warning', 12)
        : position.status === 'blocked'
          ? icon('close', 12)
          : position.status === 'in-progress'
            ? '<span class="spinner" aria-hidden="true"></span>'
            : icon('clock', 12)
  }<span>${escapeHtml(statusLabels[position.status].toLocaleUpperCase('en'))}</span></span>${reason}</div>`;
}

function avatar(position: Position): string {
  const asset =
    position.manager === 'KKR'
      ? './assets/avatar-kkr.png'
      : position.manager === 'PIMCO'
        ? './assets/avatar-pimco.png'
        : null;
  if (asset)
    return `<img class="fund-avatar fund-avatar-image" src="${asset}" alt="" aria-hidden="true" width="40" height="40" />`;
  return `<span class="fund-avatar tone-${position.brandTone}" aria-hidden="true">${escapeHtml(position.initials)}</span>`;
}

function newRibbon(): string {
  return '<span class="new-ribbon-clip"><span class="new-ribbon"><span class="new-ribbon-label">NEW</span></span></span>';
}

function pageNumbers(page: number, pageCount: number): number[] {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, index) => index + 1);
  const values = new Set([1, 2, page - 1, page, page + 1, pageCount]);
  return [...values].filter((value) => value >= 1 && value <= pageCount).sort((a, b) => a - b);
}

export class TangibleApp {
  private readonly root: HTMLElement;
  private state: AppState;
  private returnFocus: HTMLElement | null = null;
  private toastTimer: number | null = null;
  private lastError: string | null = null;
  private transientMotionToken = 0;
  private overlayMotionToken = 0;
  private dataMotionToken = 0;

  constructor(root: HTMLElement) {
    this.root = root;
    this.state = {
      uiTheme: readStoredUiTheme(),
      layout: 'auto',
      panel: null,
      overlay: null,
      selectedId: null,
      rowMenuId: null,
      mobileSearchOpen: false,
      query: {
        query: '',
        view: 'all',
        filters: emptyFilters(),
        sortKey: 'id',
        sortDirection: 'asc',
        page: 1,
        pageSize: 25,
      },
      draftFilters: emptyFilters(),
      density: 'standard',
      visibleColumns: new Set(optionalColumns.map(([key]) => key)),
      followUps: new Set(),
      aiMessages: [],
      toast: null,
    };
    applyDocumentUiTheme(this.state.uiTheme);
  }

  mount(): void {
    this.root.addEventListener('click', this.onClick);
    this.root.addEventListener('input', this.onInput);
    this.root.addEventListener('change', this.onChange);
    document.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('resize', this.onResize);
    window.addEventListener('error', (event) => {
      this.lastError = event.message;
      this.updateDiagnostics();
    });
    this.render(undefined, 'initial');
  }

  private effectiveLayout(): 'desktop' | 'mobile' {
    if (this.state.layout !== 'auto') return this.state.layout;
    return this.viewportMode() === 'mobile' ? 'mobile' : 'desktop';
  }

  private viewportMode(): ViewportMode {
    if (window.matchMedia(automaticMobileLayout).matches) return 'mobile';
    if (window.matchMedia(automaticTabletLayout).matches) return 'tablet';
    return 'desktop';
  }

  private selectedPosition(): Position | null {
    return positions.find((position) => position.id === this.state.selectedId) ?? null;
  }

  private render(
    restoreSelector?: string,
    motion: RenderMotion = 'none',
    suppressTransientEntry = false,
  ): void {
    const result = queryPositions(positions, this.state.query);
    if (result.page !== this.state.query.page) this.state.query.page = result.page;
    const layout = this.effectiveLayout();
    const viewport = this.viewportMode();
    this.root.className = 'app-root';
    this.root.dataset.layout = layout;
    this.root.dataset.layoutMode = this.state.layout;
    this.root.dataset.viewport = viewport;
    this.root.dataset.density = this.state.density;
    this.root.dataset.uiTheme = this.state.uiTheme;
    this.root.dataset.motionPolicy = 'always';
    this.root.toggleAttribute('data-suppress-transient-motion', suppressTransientEntry);
    document.body.dataset.layout = layout;
    document.body.dataset.forcedLayout = this.state.layout;
    this.root.innerHTML = `
      <a class="skip-link" href="#positions-content">Skip to positions</a>
      <div class="review-stage">
        <main class="app-shell" id="positions-content">
          ${this.renderHeader(layout)}
          ${this.renderWelcome(layout)}
          ${this.renderWorkspace(layout, viewport)}
          ${layout === 'desktop' ? this.renderDesktopTable(result.pageRows, viewport === 'tablet') : this.renderMobileCards(result.pageRows)}
          ${this.renderPagination(result.total, result.page, result.pageCount, layout)}
        </main>
      </div>
      ${this.renderOverlay()}
      ${this.state.toast ? `<div class="toast" role="status">${escapeHtml(this.state.toast)}</div>` : ''}
      <div class="sr-only" aria-live="polite" id="live-region"></div>
    `;
    this.bindTabletTableScroll();
    this.updateDiagnostics(result.total);
    if (restoreSelector) {
      const target = this.root.querySelector<HTMLElement>(restoreSelector);
      target?.focus();
      if (target instanceof HTMLInputElement)
        target.setSelectionRange(target.value.length, target.value.length);
    }
    this.runRenderMotion(motion);
  }

  private runRenderMotion(motion: RenderMotion): void {
    if (motion === 'none' || !motionEnabled()) return;

    if (motion === 'initial') {
      const sections = [
        '.topbar',
        '.welcome',
        '.workspace-head',
        '.table-region, .mobile-card-region',
        '.pagination',
      ];
      sections.forEach((selector, index) => {
        const element = this.root.querySelector<HTMLElement>(selector);
        if (!element) return;
        playMotion(
          element,
          [
            { opacity: 0, transform: 'translateY(8px)' },
            { opacity: 1, transform: 'translateY(0)' },
          ],
          {
            duration: MOTION.duration.overlay,
            delay: index * 45,
            easing: MOTION.easing.emphasized,
            fill: 'none',
          },
        );
      });
      return;
    }

    if (motion === 'layout' || motion === 'theme') {
      const shell = this.root.querySelector<HTMLElement>('.app-shell');
      if (shell)
        playMotion(
          shell,
          motion === 'theme'
            ? [{ opacity: 0.35 }, { opacity: 1 }]
            : [
                { opacity: 0.4, transform: 'translateY(8px)' },
                { opacity: 1, transform: 'translateY(0)' },
              ],
          {
            duration: MOTION.duration.overlay,
            easing: MOTION.easing.emphasized,
            fill: 'none',
          },
        );
      return;
    }

    if (motion === 'data-soft') {
      const surface = this.root.querySelector<HTMLElement>('.table-region, .mobile-card-region');
      if (surface)
        playMotion(surface, [{ opacity: 0.65 }, { opacity: 1 }], {
          duration: MOTION.duration.fast,
          easing: MOTION.easing.standard,
          fill: 'none',
        });
      return;
    }

    if (motion === 'chat') {
      const messages = [...this.root.querySelectorAll<HTMLElement>('.chat-message')].slice(-2);
      messages.forEach((message, index) =>
        playMotion(
          message,
          [
            { opacity: 0, transform: 'translateY(6px)' },
            { opacity: 1, transform: 'translateY(0)' },
          ],
          {
            duration: MOTION.duration.base,
            delay: index * 45,
            easing: MOTION.easing.emphasized,
            fill: 'none',
          },
        ),
      );
      return;
    }

    const rows = [...this.root.querySelectorAll<HTMLElement>('tbody tr, .position-card')].slice(
      0,
      12,
    );
    const isFilterTransition = motion === 'filter';
    rows.forEach((row, index) =>
      playMotion(
        row,
        [
          {
            opacity: isFilterTransition ? 0 : 0.25,
            transform: `translateY(${isFilterTransition ? 8 : 5}px)`,
          },
          { opacity: 1, transform: 'translateY(0)' },
        ],
        {
          duration: isFilterTransition ? MOTION.duration.overlay : MOTION.duration.base,
          delay: Math.min(index, 7) * (isFilterTransition ? 22 : 16),
          easing: MOTION.easing.emphasized,
          fill: 'none',
        },
      ),
    );
  }

  private renderHeader(layout: 'desktop' | 'mobile'): string {
    const switchLabel = layout === 'desktop' ? 'Show mobile layout' : 'Show desktop layout';
    const switchIcon = layout === 'desktop' ? 'mobile' : 'desktop';
    const designSystemOpen = this.state.panel === 'design-system';
    const activeThemeLabel = uiThemeLabel(this.state.uiTheme);
    return `
      <header class="topbar">
        <picture class="brand-mark">
          <source media="(max-width: 720px)" srcset="./assets/tangible-monogram.svg" />
          <img src="${layout === 'mobile' ? './assets/tangible-monogram.svg' : './assets/tangible-wordmark2.svg'}" alt="Tangible" />
        </picture>
        <div class="topbar-actions">
          ${button(switchLabel, switchIcon, 'toggle-layout', { className: 'icon-button breakpoint-button', pressed: layout === 'mobile' })}
          <div class="panel-anchor design-system-anchor">
            <div class="design-system-control ${designSystemOpen ? 'is-open' : ''}">
              <button class="design-system-button" type="button" data-action="toggle-design-system" aria-expanded="${String(designSystemOpen)}" aria-controls="design-system-menu" aria-haspopup="menu">
                <span class="design-system-main">${icon('tools', 16.884)}<span>${escapeHtml(activeThemeLabel)}</span></span>${icon('dropdown-arrow', 9.333)}
              </button>
              ${designSystemOpen ? this.renderDesignSystemMenu() : ''}
            </div>
          </div>
        </div>
      </header>`;
  }

  private renderDesignSystemMenu(): string {
    const alternatives = uiThemes.filter((theme) => theme.id !== this.state.uiTheme);
    return `<div class="design-system-menu" id="design-system-menu" role="menu" aria-label="Visual theme">
      ${alternatives
        .map(
          (theme) =>
            `<span class="design-system-divider" aria-hidden="true"></span><button type="button" role="menuitem" data-action="set-ui-theme" data-theme="${theme.id}">${icon('tools', 16.884)}<span>${escapeHtml(theme.label)}</span></button>`,
        )
        .join('')}
    </div>`;
  }

  private renderWelcome(layout: 'desktop' | 'mobile'): string {
    return `<section class="welcome" aria-label="Welcome">
      <h1><span>Welcome back</span><em>Arseniy${layout === 'desktop' ? ' Korobchenko' : ''},<img class="welcome-pointer" src="./assets/tangible-welcome-arrow.svg" alt="" aria-hidden="true" /></em></h1>
    </section>`;
  }

  private renderWorkspace(layout: 'desktop' | 'mobile', viewport: ViewportMode): string {
    const counts = countOperationalViews(positions);
    const filters = activeFilterCount(this.state.query.filters);
    return `<section class="workspace-head" aria-labelledby="workspace-title">
      <div class="workspace-title-row">
        <h2 id="workspace-title">Your client’s:</h2>
        <p class="freshness">${icon('clock', 18)}<span>Last update: 2 hours ago</span></p>
      </div>
      <nav class="tabs" aria-label="Client asset type">
        <button type="button" class="tab active" aria-current="page">Positions <small>(413)</small></button>
        <button type="button" class="tab" data-action="listings-notice">Listings <small>(43)</small></button>
      </nav>
      <div class="view-toolbar">
        <div class="operational-views" role="group" aria-label="Operational view">
          ${viewOrder
            .map(
              (view) =>
                `<button type="button" class="view-filter ${this.state.query.view === view ? 'active' : ''}" data-action="set-view" data-view="${view}" aria-pressed="${String(this.state.query.view === view)}"><span class="radio-dot"></span>${viewLabels[view]} (${counts[view]})</button>`,
            )
            .join('')}
        </div>
        ${this.renderToolbar(layout === 'mobile' || viewport === 'tablet' ? 'mobile' : 'desktop', filters)}
      </div>
    </section>`;
  }

  private renderToolbar(layout: 'desktop' | 'mobile', filterCount: number): string {
    const filterPanel = this.state.panel === 'filters' ? this.renderFilterPanel() : '';
    const settingsPanel = this.state.panel === 'settings' ? this.renderSettingsPanel() : '';
    const printPanel = this.state.panel === 'print' ? this.renderPrintPanel() : '';
    const sortPanel = this.state.panel === 'sort' ? this.renderSortPanel() : '';
    if (layout === 'mobile') {
      return `<div class="mobile-tools">
        ${this.state.mobileSearchOpen ? `<label class="mobile-search-field"><span class="sr-only">Search positions</span>${icon('search')}<input id="mobile-search" type="search" value="${escapeHtml(this.state.query.query)}" placeholder="Search client, fund or account ID" /></label>` : button('Search positions', 'search', 'toggle-mobile-search', { className: 'icon-button outlined' })}
        <span class="toolbar-divider"></span>
        <div class="panel-anchor">${button('Sort positions', 'sort', 'toggle-sort', { pressed: this.state.panel === 'sort' })}${sortPanel}</div>
        <div class="panel-anchor">${button('Filter positions', 'filter', 'toggle-filters', { pressed: this.state.panel === 'filters', badge: filterCount })}${filterPanel}</div>
        <div class="panel-anchor">${button('Personalise table', 'settings', 'toggle-settings', { pressed: this.state.panel === 'settings' })}${settingsPanel}</div>
        <span class="toolbar-divider"></span>
        <div class="panel-anchor">${button('Print or export', 'print', 'toggle-print', { pressed: this.state.panel === 'print' })}${printPanel}</div>
      </div>`;
    }
    return `<div class="desktop-tools">
      <label class="search-field"><span class="sr-only">Search positions</span>${icon('search')}<input id="desktop-search" type="search" value="${escapeHtml(this.state.query.query)}" placeholder="Search position, client, fund or account ID" /></label>
      <span class="toolbar-divider"></span>
      <div class="panel-anchor">${button('Filter positions', 'filter', 'toggle-filters', { pressed: this.state.panel === 'filters', badge: filterCount })}${filterPanel}</div>
      <div class="panel-anchor">${button('Personalise table', 'settings', 'toggle-settings', { pressed: this.state.panel === 'settings' })}${settingsPanel}</div>
      <span class="toolbar-divider"></span>
      <div class="panel-anchor">${button('Print or export', 'print', 'toggle-print', { pressed: this.state.panel === 'print' })}${printPanel}</div>
    </div>`;
  }

  private renderFilterPanel(): string {
    return `<form class="popover control-panel filters-panel" data-panel-form="filters">
      <div class="panel-heading"><div><strong>Filters</strong><small>Narrow the current position set</small></div><button type="button" data-action="close-panel" aria-label="Close filters">${icon('close')}</button></div>
      <fieldset><legend>Status</legend>${filterStatuses.map((status) => `<label><input type="checkbox" data-filter-kind="status" value="${status}" ${this.state.draftFilters.statuses.includes(status) ? 'checked' : ''}/><span>${statusLabels[status]}</span></label>`).join('')}</fieldset>
      <fieldset><legend>Account type</legend><div class="filter-grid">${accountTypes.map((account) => `<label><input type="checkbox" data-filter-kind="account" value="${account}" ${this.state.draftFilters.accounts.includes(account) ? 'checked' : ''}/><span>${account}</span></label>`).join('')}</div></fieldset>
      <fieldset><legend>Manager</legend><select data-filter-kind="manager"><option value="">All managers</option>${managers.map((manager) => `<option value="${escapeHtml(manager)}" ${this.state.draftFilters.managers.includes(manager) ? 'selected' : ''}>${escapeHtml(manager)}</option>`).join('')}</select></fieldset>
      <div class="panel-actions"><button type="button" class="text-button" data-action="reset-draft-filters">Reset</button><button type="button" class="primary-button" data-action="apply-filters">Apply filters</button></div>
    </form>`;
  }

  private renderSettingsPanel(): string {
    return `<div class="popover control-panel settings-panel">
      <div class="panel-heading"><div><strong>Personalise</strong><small>Adjust your working view</small></div><button type="button" data-action="close-panel" aria-label="Close personalisation">${icon('close')}</button></div>
      <fieldset><legend>Columns</legend>${optionalColumns.map(([key, label]) => `<label><input type="checkbox" data-setting-column="${key}" ${this.state.visibleColumns.has(key) ? 'checked' : ''}/><span>${label}</span></label>`).join('')}<label class="locked-setting"><input type="checkbox" checked disabled/><span>Position, client, status & action</span><small>Required</small></label></fieldset>
      <fieldset><legend>Density</legend><div class="segmented">${(['compact', 'standard', 'comfortable'] as Density[]).map((density) => `<button type="button" data-action="set-density" data-density="${density}" aria-pressed="${String(this.state.density === density)}">${density[0]!.toUpperCase()}${density.slice(1)}</button>`).join('')}</div></fieldset>
      <div class="panel-actions"><button type="button" class="text-button" data-action="reset-settings">Reset to default</button><button type="button" class="primary-button" data-action="close-panel">Done</button></div>
    </div>`;
  }

  private renderPrintPanel(): string {
    return `<div class="popover export-menu" role="menu" aria-label="Print and export">
      <button type="button" role="menuitem" data-action="print-current">${icon('print')}<span><strong>Print / save as PDF</strong><small>Current filtered and sorted population</small></span></button>
      <button type="button" role="menuitem" data-action="export-csv">${icon('download')}<span><strong>Export CSV</strong><small>Includes synthetic-data metadata</small></span></button>
    </div>`;
  }

  private renderSortPanel(): string {
    return `<div class="popover control-panel sort-panel">
      <div class="panel-heading"><div><strong>Sort positions</strong><small>Applies to the full result set</small></div><button type="button" data-action="close-panel" aria-label="Close sorting">${icon('close')}</button></div>
      <label class="field-label">Field<select data-sort-select>${sortableColumns.map(([key, label]) => `<option value="${key}" ${this.state.query.sortKey === key ? 'selected' : ''}>${label}</option>`).join('')}</select></label>
      <div class="segmented"><button type="button" data-action="set-sort-direction" data-direction="asc" aria-pressed="${String(this.state.query.sortDirection === 'asc')}">Ascending</button><button type="button" data-action="set-sort-direction" data-direction="desc" aria-pressed="${String(this.state.query.sortDirection === 'desc')}">Descending</button></div>
    </div>`;
  }

  private renderDesktopTable(rows: Position[], tabletScrollable = false): string {
    const show = (key: string): boolean => this.state.visibleColumns.has(key);
    const columns = `
      <col class="column-position" />
      <col class="column-client" />
      ${show('account') ? '<col class="column-account" />' : ''}
      ${show('nav') ? '<col class="column-nav" />' : ''}
      ${show('range') ? '<col class="column-range" />' : ''}
      <col class="column-status" />
      ${show('stage') ? '<col class="column-stage" />' : ''}
      ${show('updated') ? '<col class="column-updated" />' : ''}
      <col class="column-action" />
    `;
    const headings = `
      ${this.sortHeader('id', 'Position', 'column-position')}
      ${this.sortHeader('client', 'Client', 'column-client')}
      ${show('account') ? this.sortHeader('accountType', 'Account', 'column-account') : ''}
      ${show('nav') ? this.sortHeader('nav', 'Position NAV', 'numeric column-nav') : ''}
      ${show('range') ? this.sortHeader('indicativeMin', 'Indicative range', 'numeric column-range') : ''}
      ${this.sortHeader('status', 'Status', 'column-status')}
      ${show('stage') ? this.sortHeader('stage', 'Sale stage', 'column-stage') : ''}
      ${show('updated') ? this.sortHeader('updatedMinutes', 'Last update', 'column-updated') : ''}
      <th class="column-action action-heading" scope="col">Action</th>
    `;
    const stickyTabletHeader = tabletScrollable
      ? `<div class="tablet-sticky-header" aria-hidden="true" inert>
          <div class="tablet-sticky-header-viewport">
            <table class="tablet-sticky-header-table"><colgroup>${columns}</colgroup><thead><tr>${headings}</tr></thead></table>
          </div>
        </div>`
      : '';
    return `<section class="table-region" aria-label="Positions results">
      ${stickyTabletHeader}
      <div class="table-flow"${tabletScrollable ? ' id="tablet-table-flow" tabindex="0" aria-label="Horizontally scrollable positions table"' : ''}>
        <table>
          <caption class="sr-only">Advisor positions. Use column headings to sort.</caption>
          <colgroup>${columns}</colgroup>
          <thead><tr>${headings}</tr></thead>
          <tbody>${rows.length ? rows.map((position) => this.renderDesktopRow(position)).join('') : this.renderEmptyRow()}</tbody>
        </table>
      </div>
      ${tabletScrollable ? '<div class="tablet-scrollbar" role="scrollbar" tabindex="0" aria-label="Scroll positions table horizontally" aria-controls="tablet-table-flow" aria-orientation="horizontal" aria-valuemin="0" aria-valuemax="0" aria-valuenow="0"><span class="tablet-scrollbar-thumb"></span></div>' : ''}
    </section>`;
  }

  private bindTabletTableScroll(): void {
    const flow = this.root.querySelector<HTMLElement>('.table-flow');
    const stickyTable = this.root.querySelector<HTMLElement>('.tablet-sticky-header-table');
    const scrollbar = this.root.querySelector<HTMLElement>('.tablet-scrollbar');
    const thumb = this.root.querySelector<HTMLElement>('.tablet-scrollbar-thumb');
    if (!flow || !stickyTable || !scrollbar || !thumb) return;
    const sync = (): void => {
      stickyTable.style.transform = `translate3d(${-flow.scrollLeft}px, 0, 0)`;
      const maxScroll = Math.max(0, flow.scrollWidth - flow.clientWidth);
      const thumbWidth = Math.max(
        44,
        scrollbar.clientWidth * (flow.clientWidth / flow.scrollWidth),
      );
      const thumbTravel = Math.max(0, scrollbar.clientWidth - thumbWidth);
      const progress = maxScroll === 0 ? 0 : flow.scrollLeft / maxScroll;
      thumb.style.width = `${thumbWidth}px`;
      thumb.style.transform = `translate3d(${progress * thumbTravel}px, 0, 0)`;
      scrollbar.setAttribute('aria-valuemax', String(Math.round(maxScroll)));
      scrollbar.setAttribute('aria-valuenow', String(Math.round(flow.scrollLeft)));
    };
    let activePointer: number | null = null;
    let pointerStart = 0;
    let scrollStart = 0;
    const beginDrag = (event: PointerEvent): void => {
      event.preventDefault();
      activePointer = event.pointerId;
      scrollbar.setPointerCapture(event.pointerId);
      const thumbBounds = thumb.getBoundingClientRect();
      if (event.target !== thumb) {
        const trackBounds = scrollbar.getBoundingClientRect();
        const maxScroll = Math.max(0, flow.scrollWidth - flow.clientWidth);
        const thumbTravel = Math.max(1, scrollbar.clientWidth - thumbBounds.width);
        const target = Math.min(
          thumbTravel,
          Math.max(0, event.clientX - trackBounds.left - thumbBounds.width / 2),
        );
        flow.scrollLeft = (target / thumbTravel) * maxScroll;
      }
      pointerStart = event.clientX;
      scrollStart = flow.scrollLeft;
    };
    const drag = (event: PointerEvent): void => {
      if (activePointer !== event.pointerId) return;
      const maxScroll = Math.max(0, flow.scrollWidth - flow.clientWidth);
      const thumbTravel = Math.max(1, scrollbar.clientWidth - thumb.getBoundingClientRect().width);
      flow.scrollLeft = scrollStart + ((event.clientX - pointerStart) / thumbTravel) * maxScroll;
    };
    const endDrag = (event: PointerEvent): void => {
      if (activePointer !== event.pointerId) return;
      activePointer = null;
      if (scrollbar.hasPointerCapture(event.pointerId))
        scrollbar.releasePointerCapture(event.pointerId);
    };
    scrollbar.addEventListener('pointerdown', beginDrag);
    scrollbar.addEventListener('pointermove', drag);
    scrollbar.addEventListener('pointerup', endDrag);
    scrollbar.addEventListener('pointercancel', endDrag);
    scrollbar.addEventListener('keydown', (event) => {
      const maxScroll = Math.max(0, flow.scrollWidth - flow.clientWidth);
      const increments: Partial<Record<string, number>> = {
        ArrowLeft: -80,
        ArrowRight: 80,
        PageUp: -flow.clientWidth * 0.8,
        PageDown: flow.clientWidth * 0.8,
        Home: -maxScroll,
        End: maxScroll,
      };
      const increment = increments[event.key];
      if (increment === undefined) return;
      event.preventDefault();
      flow.scrollTo({
        left:
          event.key === 'Home' ? 0 : event.key === 'End' ? maxScroll : flow.scrollLeft + increment,
        behavior: 'smooth',
      });
    });
    flow.addEventListener('scroll', sync, { passive: true });
    sync();
  }

  private sortHeader(key: SortKey, label: string, className = ''): string {
    const active = this.state.query.sortKey === key;
    const ariaSort = active
      ? this.state.query.sortDirection === 'asc'
        ? 'ascending'
        : 'descending'
      : 'none';
    const glyphState = active ? `active direction-${this.state.query.sortDirection}` : '';
    return `<th class="${className}" scope="col" aria-sort="${ariaSort}"><button type="button" data-action="sort-column" data-sort="${key}"><span class="sort-label">${label}</span><span class="sort-glyph ${glyphState}">${icon('sort', 15)}</span></button></th>`;
  }

  private renderDesktopRow(position: Position): string {
    const show = (key: string): boolean => this.state.visibleColumns.has(key);
    const selected = this.state.selectedId === position.id && this.state.overlay === 'details';
    const stage =
      position.status === 'in-progress' && position.stage
        ? `<div class="stage-cell"><strong>${position.stageProgress}/6</strong><span class="stage-label">${escapeHtml(position.stage)}</span><span class="progress-track"><span style="width:calc(${(((position.stageProgress ?? 0) / 6) * 100).toFixed(4)}% - ${(((position.stageProgress ?? 0) / 6) * 4).toFixed(4)}px)"></span></span></div>`
        : '';
    const indicativeRange =
      position.indicativeMin === null
        ? `<span class="semantic-empty">${formatRange(position)}</span>`
        : `${externalRecordLink(formatRange(position), position, 'market-value')}<small>${formatMoney(Math.round((position.nav * position.indicativeMin) / 100))} –<br/>${formatMoney(Math.round((position.nav * (position.indicativeMax ?? 0)) / 100))}</small>`;
    const status = statusBadge(position, position.status !== 'in-progress');
    return `<tr data-position-id="${position.id}" class="${selected ? 'source-selected' : ''} ${this.state.followUps.has(position.id) ? 'follow-up' : ''}">
      <td class="column-position position-cell">${position.isNew ? newRibbon() : ''}<div class="identity">${avatar(position)}<span><strong>${escapeHtml(position.positionName)}</strong><small>${escapeHtml(position.manager)}</small></span></div></td>
      <td class="column-client"><div class="two-line"><strong>${escapeHtml(position.client)}</strong>${copyLink(`ID: ${position.clientId}`, position.clientId, `client ID for ${position.client}`)}</div></td>
      ${show('account') ? `<td class="column-account"><div class="two-line"><strong>${accountType(position)}</strong>${copyLink(position.accountId, position.accountId, `account ID for ${position.client}`)}</div></td>` : ''}
      ${show('nav') ? `<td class="column-nav numeric"><strong class="financial-value">${formatMoney(position.nav)}</strong></td>` : ''}
      ${show('range') ? `<td class="column-range numeric"><div class="range-cell">${indicativeRange}</div></td>` : ''}
      <td class="column-status status-cell">${status}</td>
      ${show('stage') ? `<td class="column-stage sale-stage-cell">${stage}</td>` : ''}
      ${show('updated') ? `<td class="column-updated"><time class="updated" datetime="PT${position.updatedMinutes}M">${formatUpdated(position.updatedMinutes)}</time></td>` : ''}
      <td class="column-action actions-cell">${this.renderRowActions(position, 'desktop')}</td>
    </tr>`;
  }

  private renderEmptyRow(): string {
    const columnCount = 4 + this.state.visibleColumns.size;
    return `<tr><td colspan="${columnCount}"><div class="empty-state">${icon('search', 28)}<strong>No positions match this view</strong><span>Clear the current search or filters to restore the complete position set.</span><button type="button" class="secondary-button" data-action="clear-all">Clear all</button></div></td></tr>`;
  }

  private renderRowActions(position: Position, layout: 'desktop' | 'mobile'): string {
    const primaryLabel = actionLabels[position.status];
    const primaryAction = position.status === 'ready' ? 'open-handoff' : 'open-details';
    const moreOpen = this.state.rowMenuId === position.id;
    return `<div class="row-actions ${layout}">
      <button type="button" class="row-primary status-action-${position.status}" data-action="${primaryAction}" data-id="${position.id}">${escapeHtml(primaryLabel)}${position.status === 'ready' ? icon('cta-arrow', 12) : ''}</button>
      <div class="small-actions">
        <div class="panel-anchor row-menu-anchor">${button(`More actions for ${position.positionName}`, 'more', 'toggle-row-menu', { className: layout === 'mobile' ? 'icon-button' : 'small-icon-button' }).replace('data-action="toggle-row-menu"', `data-action="toggle-row-menu" data-id="${position.id}"`)}${moreOpen ? this.renderRowMenu(position) : ''}</div>
        ${button(`View details for ${position.positionName}`, 'info', 'open-details', { className: layout === 'mobile' ? 'icon-button' : 'small-icon-button' }).replace('data-action="open-details"', `data-action="open-details" data-id="${position.id}"`)}
        ${button(`Ask AI about ${position.positionName}`, 'ai', 'open-ai', { className: layout === 'mobile' ? 'icon-button' : 'small-icon-button' }).replace('data-action="open-ai"', `data-action="open-ai" data-id="${position.id}"`)}
      </div>
    </div>`;
  }

  private renderRowMenu(position: Position): string {
    const following = this.state.followUps.has(position.id);
    return `<div class="popover row-menu" role="menu" aria-label="More actions for ${escapeHtml(position.positionName)}">
      <button type="button" role="menuitem" data-action="copy-position-id" data-id="${position.id}">${icon('copy')}<span><strong>Copy position ID</strong><small>${position.id}</small></span></button>
      <button type="button" role="menuitem" data-action="download-summary" data-id="${position.id}">${icon('download')}<span><strong>Download summary</strong><small>Synthetic text record</small></span></button>
      <button type="button" role="menuitemcheckbox" aria-checked="${String(following)}" data-action="toggle-follow-up" data-id="${position.id}">${icon(following ? 'check' : 'clock')}<span><strong>${following ? 'Remove follow-up' : 'Flag for follow-up'}</strong><small>Personal prototype marker</small></span></button>
    </div>`;
  }

  private renderMobileCards(rows: Position[]): string {
    return `<section class="mobile-card-region" aria-label="Positions results">
      ${rows.length ? rows.map((position) => this.renderMobileCard(position)).join('') : `<div class="empty-state">${icon('search', 28)}<strong>No positions match this view</strong><span>Try clearing the search or filters.</span><button type="button" class="secondary-button" data-action="clear-all">Clear all</button></div>`}
    </section>`;
  }

  private renderMobileCard(position: Position): string {
    const selected = this.state.selectedId === position.id && this.state.overlay === 'details';
    return `<article class="position-card ${selected ? 'source-selected' : ''} ${this.state.followUps.has(position.id) ? 'follow-up' : ''}" data-position-id="${position.id}">
      ${position.isNew ? newRibbon() : ''}
      <div class="card-section position-section"><span class="field-label">Position:</span><div class="identity">${avatar(position)}<span><strong>${escapeHtml(position.positionName)}</strong><small>${escapeHtml(position.manager)}</small></span></div></div>
      <div class="card-pair card-section"><div><span class="field-label">Client:</span><strong>${escapeHtml(position.client)}</strong>${copyLink(`ID: ${position.clientId}`, position.clientId, `client ID for ${position.client}`)}</div><div><span class="field-label">Account:</span><strong>${accountType(position)}</strong>${copyLink(position.accountId, position.accountId, `account ID for ${position.client}`)}</div></div>
      <div class="card-pair card-section"><div><span class="field-label">Position NAV:</span><strong class="financial-value">${formatMoney(position.nav)}</strong></div><div><span class="field-label">Market value:</span>${position.indicativeMin === null ? `<button class="info-link" type="button" data-action="open-details" data-id="${position.id}" aria-label="Why market value is unavailable">${icon('info', 18)}</button>` : `${externalRecordLink(formatRange(position), position, 'market-value')}<small>Indicative % of NAV</small>`}</div></div>
      <div class="card-pair status-pair card-section"><div><span class="field-label">Status:</span>${statusBadge(position)}</div><div><span class="field-label">Last update:</span><time class="updated" datetime="PT${position.updatedMinutes}M">${formatUpdated(position.updatedMinutes)}</time></div></div>
      <div class="card-actions">${this.renderRowActions(position, 'mobile')}</div>
    </article>`;
  }

  private renderPagination(
    total: number,
    page: number,
    pageCount: number,
    layout: 'desktop' | 'mobile',
  ): string {
    const pages = pageNumbers(page, pageCount);
    let previous = 0;
    const pageButtons = pages
      .map((value) => {
        const ellipsis =
          previous && value - previous > 1 ? '<span class="page-ellipsis">…</span>' : '';
        previous = value;
        return `${ellipsis}<button type="button" data-action="set-page" data-page="${value}" ${value === page ? 'aria-current="page"' : ''}>${value}</button>`;
      })
      .join('');
    const start = total === 0 ? 0 : (page - 1) * this.state.query.pageSize + 1;
    const end = Math.min(total, page * this.state.query.pageSize);
    return `<nav class="pagination" aria-label="Positions pagination">
      <div class="pagination-main">
        <button type="button" class="icon-button" data-action="previous-page" aria-label="Previous page" ${page <= 1 ? 'disabled' : ''}>${icon('pagination-left', 14)}</button>
        <div class="page-buttons">${pageButtons}</div>
        <button type="button" class="icon-button" data-action="next-page" aria-label="Next page" ${page >= pageCount ? 'disabled' : ''}>${icon('pagination-right', 14)}</button>
        ${layout === 'desktop' ? `<span class="toolbar-divider"></span><span class="result-range">${start}–${end} of ${total}</span>` : ''}
      </div>
      <label class="page-size">Per page:<select data-page-size>${[5, 10, 25, 50].map((size) => `<option value="${size}" ${this.state.query.pageSize === size ? 'selected' : ''}>${size}</option>`).join('')}</select></label>
    </nav>`;
  }

  private renderOverlay(): string {
    if (this.state.overlay === 'details') return this.renderDetailsDrawer();
    if (this.state.overlay === 'ai') return this.renderAiChat();
    if (this.state.overlay === 'handoff') return this.renderHandoff();
    if (this.state.overlay === 'diagnostics') return this.renderDiagnostics();
    return '';
  }

  private renderDetailsDrawer(): string {
    const position = this.selectedPosition();
    if (!position) return '';
    return `<div class="overlay-scrim drawer-scrim" data-action="close-overlay"></div>
      <aside class="details-drawer" role="dialog" aria-modal="true" aria-labelledby="details-title" data-overlay>
        <div class="overlay-header"><div><span class="eyebrow">Position details</span><h2 id="details-title">${escapeHtml(position.positionName)}</h2></div><button type="button" class="icon-button" data-action="close-overlay" aria-label="Close details">${icon('close')}</button></div>
        <div class="drawer-identity">${avatar(position)}<div><strong>${escapeHtml(position.client)}</strong><span>${position.accountType} · ${escapeHtml(position.accountId)}</span></div></div>
        <section class="drawer-section"><h3>Next action</h3><div class="readiness-card status-${position.status}">${statusBadge(position)}<p>${escapeHtml(this.readinessExplanation(position))}</p><button type="button" class="primary-button" data-action="${position.status === 'ready' ? 'open-handoff' : position.status === 'in-progress' ? 'show-progress-notice' : 'show-resolution-notice'}" data-id="${position.id}">${escapeHtml(actionLabels[position.status])}${icon('cta-arrow', 12)}</button></div></section>
        <section class="drawer-section"><div class="section-heading"><h3>Valuation evidence</h3><span>As of ${escapeHtml(position.valuationDate)}</span></div><dl class="detail-grid"><div><dt>Position NAV</dt><dd>${formatMoney(position.nav, true)}</dd></div><div><dt>Indicative range</dt><dd>${formatRange(position)}</dd></div><div><dt>Source</dt><dd>${escapeHtml(position.navSource)}</dd></div><div><dt>Currency</dt><dd>USD · native</dd></div></dl><p class="drawer-note">The indicative range is synthetic and non-binding. It is shown as a percentage of the latest reported NAV, not as an executable price.</p></section>
        <section class="drawer-section"><div class="section-heading"><h3>Workflow</h3><span>${escapeHtml(position.owner)}</span></div><dl class="timeline"><div><dt>${formatUpdated(position.updatedMinutes)}</dt><dd><strong>Status updated</strong><span>${escapeHtml(statusLabels[position.status])}${position.reason ? ` · ${escapeHtml(position.reason)}` : ''}</span></dd></div><div><dt>${position.valuationDate}</dt><dd><strong>NAV received</strong><span>${escapeHtml(position.navSource)}</span></dd></div><div><dt>Prototype</dt><dd><strong>Record generated</strong><span>Synthetic demonstration data</span></dd></div></dl></section>
        <section class="drawer-section"><div class="section-heading"><h3>Documents</h3><span>${escapeHtml(position.documentProgress)}</span></div><button type="button" class="secondary-button wide" data-action="download-summary" data-id="${position.id}">${icon('download')} Download position summary</button></section>
        <div class="drawer-footer"><button type="button" class="secondary-button" data-action="open-ai" data-id="${position.id}">${icon('ai')} Ask AI about this position</button></div>
      </aside>`;
  }

  private readinessExplanation(position: Position): string {
    if (position.status === 'ready')
      return 'Eligibility checks are complete in this synthetic record. Confirm the client, account and position before entering the separate Sell flow.';
    if (position.status === 'in-progress')
      return 'A sale is already active. Continue the existing workflow rather than starting a duplicate process.';
    if (position.status === 'review')
      return `${position.reason ?? 'A review is required'} before a sale can start. The responsible owner is ${position.owner}.`;
    if (position.status === 'blocked')
      return `${position.reason ?? 'A restriction'} currently prevents sale initiation. Review the restriction and resolution owner.`;
    return 'This position is monitored but has not been marked ready for sale. Review its evidence before taking action.';
  }

  private renderAiChat(): string {
    const position = this.selectedPosition();
    if (!position) return '';
    const messages = this.state.aiMessages.length
      ? this.state.aiMessages
      : [
          {
            role: 'assistant' as const,
            text: `I can explain the visible synthetic record for ${position.positionName}. I cannot change data or start a sale.`,
          },
        ];
    return `<section class="ai-chat" role="dialog" aria-modal="false" aria-labelledby="ai-title" data-overlay>
      <div class="ai-header"><div class="ai-mark">${icon('ai')}</div><div><h2 id="ai-title">Position assistant</h2><span>Prototype · read-only</span></div><button type="button" class="icon-button" data-action="close-overlay" aria-label="Close AI assistant">${icon('close')}</button></div>
      <div class="ai-context"><span>${avatar(position)}</span><div><strong>${escapeHtml(position.positionName)}</strong><small>${escapeHtml(position.client)} · ${position.accountType}</small></div></div>
      <div class="chat-messages" aria-live="polite">${messages.map((message) => `<div class="chat-message ${message.role}">${escapeHtml(message.text)}</div>`).join('')}</div>
      <div class="ai-suggestions"><button type="button" data-action="ask-suggestion" data-question="Why is this position ${escapeHtml(statusLabels[position.status].toLocaleLowerCase('en'))}?">Explain status</button><button type="button" data-action="ask-suggestion" data-question="Summarise the valuation evidence.">Summarise valuation</button></div>
      <form class="chat-form" data-chat-form><label><span class="sr-only">Ask about this position</span><input id="chat-input" name="message" autocomplete="off" placeholder="Ask about this position…" /></label><button type="submit" class="send-button" aria-label="Send message">${icon('arrow-right')}</button></form>
      <p class="ai-disclaimer">Answers use only this synthetic prototype record. Verify source data before any financial action.</p>
    </section>`;
  }

  private renderHandoff(): string {
    const position = this.selectedPosition();
    if (!position) return '';
    return `<div class="overlay-scrim" data-action="close-overlay"></div>
      <section class="handoff-modal" role="dialog" aria-modal="true" aria-labelledby="handoff-title" data-overlay>
        <button type="button" class="icon-button modal-close" data-action="close-overlay" aria-label="Close sale handoff">${icon('close')}</button>
        <span class="modal-icon">${icon('arrow-up-right', 24)}</span><span class="eyebrow">Separate Sell flow</span><h2 id="handoff-title">Confirm the position context</h2><p>This prototype stops at the grid-to-Sell boundary defined by Tangible. It does not invent downstream transaction steps.</p>
        <dl class="handoff-summary"><div><dt>Client</dt><dd>${escapeHtml(position.client)}</dd></div><div><dt>Account</dt><dd>${position.accountType} · ${escapeHtml(position.accountId)}</dd></div><div><dt>Position</dt><dd>${escapeHtml(position.positionName)}</dd></div><div><dt>NAV basis</dt><dd>${formatMoney(position.nav, true)} · ${escapeHtml(position.valuationDate)}</dd></div><div><dt>Readiness</dt><dd>${statusBadge(position)}</dd></div></dl>
        <div class="modal-note">${icon('info')} A production system must recheck readiness and permissions server-side and use an idempotency key before creating a sale.</div>
        <div class="modal-actions"><button type="button" class="secondary-button" data-action="close-overlay">Back to positions</button><button type="button" class="primary-button" data-action="simulate-handoff">Enter Sell flow ${icon('cta-arrow', 12)}</button></div>
      </section>`;
  }

  private renderDiagnostics(): string {
    const diagnostics = window.__TANGIBLE_DIAGNOSTICS__;
    return `<div class="overlay-scrim" data-action="close-overlay"></div><section class="diagnostics-modal" role="dialog" aria-modal="true" aria-labelledby="diagnostics-title" data-overlay>
      <div class="overlay-header"><div><span class="eyebrow">Operator diagnostics</span><h2 id="diagnostics-title">Prototype status</h2></div><button type="button" class="icon-button" data-action="close-overlay" aria-label="Close diagnostics">${icon('close')}</button></div>
      <p class="diagnostics-health"><span></span>Application rendered successfully</p><dl class="diagnostics-list">${Object.entries(
        diagnostics,
      )
        .map(
          ([key, value]) =>
            `<div><dt>${escapeHtml(key)}</dt><dd>${escapeHtml(String(value))}</dd></div>`,
        )
        .join('')}</dl>
      <div class="modal-actions"><button type="button" class="secondary-button" data-action="copy-diagnostics">${icon('copy')} Copy report</button><button type="button" class="primary-button" data-action="close-overlay">Done</button></div>
    </section>`;
  }

  private updateDiagnostics(visibleRows?: number): void {
    const current = queryPositions(positions, this.state.query);
    window.__TANGIBLE_DIAGNOSTICS__ = {
      build: '0.1.0-local',
      uiTheme: this.state.uiTheme,
      layout: this.state.layout,
      effectiveLayout: this.effectiveLayout(),
      viewport: this.viewportMode(),
      totalSyntheticRows: positions.length,
      visibleRows: visibleRows ?? current.total,
      activeFilters: activeFilterCount(this.state.query.filters),
      query: this.state.query.query,
      currentPage: current.page,
      userAgent: navigator.userAgent,
      lastError: this.lastError,
    };
  }

  private commitOverlay(
    overlay: Exclude<Overlay, null>,
    id?: string,
    captureReturnFocus = true,
  ): void {
    if (captureReturnFocus)
      this.returnFocus =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (id) this.state.selectedId = id;
    this.state.overlay = overlay;
    this.state.panel = null;
    this.state.rowMenuId = null;
    if (overlay === 'ai') this.state.aiMessages = [];
    this.render();
    window.setTimeout(
      () =>
        this.root
          .querySelector<HTMLElement>('[data-overlay] button, [data-overlay] input')
          ?.focus(),
      0,
    );
  }

  private openOverlay(overlay: Exclude<Overlay, null>, id?: string): void {
    if (this.state.overlay) {
      this.closeOverlay(() => this.commitOverlay(overlay, id, false), false);
      return;
    }
    this.commitOverlay(overlay, id);
  }

  private closeOverlay(after?: () => void, restoreFocus = true): void {
    const overlay = this.root.querySelector<HTMLElement>('[data-overlay]');
    const scrim = this.root.querySelector<HTMLElement>('.overlay-scrim');
    const token = ++this.overlayMotionToken;
    const finish = (): void => {
      if (token !== this.overlayMotionToken) return;
      this.state.overlay = null;
      if (after) after();
      else this.render(undefined, 'none', true);
      if (restoreFocus) window.setTimeout(() => this.returnFocus?.focus(), 0);
    };

    if (!overlay || !motionEnabled()) {
      finish();
      return;
    }

    overlay.dataset.motionState = 'closing';
    if (scrim) scrim.dataset.motionState = 'closing';

    let overlayFrames: MotionKeyframes;
    let duration: number = MOTION.duration.base;
    if (overlay.classList.contains('details-drawer')) {
      overlayFrames = [{ transform: 'translateX(0)' }, { transform: 'translateX(100%)' }];
      duration = MOTION.duration.overlay;
    } else if (overlay.classList.contains('ai-chat')) {
      overlayFrames = [
        { opacity: 1, transform: 'translateY(0) scale(1)' },
        { opacity: 0, transform: 'translateY(14px) scale(0.98)' },
      ];
      duration = MOTION.duration.base;
    } else {
      overlayFrames = [
        { opacity: 1, transform: 'translate(-50%, -50%) scale(1)' },
        { opacity: 0, transform: 'translate(-50%, calc(-50% + 10px)) scale(0.985)' },
      ];
    }

    const animations = [
      playMotion(overlay, overlayFrames, {
        duration,
        easing: MOTION.easing.exit,
      }),
    ];
    if (scrim)
      animations.push(
        playMotion(scrim, [{ opacity: 1 }, { opacity: 0 }], {
          duration: MOTION.duration.fast,
          easing: MOTION.easing.exit,
        }),
      );
    void Promise.all(animations.map(finishMotion)).then(finish);
  }

  private showToast(message: string): void {
    if (this.toastTimer !== null) window.clearTimeout(this.toastTimer);
    this.state.toast = message;
    this.render(undefined, 'none', true);
    this.toastTimer = window.setTimeout(() => this.hideToast(), 2500);
  }

  private hideToast(): void {
    this.toastTimer = null;
    const toast = this.root.querySelector<HTMLElement>('.toast');
    const finish = (): void => {
      this.state.toast = null;
      this.render(undefined, 'none', true);
    };
    if (!toast || !motionEnabled()) {
      finish();
      return;
    }
    toast.dataset.motionState = 'closing';
    const animation = playMotion(
      toast,
      [
        { opacity: 1, transform: 'translate(-50%, 0)' },
        { opacity: 0, transform: 'translate(-50%, 8px)' },
      ],
      {
        duration: MOTION.duration.fast,
        easing: MOTION.easing.exit,
      },
    );
    void finishMotion(animation).then(finish);
  }

  private announce(message: string): void {
    const region = this.root.querySelector<HTMLElement>('#live-region');
    if (region) region.textContent = message;
  }

  private transitionFilteredData(commit: () => void, afterRender?: () => void): void {
    const surface = this.root.querySelector<HTMLElement>(
      this.effectiveLayout() === 'desktop' ? '.table-region tbody' : '.mobile-card-region',
    );
    const token = ++this.dataMotionToken;
    commit();

    const finish = (): void => {
      if (token !== this.dataMotionToken) return;
      delete this.root.dataset.dataMotionState;
      this.render(undefined, 'filter');
      afterRender?.();
    };

    if (!surface || !motionEnabled()) {
      finish();
      return;
    }

    this.root.dataset.dataMotionState = 'changing';
    surface.dataset.motionState = 'changing';
    surface.setAttribute('aria-busy', 'true');
    const animation = playMotion(surface, [{ opacity: 1 }, { opacity: 0 }], {
      duration: MOTION.duration.fast,
      easing: MOTION.easing.exit,
    });
    void finishMotion(animation).then(finish);
  }

  private commitPanel(panel: Exclude<Panel, null>): void {
    if (panel === 'filters' && this.state.panel !== 'filters')
      this.state.draftFilters = cloneFilters(this.state.query.filters);
    this.state.panel = panel;
    this.state.rowMenuId = null;
    this.render();
  }

  private closeTransient(after?: () => void): void {
    const designSystem = this.root.querySelector<HTMLElement>('.design-system-control.is-open');
    const transient = designSystem ?? this.root.querySelector<HTMLElement>('.popover');
    const token = ++this.transientMotionToken;
    const finish = (): void => {
      if (token !== this.transientMotionToken) return;
      this.state.panel = null;
      this.state.rowMenuId = null;
      if (after) {
        transient?.remove();
        after();
      } else this.render(undefined, 'none', true);
    };

    if (!transient || !motionEnabled()) {
      finish();
      return;
    }

    transient.dataset.motionState = 'closing';
    let frames: MotionKeyframes = [
      { opacity: 1, transform: 'translateY(0) scale(1)' },
      { opacity: 0, transform: 'translateY(-4px) scale(0.99)' },
    ];
    if (designSystem)
      frames = [
        { clipPath: 'inset(0 0 0 0 round 8px)' },
        { clipPath: 'inset(0 0 calc(100% - 40px) 0 round 8px)' },
      ];
    else if (
      this.effectiveLayout() === 'mobile' &&
      (transient.classList.contains('control-panel') || transient.classList.contains('export-menu'))
    )
      frames = [
        { opacity: 1, transform: 'translateY(0)' },
        { opacity: 0, transform: 'translateY(12px)' },
      ];

    const animations = [
      playMotion(transient, frames, {
        duration: MOTION.duration.base,
        easing: MOTION.easing.exit,
      }),
    ];
    const arrow = designSystem?.querySelector<HTMLElement>('.icon-dropdown-arrow');
    if (arrow)
      animations.push(
        playMotion(arrow, [{ transform: 'rotate(180deg)' }, { transform: 'rotate(0)' }], {
          duration: MOTION.duration.base,
          easing: MOTION.easing.standard,
        }),
      );
    void Promise.all(animations.map(finishMotion)).then(finish);
  }

  private togglePanel(panel: Exclude<Panel, null>): void {
    if (this.state.panel === panel) {
      this.closeTransient();
      return;
    }
    if (this.state.panel || this.state.rowMenuId) {
      this.closeTransient(() => this.commitPanel(panel));
      return;
    }
    this.commitPanel(panel);
  }

  private setUiTheme(theme: UiTheme): void {
    if (theme === this.state.uiTheme) return;
    this.state.uiTheme = theme;
    storeUiTheme(theme);
    applyDocumentUiTheme(theme);
    this.render('.design-system-button', 'theme', true);
    this.announce(`${uiThemeLabel(theme)} visual theme applied.`);
  }

  private toggleRowMenu(id: string | null): void {
    if (this.state.rowMenuId === id) {
      this.closeTransient();
      return;
    }
    const open = (): void => {
      this.state.rowMenuId = id;
      this.state.panel = null;
      this.render();
    };
    if (this.state.panel || this.state.rowMenuId) this.closeTransient(open);
    else open();
  }

  private toggleMobileSearch(): void {
    if (!this.state.mobileSearchOpen) {
      this.state.mobileSearchOpen = true;
      this.render('#mobile-search');
      return;
    }
    const field = this.root.querySelector<HTMLElement>('.mobile-search-field');
    const finish = (): void => {
      this.state.mobileSearchOpen = false;
      this.render(undefined, 'none', true);
    };
    if (!field || !motionEnabled()) {
      finish();
      return;
    }
    const animation = playMotion(
      field,
      [
        { opacity: 1, transform: 'translateY(0)' },
        { opacity: 0, transform: 'translateY(-5px)' },
      ],
      {
        duration: MOTION.duration.fast,
        easing: MOTION.easing.exit,
      },
    );
    void finishMotion(animation).then(finish);
  }

  private scrollDataIntoView(): void {
    this.root
      .querySelector<HTMLElement>('.table-region, .mobile-card-region')
      ?.scrollIntoView({ behavior: motionEnabled() ? 'smooth' : 'auto', block: 'start' });
  }

  private async copyText(value: string, confirmation: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(value);
      this.showToast(confirmation);
    } catch {
      this.lastError = 'Clipboard access was unavailable';
      this.showToast('Copy was unavailable. Please try again.');
    }
  }

  private download(filename: string, content: string, type: string): void {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  private answerFor(position: Position, question: string): string {
    const normalized = question.toLocaleLowerCase('en');
    if (normalized.includes('valuation') || normalized.includes('nav')) {
      return `The synthetic position NAV is ${formatMoney(position.nav, true)}, valued ${position.valuationDate} from ${position.navSource}. The indicative range is ${formatRange(position)} of NAV and is non-binding.`;
    }
    if (
      normalized.includes('status') ||
      normalized.includes('why') ||
      normalized.includes('ready')
    ) {
      return this.readinessExplanation(position);
    }
    if (normalized.includes('client') || normalized.includes('account')) {
      return `This record belongs to ${position.client}, ${position.accountType} account ${position.accountId}. Confirm both identifiers before taking a material action.`;
    }
    return `For this synthetic record: ${position.positionName} is ${statusLabels[position.status].toLocaleLowerCase('en')}, has a NAV of ${formatMoney(position.nav, true)}, and was updated ${formatUpdated(position.updatedMinutes)}. I cannot edit it or start a sale.`;
  }

  private sendChat(question: string): void {
    const position = this.selectedPosition();
    if (!position || !question.trim()) return;
    this.state.aiMessages.push({ role: 'user', text: question.trim() });
    this.state.aiMessages.push({ role: 'assistant', text: this.answerFor(position, question) });
    this.render('#chat-input', 'chat', true);
    window.setTimeout(() => {
      const messages = this.root.querySelector<HTMLElement>('.chat-messages');
      if (messages) messages.scrollTop = messages.scrollHeight;
    }, 0);
  }

  private readonly onResize = (): void => {
    if (this.state.layout === 'auto') this.render();
  };

  private readonly onInput = (event: Event): void => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    if (target.id === 'desktop-search' || target.id === 'mobile-search') {
      this.state.query.query = target.value;
      this.state.query.page = 1;
      this.render(`#${target.id}`, 'data-soft');
      this.announce(
        `${queryPositions(positions, this.state.query).total} positions match the search.`,
      );
    }
  };

  private readonly onChange = (event: Event): void => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) return;
    if (target.matches('[data-page-size]')) {
      this.state.query.pageSize = Number(target.value);
      this.state.query.page = 1;
      this.render(undefined, 'data');
      return;
    }
    if (target.matches('[data-sort-select]')) {
      this.state.query.sortKey = target.value as SortKey;
      this.state.query.page = 1;
      this.render(undefined, 'data');
      return;
    }
    if (target.matches('[data-setting-column]')) {
      const key = target.getAttribute('data-setting-column');
      if (!key || !(target instanceof HTMLInputElement)) return;
      if (target.checked) this.state.visibleColumns.add(key);
      else this.state.visibleColumns.delete(key);
      this.render(undefined, 'data', true);
      return;
    }
    const filterKind = target.getAttribute('data-filter-kind');
    if (filterKind === 'manager' && target instanceof HTMLSelectElement) {
      this.state.draftFilters.managers = target.value ? [target.value] : [];
      return;
    }
    if (target instanceof HTMLInputElement && filterKind) {
      const map = {
        status: this.state.draftFilters.statuses,
        account: this.state.draftFilters.accounts,
      } as const;
      const collection = map[filterKind as keyof typeof map] as string[];
      if (target.checked && !collection.includes(target.value)) collection.push(target.value);
      const index = collection.indexOf(target.value);
      if (!target.checked && index >= 0) collection.splice(index, 1);
    }
  };

  private readonly onClick = (event: MouseEvent): void => {
    const target =
      event.target instanceof Element ? event.target.closest<HTMLElement>('[data-action]') : null;
    if (!target) return;
    const action = target.dataset.action;
    const id = target.dataset.id;
    switch (action) {
      case 'toggle-layout': {
        this.state.layout = this.effectiveLayout() === 'desktop' ? 'mobile' : 'desktop';
        this.state.panel = null;
        this.render(undefined, 'layout');
        break;
      }
      case 'toggle-design-system':
        this.togglePanel('design-system');
        break;
      case 'toggle-filters':
        this.togglePanel('filters');
        break;
      case 'toggle-settings':
        this.togglePanel('settings');
        break;
      case 'toggle-print':
        this.togglePanel('print');
        break;
      case 'toggle-sort':
        this.togglePanel('sort');
        break;
      case 'close-panel':
        this.closeTransient();
        break;
      case 'set-ui-theme': {
        const theme = target.dataset.theme;
        if (isUiTheme(theme)) this.closeTransient(() => this.setUiTheme(theme));
        break;
      }
      case 'toggle-mobile-search':
        this.toggleMobileSearch();
        break;
      case 'set-view':
        this.transitionFilteredData(() => {
          const view = target.dataset.view as OperationalView;
          this.state.query.view = view;
          this.state.query.page = 1;
          this.root.querySelectorAll<HTMLElement>('[data-action="set-view"]').forEach((filter) => {
            const selected = filter.dataset.view === view;
            filter.classList.toggle('active', selected);
            filter.setAttribute('aria-pressed', String(selected));
          });
        });
        break;
      case 'clear-all':
        this.transitionFilteredData(() => {
          this.state.query.query = '';
          this.state.query.view = 'all';
          this.state.query.filters = emptyFilters();
          this.state.draftFilters = emptyFilters();
          this.state.query.page = 1;
        });
        break;
      case 'reset-draft-filters':
        this.state.draftFilters = emptyFilters();
        this.render(undefined, 'none', true);
        break;
      case 'apply-filters':
        this.closeTransient(() => {
          this.transitionFilteredData(
            () => {
              this.state.query.filters = cloneFilters(this.state.draftFilters);
              this.state.query.page = 1;
            },
            () =>
              this.announce(
                `${queryPositions(positions, this.state.query).total} positions match the applied filters.`,
              ),
          );
        });
        break;
      case 'set-density':
        this.state.density = target.dataset.density as Density;
        this.render(undefined, 'data', true);
        break;
      case 'reset-settings':
        this.state.density = 'standard';
        this.state.visibleColumns = new Set(optionalColumns.map(([key]) => key));
        this.render(undefined, 'data', true);
        break;
      case 'sort-column': {
        const key = target.dataset.sort as SortKey;
        if (this.state.query.sortKey === key)
          this.state.query.sortDirection =
            this.state.query.sortDirection === 'asc' ? 'desc' : 'asc';
        else {
          this.state.query.sortKey = key;
          this.state.query.sortDirection = 'asc';
        }
        this.state.query.page = 1;
        this.render(undefined, 'data');
        break;
      }
      case 'set-sort-direction':
        this.state.query.sortDirection = target.dataset.direction as SortDirection;
        this.render(undefined, 'data', true);
        break;
      case 'set-page':
        this.state.query.page = Number(target.dataset.page);
        this.render(undefined, 'data');
        this.scrollDataIntoView();
        break;
      case 'previous-page':
        this.state.query.page -= 1;
        this.render(undefined, 'data');
        this.scrollDataIntoView();
        break;
      case 'next-page':
        this.state.query.page += 1;
        this.render(undefined, 'data');
        this.scrollDataIntoView();
        break;
      case 'toggle-row-menu':
        this.toggleRowMenu(id ?? null);
        break;
      case 'open-details':
        this.openOverlay('details', id);
        break;
      case 'open-ai':
        this.openOverlay('ai', id);
        break;
      case 'open-handoff':
        this.openOverlay('handoff', id);
        break;
      case 'close-overlay':
        this.closeOverlay();
        break;
      case 'copy':
        void this.copyText(target.dataset.copy ?? '', 'Identifier copied');
        break;
      case 'open-external-record':
        event.preventDefault();
        this.showToast(
          `${target.dataset.externalLabel ?? 'External record'} is outside this prototype`,
        );
        break;
      case 'copy-position-id':
        if (id) void this.copyText(id, 'Position ID copied');
        break;
      case 'copy-diagnostics':
        void this.copyText(
          JSON.stringify(window.__TANGIBLE_DIAGNOSTICS__, null, 2),
          'Diagnostics report copied',
        );
        break;
      case 'download-summary': {
        const position = positions.find((item) => item.id === id);
        if (position)
          this.download(
            `${position.id}-summary.txt`,
            `TANGIBLE DESIGN PROTOTYPE — SYNTHETIC DATA\n\nPosition: ${position.positionName}\nManager: ${position.manager}\nClient: ${position.client}\nAccount: ${position.accountType} ${position.accountId}\nPosition NAV: ${formatMoney(position.nav, true)}\nValuation date: ${position.valuationDate}\nStatus: ${statusLabels[position.status]}\nReason: ${position.reason ?? 'None'}\n`,
            'text/plain',
          );
        this.closeTransient(() => this.showToast('Synthetic position summary downloaded'));
        break;
      }
      case 'toggle-follow-up':
        if (id) {
          this.closeTransient(() => {
            if (this.state.followUps.has(id)) this.state.followUps.delete(id);
            else this.state.followUps.add(id);
            this.showToast(
              this.state.followUps.has(id) ? 'Flagged for follow-up' : 'Follow-up removed',
            );
          });
        }
        break;
      case 'print-current':
        this.closeTransient(() => {
          this.render(undefined, 'none', true);
          window.setTimeout(() => window.print(), 0);
        });
        break;
      case 'export-csv': {
        const result = queryPositions(positions, this.state.query);
        this.download(
          'tangible-positions-synthetic.csv',
          toCsv(result.allFiltered, this.state.query),
          'text/csv;charset=utf-8',
        );
        this.closeTransient(() => this.showToast(`${result.total} synthetic positions exported`));
        break;
      }
      case 'ask-suggestion':
        this.sendChat(target.dataset.question ?? 'Summarise this position.');
        break;
      case 'listings-notice':
        this.showToast('Listings are outside this positions-grid prototype');
        break;
      case 'show-progress-notice':
        this.showToast('Existing sale workflow context preserved');
        break;
      case 'show-resolution-notice':
        this.showToast('Resolution route opened in this prototype');
        break;
      case 'simulate-handoff':
        this.showToast('Readiness rechecked — Sell flow handoff simulated');
        break;
    }
  };

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    const targetAcceptsText =
      event.target instanceof HTMLInputElement ||
      event.target instanceof HTMLTextAreaElement ||
      (event.target instanceof HTMLElement && event.target.isContentEditable);
    if (event.shiftKey && event.key.toLowerCase() === 'd' && !targetAcceptsText) {
      event.preventDefault();
      this.openOverlay('diagnostics');
      return;
    }
    if (event.key === 'Escape') {
      if (this.state.overlay) this.closeOverlay();
      else if (this.state.panel || this.state.rowMenuId) {
        this.closeTransient();
      } else if (this.state.mobileSearchOpen) {
        this.toggleMobileSearch();
      }
      return;
    }
    if (
      event.key === 'Enter' &&
      event.target instanceof HTMLInputElement &&
      event.target.closest('[data-chat-form]')
    ) {
      event.preventDefault();
      this.sendChat(event.target.value);
      return;
    }
    if (event.key !== 'Tab' || !this.state.overlay || this.state.overlay === 'ai') return;
    const overlay = this.root.querySelector<HTMLElement>('[data-overlay]');
    if (!overlay) return;
    const focusable = [
      ...overlay.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      ),
    ];
    const first = focusable[0];
    const last = focusable.at(-1);
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };
}
