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
  const supported = locales.map((l) => `    ${l}: {}`).join('\n');
  write(
    'paperwhite.config.yaml',
    `# PaperWhite site configuration. Full reference: pw-docs/configuration.md
site:
  url: ${opts.url ?? 'https://example.com'}
  title: ${JSON.stringify(opts.title ?? 'My Blog')}
  description: Notes from my Obsidian vault.
  # footer: "© Me"            # replaces "Built with PaperWhite"

# Your notes. Point this at an Obsidian vault (or a sub-folder of it) if it lives elsewhere.
contentDir: ./content

locales:
  default: ${locales[0]}
  supported:
${supported}

# A folder under themes/ (yours) or a built-in theme. \`paperwhite theme list\` shows both.
theme: ${theme}

# Folders under plugins/, added with \`paperwhite add <owner/repo>\`.
plugins: []
`,
  );
  write('.gitignore', 'node_modules/\ndist/\n.paperwhite/\n');
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
  write(
    'themes/README.md',
    `# Themes

Each folder here is a theme: \`theme.json\` + \`styles/theme.css\`, plus optional \`components/\` and \`layouts/\`
that replace PaperWhite's defaults one file at a time.

- Start from the built-in theme: \`paperwhite theme new mytheme\` (copies it here and selects it).
- Or drop any theme folder in and set \`theme: <folder-name>\` in paperwhite.config.yaml.
- Only tweak one piece? \`paperwhite theme eject Header\` copies a single component into overrides/.

Restart \`paperwhite dev\` after adding new files to a theme folder.
`,
  );
  write('content/attachments/.gitkeep', '');
  write('content/_templates/post.md', `---\ntitle: "{{title}}"\ndate: {{date}}\ntags: []\ndraft: true\n---\n`);
  return written;
}

export const init = defineCommand({
  meta: { name: 'init', description: 'Create a new PaperWhite site' },
  args: {
    dir: { type: 'positional', required: false, description: 'Target directory', default: '.' },
    theme: { type: 'string', description: 'Built-in theme to start with', default: 'paper' },
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
