export const UI_THEME_STORAGE_KEY = 'tangible.ui-theme';

export const uiThemes = [
  { id: 'tangible', label: 'DS Tangible' },
  { id: 'nova', label: 'Visa Nova' },
  { id: 'carbon', label: 'IBM Carbon v11' },
  { id: 'cloudscape', label: 'Cloudscape' },
  { id: 'coinbase', label: 'Coinbase CDS' },
] as const;

export type UiTheme = (typeof uiThemes)[number]['id'];

export function isUiTheme(value: unknown): value is UiTheme {
  return uiThemes.some((theme) => theme.id === value);
}

export function uiThemeLabel(theme: UiTheme): string {
  return uiThemes.find((candidate) => candidate.id === theme)?.label ?? 'DS Tangible';
}

export function readStoredUiTheme(storage: Storage = window.localStorage): UiTheme {
  try {
    const stored = storage.getItem(UI_THEME_STORAGE_KEY);
    return isUiTheme(stored) ? stored : 'tangible';
  } catch {
    return 'tangible';
  }
}

export function storeUiTheme(theme: UiTheme, storage: Storage = window.localStorage): void {
  try {
    storage.setItem(UI_THEME_STORAGE_KEY, theme);
  } catch {
    // Theme selection remains available for the current session when storage is unavailable.
  }
}

export function applyDocumentUiTheme(theme: UiTheme): void {
  if (theme === 'tangible') {
    delete document.documentElement.dataset.uiTheme;
    delete document.body.dataset.uiTheme;
    return;
  }

  document.documentElement.dataset.uiTheme = theme;
  document.body.dataset.uiTheme = theme;
}
