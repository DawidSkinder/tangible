import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

async function settleMotion(page: Page, selector?: string): Promise<void> {
  await page.evaluate(async (targetSelector) => {
    const target = targetSelector ? document.querySelector(targetSelector) : document;
    if (!target) return;
    const animations = target
      .getAnimations({ subtree: true })
      .filter((animation) => animation.effect?.getTiming().iterations !== Infinity);
    await Promise.all(animations.map((animation) => animation.finished.catch(() => undefined)));
  }, selector);
}

async function selectUiTheme(
  page: Page,
  label: 'DS Tangible' | 'Visa Nova' | 'IBM Carbon v11' | 'Cloudscape' | 'Coinbase CDS',
) {
  const themeId = {
    'DS Tangible': 'tangible',
    'Visa Nova': 'nova',
    'IBM Carbon v11': 'carbon',
    Cloudscape: 'cloudscape',
    'Coinbase CDS': 'coinbase',
  }[label];
  await page.locator('.design-system-button').click();
  await page.getByRole('menuitem', { name: label }).click();
  await expect(page.locator('#app')).toHaveAttribute('data-ui-theme', themeId);
  await page.evaluate(() => document.fonts.ready);
  await settleMotion(page, '.app-shell');
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await settleMotion(page);
});

test('production HTML declares the search-exclusion contract', async ({ page }) => {
  const directive = 'noindex, nofollow, nosnippet, noimageindex';
  const favicon = page.locator('link[rel="icon"]');

  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', directive);
  await expect(page.locator('meta[name="googlebot"]')).toHaveAttribute('content', directive);
  await expect(page.locator('meta[name="description"]')).toHaveCount(0);
  await expect(favicon).toHaveAttribute('href', '/favicon.ico');
  await expect(favicon).toHaveAttribute('type', 'image/x-icon');
  await expect(favicon).toHaveAttribute('sizes', '24x24');
});

test('column sorting keeps one dual-arrow glyph and emphasizes its active direction', async ({
  page,
}) => {
  const positionHeader = page.getByRole('columnheader', { name: /Position$/ });
  const navHeader = page.getByRole('columnheader', { name: /Position NAV/ });
  const positionGlyph = positionHeader.locator('.sort-glyph');

  await expect(positionHeader).toHaveAttribute('aria-sort', 'ascending');
  await expect(positionGlyph).toHaveClass(/direction-asc/);
  await expect(positionGlyph.locator('.sort-arrow-asc')).toHaveCSS('stroke', 'rgb(48, 55, 79)');
  await expect(positionGlyph.locator('.sort-arrow-desc')).toHaveCSS('stroke', 'rgb(183, 185, 193)');

  await navHeader.getByRole('button', { name: /Position NAV/ }).click();
  await expect(navHeader).toHaveAttribute('aria-sort', 'ascending');
  const ascendingGlyph = navHeader.locator('.sort-glyph');
  const glyphMarkup = await ascendingGlyph.locator('svg').innerHTML();
  await expect(ascendingGlyph).toHaveClass(/direction-asc/);
  await expect(ascendingGlyph.locator('.sort-arrow-asc')).toHaveCSS('stroke', 'rgb(48, 55, 79)');
  await expect(ascendingGlyph.locator('.sort-arrow-desc')).toHaveCSS(
    'stroke',
    'rgb(183, 185, 193)',
  );

  await navHeader.getByRole('button', { name: /Position NAV/ }).click();
  await expect(navHeader).toHaveAttribute('aria-sort', 'descending');
  const descendingGlyph = navHeader.locator('.sort-glyph');
  await expect(descendingGlyph).toHaveClass(/direction-desc/);
  expect(await descendingGlyph.locator('svg').innerHTML()).toBe(glyphMarkup);
  await expect(descendingGlyph.locator('.sort-arrow-desc')).toHaveCSS('stroke', 'rgb(48, 55, 79)');
  await expect(descendingGlyph.locator('.sort-arrow-asc')).toHaveCSS(
    'stroke',
    'rgb(183, 185, 193)',
  );
});

test('desktop grid supports the primary advisor workflow', async ({ page }) => {
  await expect(page.getByRole('heading', { name: /Welcome back/ })).toBeVisible();
  await expect(page.getByRole('table')).toBeVisible();
  await expect(page.getByRole('button', { name: 'All (413)' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByText('No active sale', { exact: true })).toHaveCount(0);
  await expect(page.locator('.sale-stage-cell')).toHaveCount(25);
  await expect(page.locator('tbody td.numeric .info-link')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /View valuation details for/ })).toHaveCount(0);
  const metadataTypography = await page.evaluate(() => {
    const properties = [
      'color',
      'font-family',
      'font-size',
      'font-style',
      'font-weight',
      'letter-spacing',
      'line-height',
    ] as const;
    const values = (selector: string): Record<string, string> => {
      const element = document.querySelector<HTMLElement>(selector);
      if (!element) throw new Error(`Missing typography target: ${selector}`);
      const style = getComputedStyle(element);
      return Object.fromEntries(
        properties.map((property) => [property, style.getPropertyValue(property)]),
      );
    };
    return {
      unavailable: values('.range-cell .semantic-empty'),
      updated: values('tbody .updated'),
    };
  });
  expect(metadataTypography.unavailable).toEqual(metadataTypography.updated);
  const columnAlignment = await page.evaluate(() => ({
    cells: [...document.querySelectorAll<HTMLElement>('tbody tr:first-child td')].map(
      (cell) => getComputedStyle(cell).textAlign,
    ),
    headers: [...document.querySelectorAll<HTMLElement>('thead th')].map(
      (header) => getComputedStyle(header).textAlign,
    ),
  }));
  expect(columnAlignment.headers.slice(0, -1).every((alignment) => alignment === 'left')).toBe(
    true,
  );
  expect(columnAlignment.cells.slice(0, -1).every((alignment) => alignment === 'left')).toBe(true);
  expect(columnAlignment.headers.at(-1)).toBe('right');
  expect(columnAlignment.cells.at(-1)).toBe('right');
  expect(
    await page
      .locator('tbody tr:has(.stage-cell)')
      .evaluateAll(
        (rows) =>
          rows.filter((row) => !row.textContent?.toLocaleUpperCase('en').includes('IN PROGRESS'))
            .length,
      ),
  ).toBe(0);
  await expect(page.locator('tbody tr:has(.stage-cell) .status-cell .status-reason')).toHaveCount(
    0,
  );
  const linkAffordances = await page.evaluate(() => {
    const copyLink = document.querySelector<HTMLElement>('.copy-link');
    const jointLink = document.querySelector<HTMLAnchorElement>('.account-link');
    const marketValueLink = document.querySelector<HTMLAnchorElement>('.market-value-link');
    const rangeDetail = marketValueLink?.nextElementSibling as HTMLElement | null;
    const clientPrimary = document.querySelector<HTMLElement>('tbody .two-line > strong');
    const clientId = clientPrimary?.nextElementSibling as HTMLElement | null;
    const stage = document.querySelector<HTMLElement>('.stage-cell');
    const stageLabel = stage?.querySelector<HTMLElement>('.stage-label');
    const progressTrack = stage?.querySelector<HTMLElement>('.progress-track');
    if (
      !copyLink ||
      !jointLink ||
      !marketValueLink ||
      !rangeDetail ||
      !clientPrimary ||
      !clientId ||
      !stage ||
      !stageLabel ||
      !progressTrack
    )
      throw new Error('Missing table affordance target');
    const marketValueRect = marketValueLink.getBoundingClientRect();
    const rangeDetailRect = rangeDetail.getBoundingClientRect();
    const clientPrimaryRect = clientPrimary.getBoundingClientRect();
    const clientIdRect = clientId.getBoundingClientRect();
    const stageRect = stage.getBoundingClientRect();
    const labelRect = stageLabel.getBoundingClientRect();
    const trackRect = progressTrack.getBoundingClientRect();
    return {
      copyTag: copyLink.tagName,
      copyContainsTextAndIcon: Boolean(
        copyLink.querySelector('span') && copyLink.querySelector('.icon'),
      ),
      jointTag: jointLink.tagName,
      jointContainsIcon: Boolean(jointLink.querySelector('.icon')),
      marketValueTag: marketValueLink.tagName,
      marketValueContainsIcon: Boolean(marketValueLink.querySelector('.icon')),
      valueDetailGap: rangeDetailRect.top - marketValueRect.bottom,
      clientIdGap: clientIdRect.top - clientPrimaryRect.bottom,
      stage: {
        width: stageRect.width,
        height: stageRect.height,
        labelTop: labelRect.top - stageRect.top,
        trackTop: trackRect.top - stageRect.top,
        trackHeight: trackRect.height,
      },
    };
  });
  expect(linkAffordances).toEqual({
    copyTag: 'BUTTON',
    copyContainsTextAndIcon: true,
    jointTag: 'A',
    jointContainsIcon: true,
    marketValueTag: 'A',
    marketValueContainsIcon: true,
    valueDetailGap: 5,
    clientIdGap: 5,
    stage: { width: 106, height: 56, labelTop: 27, trackTop: 48, trackHeight: 8 },
  });
  const firstCopyLink = page.locator('.copy-link').first();
  await firstCopyLink.hover();
  await expect(firstCopyLink).toHaveCSS('color', 'rgb(48, 55, 79)');
  await expect(firstCopyLink.locator('.icon')).toHaveCSS('color', 'rgb(0, 91, 65)');

  const sellAction = page.locator('.row-primary.status-action-ready').first();
  await expect(sellAction.locator('.icon-cta-arrow')).toHaveCount(1);
  await expect(sellAction).toHaveCSS('background-color', 'rgb(48, 55, 79)');
  await sellAction.hover();
  await expect(sellAction).toHaveCSS('background-color', 'rgb(0, 91, 65)');
  await expect(sellAction).toHaveCSS('color', 'rgb(255, 255, 255)');

  const secondaryRowAction = page.locator('.row-primary:not(.status-action-ready)').first();
  await expect(secondaryRowAction.locator('.icon')).toHaveCount(0);
  await expect(secondaryRowAction).toHaveCSS('border-top-width', '0px');
  await expect(secondaryRowAction).toHaveCSS('background-color', 'rgb(234, 235, 237)');
  await secondaryRowAction.hover();
  await expect(secondaryRowAction).toHaveCSS('background-color', 'rgb(48, 55, 79)');
  await expect(secondaryRowAction).toHaveCSS('color', 'rgb(255, 255, 255)');

  const rowIconAction = page.locator('.small-icon-button').first();
  await expect(rowIconAction).toHaveCSS('background-color', 'rgb(234, 235, 237)');
  await rowIconAction.hover();
  await expect(rowIconAction).toHaveCSS('background-color', 'rgb(48, 55, 79)');
  await expect(rowIconAction).toHaveCSS('color', 'rgb(255, 255, 255)');

  const toolbarIconAction = page.getByRole('button', { name: 'Filter positions' });
  await expect(toolbarIconAction).toHaveCSS('background-color', 'rgb(234, 235, 237)');
  await toolbarIconAction.hover();
  await expect(toolbarIconAction).toHaveCSS('background-color', 'rgb(48, 55, 79)');
  await expect(toolbarIconAction).toHaveCSS('color', 'rgb(255, 255, 255)');

  await page.getByPlaceholder('Search position, client, fund or account ID').fill('Dremstedt KKR');
  await expect(page.locator('.applied-state')).toHaveCount(0);
  await expect(page.getByRole('cell', { name: /Dremstedt Chonda/ }).first()).toBeVisible();

  await page.getByPlaceholder('Search position, client, fund or account ID').fill('');
  await page
    .getByRole('button', { name: /View details for PE Premier KKR/ })
    .first()
    .click();
  await expect(page.getByRole('dialog', { name: /PE Premier KKR/ })).toBeVisible();
  await expect(page.getByText('Valuation evidence')).toBeVisible();
  const detailsDrawer = page.locator('.details-drawer');
  await page.getByRole('button', { name: 'Close details' }).click();
  await expect(detailsDrawer).toHaveCount(0);

  await page.getByRole('button', { name: /Sell/ }).first().click();
  await expect(page.getByRole('dialog', { name: 'Confirm the position context' })).toBeVisible();
  await expect(page.getByText('Separate Sell flow')).toBeVisible();
});

