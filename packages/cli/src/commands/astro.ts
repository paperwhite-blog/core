import { spawn } from 'node:child_process';
import { defineCommand } from 'citty';
import { astroBin } from '../site.ts';

function run(args: string[], env: Record<string, string> = {}): Promise<number> {
  const root = process.cwd();
  return new Promise((resolve) => {
    const child = spawn(astroBin(root), args, { stdio: 'inherit', cwd: root, env: { ...process.env, ...env } });
    child.on('exit', (code) => resolve(code ?? 1));
  });
}

export const dev = defineCommand({
  meta: { name: 'dev', description: 'Astro dev server with live reload on vault changes' },
  args: { port: { type: 'string', description: 'Port' }, host: { type: 'boolean', description: 'Expose on the network' } },
  async run({ args }) {
    const extra = [...(args.port ? ['--port', args.port] : []), ...(args.host ? ['--host'] : [])];
    process.exitCode = await run(['dev', ...extra]);
  },
});

export const build = defineCommand({
  meta: { name: 'build', description: 'Static build + Pagefind index + SEO audit' },
  args: { strict: { type: 'boolean', description: 'Fail on SEO audit errors (CI)' } },
  async run({ args }) {
    process.exitCode = await run(['build'], args.strict ? { PAPERWHITE_STRICT: '1' } : {});
  },
});

export const preview = defineCommand({
  meta: { name: 'preview', description: 'Serve the built site locally' },
  args: { port: { type: 'string', description: 'Port' } },
  async run({ args }) {
    process.exitCode = await run(['preview', ...(args.port ? ['--port', args.port] : [])]);
  },
});
