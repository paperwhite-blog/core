# Changelog

## Unreleased

### Breaking

- **Themes are folders, not packages.** `theme: 'x'` now resolves `<site>/themes/x/` first, then the themes built into core. npm theme packages (`paperwhite-theme-*`) are no longer resolved; copy the folder into `themes/` instead. The default theme is `paper`, built into `@paperwhite/core`, so `paperwhite-theme-paper` is gone and `theme` can be left out of the config.
- `paperwhite theme add` is removed. `paperwhite theme new <name> [--from paper]` copies a theme into `themes/<name>/` and selects it; `theme list` shows available themes and slot sources; `theme eject <Component>` is unchanged.
- The Mermaid and Excalidraw plugins moved to their own repositories (`paperwhite-blog/plugin-mermaid`, `paperwhite-blog/plugin-excalidraw`).

### Fixed

- Sites outside this monorepo can now build: OG image fonts are resolved from core's dependencies at config time instead of from the site, and a theme's `styles/theme.css` may `@import` packages that only core depends on (`@fontsource-variable/*`).
- Components in a site's `themes/` or `src/overrides/` can import `@paperwhite/core/*` and core's dependencies under strict package managers.

### Added

- `@paperwhite/core/theme` exports `resolveTheme`, `listThemes`, `coreDir`.
- `paperwhite init` writes `themes/README.md` explaining the theme folder.
- `LICENSE` (MIT), `CONTRIBUTING.md`.

## 0.1.0

- First release of `@paperwhite/core`, `paperwhite` (CLI), `paperwhite-theme-paper`, `@paperwhite/plugin-mermaid` and `@paperwhite/plugin-excalidraw`.
- Theme contract: `themeApi: 1`.
