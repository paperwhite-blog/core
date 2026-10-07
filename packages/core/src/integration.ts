import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { AstroIntegration } from 'astro';
import type { Plugin, ViteDevServer } from 'vite';
import type { IncomingMessage, ServerResponse } from 'node:http';
import tailwindcss from '@tailwindcss/vite';
import { resolveConfig, serializableConfig, type PaperwhiteUserConfig, type ResolvedConfig } from './config.ts';
import { resolveTheme, cascade, type ResolvedTheme } from './theme/resolve.ts';
import { buildStrings } from './i18n/strings.ts';
import { assetRegistry, copyAssets, loadRegistry, mimeOf, registerAsset } from './content/assets.ts';
import { runPagefind } from './build/pagefind.ts';
import { runAudit, printAudit } from './seo/audit.ts';
import { reportBudgets } from './build/budget.ts';
import { vaultState } from './content/loader.ts';

/** Native deps: kept external and imported by absolute path (the site may not depend on them directly). */
const NATIVE = new Set(['@resvg/resvg-js', 'sharp', 'pagefind', 'satori']);

const coreDir = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const require = createRequire(import.meta.url);

function registerKatex() {
  const katexDir = path.dirname(require.resolve('katex/package.json'));
  registerAsset('/_pw/katex/katex.min.css', path.join(katexDir, 'dist/katex.min.css'));
  const fonts = path.join(katexDir, 'dist/fonts');
  for (const f of fs.readdirSync(fonts)) if (f.endsWith('.woff2')) registerAsset(`/_pw/katex/fonts/${f}`, path.join(fonts, f));
}

function stylesheet(root: string, theme: ResolvedTheme): string {
  const posix = (p: string) => p.split(path.sep).join('/');
  const overrides = path.join(root, 'src/overrides/styles.css');
  return [
    `@import "tailwindcss" source(none);`,
    `@source "${posix(path.join(coreDir, 'components'))}";`,
    `@source "${posix(path.join(coreDir, 'layouts'))}";`,
    `@source "${posix(path.join(coreDir, 'routes'))}";`,
    `@source "${posix(theme.dir)}";`,
    `@source "${posix(path.join(root, 'src'))}";`,
    `@import "${posix(path.join(coreDir, 'styles/base.css'))}";`,
    fs.existsSync(path.join(theme.dir, 'styles/theme.css')) ? `@import "${posix(path.join(theme.dir, 'styles/theme.css'))}";` : '',
    fs.existsSync(overrides) ? `@import "${posix(overrides)}";` : '',
  ].join('\n');
}

function vitePlugin(config: ResolvedConfig, theme: ResolvedTheme): Plugin {
  const VIRTUAL = 'virtual:paperwhite/config';
  const RESOLVED = `\0${VIRTUAL}`;
  // A css id inside core so Tailwind resolves `tailwindcss` from core's dependencies.
  const STYLES_ID = path.join(coreDir, 'styles/__paperwhite.generated.css');
  const dirs = { site: config.root, theme: theme.dir, core: coreDir };
  const strings = Object.fromEntries(
    Object.keys(config.locales.supported).map((l) => [l, buildStrings(l, theme.manifest.i18n ?? {}, config.i18n)]),
  );
  return {
    name: 'paperwhite',
    enforce: 'pre',
    resolveId(id: string) {
      if (NATIVE.has(id) && this.environment?.name !== 'client') return { id: require.resolve(id), external: true };
      if (id === VIRTUAL) return RESOLVED;
      if (id === '@pw/styles.css') return STYLES_ID;
      if (id.startsWith('@pw/')) {
        const f = cascade(id, dirs);
        if (!f) this.error(`PaperWhite: cannot resolve ${id} (looked in src/overrides, ${theme.manifest.name}, core)`);
        return f;
      }
      return null;
    },
    load(id: string) {
      if (id === RESOLVED) {
        return [
          `export const config = ${JSON.stringify(serializableConfig(config))};`,
          `export const theme = ${JSON.stringify(theme.manifest)};`,
          `export const strings = ${JSON.stringify(strings)};`,
        ].join('\n');
      }
      if (id === STYLES_ID) return stylesheet(config.root, theme);
      return null;
    },
    configureServer(server: ViteDevServer) {
      // Serve /_pw/* (optimized images, attachments, KaTeX) in dev.
      server.middlewares.use((req: IncomingMessage, res: ServerResponse, next: () => void) => {
        const url = (req.url ?? '').split('?')[0]!;
        if (!url.startsWith('/_pw/')) return next();
        const reg = assetRegistry();
        if (!reg.size) loadRegistry(path.join(config.root, '.paperwhite'));
        const file = reg.get(url) ?? reg.get(encodeURI(decodeURI(url)));
        if (!file || !fs.existsSync(file)) return next();
        res.setHeader('Content-Type', mimeOf(file));
        res.setHeader('Cache-Control', 'no-cache');
        fs.createReadStream(file).pipe(res);
      });
    },
  };
}

