import path from 'node:path';
import { defineCommand } from 'citty';
import pc from 'picocolors';
import { readWxr, parseWxr, importWxr } from '../import/wxr.ts';
import { loadSiteConfig, resolveSite } from '../site.ts';

export const importCmd = defineCommand({
  meta: { name: 'import', description: 'Import a WordPress export (WXR .xml or .zip) into the vault' },
  args: {
    file: { type: 'positional', required: true, description: 'WordPress export file (.xml or .zip)' },
    out: { type: 'string', description: 'Vault directory (defaults to contentDir from config, or ./content)' },
    download: { type: 'boolean', description: 'Download attachments into attachments/' },
    drafts: { type: 'boolean', description: 'Import drafts as draft: true' },
    lang: { type: 'string', description: 'Set lang on imported notes' },
    site: { type: 'string', description: 'Site folder (default: nearest paperwhite.config.yaml)' },
  },
  async run({ args }) {
    const root = process.cwd();
    let siteRoot: string | undefined;
    try {
      siteRoot = resolveSite(args.site);
    } catch {}
    const outDir = args.out ? path.resolve(args.out) : siteRoot ? (await loadSiteConfig(siteRoot)).contentDir : path.join(root, 'content');
    const site = parseWxr(await readWxr(path.resolve(args.file)));
    const r = await importWxr(site, { outDir, download: args.download, drafts: args.drafts, lang: args.lang });
    console.log(
      `${pc.green('imported')} ${r.posts} posts, ${r.pages} pages, ${r.comments} comments, ${r.attachments} attachments into ${path.relative(root, outDir) || '.'}` +
        (r.skipped ? pc.dim(` (${r.skipped} skipped)`) : ''),
    );
    console.log(pc.dim('Legacy URLs (/?p=ID and old permalinks) are kept as redirect_from, emitted as redirects at build time.'));
  },
});