test('radio and advanced filters update results without an applied-filter box', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Blocked (2)' }).click();
  await expect(page.locator('tbody tr')).toHaveCount(2);
  await expect(page.locator('.applied-state')).toHaveCount(0);
  await settleMotion(page, '.table-region');

  await page.getByRole('button', { name: 'All (413)' }).click();
  await expect(page.locator('tbody tr')).toHaveCount(25);
  await settleMotion(page, '.table-region');
  await page.getByRole('button', { name: 'Filter positions' }).click();
  await settleMotion(page, '.filters-panel');
  await page.getByLabel('Blocked').check();
  await page.getByRole('button', { name: 'Apply filters' }).click();
  await expect(page.locator('.filters-panel')).toHaveCount(0);
  await expect(page.locator('tbody tr')).toHaveCount(2);
  const advancedFilterEntry = await page
    .locator('tbody tr')
    .first()
    .evaluate((element) => element.getAnimations().length > 0);
  expect(advancedFilterEntry).toBe(true);
  await expect(page.locator('.applied-state')).toHaveCount(0);

  await page.getByRole('button', { name: 'Personalise table' }).click();
  await page.getByLabel('Indicative range').uncheck();
  await expect(page.getByRole('columnheader', { name: /Indicative range/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Done' }).click();

  await page.getByRole('button', { name: 'Print or export' }).click();
  await expect(page.getByRole('menuitem', { name: /Export CSV/ })).toBeVisible();
});

test('mobile review mode renders cards and working row actions', async ({ page }) => {
  await page.getByRole('button', { name: 'Show mobile layout' }).click();
  await expect(page.locator('#app')).toHaveAttribute('data-layout', 'mobile');
  await expect(page.locator('.position-card')).toHaveCount(25);

  await page.locator('[data-page-size]').selectOption('5');
  await expect(page.locator('.position-card')).toHaveCount(5);
  await page
    .getByRole('button', { name: /More actions for PE Premier KKR/ })
    .first()
    .click();
  await expect(page.getByRole('menuitem', { name: /Copy position ID/ })).toBeVisible();

  await page
    .getByRole('button', { name: /Ask AI about PE Premier KKR/ })
    .first()
    .click();
  await expect(page.getByRole('dialog', { name: 'Position assistant' })).toBeVisible();
  await page.getByRole('button', { name: 'Summarise valuation' }).click();
  await expect(page.getByText(/synthetic position NAV/)).toBeVisible();
});

test('all visual systems have no automatically detectable accessibility violations', async ({
  page,
}) => {
  test.slow();
  for (const theme of [
    'DS Tangible',
    'Visa Nova',
    'IBM Carbon v11',
    'Cloudscape',
    'Coinbase CDS',
  ] as const) {
    if (theme !== 'DS Tangible') await selectUiTheme(page, theme);
    const results = await new AxeBuilder({ page }).include('#positions-content').analyze();

    expect(results.violations, theme).toEqual([]);
  }
});

test('motion system stays active and sequences entry and exit states', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.reload();
  await page.locator('.welcome').waitFor();
  await expect(page.locator('#app')).toHaveAttribute('data-motion-policy', 'always');
  await settleMotion(page);

  const statusIconMotion = await page.evaluate(() => {
    const animation = (selector: string): string => {
      const element = document.querySelector<Element>(selector);
      if (!element) throw new Error(`Missing status motion target: ${selector}`);
      return getComputedStyle(element).animationName;
    };
    return {
      ready: animation('.status-badge.status-ready > .icon'),
      review: animation('.status-badge.status-review > .icon'),
      blockedFirstLine: animation('.status-badge.status-blocked > .icon path:first-child'),
      blockedSecondLine: animation('.status-badge.status-blocked > .icon path:nth-child(2)'),
    };
  });
  expect(statusIconMotion).toEqual({
    ready: 'status-icon-wobble',
    review: 'status-icon-wobble',
    blockedFirstLine: 'blocked-line-one',
    blockedSecondLine: 'blocked-line-two',
  });

  await page.getByRole('button', { name: 'Filter positions' }).click();
  const panel = page.locator('.filters-panel');
  const panelEntry = await panel.evaluate((element) => element.getAnimations().length > 0);
  expect(panelEntry).toBe(true);
  await settleMotion(page, '.filters-panel');

  await page.getByRole('button', { name: 'Close filters' }).click();
  expect(await panel.getAttribute('data-motion-state')).toBe('closing');
  await expect(panel).toHaveCount(0);

  await page
    .getByRole('button', { name: /View details for PE Premier KKR/ })
    .first()
    .click();
  const drawer = page.locator('.details-drawer');
  const drawerEntry = await drawer.evaluate(
    (element) => element.getAnimations({ subtree: true }).length > 0,
  );
  expect(drawerEntry).toBe(true);
  await settleMotion(page, '.details-drawer');

  await page.getByRole('button', { name: 'Close details' }).click();
  expect(await drawer.getAttribute('data-motion-state')).toBe('closing');
  await expect(drawer).toHaveCount(0);

  const outgoingRows = await page.locator('tbody').elementHandle();
  if (!outgoingRows) throw new Error('Missing outgoing table body');
  await page.getByRole('button', { name: 'Blocked (2)' }).click();
  expect(await outgoingRows.getAttribute('data-motion-state')).toBe('changing');
  const exitMotion = await outgoingRows.evaluate((element) => element.getAnimations().length > 0);
  expect(exitMotion).toBe(true);
  await expect(page.locator('tbody tr')).toHaveCount(2);
  const entryMotion = await page
    .locator('tbody tr')
    .first()
    .evaluate((element) => element.getAnimations().length > 0);
  expect(entryMotion).toBe(true);
  await outgoingRows.dispose();
});

test('chat, modal and toast surfaces use the shared motion language', async ({ page }) => {
  await page
    .getByRole('button', { name: /Ask AI about PE Premier KKR/ })
    .first()
    .click();
  const chat = page.locator('.ai-chat');
  expect(await chat.evaluate((element) => element.getAnimations().length > 0)).toBe(true);
  await settleMotion(page, '.ai-chat');
  await page.getByRole('button', { name: 'Close AI assistant' }).click();
  expect(await chat.getAttribute('data-motion-state')).toBe('closing');
  await expect(chat).toHaveCount(0);

  await page.getByRole('button', { name: /Sell/ }).first().click();
  const modal = page.locator('.handoff-modal');
  expect(await modal.evaluate((element) => element.getAnimations().length > 0)).toBe(true);
  await settleMotion(page, '.handoff-modal');
  await page.getByRole('button', { name: 'Close sale handoff' }).click();
  expect(await modal.getAttribute('data-motion-state')).toBe('closing');
  await expect(modal).toHaveCount(0);

  await page.getByRole('button', { name: /Listings/ }).click();
  const toast = page.locator('.toast');
  expect(await toast.evaluate((element) => element.getAnimations().length > 0)).toBe(true);
});

test('rendered typography follows the Figma General Sans contract', async ({ page }) => {
  const desktopTypography = await page.evaluate(async () => {
    await document.fonts.ready;
    const visibleTextElements = Array.from(document.querySelectorAll<HTMLElement>('body *')).filter(
      (element) =>
        element.childNodes.length > 0 &&
        Array.from(element.childNodes).some(
          (node) => node.nodeType === Node.TEXT_NODE && Boolean(node.textContent?.trim()),
        ) &&
        element.getClientRects().length > 0,
    );
    const familyViolations = visibleTextElements
      .filter((element) => !getComputedStyle(element).fontFamily.includes('General Sans'))
      .map((element) => `${element.tagName.toLowerCase()}.${element.className}`);
    const weightViolations = visibleTextElements
      .filter((element) => !['500', '600'].includes(getComputedStyle(element).fontWeight))
      .map(
        (element) =>
          `${element.tagName.toLowerCase()}.${element.className}:${getComputedStyle(element).fontWeight}`,
      );

    return {
      familyViolations,
      italicLoaded: document.fonts.check('italic 500 64px "General Sans"'),
      italicWelcome: getComputedStyle(document.querySelector('.welcome h1 em')!).fontStyle,
      mediumLoaded: document.fonts.check('500 12px "General Sans"'),
      semiboldLoaded: document.fonts.check('600 12px "General Sans"'),
      semiboldTableHeader: getComputedStyle(document.querySelector('th button')!).fontWeight,
      mediumBody: getComputedStyle(document.querySelector('tbody .identity strong')!).fontWeight,
      weightViolations,
      wordmark: document.querySelector<HTMLImageElement>('.brand-mark img')?.getAttribute('src'),
    };
  });

  expect(desktopTypography).toEqual({
    familyViolations: [],
    italicLoaded: true,
    italicWelcome: 'italic',
    mediumLoaded: true,
    semiboldLoaded: true,
    semiboldTableHeader: '600',
    mediumBody: '500',
    weightViolations: [],
    wordmark: './assets/tangible-wordmark2.svg',
  });

  await page.getByRole('button', { name: 'Show mobile layout' }).click();
  await expect(page.locator('.position-card').first()).toBeVisible();
  await expect(page.locator('.position-card .field-label').first()).toHaveCSS('font-weight', '600');
  await expect(page.locator('.position-card .card-pair strong').first()).toHaveCSS(
    'font-weight',
    '500',
  );
  await expect(page.locator('.position-card .financial-value').first()).toHaveCSS(
    'font-size',
    '20px',
  );
});

test('brand, NEW ribbon and supplied fund avatars match their source assets', async ({
  page,
  request,
}) => {
  for (const asset of [
    '/assets/tangible-wordmark2.svg',
    '/assets/avatar-kkr.png',
    '/assets/avatar-pimco.png',
  ])
    expect((await request.get(asset)).ok()).toBe(true);

  const desktop = await page.evaluate(async () => {
    const wordmark = document.querySelector<HTMLImageElement>('.brand-mark img')!;
    if (!wordmark.complete) await wordmark.decode();
    const kkr = document.querySelector<HTMLImageElement>(
      'tbody tr[data-position-id="POS-000001"] img.fund-avatar',
    )!;
    const pimco = document.querySelector<HTMLImageElement>(
      'tbody tr[data-position-id="POS-000002"] img.fund-avatar',
    )!;
    const clip = document.querySelector<HTMLElement>('tbody .new-ribbon-clip')!;
    const ribbon = clip.querySelector<HTMLElement>('.new-ribbon')!;
    const ribbonLabel = ribbon.querySelector<HTMLElement>('.new-ribbon-label')!;
    const ribbonStyle = getComputedStyle(ribbon);
    const wordmarkBounds = wordmark.getBoundingClientRect();
    return {
      avatars: [kkr, pimco].map((avatar) => ({
        height: avatar.getBoundingClientRect().height,
        loaded: avatar.complete && avatar.naturalWidth === 40 && avatar.naturalHeight === 40,
        src: avatar.getAttribute('src'),
        width: avatar.getBoundingClientRect().width,
      })),
      clipOverflow: getComputedStyle(clip).overflow,
      ribbon: {
        height: ribbonStyle.height,
        left: ribbonStyle.left,
        top: ribbonStyle.top,
        transform: ribbonStyle.transform,
        width: ribbonStyle.width,
      },
      ribbonLabelTransform: getComputedStyle(ribbonLabel).transform,
      wordmark: {
        height: wordmarkBounds.height,
        naturalHeight: wordmark.naturalHeight,
        naturalWidth: wordmark.naturalWidth,
        src: wordmark.getAttribute('src'),
        width: wordmarkBounds.width,
      },
    };
  });

  expect(desktop.wordmark).toEqual({
    height: 41,
    naturalHeight: 41,
    naturalWidth: 166,
    src: './assets/tangible-wordmark2.svg',
    width: 166,
  });
  expect(desktop.avatars).toEqual([
    { height: 40, loaded: true, src: './assets/avatar-kkr.png', width: 40 },
    { height: 40, loaded: true, src: './assets/avatar-pimco.png', width: 40 },
  ]);
  expect(desktop.clipOverflow).toBe('hidden');
  expect(desktop.ribbon).toMatchObject({
    height: '16px',
    left: '-42px',
    top: '4px',
    width: '128px',
  });
  expect(desktop.ribbon.transform).toBe('matrix(0.707107, -0.707107, 0.707107, 0.707107, 0, 0)');
  expect(desktop.ribbonLabelTransform).toBe('matrix(1, 0, 0, 1, -7, 0)');

  await page.getByRole('button', { name: 'Show mobile layout' }).click();
  const mobileRibbon = await page.locator('.position-card .new-ribbon').evaluate((ribbon) => {
    const style = getComputedStyle(ribbon);
    return {
      labelTransform: getComputedStyle(ribbon.querySelector('.new-ribbon-label')!).transform,
      left: style.left,
      right: style.right,
      top: style.top,
      transform: style.transform,
    };
  });
  expect(mobileRibbon).toMatchObject({ right: '-42px', top: '4px' });
  expect(mobileRibbon.transform).toBe('matrix(0.707107, 0.707107, -0.707107, 0.707107, 0, 0)');
  expect(mobileRibbon.labelTransform).toBe('matrix(1, 0, 0, 1, 7, 0)');
});

test('welcome arrow uses the exported Figma vector and responsive offsets', async ({ page }) => {
  const desktop = await page.locator('.welcome h1 em').evaluate((highlight) => {
    const arrow = highlight.querySelector<HTMLImageElement>('.welcome-pointer')!;
    const highlightBounds = highlight.getBoundingClientRect();
    const arrowBounds = arrow.getBoundingClientRect();
    return {
      height: arrowBounds.height,
      highlightHeight: highlightBounds.height,
      leftGap: arrowBounds.left - highlightBounds.right,
      loaded: arrow.complete && arrow.naturalWidth > 0,
      sectionMarginTop: getComputedStyle(highlight.closest('.welcome')!).marginTop,
      sectionPaddingBottom: getComputedStyle(highlight.closest('.welcome')!).paddingBottom,
      shellPadding: getComputedStyle(document.querySelector('.app-shell')!).paddingTop,
      src: arrow.getAttribute('src'),
      topGap: arrowBounds.top - highlightBounds.bottom,
      width: arrowBounds.width,
      y: arrowBounds.y,
    };
  });

  expect(desktop.src).toBe('./assets/tangible-welcome-arrow.svg');
  expect(desktop.loaded).toBe(true);
  expect(desktop.sectionMarginTop).toBe('48px');
  expect(desktop.sectionPaddingBottom).toBe('48px');
  expect(desktop.shellPadding).toBe('64px');
  expect(desktop.width).toBeCloseTo(24.2341, 1);
  expect(desktop.height).toBeCloseTo(24.2341, 1);
  expect(desktop.highlightHeight).toBe(80);
  expect(desktop.leftGap).toBeCloseTo(8, 1);
  expect(desktop.topGap).toBeCloseTo(8, 1);
  expect(desktop.y).toBe(241);

  await page.getByRole('button', { name: 'Show mobile layout' }).click();
  await settleMotion(page, '.app-shell');
  const mobile = await page.locator('.welcome h1 em').evaluate((highlight) => {
    const arrow = highlight.querySelector<HTMLImageElement>('.welcome-pointer')!;
    const highlightBounds = highlight.getBoundingClientRect();
    const arrowBounds = arrow.getBoundingClientRect();
    return {
      height: arrowBounds.height,
      highlightHeight: highlightBounds.height,
      leftGap: arrowBounds.left - highlightBounds.right,
      sectionMarginTop: getComputedStyle(highlight.closest('.welcome')!).marginTop,
      sectionPaddingBottom: getComputedStyle(highlight.closest('.welcome')!).paddingBottom,
      shellPadding: getComputedStyle(document.querySelector('.app-shell')!).paddingTop,
      topGap: arrowBounds.top - highlightBounds.bottom,
      width: arrowBounds.width,
      y: arrowBounds.y,
    };
  });

  expect(mobile.width).toBe(16);
  expect(mobile.height).toBe(16);
  expect(mobile.sectionMarginTop).toBe('24px');
  expect(mobile.sectionPaddingBottom).toBe('24px');
  expect(mobile.shellPadding).toBe('16px');
  expect(mobile.highlightHeight).toBe(40);
  expect(mobile.leftGap).toBeCloseTo(3, 1);
  expect(mobile.topGap).toBeCloseTo(5, 1);
  expect(mobile.y).toBe(165);
});

test('selected interface icons use the exported Figma vectors', async ({ page, request }) => {
  const assets = [
    '/assets/icon-design-system.svg',
    '/assets/icon-cta-arrow.svg',
    '/assets/icon-ai.svg',
    '/assets/icon-pagination-left.svg',
    '/assets/icon-pagination-right.svg',
  ];
  for (const asset of assets) expect((await request.get(asset)).ok()).toBe(true);

  const renderedIcons = await page.evaluate(() => {
    const details = (selector: string) => {
      const element = document.querySelector<HTMLElement>(selector)!;
      const style = getComputedStyle(element);
      return {
        height: style.height,
        mask: style.getPropertyValue('-webkit-mask-image') || style.getPropertyValue('mask-image'),
        width: style.width,
      };
    };
    return {
      ai: details('.small-icon-button .icon-ai'),
      cta: details('.row-primary .icon-cta-arrow'),
      designSystem: details('.design-system-main .icon-tools'),
      paginationLeft: details('.pagination .icon-pagination-left'),
      paginationRight: details('.pagination .icon-pagination-right'),
    };
  });

  expect(renderedIcons.designSystem).toMatchObject({ width: '16.875px', height: '16.875px' });
  expect(renderedIcons.designSystem.mask).toContain('icon-design-system.svg');
  expect(renderedIcons.cta).toMatchObject({ width: '12px', height: '12px' });
  expect(renderedIcons.cta.mask).toContain('icon-cta-arrow.svg');
  expect(renderedIcons.ai).toMatchObject({ width: '15px', height: '15px' });
  expect(renderedIcons.ai.mask).toContain('icon-ai.svg');
  expect(renderedIcons.paginationLeft).toMatchObject({ width: '14px', height: '14px' });
  expect(renderedIcons.paginationLeft.mask).toContain('icon-pagination-left.svg');
  expect(renderedIcons.paginationRight).toMatchObject({ width: '14px', height: '14px' });
  expect(renderedIcons.paginationRight.mask).toContain('icon-pagination-right.svg');
});

test('Cloudscape and Coinbase icon adapters are local and licensed', async ({ request }) => {
  const assets = [
    '/icons/cloudscape/search.svg',
    '/icons/cloudscape/ai.svg',
    '/icons/cloudscape/tools.svg',
    '/icons/cloudscape/LICENSE.txt',
    '/icons/coinbase/search.svg',
    '/icons/coinbase/ai.svg',
    '/icons/coinbase/tools.svg',
    '/icons/coinbase/LICENSE.txt',
  ];

  for (const asset of assets) expect((await request.get(asset)).ok(), asset).toBe(true);
});

test('design-system dropdown preserves the compact Tangible control while exposing live themes', async ({
  page,
  request,
}) => {
  expect((await request.get('/assets/icon-dropdown-arrow.svg')).ok()).toBe(true);

  const trigger = page.getByRole('button', { name: 'DS Tangible' });
  const closed = await trigger.evaluate((button) => {
    const bounds = button.getBoundingClientRect();
    const arrow = button.querySelector<HTMLElement>('.icon-dropdown-arrow')!;
    const arrowBounds = arrow.getBoundingClientRect();
    const breakpointBounds = document
      .querySelector<HTMLElement>('.breakpoint-button')!
      .getBoundingClientRect();
    const toolsBounds = button.querySelector<HTMLElement>('.icon-tools')!.getBoundingClientRect();
    return {
      arrowHeight: arrowBounds.height,
      arrowMask: getComputedStyle(arrow).getPropertyValue('-webkit-mask-image'),
      arrowWidth: arrowBounds.width,
      breakpointTop: breakpointBounds.top,
      height: bounds.height,
      toolsHeight: toolsBounds.height,
      toolsWidth: toolsBounds.width,
      top: bounds.top,
      width: bounds.width,
    };
  });
  expect(closed.width).toBeCloseTo(168.217, 1);
  expect(closed.height).toBe(40);
  expect(closed.arrowWidth).toBeCloseTo(9.333, 1);
  expect(closed.arrowHeight).toBeCloseTo(9.333, 1);
  expect(closed.arrowMask).toContain('icon-dropdown-arrow.svg');
  expect(closed.top - closed.breakpointTop).toBe(1);

  await trigger.click();
  const control = page.locator('.design-system-control.is-open');
  await expect(control).toBeVisible();
  await control.evaluate(async (element) => {
    await Promise.all(element.getAnimations().map((animation) => animation.finished));
  });

  const opened = await control.evaluate((element) => {
    const style = getComputedStyle(element);
    const bounds = element.getBoundingClientRect();
    const triggerButton = element.querySelector<HTMLElement>('.design-system-button')!;
    const arrow = element.querySelector<HTMLElement>('.icon-dropdown-arrow')!;
    const dividers = [...element.querySelectorAll<HTMLElement>('.design-system-divider')];
    const options = [...element.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')];
    const toolsBounds = element
      .querySelector<HTMLElement>('.design-system-main .icon-tools')!
      .getBoundingClientRect();
    return {
      arrowTransform: getComputedStyle(arrow).transform,
      borderWidth: style.borderTopWidth,
      controlGap: style.gap,
      height: bounds.height,
      menuGap: getComputedStyle(element.querySelector('.design-system-menu')!).gap,
      optionHeights: options.map((option) => getComputedStyle(option).height),
      optionLabels: options.map((option) => option.textContent?.trim()),
      paddingLeft: style.paddingLeft,
      paddingTop: style.paddingTop,
      separatorHeights: dividers.map((divider) => divider.getBoundingClientRect().height),
      separatorWidths: dividers.map((divider) => divider.getBoundingClientRect().width),
      subtitles: element.querySelectorAll('small').length,
      toolsHeight: toolsBounds.height,
      toolsWidth: toolsBounds.width,
      top: bounds.top,
      triggerHeight: getComputedStyle(triggerButton).height,
      width: bounds.width,
    };
  });

  expect(opened.width).toBeCloseTo(168.217, 1);
  expect(opened.height).toBeCloseTo(208.375, 1);
  expect(opened.top).toBe(closed.top);
  expect(opened.toolsWidth).toBeGreaterThanOrEqual(closed.toolsWidth);
  expect(opened.toolsHeight).toBeGreaterThanOrEqual(closed.toolsHeight);
  expect(opened.toolsWidth).toBe(18);
  expect(opened.toolsHeight).toBe(18);
  expect(opened).toMatchObject({
    arrowTransform: 'matrix(-1, 0, 0, -1, 0, 0)',
    borderWidth: '2px',
    controlGap: '12px',
    menuGap: '12px',
    optionHeights: ['16.875px', '16.875px', '16.875px', '16.875px'],
    optionLabels: ['Visa Nova', 'IBM Carbon v11', 'Cloudscape', 'Coinbase CDS'],
    paddingLeft: '14px',
    paddingTop: '10px',
    separatorHeights: [1, 1, 1, 1],
    subtitles: 0,
    triggerHeight: '16.875px',
  });
  for (const width of opened.separatorWidths) expect(width).toBeCloseTo(136.217, 1);

  const visaNova = page.getByRole('menuitem', { name: 'Visa Nova' });
  await visaNova.hover();
  await expect(visaNova).toHaveCSS('color', 'rgb(0, 91, 65)');
  await visaNova.click();
  await expect(page.locator('#app')).toHaveAttribute('data-ui-theme', 'nova');
  await expect(page.getByRole('button', { name: 'Visa Nova' })).toBeFocused();
  await expect(control).toHaveCount(0);
});

test('alternative themes preserve product state while expressing distinct component systems', async ({
  page,
}) => {
  const search = page.locator('#desktop-search');
  await search.fill('KKR');
  const visiblePositionIds = async () =>
    page
      .locator('tbody tr')
      .evaluateAll((rows) => rows.map((row) => row.getAttribute('data-position-id')));
  const columnLabels = async () =>
    page
      .locator('thead th')
      .evaluateAll((headers) => headers.map((header) => header.textContent?.trim()));
  const visualSignature = async () =>
    page.evaluate(() => {
      const style = (selector: string, pseudo?: string): CSSStyleDeclaration => {
        const element = document.querySelector<HTMLElement>(selector);
        if (!element) throw new Error(`Missing visual-system target: ${selector}`);
        return getComputedStyle(element, pseudo);
      };
      const firstRow = document.querySelector<HTMLElement>('tbody tr:nth-child(1) td');
      const secondRow = document.querySelector<HTMLElement>('tbody tr:nth-child(2) td');
      if (!firstRow || !secondRow) throw new Error('Missing visual-system table rows');
      return {
        activeTab: {
          background: style('.tab.active').backgroundColor,
          borderTopColor: style('.tab.active').borderTopColor,
          borderTopWidth: style('.tab.active').borderTopWidth,
          boxShadow: style('.tab.active').boxShadow,
        },
        avatarRadius: style('.fund-avatar').borderRadius,
        headerBackground: style('thead th').backgroundColor,
        iconMask: style('.search-field .icon-search').webkitMaskImage,
        inactiveTabBackground: style('.tab:not(.active)').backgroundColor,
        nameBackground: style('.welcome h1 em').backgroundColor,
        namePadding: style('.welcome h1 em').padding,
        numericAlignment: style('tbody td.numeric').textAlign,
        pointerDisplay: style('.welcome-pointer').display,
        rowBackgrounds: [
          style('tbody tr:nth-child(1) td').backgroundColor,
          style('tbody tr:nth-child(2) td').backgroundColor,
        ],
        rowHeight: firstRow.getBoundingClientRect().height,
        tableBorderSpacing: style('table').borderSpacing,
        toolbarBackground: style('.view-toolbar').backgroundColor,
        topbarBackground: style('.topbar').backgroundColor,
      };
    });

  const tangibleRows = await visiblePositionIds();
  const tangibleColumns = await columnLabels();

  await selectUiTheme(page, 'Visa Nova');
  await expect(page.locator('#app')).toHaveAttribute('data-ui-theme', 'nova');
  await expect(page.locator('.design-system-button')).toHaveText(/Visa Nova/);
  expect(await visiblePositionIds()).toEqual(tangibleRows);
  expect(await columnLabels()).toEqual(tangibleColumns);
  const novaSignature = await visualSignature();
  expect(novaSignature).toMatchObject({
    activeTab: {
      background: 'rgb(229, 243, 250)',
      borderTopColor: 'rgb(30, 120, 168)',
      borderTopWidth: '1px',
    },
    avatarRadius: '2px',
    headerBackground: 'rgb(242, 242, 242)',
    inactiveTabBackground: 'rgb(255, 255, 255)',
    nameBackground: 'rgba(0, 0, 0, 0)',
    namePadding: '0px',
    numericAlignment: 'right',
    pointerDisplay: 'none',
    rowBackgrounds: ['rgb(255, 255, 255)', 'rgb(247, 247, 247)'],
    rowHeight: 96,
    tableBorderSpacing: '0px',
    toolbarBackground: 'rgb(247, 247, 247)',
    topbarBackground: 'rgba(0, 0, 0, 0)',
  });
  expect(novaSignature.activeTab.boxShadow).toContain('rgb(30, 120, 168)');
  expect(novaSignature.iconMask).toContain('/icons/nova/search.svg');
  const novaStyles = await page.evaluate(() => ({
    fontFamily: getComputedStyle(document.querySelector('.app-root')!).fontFamily,
    radius: getComputedStyle(document.querySelector('.design-system-button')!).borderRadius,
    stored: localStorage.getItem('tangible.ui-theme'),
    theme: window.__TANGIBLE_DIAGNOSTICS__.uiTheme,
  }));
  expect(novaStyles).toMatchObject({ radius: '2px', stored: 'nova', theme: 'nova' });
  expect(novaStyles.fontFamily).toContain('Open Sans Tangible Theme');

  await selectUiTheme(page, 'IBM Carbon v11');
  await expect(page.locator('#app')).toHaveAttribute('data-ui-theme', 'carbon');
  expect(await visiblePositionIds()).toEqual(tangibleRows);
  expect(await columnLabels()).toEqual(tangibleColumns);
  const carbonSignature = await visualSignature();
  expect(carbonSignature).toMatchObject({
    activeTab: {
      background: 'rgb(255, 255, 255)',
      borderTopColor: 'rgb(15, 98, 254)',
      borderTopWidth: '2px',
      boxShadow: 'none',
    },
    avatarRadius: '0px',
    headerBackground: 'rgb(224, 224, 224)',
    inactiveTabBackground: 'rgb(224, 224, 224)',
    nameBackground: 'rgba(0, 0, 0, 0)',
    namePadding: '0px',
    numericAlignment: 'left',
    pointerDisplay: 'none',
    rowBackgrounds: ['rgb(255, 255, 255)', 'rgb(255, 255, 255)'],
    rowHeight: 92,
    tableBorderSpacing: '0px',
    toolbarBackground: 'rgb(224, 224, 224)',
    topbarBackground: 'rgb(22, 22, 22)',
  });
  expect(carbonSignature.iconMask).toContain('/icons/carbon/search.svg');
  expect(carbonSignature).not.toEqual(novaSignature);
  const carbonStyles = await page.evaluate(() => ({
    background: getComputedStyle(document.querySelector('.app-shell')!).backgroundColor,
    fontFamily: getComputedStyle(document.querySelector('.app-root')!).fontFamily,
    radius: getComputedStyle(document.querySelector('.design-system-button')!).borderRadius,
    stored: localStorage.getItem('tangible.ui-theme'),
    theme: window.__TANGIBLE_DIAGNOSTICS__.uiTheme,
  }));
  expect(carbonStyles).toMatchObject({
    background: 'rgb(244, 244, 244)',
    radius: '0px',
    stored: 'carbon',
    theme: 'carbon',
  });
  expect(carbonStyles.fontFamily).toContain('IBM Plex Sans Tangible Theme');

  await selectUiTheme(page, 'Cloudscape');
  await expect(page.locator('#app')).toHaveAttribute('data-ui-theme', 'cloudscape');
  expect(await visiblePositionIds()).toEqual(tangibleRows);
  expect(await columnLabels()).toEqual(tangibleColumns);
  const cloudscapeSignature = await visualSignature();
  expect(cloudscapeSignature).toMatchObject({
    activeTab: {
      background: 'rgba(0, 0, 0, 0)',
      borderTopWidth: '0px',
      boxShadow: 'none',
    },
    avatarRadius: '6px',
    headerBackground: 'rgb(242, 243, 243)',
    inactiveTabBackground: 'rgba(0, 0, 0, 0)',
    nameBackground: 'rgba(0, 0, 0, 0)',
    namePadding: '0px',
    numericAlignment: 'right',
    pointerDisplay: 'none',
    rowBackgrounds: ['rgb(255, 255, 255)', 'rgb(255, 255, 255)'],
    tableBorderSpacing: '0px',
    toolbarBackground: 'rgb(255, 255, 255)',
    topbarBackground: 'rgb(15, 27, 42)',
  });
  expect(cloudscapeSignature.rowHeight).toBeGreaterThanOrEqual(88);
  expect(cloudscapeSignature.rowHeight).toBeLessThanOrEqual(89);
  expect(cloudscapeSignature.iconMask).toContain('/icons/cloudscape/search.svg');
  expect(cloudscapeSignature).not.toEqual(carbonSignature);
  const cloudscapeStyles = await page.evaluate(() => ({
    background: getComputedStyle(document.querySelector('.app-shell')!).backgroundColor,
    fontFamily: getComputedStyle(document.querySelector('.app-root')!).fontFamily,
    radius: getComputedStyle(document.querySelector('.design-system-button')!).borderRadius,
    stored: localStorage.getItem('tangible.ui-theme'),
    theme: window.__TANGIBLE_DIAGNOSTICS__.uiTheme,
  }));
  expect(cloudscapeStyles).toMatchObject({
    background: 'rgb(242, 243, 243)',
    radius: '8px',
    stored: 'cloudscape',
    theme: 'cloudscape',
  });
  expect(cloudscapeStyles.fontFamily).toContain('Open Sans Tangible Theme');

  await selectUiTheme(page, 'Coinbase CDS');
  await expect(page.locator('#app')).toHaveAttribute('data-ui-theme', 'coinbase');
  expect(await visiblePositionIds()).toEqual(tangibleRows);
  expect(await columnLabels()).toEqual(tangibleColumns);
  const coinbaseSignature = await visualSignature();
  expect(coinbaseSignature).toMatchObject({
    activeTab: {
      background: 'rgb(255, 255, 255)',
      borderTopWidth: '0px',
    },
    avatarRadius: '50%',
    headerBackground: 'rgb(245, 247, 250)',
    inactiveTabBackground: 'rgba(0, 0, 0, 0)',
    nameBackground: 'rgba(0, 0, 0, 0)',
    namePadding: '0px',
    numericAlignment: 'right',
    pointerDisplay: 'none',
    rowBackgrounds: ['rgb(255, 255, 255)', 'rgb(255, 255, 255)'],
    tableBorderSpacing: '0px',
    toolbarBackground: 'rgb(255, 255, 255)',
    topbarBackground: 'rgba(0, 0, 0, 0)',
  });
  expect(coinbaseSignature.rowHeight).toBeGreaterThanOrEqual(103);
  expect(coinbaseSignature.rowHeight).toBeLessThanOrEqual(104);
  expect(coinbaseSignature.activeTab.boxShadow).toContain('rgba(10, 11, 13, 0.12)');
  expect(coinbaseSignature.iconMask).toContain('/icons/coinbase/search.svg');
  expect(coinbaseSignature).not.toEqual(cloudscapeSignature);
  const coinbaseStyles = await page.evaluate(() => ({
    background: getComputedStyle(document.querySelector('.app-shell')!).backgroundColor,
    fontFamily: getComputedStyle(document.querySelector('.app-root')!).fontFamily,
    radius: getComputedStyle(document.querySelector('.design-system-button')!).borderRadius,
    stored: localStorage.getItem('tangible.ui-theme'),
    theme: window.__TANGIBLE_DIAGNOSTICS__.uiTheme,
  }));
  expect(coinbaseStyles).toMatchObject({
    background: 'rgb(255, 255, 255)',
    radius: '999px',
    stored: 'coinbase',
    theme: 'coinbase',
  });
  expect(coinbaseStyles.fontFamily).toContain('Helvetica Neue');

  await page.reload();
  await settleMotion(page);
  await expect(page.locator('#app')).toHaveAttribute('data-ui-theme', 'coinbase');
  await selectUiTheme(page, 'DS Tangible');
  await expect(page.locator('#app')).toHaveAttribute('data-ui-theme', 'tangible');
  const tangibleReturn = await page.evaluate(() => ({
    bodyTheme: document.body.getAttribute('data-ui-theme'),
    fontFamily: getComputedStyle(document.querySelector('.app-root')!).fontFamily,
    htmlTheme: document.documentElement.getAttribute('data-ui-theme'),
    stored: localStorage.getItem('tangible.ui-theme'),
  }));
  expect(tangibleReturn).toMatchObject({ bodyTheme: null, htmlTheme: null, stored: 'tangible' });
  expect(tangibleReturn.fontFamily).toContain('General Sans');
});

test('Nova, Cloudscape and Coinbase align the indicative-range stack to one left edge', async ({
  page,
}) => {
  for (const theme of ['Visa Nova', 'Cloudscape', 'Coinbase CDS'] as const) {
    await selectUiTheme(page, theme);

    const alignment = await page.evaluate(() => {
      const header = document.querySelector<HTMLElement>('th.column-range')!;
      const headerLabel = header.querySelector<HTMLElement>('.sort-label')!;
      const unavailable = document.querySelector<HTMLElement>(
        'tbody tr:nth-child(1) td.column-range .semantic-empty',
      )!;
      const range = document.querySelector<HTMLElement>(
        'tbody tr:nth-child(2) td.column-range .range-cell',
      )!;
      const rangeLink = range.querySelector<HTMLElement>('.market-value-link')!;
      const valuation = range.querySelector<HTMLElement>('small')!;

      return {
        headerLeft: headerLabel.getBoundingClientRect().left,
        headerTextAlign: getComputedStyle(header).textAlign,
        rangeAlignItems: getComputedStyle(range).alignItems,
        rangeLeft: rangeLink.getBoundingClientRect().left,
        rangeTextAlign: getComputedStyle(range.closest('td')!).textAlign,
        unavailableLeft: unavailable.getBoundingClientRect().left,
        valuationLeft: valuation.getBoundingClientRect().left,
        valuationTextAlign: getComputedStyle(valuation).textAlign,
      };
    });

    expect(alignment, theme).toMatchObject({
      headerTextAlign: 'left',
      rangeAlignItems: 'flex-start',
      rangeTextAlign: 'left',
      valuationTextAlign: 'left',
    });
    expect(alignment.unavailableLeft, theme).toBeCloseTo(alignment.headerLeft, 1);
    expect(alignment.rangeLeft, theme).toBeCloseTo(alignment.headerLeft, 1);
    expect(alignment.valuationLeft, theme).toBeCloseTo(alignment.headerLeft, 1);
  }
});

test('alternative themes keep mobile headings compact and wrap operational views', async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 1469 });
  await page.locator('[data-page-size]').selectOption('5');

  for (const theme of ['Visa Nova', 'IBM Carbon v11', 'Cloudscape', 'Coinbase CDS'] as const) {
    await selectUiTheme(page, theme);

    const layout = await page.evaluate(() => {
      const title = document.querySelector<HTMLElement>('.workspace-title-row h2')!;
      const freshness = document.querySelector<HTMLElement>('.freshness')!;
      const workspace = document.querySelector<HTMLElement>('.workspace-head')!;
      const operationalViews = document.querySelector<HTMLElement>('.operational-views')!;
      const tools = document.querySelector<HTMLElement>('.mobile-tools')!;
      const buttons = [...operationalViews.querySelectorAll<HTMLElement>('.view-filter')];
      const titleBounds = title.getBoundingClientRect();
      const freshnessBounds = freshness.getBoundingClientRect();
      const operationalBounds = operationalViews.getBoundingClientRect();
      const toolsBounds = tools.getBoundingClientRect();
      const operationalStyle = getComputedStyle(operationalViews);
      const buttonBounds = buttons.map((button) => button.getBoundingClientRect());

      return {
        buttonRows: new Set(buttonBounds.map((bounds) => Math.round(bounds.top))).size,
        buttonsInside:
          buttonBounds.every(
            (bounds) =>
              bounds.left >= operationalBounds.left - 0.5 &&
              bounds.right <= operationalBounds.right + 0.5,
          ) && operationalViews.scrollWidth <= operationalViews.clientWidth + 1,
        documentFits: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
        flexWrap: operationalStyle.flexWrap,
        headingFontSize: getComputedStyle(title).fontSize,
        headingLineHeight: getComputedStyle(title).lineHeight,
        headingPrecedesFreshness: titleBounds.right <= freshnessBounds.left,
        overflowX: operationalStyle.overflowX,
        toolsFollowViews: toolsBounds.top >= operationalBounds.bottom + 8,
        workspaceFits: workspace.scrollWidth <= workspace.clientWidth + 1,
      };
    });

    expect(layout, theme).toMatchObject({
      buttonsInside: true,
      documentFits: true,
      flexWrap: 'wrap',
      headingFontSize: '20px',
      headingLineHeight: '24px',
      headingPrecedesFreshness: true,
      overflowX: 'visible',
      toolsFollowViews: true,
      workspaceFits: true,
    });
    expect(layout.buttonRows, theme).toBeGreaterThanOrEqual(2);
  }
});

