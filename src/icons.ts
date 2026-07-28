export type IconName =
  | 'ai'
  | 'arrow-down'
  | 'arrow-left'
  | 'arrow-right'
  | 'arrow-up-right'
  | 'check'
  | 'chevrons'
  | 'clock'
  | 'close'
  | 'copy'
  | 'cta-arrow'
  | 'desktop'
  | 'download'
  | 'dropdown-arrow'
  | 'external-link'
  | 'filter'
  | 'info'
  | 'mobile'
  | 'more'
  | 'pagination-left'
  | 'pagination-right'
  | 'print'
  | 'search'
  | 'settings'
  | 'sort'
  | 'tools'
  | 'warning';

const paths: Record<IconName, string> = {
  ai: '<path d="M12 3l1.2 3.3L16.5 7.5l-3.3 1.2L12 12l-1.2-3.3-3.3-1.2 3.3-1.2L12 3Z"/><path d="M6 12l.7 1.9 1.8.6-1.8.7L6 18l-.7-1.8-1.8-.7 1.8-.6L6 12Z"/>',
  'arrow-down': '<path d="m6 9 6 6 6-6"/>',
  'arrow-left': '<path d="m15 18-6-6 6-6"/>',
  'arrow-right': '<path d="m9 18 6-6-6-6"/>',
  'arrow-up-right': '<path d="M7 17 17 7"/><path d="M8 7h9v9"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  chevrons: '<path d="m8 9 4-4 4 4"/><path d="m16 15-4 4-4-4"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  close: '<path d="m6 6 12 12"/><path d="m18 6-12 12"/>',
  copy: '<rect x="8" y="8" width="10" height="10" rx="1"/><path d="M15 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h2"/>',
  'cta-arrow': '',
  desktop: '<path d="M4 5h16v11H4z"/><path d="M8 20h8M12 16v4"/>',
  download: '<path d="M12 3v12m0 0 4-4m-4 4-4-4"/><path d="M5 19h14"/>',
  'dropdown-arrow': '',
  'external-link':
    '<path d="M15 3h6v6"/><path d="m10 14 11-11"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  filter: '<path d="M4 5h16l-6.5 7.2V19l-3 1v-7.8L4 5Z"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>',
  mobile: '<rect x="7" y="3" width="10" height="18" rx="2"/><path d="M10.5 6h3M11 18h2"/>',
  more: '<circle cx="12" cy="5" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="19" r="1" fill="currentColor" stroke="none"/>',
  'pagination-left': '',
  'pagination-right': '',
  print:
    '<path d="M7 8V4h10v4"/><path d="M7 17H5a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M7 14h10v6H7z"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m16 16 4 4"/>',
  settings:
    '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6 1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"/>',
  sort: '<path class="sort-arrow sort-arrow-desc" d="M8 4v16m-3-3 3 3 3-3"/><path class="sort-arrow sort-arrow-asc" d="M16 20V4m-3 3 3-3 3 3"/>',
  tools:
    '<path d="m14.7 6.3 3-3a4 4 0 0 1-5 5L5.2 15.8a2 2 0 0 1-3-3l7.5-7.5a4 4 0 0 1 5-5l-3 3 3 3Z"/><path d="m15 13 6 6-2 2-6-6"/>',
  warning: '<path d="M12 3 2.5 20h19L12 3Z"/><path d="M12 9v5M12 17h.01"/>',
};

const assetIcons: Partial<Record<IconName, string>> = {
  ai: './assets/icon-ai.svg',
  'cta-arrow': './assets/icon-cta-arrow.svg',
  'dropdown-arrow': './assets/icon-dropdown-arrow.svg',
  'pagination-left': './assets/icon-pagination-left.svg',
  'pagination-right': './assets/icon-pagination-right.svg',
  tools: './assets/icon-design-system.svg',
};

export function icon(name: IconName, size = 18): string {
  const asset = assetIcons[name];
  if (asset)
    return `<span class="icon icon-asset icon-${name}" aria-hidden="true" style="--icon-size:${size}px;--icon-mask:url('${asset}')"></span>`;
  return `<svg class="icon icon-${name}" aria-hidden="true" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${paths[name]}</svg>`;
}
