# PaperWhite

**Obsidian in, Lighthouse 100 out.** A folder of Markdown, written the Obsidian way, becomes a production-grade static blog: SEO complete, bilingual-ready (English and Persian with full RTL), 100/100/100/100 in Lighthouse, about 5 KB of JavaScript per page.

There is nothing to install from a registry. **This repository is your blog.**

```bash
git clone https://github.com/paperwhite-blog/core my-blog
cd my-blog && pnpm install
pnpm exec paperwhite init        # title, URL, deploy target; strips PaperWhite's dev files
pnpm dev                         # write at http://localhost:4321
```

Then push to your own GitHub repository. The workflow `init` wrote builds and deploys the site (GitHub Pages, Cloudflare Pages, Netlify or Vercel) and rebuilds daily so scheduled posts appear on time.

## What you get

```
paperwhite.config.yaml   one file: title, URL, locales, theme, plugins, SEO
content/                 posts/ and pages/ in Markdown; or point contentDir at your Obsidian vault
themes/                  your themes, one folder each (paperwhite theme new mine)
plugins/                 your plugins, one folder each (paperwhite add paperwhite-blog/plugin-mermaid)
public/                  favicon, CNAME, anything copied as-is
pw-core/                 PaperWhite — replaced by `paperwhite update`, never edited
pw-docs/                 the manual
dist/                    the built site
```

- **Obsidian Markdown**: wikilinks with aliases, headings and blocks; image/PDF/audio/video embeds; transclusion; callouts incl. folding FAQ; highlights, comments, block ids, nested tags, footnotes, KaTeX, tables, task lists; `paperwhite:query` fences instead of Dataview. Backlinks, related posts, series, TOC, search.
- **SEO, done**: titles, meta, canonical, Open Graph with generated cards, JSON-LD, sitemaps with hreflang, RSS/Atom/JSON feeds, redirects for every host, robots/humans/security/llms.txt, and a build-time audit that fails CI on broken links or missing alt text.
- **Languages**: `prefix-other` or `prefix-all` routing, Jalali or Gregorian dates, Persian digits and typography, bidi-safe paragraphs.
- **Themes are folders**: `theme.json` + `styles/theme.css` tokens + optional components. Copy the built-in theme and edit, install one from GitHub, or eject a single component into `overrides/`.
- **Plugins are folders**: build-time extensions installed from GitHub with one command. Mermaid and Excalidraw are available.
- **Stays current**: `paperwhite update` replaces `pw-core/` and `pw-docs/` with the latest release and touches nothing of yours.

## Documentation

[pw-docs/](pw-docs/README.md): [getting started](pw-docs/getting-started.md) · [writing](pw-docs/writing.md) · [configuration](pw-docs/configuration.md) · [themes](pw-docs/themes.md) · [plugins](pw-docs/plugins.md) · [SEO](pw-docs/seo.md) · [deploying](pw-docs/deploying.md) · [updating](pw-docs/updating.md) · [CLI](pw-docs/cli.md) · [architecture](pw-docs/architecture.md) · [contributing](pw-docs/contributing.md) · [decisions](pw-docs/decisions.md) · [changelog](pw-docs/changelog.md).

## Measured

| | Target | Measured |
| --- | --- | --- |
| Lighthouse, mobile, default theme | ≥ 95 in all four categories | 100 / 100 / 100 / 100 |
| JavaScript on a post page (excluding search) | ≤ 30 KB | 5.5 KB |
| CLS | — | 0 |
| 1,000 posts, cold build | < 60 s | 18–21 s |
| 1,000 posts, incremental (one note edited) | < 10 s | 5.8–5.9 s |

Reproduce with `pnpm lhci` and `pnpm bench` in a clone that has not run `init`.

## Developing PaperWhite

The same clone, before `init`: `pnpm test`, `pnpm typecheck`, `pnpm fixture:build`, `pnpm e2e`. Everything under `dev/` and `pw-core/test/` exists for that and is removed from blogs by `init`. See [pw-docs/contributing.md](pw-docs/contributing.md).

Built on Astro 7, unified (remark/rehype), Tailwind CSS v4, Pagefind, Shiki, KaTeX, sharp, satori and resvg. Node ≥ 22.12 and pnpm 10. MIT.
