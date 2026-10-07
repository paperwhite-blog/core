import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolveConfig, type PaperwhiteUserConfig } from '../src/config.ts';
import { buildVault, type VaultResult } from '../src/content/vault.ts';

export const repoRoot = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');
export const fixtureVault = path.join(repoRoot, 'pw-core/test/fixtures/vault');

export function fixtureConfig(extra: Partial<PaperwhiteUserConfig> = {}) {
  return resolveConfig(
    {
      site: { url: 'https://paperwhite.example', title: 'Fixture' },
      contentDir: fixtureVault,
      locales: { supported: { en: {}, fa: {} } },
      ...extra,
    },
    repoRoot,
  );
}

let cached: Promise<VaultResult> | undefined;
export const cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pw-test-'));

/** Build the fixture vault once per test file (fixed "now" so scheduled posts are deterministic). */
export function fixtureVaultResult(): Promise<VaultResult> {
  cached ??= buildVault(fixtureConfig(), { cacheDir, now: new Date('2026-01-01T00:00:00Z') });
  return cached;
}

export async function noteHtml(id: string): Promise<string> {
  const r = await fixtureVaultResult();
  const n = r.notes.find((x) => x.id === id);
  if (!n) throw new Error(`fixture note not found: ${id}`);
  return n.html;
}

/** Build a throwaway vault from a map of files. */
export async function tempVault(files: Record<string, string>, extra: Partial<PaperwhiteUserConfig> = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pw-vault-'));
  for (const [rel, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), content);
  }
  const config = resolveConfig({ site: { url: 'https://x.test', title: 'T' }, contentDir: dir, locales: { supported: { en: {}, fa: {} } }, ...extra }, dir);
  return { dir, config, result: await buildVault(config, { cacheDir: path.join(dir, '.cache') }) };
}

/** A minimal site folder for CLI tests: YAML config, sample notes, themes/ README. */
export function scaffold(opts: { dir: string; theme?: string; locales?: string[] }): string[] {
  const { dir, theme = 'paper', locales = ['en'] } = opts;
  const written: string[] = [];
  const write = (rel: string, content: string) => {
    const file = path.join(dir, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
    written.push(rel);
  };
  const supported = locales.map((l) => `    ${l}: {}`).join('\n');
  write('package.json', '{"name":"site","private":true,"type":"module"}\n');
  write(
    'paperwhite.config.yaml',
    `# A folder under themes/ (yours) or a built-in theme.\nsite:\n  url: https://example.com\n  title: My Blog\ncontentDir: ./content\nlocales:\n  default: ${locales[0]}\n  supported:\n${supported}\ntheme: ${theme}\nplugins: []\n`,
  );
  write('content/posts/hello-world.md', '---\ntitle: Hello\ndate: 2024-01-01\n---\nHi [[About]].\n');
  write('content/pages/about.md', '---\ntitle: About\n---\nAbout.\n');
  if (locales.includes('fa')) write('content/posts/fa/سلام.md', '---\ntitle: سلام\ndate: 2024-01-01\nlang: fa\n---\nسلام.\n');
  write('themes/README.md', '# themes\n');
  return written;
}
