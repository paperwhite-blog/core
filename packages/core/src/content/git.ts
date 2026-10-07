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
    const { stdout } = await run('git', ['log', '--name-only', '--format=%x00%cI', '--no-renames', '--', '.'], {
      cwd: dir,
      maxBuffer: 256 * 1024 * 1024,
    });
    let current: Date | undefined;
    for (const line of stdout.split('\n')) {
      if (line.startsWith('\u0000')) current = new Date(line.slice(1));
      else if (line.trim() && current) {
        const abs = path.join(root, line.trim());
        if (!map.has(abs)) map.set(abs, current);
      }
    }
  } catch {
    /* not a git repo or git missing */
  }
  return map;
}
