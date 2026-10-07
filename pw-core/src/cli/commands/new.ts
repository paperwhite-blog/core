import fs from 'node:fs';
import path from 'node:path';
import { defineCommand } from 'citty';
import pc from 'picocolors';
import { slugify } from '../../i18n/index.ts';
import { loadSiteConfig, resolveSite } from '../site.ts';

export function noteTemplate(opts: { title: string; lang?: string; date: Date; page?: boolean; defaultLang: string }): string {
  const lines = ['---', `title: ${JSON.stringify(opts.title)}`];
  if (!opts.page) lines.push(`date: ${opts.date.toISOString().slice(0, 10)}`);
  lines.push('description: ""');
  if (!opts.page) lines.push('tags: []');
  if (opts.lang && opts.lang !== opts.defaultLang) lines.push(`lang: ${opts.lang}`);
  lines.push('draft: true', '---', '', '');
  return lines.join('\n');
}

export const newNote = defineCommand({
  meta: { name: 'new', description: 'Scaffold a note with frontmatter' },
  args: {
    title: { type: 'positional', description: 'Note title', required: true },
    lang: { type: 'string', description: 'Locale (e.g. fa)' },
    page: { type: 'boolean', description: 'Create a page instead of a post' },
    dir: { type: 'string', description: 'Sub-folder inside posts/' },
    site: { type: 'string', description: 'Site folder (default: nearest paperwhite.config.yaml)' },
  },
  async run({ args }) {
    const config = await loadSiteConfig(resolveSite(args.site));
    const base = path.join(config.contentDir, args.page ? config.dirs.pages : config.dirs.posts, args.dir ?? '', args.lang && args.lang !== config.locales.default ? args.lang : '');
    fs.mkdirSync(base, { recursive: true });
    const file = path.join(base, `${slugify(args.title) || 'untitled'}.md`);
    if (fs.existsSync(file)) {
      console.error(pc.red(`${path.relative(process.cwd(), file)} already exists`));
      process.exitCode = 1;
      return;
    }
    fs.writeFileSync(file, noteTemplate({ title: args.title, lang: args.lang, date: new Date(), page: args.page, defaultLang: config.locales.default }));
    console.log(`${pc.green('created')} ${path.relative(process.cwd(), file)}`);
  },
});
