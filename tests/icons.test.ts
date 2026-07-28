import { describe, expect, it } from 'vitest';
import { resolveIconAsset } from '../src/icons';

describe('icon asset URLs', () => {
  it('keeps runtime icons inside the deployed application base path', () => {
    expect(resolveIconAsset('icon-ai.svg', 'https://dawidskinder.github.io/tangible/')).toBe(
      'https://dawidskinder.github.io/tangible/assets/icon-ai.svg',
    );
  });

  it('keeps local runtime icons at the site root', () => {
    expect(resolveIconAsset('icon-ai.svg', 'http://127.0.0.1:4173/')).toBe(
      'http://127.0.0.1:4173/assets/icon-ai.svg',
    );
  });
});
