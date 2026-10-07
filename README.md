# PaperWhite

**Obsidian in, Lighthouse 100 out.** PaperWhite is a static blog generator that treats a folder of Markdown — written the Obsidian way — as the single source of truth. Point it at a vault and get a production-grade, SEO-complete blog; theme it, extend it, deploy it anywhere static files are served.

Built on Astro 7 (Content Layer, static output), unified (remark/rehype), Tailwind CSS v4, Pagefind, Shiki and KaTeX at build time, sharp for images, and satori + resvg for social cards.

```bash
npx paperwhite init my-blog --locale en,fa
cd my-blog && pnpm install && pnpm dev
```

> **Not on npm yet.** `@paperwhite/core` and `paperwhite` are unpublished, so the command above does not work today. Until they are published, use the [starter template](https://github.com/paperwhite-blog/starter) with linked packages, or work inside this repo (see [Using this repo](#using-this-repo)).

## Measured on this repo

| Requirement (spec §3) | Target | Measured |
| --- | --- | --- |
| Lighthouse, mobile, default theme | ≥ 95 in all four categories | 100 / 100 / 100 / 100 on home, image post, Persian post, comments post |
| JS on a post page (excluding Pagefind) | ≤ 30 KB | 5.5 KB |
| CLS | — | 0 on all audited pages |
| 1,000 posts, cold build | < 60 s | 18–21 s (1,440 pages incl. OG images) |
| 1,000 posts, incremental (one note edited) | < 10 s | 5.8–5.9 s (1 rendered, 999 cached) |

LCP under Lighthouse's simulated slow-4G mobile profile is 1.5–1.7 s; the spec's "< 1.2 s on 4G" refers to regular 4G and was not measured separately. Reproduce with `pnpm lhci` and `pnpm bench`.

## What's in v1

- **Vault loader** (Content Layer): global index first (aliases, headings, block ids, links), then per-note rendering, so wikilinks, transclusion and backlinks work across the whole vault. Unchanged notes are reused from the content-layer cache; the cache key covers the note, the vault's link surface, embedded sources, the pipeline code and render config.
- **Obsidian Markdown** (§4.3): wikilinks with aliases, headings and blocks; image/PDF/audio/video embeds; full and section transclusion with recursion guard; callouts incl. custom types and `[!faq]-` folding via `<details>`; `==highlight==`; `%% comments %%`; `^block-id`; inline and nested `#tags`; GFM footnotes and `^[inline]` footnotes; KaTeX; tables, tasks, strikethrough; `cssclasses`; `paperwhite:query` fences as a static Dataview alternative. Optional plugins (separate repos): [Mermaid](https://github.com/paperwhite-blog/plugin-mermaid), [Excalidraw](https://github.com/paperwhite-blog/plugin-excalidraw).
- **Derived graph**: backlinks with context excerpts, outgoing links, weighted related posts, `dist/graph.json`.
- **i18n** (§5): `prefix-other` / `prefix-all` routing, per-note `lang`/`dir`, Jalali/Gregorian via `Intl`, Persian digits, `hreflang` from `translations`, bidi-safe paragraphs, Persian typography (ZWNJ, «», ی/ک) applied to content, slugs and the search index.
- **SEO** (§6): titles, meta, canonical, robots, OG/Twitter with generated cards (Persian supported), JSON-LD (BlogPosting, BreadcrumbList, WebSite + SearchAction, FAQPage, ItemList), per-locale image sitemaps with hreflang split at 10k, RSS/Atom/JSON Feed per locale plus RSS per tag, redirects for Netlify/Cloudflare, Vercel and nginx plus meta-refresh pages, clean URLs, `rel=prev/next` pagination, tag/category/author/year/series archives, robots/humans/security/llms(-full).txt, and a build-time **SEO audit** that can fail CI (`--strict`).
- **Themes** (§7): a theme is a folder — `themes/<name>/` in your site with `theme.json`, `styles/theme.css` and optional `components/`/`layouts/` — selected by name in the config. Override cascade `src/overrides/` → theme → core for every component and layout, token-only theming with logical properties, dark mode without flash. Default theme **Paper**, built in. `paperwhite theme new <name>` copies it out for editing.
- **CLI** (§8): `init`, `dev`, `build [--strict]`, `preview`, `check [--external]`, `new`, `theme list|new|eject`, `import` (WordPress WXR).
- **Comments** (§9): imported comments rendered statically with threading, initials avatars and `rel="nofollow ugc"`; optional Giscus, Cusdis or Webmentions islands.
- **P1 extras** (§10): reading time and word count (locale digits), series navigation and index pages, hover link previews from static JSON, TOC with scroll-spy, copy-code buttons, line highlighting and file labels, no-JS lightbox, last-updated from git history, scheduled publishing, cached external link checker. From P2: content API (`api/posts.json`, `api/tags.json`) and edit-on-GitHub links.

## Repository layout

This repository is PaperWhite's core. Themes are folders inside a site (the default one ships inside core), and plugins live in their own repositories.

```
packages/core        @paperwhite/core — Astro integration, vault loader, pipeline, SEO, i18n
  components/        default components (every one replaceable by a theme or a site)
  layouts/           default layouts
  routes/            injected routes: pages, feeds, sitemaps, OG images, text files, redirects
  islands/           the few client scripts (TOC scroll-spy, theme toggle, copy-code, search)
  styles/            base stylesheet, driven by --pw-* tokens
  themes/paper       the built-in default theme
  src/               config, content loader, markdown pipeline, i18n, SEO, theme resolution
packages/cli         paperwhite — the CLI
fixtures/vault       50-note test vault covering every syntax, en + fa, with two deliberate audit errors
fixtures/wordpress   WXR export used by importer tests
examples/site        the fixture vault as a site (used by e2e and Lighthouse)
examples/mdx         `mdx: true` example
docs                 documentation, built with PaperWhite (docs/requirements.md is the original spec)
bench                1,000-post build benchmark
e2e                  Playwright: visual regression (en/fa × light/dark × desktop/mobile) and behaviour
scripts              repo helpers (link the CLI, assert the audit)
```

Related repositories: [starter](https://github.com/paperwhite-blog/starter) (template site), [plugin-mermaid](https://github.com/paperwhite-blog/plugin-mermaid), [plugin-excalidraw](https://github.com/paperwhite-blog/plugin-excalidraw).

## Themes in one minute

```bash
paperwhite theme list          # themes/<name>/ in the site, then built-in; the active one is marked
paperwhite theme new ink       # copies paper → themes/ink/ and sets theme: 'ink'
paperwhite theme eject Header  # one component → src/overrides/components/Header.astro
```

A theme folder is `theme.json` + `styles/theme.css` (tokens) + optional `components/` and `layouts/`. Any folder dropped into `themes/` works once its name is in `paperwhite.config.ts`. Full contract and token list: [docs/content/posts/themes.md](docs/content/posts/themes.md).

## How it fits together

1. `src/content.config.ts` registers `paperwhiteCollections(config)`. The loader walks the vault, builds a global index, and renders each note through PaperWhite's own unified pipeline. Rendered HTML is stored on the entry, so Astro's Markdown processor is not involved.
2. The `paperwhite()` integration resolves the theme (`themes/<name>/` in the site, else built in), injects every route (one catch-all page route, feeds, sitemaps, OG images, text files, redirect files), adds Tailwind, and resolves `@pw/components/*` and `@pw/layouts/*` through the override cascade.
3. After the build it copies optimized assets, builds the Pagefind index, measures JS per page and runs the SEO audit.

## Decisions (spec §12)

1. Transclusion renders the full note by default (`markdown.transclusion: 'first-section'` is available).
2. Persian slugs stay Unicode, percent-encoded in URLs.
3. Pagefind with build-time ی/ک normalization of content, titles and queries. Stemming quality for Persian was not evaluated.
4. MDX is off by default (`mdx: true`), and MDX notes bypass the Obsidian pipeline.

## Deviations from the requirements document

- **Astro 7** instead of Astro 5. It was current at build time; the Content Layer API is the same.
- **Dates use `Intl`** (Persian calendar and digits are built in) plus `jalaali-js` for parsing. The `@date-fns/jalali` package named in the spec does not exist.
- **`paperwhite import`** reads standard WordPress WXR exports. The "PaperWhite WordPress export (doc 2)" referenced in the spec was not available.
- **TOC scroll-spy** uses a small IntersectionObserver island rather than CSS `scroll-timeline`.
- **Wikilinks** also resolve by note title and slug after Obsidian's own rules. This helps imported vaults whose filenames are slugs.

## Limitations

- Dataview is not supported. Use `paperwhite:query` fences.
- Diagrams: the Mermaid plugin needs a headless browser at build time (SVGs are cached afterwards); Excalidraw uses the exported SVG if present, else a built-in renderer without the hand-drawn style. Both are separate packages, see Related repositories.
- Visual-regression baselines are committed for macOS. CI generates Linux baselines on first run.

## Using this repo

```bash
pnpm install
pnpm link-cli        # once: makes the `paperwhite` command available everywhere
```

The same commands work from the repo root, from inside any site folder, or from any folder below one. At the repo root they target `examples/site`; use `--site docs` (or any folder) to pick another.

| Command | What it does |
| --- | --- |
| `paperwhite dev` or `pnpm dev` | Live preview at http://localhost:4321, reloads when you edit notes |
| `paperwhite build` or `pnpm build` | Build the static site into `dist/` and print the SEO audit |
| `paperwhite preview` or `pnpm preview` | Serve the last build |
| `paperwhite check` | Check links, images and frontmatter without building |
| `paperwhite new "My post"` | Create a new note with frontmatter |
| `pnpm docs:dev` | Live preview of the documentation site |

`pnpm unlink-cli` removes the `paperwhite` command again. It is a symlink next to your `node` binary, so it follows that Node install.

## Development

```bash
pnpm test                 # unit + golden-file tests (Vitest)
pnpm typecheck
pnpm build                # build the fixture site (audit reports the 2 deliberate errors)
pnpm e2e                  # Playwright visual + behaviour tests (after a build)
pnpm lhci                 # Lighthouse CI against the built site
pnpm bench                # 1,000-post benchmark
pnpm build:packages       # bundle the CLI for publishing
```

Golden files live in `packages/core/test/golden/`. Update them with `pnpm vitest -u` after an intentional output change. See [CONTRIBUTING.md](CONTRIBUTING.md) for the layout, conventions and release notes.

## License

MIT.
