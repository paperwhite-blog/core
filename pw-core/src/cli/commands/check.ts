import path from 'node:path';
import { defineCommand } from 'citty';
import pc from 'picocolors';
import { buildVault } from '../../content/vault.ts';
import { auditVault } from '../../seo/audit.ts';
import { loadSiteConfig, resolveSite } from '../site.ts';
import { checkExternalLinks, extractExternalLinks } from '../external.ts';

export const check = defineCommand({
  meta: { name: 'check', description: 'Check links, frontmatter, images and orphans without building' },
  args: {
    external: { type: 'boolean', description: 'Also check external links (cached for 7 days)' },
    force: { type: 'boolean', description: 'Ignore the external link cache' },
    strict: { type: 'boolean', description: 'Exit non-zero on warnings too' },
    json: { type: 'boolean', description: 'Print the report as JSON' },
    site: { type: 'string', description: 'Site folder (default: nearest paperwhite.config.ts)' },
  },
  async run({ args }) {
    const root = resolveSite(args.site);
    const config = await loadSiteConfig(root);
    const cacheDir = path.join(root, '.paperwhite');
    const t0 = Date.now();
    const result = await buildVault(config, { cacheDir });
    const issues = auditVault(result, config);
    if (args.external) {
      const links = new Map<string, string[]>();
      for (const n of result.notes) for (const u of extractExternalLinks(n.html)) links.set(u, [...(links.get(u) ?? []), n.data.path]);
      const ext = await checkExternalLinks(links, cacheDir, { force: args.force });
      for (const r of ext.filter((x) => !x.ok)) {
        for (const src of r.sources) issues.push({ level: 'error', rule: 'broken-external-link', page: src, message: `${r.url} → ${r.status}${r.error ? ` (${r.error})` : ''}` });
      }
      if (!args.json) console.log(pc.dim(`checked ${ext.length} external links`));
    }
    const errors = issues.filter((i) => i.level === 'error');
    const warnings = issues.filter((i) => i.level === 'warning');
    if (args.json) {
      console.log(JSON.stringify({ notes: result.notes.length, excluded: result.excluded, errors: errors.length, warnings: warnings.length, issues }, null, 2));
    } else {
      for (const i of [...errors, ...warnings]) {
        const icon = i.level === 'error' ? pc.red('✖') : pc.yellow('▲');
        console.log(`${icon} ${pc.bold(i.rule)} ${pc.dim(i.page)} — ${i.message}`);
      }
      console.log(
        `\n${result.notes.length} notes · ${result.excluded.length} excluded · ${pc.red(`${errors.length} errors`)} · ${pc.yellow(`${warnings.length} warnings`)} · ${Date.now() - t0}ms`,
      );
    }
    if (errors.length || (args.strict && warnings.length)) process.exitCode = 1;
  },
});