test('desktop columns stay proportional and inside the viewport across breakpoints', async ({
  page,
}) => {
  const desktopWidths = [1440, 1280, 1221] as const;
  const standardShares = [17, 16, 8, 11, 11, 11, 9, 8, 9];
  const mediumShares = [17, 16, 8, 11, 11, 11.5, 9, 7.5, 9];
  const narrowShares = [17, 16, 8, 11, 11, 12, 9, 7, 9];

  for (const width of desktopWidths) {
    await page.setViewportSize({ width, height: 1269 });
    await page.goto('/');
    await settleMotion(page);
    await page.locator('[data-page-size]').selectOption('5');
    await expect(page.locator('#app')).toHaveAttribute('data-layout', 'desktop');

    const metrics = await page.evaluate(() => {
      const table = document.querySelector<HTMLTableElement>('table');
      const flow = document.querySelector<HTMLElement>('.table-flow');
      const row = document.querySelector<HTMLTableRowElement>('tbody tr');
      if (!table || !flow || !row) throw new Error('Missing responsive table target');
      const tableBounds = table.getBoundingClientRect();
      const cellShares = [...row.cells].map(
        (cell) => (cell.getBoundingClientRect().width / tableBounds.width) * 100,
      );
      const overflowCells = [...document.querySelectorAll<HTMLElement>('tbody td')]
        .filter((cell) => cell.scrollWidth > cell.clientWidth + 1)
        .map((cell) => ({
          className: cell.className,
          clientWidth: cell.clientWidth,
          scrollWidth: cell.scrollWidth,
          text: cell.textContent?.trim().replace(/\s+/g, ' ').slice(0, 80),
        }));
      const lineCount = (selector: string): number[] =>
        [...document.querySelectorAll<HTMLElement>(selector)].map((element) => {
          const lineHeight = Number.parseFloat(getComputedStyle(element).lineHeight);
          return Math.round(element.getBoundingClientRect().height / lineHeight);
        });
      const wrappedHeaderAlignments = [...document.querySelectorAll<HTMLElement>('th .sort-label')]
        .filter((label) => {
          const lineHeight = Number.parseFloat(getComputedStyle(label).lineHeight);
          return label.getBoundingClientRect().height > lineHeight + 1;
        })
        .map((label) => getComputedStyle(label).textAlign);
      return {
        cellShares,
        clientIdLines: lineCount('.column-client .copy-link > span'),
        documentClientWidth: document.documentElement.clientWidth,
        documentScrollWidth: document.documentElement.scrollWidth,
        flowClientWidth: flow.clientWidth,
        flowScrollWidth: flow.scrollWidth,
        overflowCells,
        positionNameLines: lineCount('.column-position .identity strong'),
        tableLeft: tableBounds.left,
        tableRight: tableBounds.right,
        wrappedHeaderAlignments,
      };
    });

    expect(metrics.documentScrollWidth).toBe(metrics.documentClientWidth);
    expect(metrics.flowScrollWidth).toBe(metrics.flowClientWidth);
    expect(metrics.tableLeft).toBeGreaterThanOrEqual(0);
    expect(metrics.tableRight).toBeLessThanOrEqual(width);
    expect(metrics.overflowCells).toEqual([]);
    expect(metrics.wrappedHeaderAlignments.every((alignment) => alignment === 'left')).toBe(true);

    const expectedShares =
      width <= 1240 ? narrowShares : width <= 1280 ? mediumShares : standardShares;
    metrics.cellShares.forEach((share, index) =>
      expect(share).toBeCloseTo(expectedShares[index]!, 0),
    );
  }

  await page.setViewportSize({ width: 720, height: 1269 });
  await page.goto('/');
  await settleMotion(page);
  await expect(page.locator('#app')).toHaveAttribute('data-layout', 'mobile');
  const phoneWidth = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  expect(phoneWidth.scroll).toBe(phoneWidth.client);
});

