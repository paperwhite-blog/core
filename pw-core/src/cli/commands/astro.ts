import { spawn } from 'node:child_process';
import { defineCommand } from 'citty';
import pc from 'picocolors';
import path from 'node:path';
import { astroBin, resolveSite } from '../site.ts';
import { ensureAstroRoot } from '../astro-root.ts';
import { cachedUpdateNotice } from './update.ts';

const siteArg = { type: 'string', description: 'Site folder (default: nearest paperwhite.config.yaml)' } as const;

function run(args: string[], site: string | undefined, env: Record<string, string> = {}): Promise<number> {
  const root = resolveSite(site);
  if (root !== process.cwd()) console.log(pc.dim(`site: ${path.relative(process.cwd(), root) || '.'}`));
  const astroRoot = ensureAstroRoot(root);
  // once a day, one line, never blocking: is a newer core available?
  void cachedUpdateNotice(root).then((n) => n && console.log(pc.yellow(n)));
  return new Promise((resolve) => {
    const child = spawn(astroBin(root), [args[0]!, '--root', astroRoot, ...args.slice(1)], { stdio: 'inherit', cwd: root, env: { ...process.env, ...env } });
    child.on('exit', (code) => resolve(code ?? 1));
  });
}

export const dev = defineCommand({
  meta: { name: 'dev', description: 'Astro dev server with live reload on vault changes' },
  args: { port: { type: 'string', description: 'Port' }, host: { type: 'boolean', description: 'Expose on the network' }, open: { type: 'boolean', description: 'Open the browser' }, site: siteArg },
  async run({ args }) {
    const extra = [...(args.port ? ['--port', args.port] : []), ...(args.host ? ['--host'] : []), ...(args.open ? ['--open'] : [])];
    process.exitCode = await run(['dev', ...extra], args.site);
  },
});

export const build = defineCommand({
  meta: { name: 'build', description: 'Static build + Pagefind index + SEO audit' },
  args: { strict: { type: 'boolean', description: 'Fail on SEO audit errors (CI)' }, site: siteArg },
  async run({ args }) {
    process.exitCode = await run(['build'], args.site, args.strict ? { PAPERWHITE_STRICT: '1' } : {});
  },
});

export const preview = defineCommand({
  meta: { name: 'preview', description: 'Serve the built site locally' },
  args: { port: { type: 'string', description: 'Port' }, open: { type: 'boolean', description: 'Open the browser' }, site: siteArg },
  async run({ args }) {
    process.exitCode = await run(['preview', ...(args.port ? ['--port', args.port] : []), ...(args.open ? ['--open'] : [])], args.site);
  },
});
