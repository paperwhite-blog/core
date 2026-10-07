# PaperWhite — Core Static Blog Generator
## Requirements Document v1

---

## 1. Vision

PaperWhite is a static blog generator that treats a folder of Markdown files — written the Obsidian way — as the single source of truth, and produces the fastest, most SEO-complete static blog possible. A writer should be able to point PaperWhite at an Obsidian vault and get a production-grade blog with zero configuration; a developer should be able to theme it, extend it, and deploy it anywhere static files are served.

**Positioning:** "Obsidian in, Lighthouse 100 out."

**Non-goals (v1):** CMS/admin UI, server-side rendering, user accounts, dynamic comments backend, plugin marketplace.

---

## 2. Target users

| User | Needs |
|---|---|
| Obsidian writer | Publish a vault (or subfolder) without rewriting notes; wikilinks, callouts, embeds just work |
| Migrating WordPress blogger | Import a 1,000+ post archive, keep SEO equity (slugs, redirects, metadata), keep comments |
| Bilingual author (en/fa) | Mixed LTR/RTL content, per-locale calendars, correct typography |
| Developer | Clear theme contract, typed config, predictable build, CI-friendly |

---

## 3. Stack (decided)

| Layer | Choice | Rationale |
|---|---|---|
| Framework | **Astro 5** (static output, Content Layer API) | Zero-JS by default, fastest HTML output, first-class Markdown/MDX, islands only where needed, Content Layer scales to thousands of entries with incremental caching |
| Language | TypeScript (strict) | Typed frontmatter schemas (Zod via Astro content collections), typed theme contract |
| Markdown pipeline | remark + rehype (unified) | Full control for Obsidian syntax; one pipeline for `.md` and `.mdx` |
| Styling | Tailwind CSS v4 + CSS variables design tokens | Themes override tokens, not components; logical properties (`ms-`, `me-`) for RTL/LTR for free |
| Search | **Pagefind** | Static, index built post-build, no backend, ~100 KB JS, multilingual (fa stemming via fallback) |
| Code highlighting | Shiki (build-time) | Zero runtime JS, themeable |
| Images | Astro `<Image>` + sharp | Responsive `srcset`, AVIF/WebP, lazy loading, dimensions inlined (no CLS) |
| OG images | satori + resvg (build-time) | Auto-generated per-post social cards, Persian font support |
| Dates | `date-fns` + `@date-fns/jalali` (or `jalaali-js`) | Jalali/Gregorian via one adapter |
| Package manager | pnpm | Monorepo: `core`, `cli`, `themes/*`, `plugins/*` |
| Deploy targets | Any static host (Cloudflare Pages, Netlify, Vercel static, GitHub Pages, nginx/Docker) | Output is a plain `dist/` folder |

**Performance budgets (hard requirements):**
- Lighthouse ≥ 95 on all four categories, mobile, for the default theme
- Post page: ≤ 30 KB JS (excluding Pagefind, loaded on demand), LCP < 1.2 s on 4G
- Build: 1,000 posts in < 60 s cold, < 10 s incremental (Content Layer cache)

---

## 4. Content model

### 4.1 Vault structure

```
content/
├── posts/            # blog posts (any depth; folders ≠ URL unless configured)
├── pages/            # static pages (about, contact)
├── attachments/      # images/files referenced via ![[...]]
├── _templates/       # ignored by build (Obsidian templates)
└── .obsidian/        # ignored
```

- Any folder can be the vault root; `paperwhite.config.ts` sets `contentDir`.
- Files/folders starting with `_` or `.` are ignored.
- Publish control: `draft: true` or `publish: false` excludes a note. Optional `publishedOnly` mode: only notes with `publish: true` are built (Obsidian Publish parity).

### 4.2 Frontmatter schema (Zod, extensible by themes)

```yaml
title: string                  # falls back to filename / first H1
description: string            # meta description; auto-excerpt if missing
date: date                     # Gregorian ISO or Jalali (1403/07/14) — parsed by locale
updated: date
slug: string                   # defaults to slugified filename; Persian slugs preserved (percent-encoded in URL, readable in <a>)
aliases: string[]              # Obsidian aliases → 301 redirects + wikilink resolution
tags: string[]                 # supports nested tags (#pm/strategy)
categories: string[]
series: string                 # groups posts into an ordered series
lang: 'en' | 'fa' | ...        # per-note override of site default
dir: 'ltr' | 'rtl'             # auto from lang if omitted
cover: image                   # featured image (relative or ![[...]])
author: string | string[]
draft: boolean
publish: boolean
canonical: url                 # if syndicated
noindex: boolean
toc: boolean                   # default from theme
math: boolean                  # enables KaTeX for this note only
cssclasses: string[]           # Obsidian cssclasses → body classes
redirect_from: string[]        # legacy URLs (e.g. WordPress /?p=123, /2019/05/old-slug)
comments: path | boolean       # path to imported comments file, or disable
```