test('tablet uses compact controls and a contained horizontally scrollable table', async ({
  page,
}) => {
  for (const width of [1220, 1024, 768]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await settleMotion(page);
    await page.locator('[data-page-size]').selectOption('5');

    await expect(page.locator('#app')).toHaveAttribute('data-layout', 'desktop');
    await expect(page.locator('#app')).toHaveAttribute('data-viewport', 'tablet');
    await expect(page.locator('.mobile-tools')).toBeVisible();
    await expect(page.locator('.desktop-tools')).toHaveCount(0);
    await expect(page.getByRole('table')).toBeVisible();
    await expect(page.locator('.position-card')).toHaveCount(0);
    const tabletScrollbar = page.getByRole('scrollbar', {
      name: 'Scroll positions table horizontally',
    });
    await expect(tabletScrollbar).toBeVisible();
    await expect(tabletScrollbar).toHaveAttribute('aria-controls', 'tablet-table-flow');

    const metrics = await page.evaluate(() => {
      const flow = document.querySelector<HTMLElement>('.table-flow');
      const region = document.querySelector<HTMLElement>('.table-region');
      const table = document.querySelector<HTMLTableElement>('table');
      if (!flow || !region || !table) throw new Error('Missing tablet table target');
      const regionBounds = region.getBoundingClientRect();
      return {
        documentClientWidth: document.documentElement.clientWidth,
        documentScrollWidth: document.documentElement.scrollWidth,
        flowClientWidth: flow.clientWidth,
        flowOverflowX: getComputedStyle(flow).overflowX,
        flowScrollWidth: flow.scrollWidth,
        regionLeft: regionBounds.left,
        regionRight: regionBounds.right,
        tableWidth: table.getBoundingClientRect().width,
        tabIndex: flow.tabIndex,
      };
    });

    expect(metrics.documentScrollWidth).toBe(metrics.documentClientWidth);
    expect(metrics.regionLeft).toBeGreaterThanOrEqual(0);
    expect(metrics.regionRight).toBeLessThanOrEqual(width);
    expect(metrics.flowOverflowX).toBe('auto');
    expect(metrics.flowScrollWidth).toBeGreaterThan(metrics.flowClientWidth);
    expect(metrics.tableWidth).toBeCloseTo(1320, 0);
    expect(metrics.tabIndex).toBe(0);

    const flow = page.locator('.table-flow');
    await flow.evaluate((element) => element.scrollTo({ left: 160, behavior: 'instant' }));
    await expect
      .poll(() => flow.evaluate((element) => element.scrollLeft))
      .toBeGreaterThanOrEqual(150);
    await expect
      .poll(() => tabletScrollbar.getAttribute('aria-valuenow'))
      .toBe(String(Math.round(await flow.evaluate((element) => element.scrollLeft))));
    expect(await page.evaluate(() => window.scrollX)).toBe(0);

    const syncedHeader = await page.evaluate(() => {
      const table = document.querySelector<HTMLTableElement>('.table-flow > table');
      const stickyTable = document.querySelector<HTMLTableElement>('.tablet-sticky-header-table');
      if (!table || !stickyTable) throw new Error('Missing synchronized tablet header');
      return {
        bodyTableLeft: table.getBoundingClientRect().left,
        stickyTableLeft: stickyTable.getBoundingClientRect().left,
      };
    });
    expect(syncedHeader.stickyTableLeft).toBeCloseTo(syncedHeader.bodyTableLeft, 0);

    await page.getByRole('button', { name: 'Search positions' }).click();
    await expect(page.locator('#mobile-search')).toBeVisible();
  }

  await page.setViewportSize({ width: 1024, height: 900 });
  await page.goto('/');
  await settleMotion(page);
  const tableTop = await page
    .locator('.table-region')
    .evaluate((element) => element.getBoundingClientRect().top + window.scrollY);
  await page.evaluate((top) => window.scrollTo({ top: top + 240, behavior: 'instant' }), tableTop);
  const stickyHeaderTop = await page
    .locator('.tablet-sticky-header-viewport')
    .evaluate((element) => element.getBoundingClientRect().top);
  expect(stickyHeaderTop).toBeGreaterThanOrEqual(0);
  expect(stickyHeaderTop).toBeLessThanOrEqual(1);
});

