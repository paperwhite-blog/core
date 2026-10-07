---
title: Themes
description: The theme contract, the override cascade, and ejecting components.
date: 2026-09-25
series: Guide
series_order: 5
tags: [guide, themes]
---

A theme is a package named `paperwhite-theme-*` with a `theme.json` (metadata, tokens, fonts, RTL support level, `themeApi: 1`), optional `components/` and `layouts/`, and `styles/theme.css`.

## Override cascade

Every slot resolves in this order:

1. `src/overrides/components/Header.astro` in your site
2. the theme's `components/Header.astro`
3. PaperWhite's default

So you can replace one component without forking the theme:

```bash
paperwhite theme list          # where each slot comes from
paperwhite theme eject Footer  # copy it into src/overrides/
```

Slots: `Header`, `Footer`, `PostCard`, `PostMeta`, `TOC`, `Comments`, `Pagination`, `Backlinks`, `RelatedPosts`, `SeriesNav`, `Translations`, `TagList`, `Breadcrumbs`, `SearchBox`, `ThemeToggle`, `Cover`, `HeadExtra`. Layouts: `Base`, `Post`, `Page`, `Home`, `Taxonomy`, `Archive`, `Tags`, `Search`, `NotFound`.

## Tokens, not components

Themes set `--pw-*` CSS variables (colors, fonts, measure, radius). Core styles use logical properties, so a theme that only sets tokens still gets full RTL. Dark mode follows `prefers-color-scheme` with a toggle that is applied before first paint.

Next: [[Deploying]].