### 4.3 Obsidian Markdown support (must-have)

| Feature | Behavior |
|---|---|
| `[[Wikilinks]]`, `[[Note\|Alias]]`, `[[Note#Heading]]`, `[[Note#^block]]` | Resolve by filename, alias, or path; shortest-path resolution like Obsidian; unresolved links render as `<span class="unresolved">` and are reported |
| `![[image.png]]`, `![[image.png\|400]]` | Embedded, optimized image with width hint |
| `![[note]]`, `![[note#heading]]` | Transclusion (rendered inline, recursion-guarded) |
| `![[file.pdf]]`, `![[audio.mp3]]` | Native embed elements |
| `> [!note]`, `[!tip]`, `[!warning]`, custom types, `[!faq]- ` foldable | Callouts → semantic HTML, themeable, foldable via `<details>` (no JS) |
| `==highlight==` | `<mark>` |
| `^block-id` | Anchors; stripped from visible text |
| `%% comments %%` | Removed from output |
| `#tag` inline | Rendered as tag links (configurable: strip / link) |
| Footnotes `[^1]`, inline `^[...]` | GFM footnotes with back-references |
| Math `$...$`, `$$...$$` | KaTeX at build time (zero runtime JS) |
| Mermaid fences | Rendered to SVG at build time (optional plugin, off by default) |
| Tables, task lists, strikethrough | GFM |
| Frontmatter `aliases`, `tags`, `cssclasses` | Honored as in Obsidian |
| Excalidraw `.excalidraw.md` | Rendered to SVG (optional plugin) |
| Dataview | **Not supported** in v1 (requires runtime); documented limitation. Static alternative: `paperwhite:query` fence resolved at build time for simple `tags`/`folder`/`date` filters |

### 4.4 Derived graph data

- **Backlinks**: every note gets `backlinks[]` (title, excerpt around the link).
- **Outgoing links** and **related posts** (shared tags + link graph, weighted).
- **Graph JSON** exported to `dist/graph.json` for optional theme-side graph view (island).

---

## 5. Internationalization & typography

- Site default locale: `en`. Supported locales declared in config; `fa` ships out of the box.
- Routing strategy (configurable): `prefix-other` (`/post` for en, `/fa/post` for fa) or `prefix-all`.
- Per-note `lang` sets `<html lang dir>`; mixed-direction inline content uses `<bdi>`/`unicode-bidi: plaintext` on paragraphs so Latin snippets inside Persian text don't break.
- Per-locale **date rendering**: Gregorian for `en`, Jalali for `fa`, configurable per locale (`calendar: 'jalali' | 'gregorian'`, `numerals: 'latn' | 'arab'`). Dates in frontmatter can be written in either calendar; the parser is locale-aware.
- `hreflang` alternates generated when a note declares `translations: { fa: 'path' }`.
- **Fonts are the theme's responsibility**: theme declares `fonts.latin` and `fonts.rtl` (e.g. Inter / Vazirmatn); core applies the right stack via `:lang(fa)` selectors and self-hosts subsets (woff2) — no third-party font requests by default.
- UI strings (nav, "Read more", "Table of contents", search placeholder) live in `i18n/*.json`, overridable by theme and site.
- Persian typography helpers (optional, on by default for `fa`): ZWNJ preservation, Persian digits in dates/reading time, correct quotation marks «», Arabic→Persian ی/ک normalization in slugs and search index.

---

## 6. SEO (must-have, all automatic)

- Semantic HTML5 (`article`, `time`, `nav`, heading hierarchy validated at build).
- Per-page `<title>` templates, meta description, canonical, robots (`noindex` honored).
- Open Graph + Twitter Card with **auto-generated OG image** (title, site name, cover, locale-aware font).
- **JSON-LD**: `BlogPosting`/`Article`, `BreadcrumbList`, `Person`/`Organization`, `WebSite` with `SearchAction`, `FAQPage` when FAQ callouts are present, `ItemList` for series.
- `sitemap-index.xml` (split at 10k URLs) with `lastmod`, image sitemap, per-locale sitemaps.
- RSS 2.0 + Atom + JSON Feed, per-locale and per-tag feeds, full content option, `<media:content>` for covers.
- **Redirects**: from `aliases`, `redirect_from`, and changed slugs → emitted as `_redirects` (Netlify/Cloudflare), `vercel.json`, nginx `map` snippet, and an HTML meta-refresh fallback.
- Clean URLs (`/slug/` with trailing slash configurable), no `.html`.
- Pagination with `rel=prev/next`, tag/category/author archive pages, yearly archives.
- `robots.txt`, `humans.txt`, `security.txt` (configurable), `llms.txt` with a machine-readable site index.
- Build-time **SEO audit report**: missing descriptions, duplicate titles, images without alt, broken internal links, orphan pages, titles > 60 chars, descriptions > 160 chars. Can fail the build in CI (`--strict`).
- Core Web Vitals safeguards: inlined critical CSS, `font-display: swap`, image dimensions, no layout-shifting embeds, prefetch on hover (Astro `prefetch`).

