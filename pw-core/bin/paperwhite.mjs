#!/usr/bin/env node
// Prefer the bundled build; fall back to TypeScript sources (workspace / dev) via jiti.
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const dist = fileURLToPath(new URL('../dist/index.js', import.meta.url));
if (existsSync(dist)) {
  const { main } = await import(dist);
  await main();
} else {
  const { createJiti } = await import('jiti');
  const jiti = createJiti(import.meta.url, { interopDefault: true });
  const { main } = await jiti.import(fileURLToPath(new URL('../src/cli/index.ts', import.meta.url)));
  await main();
}
