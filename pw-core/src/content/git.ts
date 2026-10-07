import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);

/**
 * Last-commit date per file, from a single `git log` walk (not one spawn per file).
 * Returns an empty map when the vault is not inside a git repository.
 */
export async function gitLastUpdated(dir: string): Promise<Map<string, Date>> {
  const map = new Map<string, Date>();
  try {
    const { stdout: top } = await run('git', ['rev-parse', '--show-toplevel'], { cwd: dir });
    const root = top.trim();
    // Newest first, with rename detection: a pure rename (R100) is not a content change, so the
    // new path inherits the date of the last commit that touched the old one. The walk is not
    // limited to the vault path: a rename from outside it only shows up as a rename without a pathspec.
    const { stdout } = await run('git', ['log', '--name-status', '-M', '--format=%x00%cI'], {
      cwd: dir,
      maxBuffer: 256 * 1024 * 1024,
    });
    const prefix = `${path.relative(root, path.resolve(dir)).split(path.sep).join('/')}/`.replace(/^\/+/, '');
    const inVault = (p: string) => prefix === '/' || p.startsWith(prefix);
    const alias = new Map<string, string>();
    const canonical = (p: string): string => {
      let cur = p;
      for (let i = 0; i < 100 && alias.has(cur); i++) cur = alias.get(cur)!;
      return cur;
    };
    const record = (p: string, date: Date) => {
      const to = canonical(p);
      if (!inVault(to)) return;
      const abs = path.join(root, to);
      if (!map.has(abs)) map.set(abs, date);
    };
    let current: Date | undefined;
    for (const line of stdout.split('\n')) {
      if (line.startsWith('\u0000')) {
        current = new Date(line.slice(1));
        continue;
      }
      if (!line.trim() || !current) continue;
      const [status, a, b] = line.split('\t') as [string, string, string | undefined];
      if (status.startsWith('R') && b) {
        const similarity = Number(status.slice(1) || '0');
        const to = canonical(b);
        if (similarity < 100 && inVault(to) && !map.has(path.join(root, to))) map.set(path.join(root, to), current);
        alias.set(a, to);
      } else if (status.startsWith('C') && b) {
        record(b, current);
      } else if (!status.startsWith('D')) record(a, current);
    }
  } catch {
    /* not a git repo or git missing */
  }
  return map;
}