---

## 7. Theme system

- A theme is an npm package `paperwhite-theme-*` exposing:
  - `theme.json` — metadata, design tokens (colors, spacing, radius, fonts incl. RTL stack), supported layouts, i18n overrides
  - `layouts/` — `Base`, `Post`, `Page`, `Archive`, `Home`, `Tag`, `Search`, `404` (Astro components)
  - `components/` — overridable slots: `Header`, `Footer`, `PostCard`, `PostMeta`, `TOC`, `Callout`, `Comments`, `Pagination`, `Backlinks`, `RelatedPosts`
  - `styles/` — token CSS; Tailwind preset
- **Override cascade**: site `src/overrides/` → theme → core defaults. A site can replace any single component without forking the theme.
- Dark mode via `prefers-color-scheme` + optional toggle (tiny island).
- Themes must declare RTL support level (`full | tokens-only`); core runs a snapshot test in both directions.
- Default theme **"Paper"**: minimal, typography-first, ships with en/fa fonts, passes all budgets.

---

## 8. CLI

```
paperwhite init [dir] [--theme paper] [--locale en,fa]
paperwhite dev                       # Astro dev server + live reload on vault changes
paperwhite build [--strict]          # static build + Pagefind index + SEO audit
paperwhite preview
paperwhite import <wp-export.zip>    # ingest PaperWhite WordPress export (see doc 2)
paperwhite check                     # links, frontmatter, images, orphans — no build
paperwhite new "Title" [--lang fa]   # scaffold a note with frontmatter
paperwhite theme add <pkg> | list | eject <component>
```

- `paperwhite.config.ts` fully typed with autocomplete; sensible defaults so an empty config works.
- Watch mode tolerates Obsidian's atomic file writes and `.obsidian/` churn.

---

## 9. Comments (static)

- Imported comments (from WordPress export) stored as `content/comments/<post-slug>.json` and rendered statically with threading, Gravatar-free avatars (initials), author/date, and `rel="nofollow ugc"` on links. Fully indexable, zero JS.
- Optional live comments via pluggable island: Giscus (GitHub Discussions), Cusdis, or Webmentions. Theme `Comments` slot can render "archived comments" + live widget together.

---

## 10. Suggested features to make it the best SSG for blogs

Prioritized P1 (ship in v1) → P3 (later):

**P1**
- Reading time + word count (locale-aware, Persian digits)
- Series navigation (prev/next within series, series index page)
- Link previews on hover for internal wikilinks (static JSON snippets, tiny island)
- Table of contents with scroll-spy (CSS-only `scroll-timeline` where supported)
- Copy-code button, line highlighting, file-name labels on code blocks
- Image lightbox (no-JS `<dialog>` + minimal script)
- Automatic "Last updated" from git history when `updated` is absent
- Scheduled publishing: `date` in the future → excluded until a build after that date (document the cron pattern)
- Broken-link checker for external links (`paperwhite check --external`, cached)

**P2**
- Graph view page (force-directed, lazy island, uses `graph.json`)
- Newsletter form slot (Buttondown/Listmonk/Mailchimp adapters, static POST)
- Webmentions receive/display
- Per-post "edit on GitHub" link
- Content API: `dist/api/posts.json`, `tags.json` for external consumers
- AI-generated description/alt-text suggestions in `paperwhite check` (opt-in, BYO API key)

**P3**
- Incremental deploy diff (only upload changed files)
- Multi-author with author pages and per-author feeds
- A/B title metadata (`title_variants`) for social
- Obsidian plugin "Publish to PaperWhite" (git commit + push from inside Obsidian)

---

## 11. Quality & tooling

- Vitest unit tests for the remark/rehype pipeline (golden-file tests per Obsidian feature)
- Playwright visual regression for default theme in `en`/LTR and `fa`/RTL, light/dark
- Lighthouse CI gate on PRs
- Fixture vault: 50 notes covering every supported syntax, both locales
- Docs site built with PaperWhite itself (dogfooding)
- Semantic versioning; theme contract versioned separately (`themeApi: 1`)

---

## 12. Open decisions

1. Should transclusion (`![[note]]`) render the full note or only up to the first heading by default?
2. Default URL shape for Persian slugs: keep Unicode (`/یادداشت/`) vs transliterate (`/yaddasht/`)? Proposal: keep Unicode, since Google handles it and WordPress migrations preserve equity.
3. Pagefind Persian stemming quality — evaluate; fallback is a custom normalizer plugin.
4. MDX: allow by default or behind a flag? Proposal: on by default, but Obsidian users never need it.