test('desktop rows use document scrolling and keep column headings pinned', async ({ page }) => {
  await page.locator('[data-page-size]').selectOption('25');

  const flow = await page.locator('.table-flow').evaluate((element) => ({
    clientHeight: element.clientHeight,
    overflowY: getComputedStyle(element).overflowY,
    scrollHeight: element.scrollHeight,
  }));
  const viewport = await page.evaluate(() => ({
    clientHeight: document.documentElement.clientHeight,
    scrollHeight: document.documentElement.scrollHeight,
  }));

  expect(flow.overflowY).toBe('visible');
  expect(Math.abs(flow.scrollHeight - flow.clientHeight)).toBeLessThanOrEqual(1);
  expect(viewport.scrollHeight).toBeGreaterThan(viewport.clientHeight);

  await page.locator('.table-region').evaluate((element) => {
    window.scrollTo({
      top: element.getBoundingClientRect().top + window.scrollY + 240,
      behavior: 'instant',
    });
  });
  await expect
    .poll(() =>
      page
        .locator('th')
        .first()
        .evaluate((header) => header.getBoundingClientRect().top),
    )
    .toBe(0);

  await expect(page.locator('.prototype-chip')).toHaveCount(0);
  await page.keyboard.press('Shift+D');
  await expect(page.getByRole('dialog', { name: 'Prototype status' })).toBeVisible();
});