const ROUTES: [pattern: string, file: string][] = [
  ['/404', '404.astro'],
  ['/[...base]/rss.xml', 'feeds/rss.xml.ts'],
  ['/[...base]/atom.xml', 'feeds/atom.xml.ts'],
  ['/[...base]/feed.json', 'feeds/feed.json.ts'],
  ['/sitemap-index.xml', 'sitemap-index.xml.ts'],
  ['/sitemap-[name].xml', 'sitemap.xml.ts'],
  ['/robots.txt', 'robots.txt.ts'],
  ['/humans.txt', 'humans.txt.ts'],
  ['/.well-known/security.txt', 'security.txt.ts'],
  ['/llms.txt', 'llms.txt.ts'],
  ['/llms-full.txt', 'llms-full.txt.ts'],
  ['/graph.json', 'graph.json.ts'],
  ['/api/posts.json', 'api/posts.json.ts'],
  ['/api/tags.json', 'api/tags.json.ts'],
  ['/_pw/previews/[id].json', 'previews.json.ts'],
  ['/og/[...id].png', 'og.png.ts'],
  ['/_redirects', 'redirects/netlify.ts'],
  ['/vercel.json', 'redirects/vercel.json.ts'],
  ['/nginx-redirects.conf', 'redirects/nginx.ts'],
  ['/[...path]', 'page.astro'],
];

export interface IntegrationOptions {
  /** Fail the build on audit errors (also `PAPERWHITE_STRICT=1`) */
  strict?: boolean;
}

export default function paperwhite(user: PaperwhiteUserConfig, opts: IntegrationOptions = {}): AstroIntegration {
  let config: ResolvedConfig;
  let theme: ResolvedTheme;
  return {
    name: '@paperwhite/core',
    hooks: {
      'astro:config:setup': async ({ config: astro, updateConfig, injectRoute, logger, addWatchFile }) => {
        const root = fileURLToPath(astro.root);
        config = resolveConfig(user, root);
        theme = resolveTheme(config.theme, root);
        logger.info(`theme ${theme.manifest.name} · vault ${path.relative(root, config.contentDir) || '.'}`);
        registerKatex();
        addWatchFile(path.join(theme.dir, 'theme.json'));
        const integrations: AstroIntegration[] = [];
        if (config.mdx) {
          try {
            // resolve from the site, not from core (strict package managers)
            const entry = createRequire(path.join(root, 'package.json')).resolve('@astrojs/mdx');
            // native import: this module may run inside Astro's config-time Vite runner, which is closed by now
            const nativeImport = new Function('u', 'return import(u)') as (u: string) => Promise<{ default: () => AstroIntegration }>;
            const { default: mdx } = await nativeImport(pathToFileURL(entry).href);
            integrations.push(mdx());
          } catch (e) {
            const msg = (e as NodeJS.ErrnoException).code === 'MODULE_NOT_FOUND' ? 'Install it: pnpm add @astrojs/mdx' : (e as Error).message;
            throw new Error(`PaperWhite: \`mdx: true\` requires @astrojs/mdx. ${msg}`);
          }
        }
        updateConfig({
          site: config.site.url,
          trailingSlash: config.trailingSlash ? 'always' : 'never',
          build: { format: config.trailingSlash ? 'directory' : 'file', inlineStylesheets: 'always' },
          prefetch: { prefetchAll: true, defaultStrategy: 'hover' },
          compressHTML: true,
          integrations,
          vite: {
            plugins: [vitePlugin(config, theme) as never, tailwindcss() as never],
            ssr: {
              noExternal: ['@paperwhite/core', /^paperwhite-theme-/, /^@paperwhite\//],
            },
          },
        });
        for (const [pattern, file] of ROUTES) {
          if (pattern === '/graph.json' && !config.graph) continue;
          if (pattern.startsWith('/api/') && !config.api) continue;
          if (pattern.startsWith('/og/') && !config.seo.ogImages) continue;
          if (pattern === '/llms.txt' || pattern === '/llms-full.txt') if (!config.seo.llms) continue;
          if (pattern === '/humans.txt' && config.seo.humans === false) continue;
          if (pattern === '/.well-known/security.txt' && !config.seo.security) continue;
          injectRoute({ pattern, entrypoint: path.join(coreDir, 'routes', file), prerender: true });
        }
      },
      'astro:build:done': async ({ dir, logger }) => {
        const out = fileURLToPath(dir);
        const t0 = Date.now();
        if (!assetRegistry().size) loadRegistry(path.join(config.root, '.paperwhite'));
        const copied = await copyAssets(out);
        logger.info(`copied ${copied} assets to /_pw/`);
        if (config.search) {
          const r = await runPagefind(out, config);
          logger.info(`pagefind: indexed ${r.pages} pages (${r.languages.join(', ')})`);
        }
        const budgets = await reportBudgets(out);
        for (const w of budgets.warnings) logger.warn(w);
        logger.info(`JS budget: max ${(budgets.maxPostJs / 1024).toFixed(1)} KB on post pages (limit 30 KB)`);
        const report = await runAudit(out, config, vaultState()?.result);
        await fsp.mkdir(path.join(config.root, '.paperwhite'), { recursive: true });
        await fsp.writeFile(path.join(config.root, '.paperwhite/audit.json'), JSON.stringify(report, null, 2));
        await fsp.writeFile(path.join(config.root, '.paperwhite/budgets.json'), JSON.stringify(budgets, null, 2));
        printAudit(report, logger);
        logger.info(`post-build steps in ${Date.now() - t0}ms`);
        const strict = opts.strict || config.seo.audit.strict || process.env.PAPERWHITE_STRICT === '1';
        if (strict && report.errors > 0) {
          throw new Error(`PaperWhite audit failed in strict mode: ${report.errors} error(s). See .paperwhite/audit.json`);
        }
      },
    },
  };
}
