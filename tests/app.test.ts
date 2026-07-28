import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TangibleApp } from '../src/app';

function installBrowserStubs(mobile = false): void {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('max-width') ? mobile : false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
  });
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: vi.fn(() => 'blob:mock'),
  });
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    value: vi.fn(),
  });
  HTMLElement.prototype.scrollIntoView = vi.fn();
}

function click(selector: string): void {
  const target = document.querySelector<HTMLElement>(selector);
  if (!target) throw new Error(`Missing test target: ${selector}`);
  target.click();
}

describe('TangibleApp DOM behavior', () => {
  beforeEach(() => {
    window.localStorage.clear();
    delete document.documentElement.dataset.uiTheme;
    document.body.innerHTML = '<div id="app"></div>';
    delete document.body.dataset.uiTheme;
    installBrowserStubs();
    new TangibleApp(document.querySelector<HTMLElement>('#app')!).mount();
  });

  it('renders semantic desktop positions and the complete count', () => {
    expect(document.querySelector('table caption')?.textContent).toContain('Advisor positions');
    expect(document.querySelectorAll('tbody tr')).toHaveLength(25);
    expect(document.querySelectorAll('tbody td.numeric .info-link')).toHaveLength(0);
    expect(document.querySelector('.range-cell .semantic-empty')?.textContent).toBe(
      'Not available',
    );
    expect(document.querySelector('.view-filter.active')?.textContent).toContain('All (413)');
    expect(window.__TANGIBLE_DIAGNOSTICS__.totalSyntheticRows).toBe(413);
    expect(window.__TANGIBLE_DIAGNOSTICS__.uiTheme).toBe('tangible');
  });

  it('switches visual systems without resetting product state and restores the saved choice', () => {
    const search = document.querySelector<HTMLInputElement>('#desktop-search')!;
    search.value = 'KKR';
    search.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }));
    const matchingRows = document.querySelectorAll('tbody tr').length;

    click('[data-action="toggle-design-system"]');
    expect(
      [...document.querySelectorAll<HTMLElement>('[data-action="set-ui-theme"]')].map((option) =>
        option.textContent?.trim(),
      ),
    ).toEqual(['Visa Nova', 'IBM Carbon v11', 'Cloudscape', 'Coinbase CDS']);

    click('[data-action="set-ui-theme"][data-theme="nova"]');
    expect(document.querySelector('#app')?.getAttribute('data-ui-theme')).toBe('nova');
    expect(document.documentElement.dataset.uiTheme).toBe('nova');
    expect(document.body.dataset.uiTheme).toBe('nova');
    expect(document.querySelector<HTMLInputElement>('#desktop-search')?.value).toBe('KKR');
    expect(document.querySelectorAll('tbody tr')).toHaveLength(matchingRows);
    expect(window.__TANGIBLE_DIAGNOSTICS__.uiTheme).toBe('nova');
    expect(window.localStorage.getItem('tangible.ui-theme')).toBe('nova');
    expect(document.querySelector('.design-system-button')?.textContent).toContain('Visa Nova');

    click('[data-action="toggle-design-system"]');
    click('[data-action="set-ui-theme"][data-theme="carbon"]');
    expect(document.querySelector('#app')?.getAttribute('data-ui-theme')).toBe('carbon');
    expect(document.querySelectorAll('tbody tr')).toHaveLength(matchingRows);
    expect(window.localStorage.getItem('tangible.ui-theme')).toBe('carbon');

    click('[data-action="toggle-design-system"]');
    click('[data-action="set-ui-theme"][data-theme="cloudscape"]');
    expect(document.querySelector('#app')?.getAttribute('data-ui-theme')).toBe('cloudscape');
    expect(document.querySelectorAll('tbody tr')).toHaveLength(matchingRows);
    expect(window.localStorage.getItem('tangible.ui-theme')).toBe('cloudscape');

    click('[data-action="toggle-design-system"]');
    click('[data-action="set-ui-theme"][data-theme="coinbase"]');
    expect(document.querySelector('#app')?.getAttribute('data-ui-theme')).toBe('coinbase');
    expect(document.querySelectorAll('tbody tr')).toHaveLength(matchingRows);
    expect(window.localStorage.getItem('tangible.ui-theme')).toBe('coinbase');

    document.body.innerHTML = '<div id="restored-app"></div>';
    new TangibleApp(document.querySelector<HTMLElement>('#restored-app')!).mount();
    expect(document.querySelector('#restored-app')?.getAttribute('data-ui-theme')).toBe('coinbase');

    click('[data-action="toggle-design-system"]');
    click('[data-action="set-ui-theme"][data-theme="tangible"]');
    expect(document.querySelector('#restored-app')?.getAttribute('data-ui-theme')).toBe('tangible');
    expect(document.documentElement.hasAttribute('data-ui-theme')).toBe(false);
    expect(document.body.hasAttribute('data-ui-theme')).toBe(false);
  });

  it('renders semantic columns for the responsive desktop width system', () => {
    const columns = [...document.querySelectorAll('colgroup col')].map((column) =>
      column.className.trim(),
    );

    expect(columns).toEqual([
      'column-position',
      'column-client',
      'column-account',
      'column-nav',
      'column-range',
      'column-status',
      'column-stage',
      'column-updated',
      'column-action',
    ]);
  });

  it('shows the default sort and preserves one dual-arrow glyph across directions', () => {
    const activeHeader = document.querySelector<HTMLTableCellElement>('th[aria-sort="ascending"]');
    expect(activeHeader?.textContent).toContain('Position');
    expect(activeHeader?.querySelector('.sort-glyph.direction-asc')).not.toBeNull();
    expect(activeHeader?.querySelectorAll('.sort-arrow')).toHaveLength(2);

    click('th button[data-sort="nav"]');
    const navHeader = document.querySelector<HTMLTableCellElement>('th[aria-sort="ascending"]');
    const ascendingGlyph = navHeader?.querySelector('.sort-glyph');
    const ascendingMarkup = ascendingGlyph?.innerHTML;
    expect(navHeader?.textContent).toContain('Position NAV');
    expect(ascendingGlyph?.classList.contains('direction-asc')).toBe(true);

    click('th button[data-sort="nav"]');
    const descendingHeader = document.querySelector<HTMLTableCellElement>(
      'th[aria-sort="descending"]',
    );
    const descendingGlyph = descendingHeader?.querySelector('.sort-glyph');
    expect(descendingHeader?.textContent).toContain('Position NAV');
    expect(descendingGlyph?.classList.contains('direction-desc')).toBe(true);
    expect(descendingGlyph?.innerHTML).toBe(ascendingMarkup);
  });

  it('shows sale-stage content only for in-progress records', () => {
    const stageCells = [...document.querySelectorAll<HTMLElement>('.sale-stage-cell')];
    const activeStageRows = [
      ...document.querySelectorAll<HTMLElement>('tbody tr:has(.stage-cell)'),
    ];

    expect(stageCells).toHaveLength(25);
    expect(document.body.textContent).not.toContain('No active sale');
    expect(
      stageCells.every(
        (cell) => cell.querySelector('.stage-cell') || cell.textContent?.trim() === '',
      ),
    ).toBe(true);
    expect(
      activeStageRows.every((row) =>
        row.textContent?.toLocaleUpperCase('en').includes('IN PROGRESS'),
      ),
    ).toBe(true);
    expect(
      activeStageRows.every((row) => row.querySelector('.status-cell .status-reason') === null),
    ).toBe(true);
  });

  it('renders independently animatable status icon geometry', () => {
    const readyIcon = document.querySelector('.status-badge.status-ready > .icon');
    const reviewIcon = document.querySelector('.status-badge.status-review > .icon');
    const blockedIcon = document.querySelector('.status-badge.status-blocked > .icon');

    expect(readyIcon).not.toBeNull();
    expect(reviewIcon).not.toBeNull();
    expect(blockedIcon?.querySelectorAll('path')).toHaveLength(2);
  });

  it('reserves the CTA arrow for Sell and renders other row actions as secondary controls', () => {
    const sellActions = [
      ...document.querySelectorAll<HTMLButtonElement>('.row-primary.status-action-ready'),
    ];
    const secondaryActions = [
      ...document.querySelectorAll<HTMLButtonElement>('.row-primary:not(.status-action-ready)'),
    ];

    expect(sellActions.length).toBeGreaterThan(0);
    expect(sellActions.every((action) => action.querySelector('.icon-cta-arrow'))).toBe(true);
    expect(secondaryActions.length).toBeGreaterThan(0);
    expect(secondaryActions.every((action) => action.querySelector('.icon') === null)).toBe(true);
  });

  it('makes identifiers, Joint accounts and market values complete interactive targets', async () => {
    const copyLinks = [...document.querySelectorAll<HTMLButtonElement>('.copy-link')];
    const jointLinks = [...document.querySelectorAll<HTMLAnchorElement>('.account-link')];
    const marketValueLinks = [
      ...document.querySelectorAll<HTMLAnchorElement>('.market-value-link'),
    ];

    expect(copyLinks).toHaveLength(50);
    expect(copyLinks[0]?.textContent).toContain('ID: 6D97');
    expect(copyLinks.every((link) => link.querySelector('.icon') !== null)).toBe(true);
    expect(jointLinks).toHaveLength(6);
    expect(jointLinks.every((link) => link.textContent?.includes('Joint'))).toBe(true);
    expect(marketValueLinks).toHaveLength(20);
    expect(marketValueLinks.every((link) => link.querySelector('.icon') !== null)).toBe(true);

    jointLinks[0]?.querySelector<HTMLElement>('span')?.click();
    expect(document.body.textContent).toContain('Joint account is outside this prototype');

    const activeCopyLink = document.querySelector<HTMLButtonElement>('.copy-link')!;
    activeCopyLink.querySelector<HTMLElement>('span')?.click();
    await vi.waitFor(() =>
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(activeCopyLink.dataset.copy),
    );
  });

  it('switches to the task-specific mobile card composition', () => {
    click('[data-action="toggle-layout"]');

    expect(document.querySelector('#app')?.getAttribute('data-layout')).toBe('mobile');
    expect(document.querySelectorAll('.position-card')).toHaveLength(25);
    expect(document.querySelector('.position-card .field-label')?.textContent).toBe('Position:');
  });

  it('searches the same dataset without adding an applied-state box', () => {
    const input = document.querySelector<HTMLInputElement>('#desktop-search')!;
    input.value = 'Dremstedt KKR';
    input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }));

    expect(document.querySelector('.applied-state')).toBeNull();
    expect(document.querySelector('tbody')?.textContent).toContain('Dremstedt Chonda');
    expect(document.querySelector('tbody')?.textContent).toContain('KKR');
  });

  it('applies advanced filters through the panel draft', () => {
    click('[data-action="toggle-filters"]');
    const checkbox = document.querySelector<HTMLInputElement>(
      'input[data-filter-kind="status"][value="blocked"]',
    )!;
    checkbox.click();
    click('[data-action="apply-filters"]');

    expect(document.querySelector('.applied-state')).toBeNull();
    expect(document.querySelectorAll('tbody tr')).toHaveLength(2);
    expect(document.querySelector('tbody')?.textContent).toContain('BLOCKED');
  });

  it('opens and closes a contextual details drawer', () => {
    click('[data-action="open-details"]');

    expect(document.querySelector('.details-drawer')?.getAttribute('role')).toBe('dialog');
    expect(document.querySelector('.details-drawer')?.textContent).toContain('Valuation evidence');
    click('.details-drawer [data-action="close-overlay"]');
    expect(document.querySelector('.details-drawer')).toBeNull();
  });

  it('opens a governed AI chat for the selected record', () => {
    click('[data-action="open-ai"]');

    expect(document.querySelector('.ai-chat')?.textContent).toContain('read-only');
    const suggestions = document.querySelectorAll<HTMLElement>('[data-action="ask-suggestion"]');
    suggestions[1]!.click();
    expect(document.querySelectorAll('.chat-message')).toHaveLength(2);
    expect(document.querySelector('.chat-messages')?.textContent).toContain(
      'synthetic position NAV',
    );
  });

  it('uses a confirmation handoff only for a sell-ready row', () => {
    click('[data-action="open-handoff"]');

    expect(document.querySelector('.handoff-modal')?.textContent).toContain('Separate Sell flow');
    expect(document.querySelector('.handoff-modal')?.textContent).toContain(
      'Confirm the position context',
    );
  });
});
