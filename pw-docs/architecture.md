# Architecture

Everything is in `pw-core/`, one package (`@paperwhite/core`) that is also the `paperwhite` CLI. The site repository depends on it through the pnpm workspace, so there is nothing to publish or install from a registry; `paperwhite update` replaces the folder.

```
pw-core/
  bin/paperwhite.mjs      CLI entry (runs the TypeScript sources through jiti)
  src/
    cli/                  commands: init, dev/build/preview, check, new, theme, add, update, import
    config.ts             the typed config, defaults (resolveConfig) and its JSON-safe projection
    config/load.ts        paperwhite.config.yaml → validated config, plugins loaded from plugins/<name>/
    integration.ts        the Astro integration: routes, Tailwind, the override cascade, post-build steps
    content/              vault walk, global index, per-note render + cache key, images, assets, git dates
    pipeline/             the unified (remark/rehype) pipeline and one plugin per Obsidian feature
    i18n/                 locales, dates (Intl + Jalali), digits, Persian typography, slugs, UI strings
    seo/                  meta/JSON-LD builders, OG cards (satori + resvg), sitemaps, feeds, the audit
    runtime/              what components import: config, notes, URLs, i18n helpers
    theme/resolve.ts      theme lookup (themes/<name> → built in → path) and the override cascade
    build/                Pagefind indexing, asset copy, JS budget
  components/ layouts/    the default UI; every file is a slot a theme or overrides/ can replace
  routes/                 injected routes: the catch-all page, feeds, sitemaps, OG images, txt files, redirects
  islands/                the few client scripts (TOC scroll-spy, theme toggle, copy-code, search, lightbox)
  styles/base.css         core styles, driven only by --pw-* tokens, logical properties for RTL
  themes/paper/           the built-in default theme
  templates/              deploy workflows and the user README written by init
  i18n/*.json             default UI strings
  test/                   unit + golden-file tests and the fixture vault (removed from blogs by init)
```

## A build, step by step

1. **CLI** finds the site (`paperwhite.config.yaml`), writes a tiny Astro project under `.paperwhite/site/` (Astro needs `astro.config` and `src/content.config.ts` at its root; a PaperWhite site keeps neither), and runs Astro there with `dist/` and `public/` pointed back at the site.
2. **Config** is read once by `readUserConfig`: YAML parsed, shape validated, `plugins:` turned into plugin instances by importing `plugins/<name>/index.ts`.
3. **Content layer**: the loader walks the vault and builds a global index first (aliases, headings, block ids, links), then renders each note through PaperWhite's own unified pipeline. Rendered HTML is stored on the entry, so Astro's Markdown processor is not involved. Unchanged notes are reused from the cache; the key covers the note, the vault's link surface, embedded sources, the pipeline code, the plugin folders and render config.
4. **Integration** injects every route, adds Tailwind, and resolves `@pw/components/*` and `@pw/layouts/*` through the cascade `overrides/` → theme → core. Theme and override stylesheets are inlined into the generated stylesheet with imports rewritten to absolute paths, so a theme folder can `@import` packages core depends on.
5. **Post-build**: optimized assets copied to `/_pw/`, Pagefind index, JS budget, SEO audit (`.paperwhite/audit.json`), strict mode.

## Why these shapes

- **Folders, not packages, for themes and plugins.** A user can read, edit and version them in their own repository, and `add` is a copy. The price is that plugin dependencies are declared in `plugin.json` and installed into the site's `package.json`.
- **A generated Astro root.** Keeps the repository root to what a writer cares about, and keeps Astro's cache per site.
- **Zero runtime JavaScript by default.** Islands are opt-in and small; the budget is enforced at build time.
- **Determinism.** Identical input gives byte-identical output (`security.txt`'s `Expires` is the one exception), which is what makes the golden-file tests and the e2e visual baselines reliable.

The original requirements document is [requirements.md](requirements.md); [decisions.md](decisions.md) lists where and why the implementation deviates.
