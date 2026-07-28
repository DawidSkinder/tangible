import { lstat, readFile, readdir } from 'node:fs/promises';
import { extname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const allowedTopLevel = new Set([
  '.github',
  '.gitignore',
  '.prettierignore',
  '.prettierrc.json',
  '- START.md',
  'README.md',
  'eslint.config.js',
  'index.html',
  'package-lock.json',
  'package.json',
  'playwright.config.ts',
  'public',
  'scripts',
  'src',
  'tests',
  'tsconfig.json',
  'vite.config.ts',
  'vitest.config.ts',
]);
const ignoredDirectories = new Set([
  '.git',
  'coverage',
  'dist',
  'node_modules',
  'playwright-report',
  'test-results',
]);
const forbiddenNames = ['AGENTS.md', '- GITHUB FLOW.md', '- KNOWLEDGE', '- PROMPTS.md'];
const forbiddenExtensions = new Set(['.pdf']);
const textExtensions = new Set([
  '.css',
  '.html',
  '.js',
  '.json',
  '.md',
  '.mjs',
  '.ts',
  '.txt',
  '.yaml',
  '.yml',
]);
const forbiddenContent = [
  { label: 'absolute local user path', pattern: /\/Users\/[A-Za-z0-9._-]+\// },
  { label: 'GitHub token', pattern: /(?:ghp_|github_pat_)[A-Za-z0-9_]+/ },
  { label: 'OpenAI secret key', pattern: /\bsk-[A-Za-z0-9_-]{20,}\b/ },
  { label: 'private key', pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { label: 'internal knowledge path', pattern: /(?:^|[/'"])- KNOWLEDGE(?:\/|$)/m },
  { label: 'internal prompt path', pattern: /(?:^|[/'"])- PROMPTS\.md\b/m },
];
const maxFileBytes = 5 * 1024 * 1024;

async function walk(directory, files = []) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name === '.DS_Store') {
      throw new Error(`Forbidden macOS metadata: ${entry.name}`);
    }
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
    const url = new URL(`${entry.name}${entry.isDirectory() ? '/' : ''}`, directory);
    if (entry.isDirectory()) await walk(url, files);
    else if (entry.isFile()) files.push(url);
  }
  return files;
}

const files = await walk(root);
const failures = [];

for (const file of files) {
  const path = relative(fileURLToPath(root), fileURLToPath(file)).split(sep).join('/');
  const topLevel = path.split('/')[0];
  if (!allowedTopLevel.has(topLevel)) failures.push(`${path}: top-level path is not allowlisted`);
  if (forbiddenNames.some((name) => path.includes(name))) {
    failures.push(`${path}: forbidden internal source`);
  }
  if (forbiddenExtensions.has(extname(path).toLowerCase())) {
    failures.push(`${path}: forbidden document type`);
  }

  const stats = await lstat(file);
  if (stats.size > maxFileBytes) failures.push(`${path}: exceeds 5 MiB`);
  if (!textExtensions.has(extname(path)) || path === 'scripts/audit-release.mjs') continue;

  const contents = await readFile(file, 'utf8');
  for (const check of forbiddenContent) {
    if (check.pattern.test(contents)) failures.push(`${path}: contains ${check.label}`);
  }
}

if (failures.length > 0) {
  throw new Error(`Release audit failed:\n- ${failures.join('\n- ')}`);
}

console.log(`Release audit passed for ${files.length} files.`);
