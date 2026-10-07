import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolveConfig, type PaperwhiteUserConfig } from '../src/config.ts';
import { buildVault, type VaultResult } from '../src/content/vault.ts';

export const repoRoot = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../../..');
export const fixtureVault = path.join(repoRoot, 'fixtures/vault');

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
