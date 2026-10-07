---
title: Themes
description: Theme folders, the token list, the override cascade, and how to make a theme of your own.
date: 2026-09-25
updated: 2026-10-08
series: Guide
series_order: 5
tags: [guide, themes]
---

A theme is a **folder**. Put it in your site's `themes/`, set its name in the config, done:

```ts title="paperwhite.config.ts"
export default defineConfig({
  theme: 'ink',   // → themes/ink/
});
```

`theme` resolves in this order:

1. `themes/<name>/` in your site
2. a theme built into PaperWhite (`paper`, the default)
3. a path such as `./my-theme`

`paperwhite theme list` shows every theme it can see and which one is active.

## Make one

Start from the built-in theme and change what you like:

```bash
paperwhite theme new ink            # copies paper → themes/ink/ and sets theme: 'ink'
paperwhite theme new ink --from zen # start from another theme folder instead
```

Or build a folder by hand. The minimum is two files:

```
themes/ink/
  theme.json
  styles/theme.css
```

```json title="themes/ink/theme.json"
{
  "name": "ink",
  "themeApi": 1,
  "version": "0.1.0",
  "description": "High-contrast, serif body.",
  "rtl": "full",
  "fonts": { "latin": "Literata", "rtl": "Vazirmatn", "mono": "JetBrains Mono" },
  "tokens": { "bg": "#ffffff", "fg": "#111111", "accent": "#0b63ce" },
  "i18n": { "en": { "footer.poweredBy": "Set in Ink" } }
}
```

| Field | Meaning |
| --- | --- |
| `name`, `themeApi` | Required. `themeApi` must be `1`; PaperWhite refuses other values so an old theme fails loudly instead of rendering wrong. |
| `rtl` | `full` when the theme sets `--pw-font-rtl` and was checked on an RTL page, otherwise `tokens-only`. |
| `fonts`, `tokens`, `version`, `description` | Informational: not read by core. They document the theme for people and tools; the real values live in `styles/theme.css`. |
| `i18n` | UI strings per locale, merged between core's defaults and the site's `i18n` config. |

Restart `paperwhite dev` after adding **new files** to a theme folder; edits to existing files reload on their own.

## Tokens

`styles/theme.css` sets CSS custom properties. Core's components only ever read these, so a theme that sets tokens and nothing else already gets layout, dark mode and full RTL for free.

| Token | Default | Used for |
| --- | --- | --- |
| `--pw-bg` / `--pw-fg` | `#ffffff` / `#1f2328` | page background and text |
| `--pw-muted` | `#59636e` | dates, meta, secondary text |
| `--pw-accent` | `#0b63ce` | links, active states, focus ring |
| `--pw-border` | `#d1d9e0` | rules, card borders |
| `--pw-surface` | `#f6f8fa` | cards, callouts, table stripes |
| `--pw-mark` | `#fff3a3` | `==highlights==` |
| `--pw-code-bg` | `#f6f8fa` | inline and block code |
| `--pw-font-sans` | system stack | body text for LTR locales |
| `--pw-font-rtl` | Tahoma stack | body text for `fa`, `ar`, `ur` |
| `--pw-font-mono` | ui-monospace stack | code |
| `--pw-measure` | `42rem` | content column width |
| `--pw-wide` | `64rem` | wide layouts (home, archives) |
| `--pw-radius` | `0.5rem` | corners |
| `--pw-leading` / `--pw-leading-rtl` | `1.7` / `1.95` | line height per script |

Dark mode: set the same tokens under both selectors so the toggle and the OS preference agree:

```css title="themes/ink/styles/theme.css"
:root { --pw-bg: #fff; --pw-fg: #111; --pw-accent: #0b63ce; }

@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) { --pw-bg: #0f0f10; --pw-fg: #ececec; --pw-accent: #7ab7ff; }
}
:root[data-theme='dark'] { --pw-bg: #0f0f10; --pw-fg: #ececec; --pw-accent: #7ab7ff; }
```

Fonts: `@import` a self-hosted package (`@import '@fontsource-variable/literata/wght.css';`), or write `@font-face` rules pointing at files inside the theme folder (`url(../fonts/literata.woff2)`, bundled and hashed at build) or in `public/` (`url(/fonts/literata.woff2)`). Give each a metric-matched local fallback (`size-adjust`, `ascent-override`) so the swap does not shift layout. Tailwind utilities are available inside theme components; the theme folder is scanned for class names.

## Components and layouts

Any file in `themes/<name>/components/` or `layouts/` replaces PaperWhite's default of the same name. Every slot resolves in this order:

1. `src/overrides/components/Header.astro` in your site
2. `themes/<name>/components/Header.astro`
3. PaperWhite's default

Components: `Header`, `Footer`, `PostCard`, `PostMeta`, `TOC`, `Comments`, `Pagination`, `Backlinks`, `RelatedPosts`, `SeriesNav`, `Translations`, `TagList`, `Breadcrumbs`, `SearchBox`, `ThemeToggle`, `Cover`, `HeadExtra`. Layouts: `Base`, `Post`, `Page`, `Home`, `Taxonomy`, `Archive`, `Tags`, `Search`, `NotFound`.

Import what you need from `@paperwhite/core/runtime` (`useLocale`, `encodePath`, `config`, note types), and wrap instead of copying when you can:

```astro title="themes/ink/components/PostCard.astro"
---
import Card from '@pw/core/components/PostCard.astro';
---
<div class="border-b border-border pb-4"><Card {...Astro.props} /></div>
```

`@pw/core/...` always points at PaperWhite's default; `@pw/theme/...` skips site overrides.

## One component, not a whole theme

```bash
paperwhite theme eject Footer          # → src/overrides/components/Footer.astro
paperwhite theme eject layouts/Post    # → src/overrides/layouts/Post.astro
```

`src/overrides/styles.css`, if present, is loaded after the theme's stylesheet for small token tweaks without touching the theme folder.

## Sharing a theme

A theme folder is self-contained, so sharing it is copying it: publish the folder in a repository and users drop it into `themes/`. Keep `themeApi: 1` in `theme.json`, document which tokens you set and which slots you override, and check an RTL locale before claiming `rtl: "full"`.

Next: [[Deploying]].