test('@visual desktop and mobile compositions remain stable', async ({ page }) => {
  await page.locator('[data-page-size]').selectOption('5');
  await expect(page).toHaveScreenshot('tangible-grid-desktop.png');

  await page.getByRole('button', { name: 'Show mobile layout' }).click();
  await expect(page).toHaveScreenshot('tangible-grid-mobile-review.png');
});

test('@visual Visa Nova desktop and mobile compositions remain stable', async ({ page }) => {
  await page.locator('[data-page-size]').selectOption('5');
  await selectUiTheme(page, 'Visa Nova');
  await expect(page).toHaveScreenshot('visa-nova-grid-desktop.png');

  await page.getByRole('button', { name: 'Show mobile layout' }).click();
  await settleMotion(page, '.app-shell');
  await expect(page).toHaveScreenshot('visa-nova-grid-mobile-review.png');
});

test('@visual IBM Carbon v11 desktop and mobile compositions remain stable', async ({ page }) => {
  await page.locator('[data-page-size]').selectOption('5');
  await selectUiTheme(page, 'IBM Carbon v11');
  await expect(page).toHaveScreenshot('ibm-carbon-grid-desktop.png');

  await page.getByRole('button', { name: 'Show mobile layout' }).click();
  await settleMotion(page, '.app-shell');
  await expect(page).toHaveScreenshot('ibm-carbon-grid-mobile-review.png');
});

