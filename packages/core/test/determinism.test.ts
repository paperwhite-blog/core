import { it, expect } from 'vitest';
import { buildVault } from '../src/content/vault.ts';
import { fixtureConfig, cacheDir } from './helpers.ts';
it('derived lists are deterministic across builds', async () => {
  const runs = await Promise.all([1, 2, 3].map(() => buildVault(fixtureConfig(), { cacheDir, now: new Date('2026-01-01') })));
  const sig = (r: Awaited<ReturnType<typeof buildVault>>) => JSON.stringify(r.notes.map((n) => [n.id, n.data.backlinks.map((b) => b.id), n.data.related.map((x) => x.id)]));
  expect(sig(runs[1]!)).toBe(sig(runs[0]!));
  expect(sig(runs[2]!)).toBe(sig(runs[0]!));
});
