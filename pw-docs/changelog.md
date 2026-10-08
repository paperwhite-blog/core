# Changelog

## 0.1.1 — 2026-10-08

### Fixed

- `paperwhite init` no longer rewrites git history. Repositories created with GitHub's **Use this template** keep their history and `origin`, so `git push` works right after init. A remote that points at `paperwhite-blog/core` (a direct clone) is still removed; `--fresh-history` is the opt-in way to start over.

## 0.1.0 — 2026-10-08

First release: the repository is the blog. Clone it, run `paperwhite init`, write. Earlier iterations (npm packages, `paperwhite-theme-paper`, TypeScript config) were never released; the entries below describe the changes relative to those drafts.

### Breaking

- **The repository is the blog.** Clone `paperwhite-blog/core`, run `paperwhite init`, write. Code lives in `pw-core/`, docs in `pw-docs/`, your site at the root (`paperwhite.config.yaml`, `content/`, `themes/`, `plugins/`, `public/`). The `@paperwhite/core` and `paperwhite` npm packages are not published; the workspace links `pw-core/`.
- **YAML config.** `paperwhite.config.yaml` replaces `paperwhite.config.ts`. Options are validated with explicit messages. `plugins:` lists folder names under `plugins/` (optionally with options). `site.footer` sets the footer text.
- **Plugins are folders** (`plugins/<name>/` with `plugin.json`, `pluginApi: 1`, and `index.ts` exporting `(options) => plugin`), installed with `paperwhite add owner/repo`. Mermaid and Excalidraw live in `paperwhite-blog/plugin-mermaid` and `plugin-excalidraw`.
- `src/overrides/` is now `overrides/`.
- Astro runs from a generated project under `.paperwhite/site/`; a site no longer has `astro.config.ts` or `src/content.config.ts`.
- **Themes are folders, not packages.** `theme: 'x'` now resolves `<site>/themes/x/` first, then the themes built into core. npm theme packages (`paperwhite-theme-*`) are no longer resolved; copy the folder into `themes/` instead. The default theme is `paper`, built into `@paperwhite/core`, so `paperwhite-theme-paper` is gone and `theme` can be left out of the config.
- `paperwhite theme add` is removed. `paperwhite theme new <name> [--from paper]` copies a theme into `themes/<name>/` and selects it; `theme list` shows available themes and slot sources; `theme eject <Component>` is unchanged.
- The Mermaid and Excalidraw plugins moved to their own repositories (`paperwhite-blog/plugin-mermaid`, `paperwhite-blog/plugin-excalidraw`).

### Fixed

- Sites outside this monorepo can now build: OG image fonts are resolved from core's dependencies at config time instead of from the site, and a theme's `styles/theme.css` may `@import` packages that only core depends on (`@fontsource-variable/*`).
- Components in a site's `themes/` or `src/overrides/` can import `@paperwhite/core/*` and core's dependencies under strict package managers.

### Added

- `paperwhite init` (interactive, every answer a flag): config, strips development files, sample content, deploy workflow for GitHub Pages / Cloudflare / Netlify / Vercel, fresh git history.
- `paperwhite add <owner/repo[#ref] | path>` for themes and plugins, with dependency installation and config update.
- `paperwhite update [--check] [--from]` follows releases of core on GitHub and replaces `pw-core/` and `pw-docs/`; `dev`/`build` print a daily notice.
- Attachment URLs hash the vault-relative path (stable across machines); "last updated" survives renames.
- `pw-docs/`: a complete Markdown manual.
- `@paperwhite/core/theme` exports `resolveTheme`, `listThemes`, `coreDir`.
- `paperwhite init` writes `themes/README.md` explaining the theme folder.
- `LICENSE` (MIT), `CONTRIBUTING.md`.