test('@visual Cloudscape desktop and mobile compositions remain stable', async ({ page }) => {
  await page.locator('[data-page-size]').selectOption('5');
  await selectUiTheme(page, 'Cloudscape');
  await expect(page).toHaveScreenshot('cloudscape-grid-desktop.png');

  await page.getByRole('button', { name: 'Show mobile layout' }).click();
  await settleMotion(page, '.app-shell');
  await expect(page).toHaveScreenshot('cloudscape-grid-mobile-review.png');
});

test('@visual Coinbase CDS desktop and mobile compositions remain stable', async ({ page }) => {
  await page.locator('[data-page-size]').selectOption('5');
  await selectUiTheme(page, 'Coinbase CDS');
  await expect(page).toHaveScreenshot('coinbase-cds-grid-desktop.png');

  await page.getByRole('button', { name: 'Show mobile layout' }).click();
  await settleMotion(page, '.app-shell');
  await expect(page).toHaveScreenshot('coinbase-cds-grid-mobile-review.png');
});

test('@visual design-system dropdown open state remains stable', async ({ page }) => {
  await page.getByRole('button', { name: 'DS Tangible' }).click();
  const control = page.locator('.design-system-control.is-open');
  await control.evaluate(async (element) => {
    await Promise.all(element.getAnimations().map((animation) => animation.finished));
  });
  await expect(control).toHaveScreenshot('tangible-design-system-dropdown-open.png');
});

