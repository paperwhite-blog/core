# {{title}}

A blog built with [PaperWhite](https://github.com/paperwhite-blog/core): Markdown notes in `content/`, written the Obsidian way, published as a static site.

```bash
pnpm install
pnpm dev                       # http://localhost:4321, reloads as you write
pnpm build                     # static site in dist/ plus an SEO audit
pnpm exec paperwhite new "A post"
```

| Folder | What goes there |
| --- | --- |
| `content/posts/`, `content/pages/` | your notes (or set `contentDir` in the config to your vault) |
| `content/attachments/` | images and files you embed |
| `themes/`, `plugins/` | your themes and plugins (`paperwhite theme new`, `paperwhite add owner/repo`) |
| `overrides/` | single components ejected for editing (`paperwhite theme eject Header`) |
| `public/` | copied to the site root as-is (favicon, CNAME, …) |
| `pw-core/`, `pw-docs/` | PaperWhite itself and its docs; replaced by `paperwhite update`, never edit |
| `paperwhite.config.yaml` | title, URL, locales, theme, plugins, SEO |

Docs: [pw-docs/](pw-docs/). Deploy: `.github/workflows/deploy.yml`.
