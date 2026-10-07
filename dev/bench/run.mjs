// Cold build, then an incremental build after touching one note.
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const sh = (cmd) => {
  const t = Date.now();
  const out = execSync(cmd, { cwd: here, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  return { ms: Date.now() - t, out };
};
for (const d of ['dist', '.paperwhite']) fs.rmSync(path.join(here, d), { recursive: true, force: true });
const cold = sh('pnpm exec paperwhite build');
const line = (o) => o.split('\n').find((l) => l.includes('vault loaded')) ?? '';
console.log(`cold:        ${(cold.ms / 1000).toFixed(1)}s  ${line(cold.out).replace(/.*\] /, '')}`);
const f = path.join(here, 'vault/posts/post-0042.md');
fs.appendFileSync(f, `\nEdited at ${Date.now()}.\n`);
const inc = sh('pnpm exec paperwhite build');
console.log(`incremental: ${(inc.ms / 1000).toFixed(1)}s  ${line(inc.out).replace(/.*\] /, '')}`);
const pages = (inc.out.match(/(\d+) page\(s\) built/) ?? [])[1];
console.log(`pages: ${pages}`);

// Budgets from the requirements (§3). BENCH_ASSERT=0 makes the run informational.
if (process.env.BENCH_ASSERT !== '0') {
  const fails = [];
  if (cold.ms > 60_000) fails.push(`cold build ${(cold.ms / 1000).toFixed(1)}s > 60s`);
  if (inc.ms > 10_000) fails.push(`incremental build ${(inc.ms / 1000).toFixed(1)}s > 10s`);
  if (fails.length) {
    console.error(`budget exceeded: ${fails.join('; ')}`);
    process.exit(1);
  }
  console.log('budgets OK');
}
