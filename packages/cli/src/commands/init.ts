import fs from 'node:fs';
import path from 'node:path';
import { defineCommand } from 'citty';
import pc from 'picocolors';

export interface InitOptions {
  dir: string;
  theme: string;
  locales: string[];
  title?: string;
  url?: string;
  coreVersion?: string;
}

export function scaffold(opts: InitOptions): string[] {
  const { dir, theme, locales } = opts;
  const written: string[] = [];
  const write = (rel: string, content: string) => {
    const file = path.join(dir, rel);
    if (fs.existsSync(file)) return;
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
    written.push(rel);
  };
  const themePkg = theme.startsWith('paperwhite-theme-') || theme.includes('/') ? theme : `paperwhite-theme-${theme}`;
  const v = opts.coreVersion ?? '^0.1.0';
  const name = path.basename(path.resolve(dir)).toLowerCase().replace(/[^a-z0-9-]+/g, '-') || 'my-blog';
  write(
    'package.json',
    `${JSON.stringify(
      {
        name,
        private: true,
        type: 'module',
        scripts: { dev: 'paperwhite dev', build: 'paperwhite build', 'build:ci': 'paperwhite build --strict', preview: 'paperwhite preview', check: 'paperwhite check' },
        dependencies: { '@paperwhite/core': v, astro: '^7.3.5', paperwhite: v, [themePkg]: v },
      },
      null,
      2,
    )}\n`,
  );
  const supported = locales.map((l) => `${l}: {}`).join(', ');
  write(
    'paperwhite.config.ts',
    `import { defineConfig } from '@paperwhite/core/config';

export default defineConfig({
  site: {
    url: '${opts.url ?? 'https://example.com'}',
    title: '${(opts.title ?? 'My Blog').replace(/'/g, "\\'")}',
    description: 'Notes from my Obsidian vault.',
  },
  // Point this at your Obsidian vault (or a sub-folder of it).
  contentDir: './content',
  locales: { default: '${locales[0]}', supported: { ${supported} } },
  theme: '${themePkg}',
});
`,
  );
  write(
    'astro.config.ts',
    `import { defineConfig } from 'astro/config';
import paperwhite from '@paperwhite/core';
import config from './paperwhite.config';

export default defineConfig({ integrations: [paperwhite(config)] });
`,
  );
  write(
    'src/content.config.ts',
    `import { paperwhiteCollections } from '@paperwhite/core/content';
import config from '../paperwhite.config';

export const collections = paperwhiteCollections(config);
`,
  );
  write('src/env.d.ts', '/// <reference types="@paperwhite/core/client.d.ts" />\n');
  write('tsconfig.json', `${JSON.stringify({ extends: 'astro/tsconfigs/strict', include: ['.astro/types.d.ts', 'src', '*.ts'] }, null, 2)}\n`);
  write('.gitignore', 'node_modules/\ndist/\n.astro/\n.paperwhite/\n');
  write('public/favicon.svg', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="#a4440f"/></svg>\n');
  const today = new Date().toISOString().slice(0, 10);
  write(
    'content/posts/hello-world.md',
    `---\ntitle: Hello, world\ndescription: The first post on my new PaperWhite blog.\ndate: ${today}\ntags: [meta]\n---\n\nThis blog is a folder of Markdown. Link notes with [[About|wikilinks]], add callouts:\n\n> [!tip] Obsidian syntax works\n> Embeds, ==highlights==, footnotes[^1] and more.\n\n[^1]: Rendered at build time, zero JavaScript.\n`,
  );
  write('content/pages/about.md', `---\ntitle: About\ndescription: About this blog.\n---\n\nWrite something about yourself.\n`);
  if (locales.includes('fa')) {
    write(
      'content/posts/fa/سلام.md',
      `---\ntitle: سلام دنیا\ndescription: نخستین نوشته.\ndate: ${today}\nlang: fa\n---\n\nاین نخستین نوشتهٔ فارسی است.\n`,
    );
  }
  write('content/attachments/.gitkeep', '');
  write('content/_templates/post.md', `---\ntitle: "{{title}}"\ndate: {{date}}\ntags: []\ndraft: true\n---\n`);
  return written;
}

export const init = defineCommand({
  meta: { name: 'init', description: 'Create a new PaperWhite site' },
  args: {
    dir: { type: 'positional', required: false, description: 'Target directory', default: '.' },
    theme: { type: 'string', description: 'Theme name', default: 'paper' },
    locale: { type: 'string', description: 'Comma-separated locales, first is default', default: 'en' },
    title: { type: 'string', description: 'Site title' },
    url: { type: 'string', description: 'Production URL' },
  },
  run({ args }) {
    const dir = path.resolve(args.dir ?? '.');
    const locales = String(args.locale).split(',').map((s) => s.trim()).filter(Boolean);
    const written = scaffold({ dir, theme: args.theme, locales, title: args.title, url: args.url });
    for (const f of written) console.log(`${pc.green('+')} ${f}`);
    const rel = path.relative(process.cwd(), dir) || '.';
    console.log(`\n${pc.bold('Next:')}\n  ${rel !== '.' ? `cd ${rel}\n  ` : ''}pnpm install\n  pnpm dev`);
  },
});
