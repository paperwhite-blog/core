# Themes

A theme is a **folder**. Put it in `themes/`, name it in the config, done:

```yaml
theme: ink      # → themes/ink/
```

`theme:` resolves in this order: `themes/<name>/` in your repository, then a theme built into PaperWhite (`paper`, the default), then a path such as `./my-theme`. `paperwhite theme list` shows every theme it can see and marks the active one.

## Start from the built-in theme

```bash
pnpm exec paperwhite theme new ink            # copies paper → themes/ink/ and sets theme: ink
pnpm exec paperwhite theme new ink --from zen # start from another theme folder instead
```

## Install someone else's

```bash
pnpm exec paperwhite add owner/repo           # latest release of a GitHub repo → themes/<name>/
pnpm exec paperwhite add owner/repo#v2.0.0    # a specific tag or branch
pnpm exec paperwhite add ./downloads/theme    # a local folder
```

`add` copies the folder, installs the `dependencies` its `theme.json` declares (fonts, usually) and sets `theme:`.

## Anatomy

```
themes/ink/
  theme.json              name, themeApi, rtl, fonts, tokens, i18n
  styles/theme.css        the --pw-* tokens for light and dark, @font-face rules, a few rules
  components/             optional: any component replaces the default of the same name
  layouts/                optional: same for layouts
  fonts/                  optional: files referenced from theme.css with url(../fonts/x.woff2)
```

```json
{
  "name": "ink",
  "themeApi": 1,
  "version": "0.1.0",
  "description": "High-contrast, serif body.",
  "rtl": "full",
  "fonts": { "latin": "Literata", "rtl": "Vazirmatn", "mono": "JetBrains Mono" },
  "dependencies": { "@fontsource-variable/literata": "^5.0.0" },
  "i18n": { "en": { "footer.poweredBy": "Set in Ink" } }
}
```

| Field | Meaning |
| --- | --- |
| `name`, `themeApi` | Required. `themeApi` must be `1`; PaperWhite refuses other values so an old theme fails loudly instead of rendering wrong. |
| `rtl` | `full` when the theme sets `--pw-font-rtl` and was checked on an RTL page, otherwise `tokens-only`. |
| `dependencies` | npm packages `paperwhite add` installs for the theme (fonts). |
| `i18n` | UI strings per locale, merged between core's defaults and the site's `i18n` config. |
| `fonts`, `tokens`, `version`, `description` | Informational: not read by core. |

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

Dark mode: set the same tokens under both selectors so the toggle and the OS preference agree.

```css
:root { --pw-bg: #fff; --pw-fg: #111; --pw-accent: #0b63ce; }

@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) { --pw-bg: #0f0f10; --pw-fg: #ececec; --pw-accent: #7ab7ff; }
}
:root[data-theme='dark'] { --pw-bg: #0f0f10; --pw-fg: #ececec; --pw-accent: #7ab7ff; }
```

Fonts: `@import '@fontsource-variable/literata/wght.css';` (declare the package in `dependencies`), or `@font-face` rules pointing at files inside the theme folder (`url(../fonts/literata.woff2)`, bundled and hashed at build) or in `public/`. Give each a metric-matched local fallback (`size-adjust`, `ascent-override`) so the swap does not shift layout. Tailwind utilities are available inside theme components; the theme folder is scanned for class names.

## Components and layouts

Any file in `themes/<name>/components/` or `layouts/` replaces PaperWhite's default of the same name. Every slot resolves in this order:

1. `overrides/components/Header.astro` in your repository
2. `themes/<name>/components/Header.astro`
3. PaperWhite's default in `pw-core/components/`

Components: `Header`, `Footer`, `PostCard`, `PostMeta`, `TOC`, `Comments`, `Pagination`, `Backlinks`, `RelatedPosts`, `SeriesNav`, `Translations`, `TagList`, `Breadcrumbs`, `SearchBox`, `ThemeToggle`, `Cover`, `HeadExtra`, `ContentIslands`. Layouts: `Base`, `Post`, `Page`, `Home`, `Taxonomy`, `Archive`, `Tags`, `Search`, `NotFound`.

Import what you need from `@paperwhite/core/runtime` (`useLocale`, `encodePath`, `config`, `getNotes`, note types) and wrap instead of copying when you can:

```astro
---
// themes/ink/components/PostCard.astro
import Card from '@pw/core/components/PostCard.astro';
---
<div class="border-b border-border pb-4"><Card {...Astro.props} /></div>
```

`@pw/core/...` always points at PaperWhite's default; `@pw/theme/...` skips site overrides. Restart `paperwhite dev` after adding **new files** to a theme folder; edits to existing files reload on their own.

## One component, not a whole theme

```bash
pnpm exec paperwhite theme eject Footer          # → overrides/components/Footer.astro
pnpm exec paperwhite theme eject layouts/Post    # → overrides/layouts/Post.astro
```

`overrides/styles.css`, if present, loads after the theme's stylesheet for small token tweaks without touching the theme folder.

## Sharing a theme

A theme folder is self-contained, so sharing it is publishing the folder as a GitHub repository; users run `paperwhite add you/repo`. Tag releases (`v1.0.0`) so `add` picks a stable version. Keep `themeApi: 1` in `theme.json`, list font packages under `dependencies`, document which tokens you set and which slots you override, and check an RTL locale before claiming `rtl: "full"`. Repository housekeeping (`.git`, `node_modules`, `test/`, lockfiles, `package.json`) is not copied into sites.