test('new themes remain overflow-free at the native mobile viewport', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 1469 });
  await page.goto('/');
  await page.locator('[data-page-size]').selectOption('5');

  for (const theme of ['Cloudscape', 'Coinbase CDS'] as const) {
    await selectUiTheme(page, theme);
    await expect(page.locator('#app')).toHaveAttribute('data-layout', 'mobile');
    await expect(page.locator('.position-card')).toHaveCount(5);
    const dimensions = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(dimensions.scrollWidth, theme).toBe(dimensions.clientWidth);
  }
});

test('@visual native mobile viewport reflows without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 1469 });
  await page.goto('/');
  await page.locator('[data-page-size]').selectOption('5');

  await expect(page.locator('#app')).toHaveAttribute('data-layout', 'mobile');
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBe(dimensions.clientWidth);
  await expect(page).toHaveScreenshot('tangible-grid-mobile-native.png');
});

test('@visual tablet keeps the full grid with compact controls and a visible scroll rail', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1220, height: 1269 });
  await page.goto('/');
  await page.locator('[data-page-size]').selectOption('5');
  await settleMotion(page);

  await expect(page.locator('#app')).toHaveAttribute('data-viewport', 'tablet');
  await expect(page.getByRole('scrollbar')).toBeVisible();
  await expect(page).toHaveScreenshot('tangible-grid-tablet.png', { fullPage: true });
});

test('@webkit desktop table body remains visibly painted', async ({ page, browserName }) => {
  test.skip(browserName !== 'webkit', 'Safari/WebKit paint regression');
  await page.locator('[data-page-size]').selectOption('5');

  await expect(page.locator('tbody tr')).toHaveCount(5);
  await expect(page.locator('.table-region')).toHaveScreenshot('tangible-grid-table-webkit.png');
});
