import type { ResolvedConfig } from '../config.ts';
import { slugify, encodePath } from '../i18n/slug.ts';

/** Pure URL helpers shared by the loader and the routes (no Node APIs). */

function dirname(p: string): string {
  const i = p.lastIndexOf('/');
  return i <= 0 ? '.' : p.slice(0, i);
}

export function noteUrl(
  config: ResolvedConfig,
  n: { type: 'post' | 'page'; slug: string; lang: string; date?: Date; relPath: string },
): string {
  let p: string;
  if (n.type === 'page') p = `/${n.slug}/`;
  else {
    const d = n.date;
    switch (config.permalink) {
      case '/:year/:slug/':
        p = d ? `/${d.getUTCFullYear()}/${n.slug}/` : `/${n.slug}/`;
        break;
      case '/:year/:month/:slug/':
        p = d ? `/${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${n.slug}/` : `/${n.slug}/`;
        break;
      case 'folder': {
        const rel = n.relPath.startsWith(`${config.dirs.posts}/`) ? n.relPath.slice(config.dirs.posts.length + 1) : n.relPath;
        const folder = dirname(rel);
        p = folder === '.' ? `/${n.slug}/` : `/${folder.split('/').map(slugify).join('/')}/${n.slug}/`;
        break;
      }
      default:
        p = `/${n.slug}/`;
    }
  }
  return localizePath(config, p, n.lang);
}

export function localizePath(config: ResolvedConfig, p: string, lang: string): string {
  const prefix =
    config.locales.routing === 'prefix-all' || lang !== config.locales.default ? `/${lang}` : '';
  let out = `${prefix}${p}`.replace(/\/{2,}/g, '/');
  if (!config.trailingSlash && out.length > 1) out = out.replace(/\/$/, '');
  return out;
}

export function tagPath(config: ResolvedConfig, tag: string, lang: string): string {
  return localizePath(config, `/tags/${tag.split('/').map(slugify).join('/')}/`, lang);
}

export function href(p: string): string {
  return encodePath(p);
}


export function taxonomyPath(config: ResolvedConfig, kind: 'categories' | 'authors' | 'series', name: string, lang: string): string {
  return localizePath(config, `/${kind}/${slugify(name)}/`, lang);
}

export function paginatedPath(config: ResolvedConfig, base: string, page: number): string {
  if (page <= 1) return base;
  const b = base.endsWith('/') ? base : `${base}/`;
  return `${b}page/${page}${config.trailingSlash ? '/' : ''}`;
}

export function homePath(config: ResolvedConfig, lang: string): string {
  return localizePath(config, '/', lang);
}
