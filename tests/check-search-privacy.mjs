import { readFile } from 'node:fs/promises';
import { URL } from 'node:url';

const directive = 'noindex, nofollow, nosnippet, noimageindex';
const expectedTags = [
  `<meta name="robots" content="${directive}" />`,
  `<meta name="googlebot" content="${directive}" />`,
];

for (const file of ['index.html', 'dist/index.html']) {
  const html = await readFile(new URL(`../${file}`, import.meta.url), 'utf8');
  for (const tag of expectedTags) {
    if (!html.includes(tag)) throw new Error(`${file} is missing required directive: ${tag}`);
  }
  if (html.includes('name="description"')) {
    throw new Error(`${file} must not expose a search-oriented meta description`);
  }
}
