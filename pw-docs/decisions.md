# Decisions and limitations

## Decisions

- **A clone is the blog.** The repository you clone contains the code (`pw-core/`), the docs (`pw-docs/`), a sample site and the tooling to develop PaperWhite. `init` strips the tooling; `update` replaces the code and docs. There is no npm package to publish or install.
- **Themes and plugins are folders**, installed by copying (`paperwhite add` from GitHub). Dependencies they need are declared in their manifest and installed into the site.
- **One YAML config.** `paperwhite.config.yaml` is validated with explicit messages. Functions (custom remark/rehype plugins) are not configurable from YAML; write a plugin folder instead.
- **Transclusion** renders the full note (Obsidian parity); `![[note#heading]]` renders one section; `markdown.transclusion: first-section` changes the default.
- **Persian slugs** stay Unicode, percent-encoded in URLs and readable in links.
- **Search** uses Pagefind with build-time ی/ک normalization of content, titles and queries. Stemming quality for Persian was not evaluated.
- **MDX** is opt-in with `mdx: true`. MDX notes bypass the Obsidian pipeline (no wikilinks or backlinks).
- **Wikilinks** resolve like Obsidian (path, then shortest-path file name, then alias), plus note titles and slugs as a fallback for imported vaults.
- **Dates** use `Intl` (Persian calendar and digits are built in) plus `jalaali-js` for parsing.
- **Last updated** comes from `updated` in frontmatter, else git history with rename detection, so moving a note does not reset its date.
- **TOC scroll-spy** is a small IntersectionObserver island rather than CSS `scroll-timeline`.

## Limitations

- Dataview is not supported (it needs a runtime). Use `paperwhite:query` fences.
- The Mermaid plugin needs a headless browser at build time; results are cached. Excalidraw uses an exported SVG when present, otherwise a clean built-in renderer without the hand-drawn style.
- The WordPress importer reads the standard WXR export; shortcodes other than `[caption]` are dropped.
- Astro's module resolution treats absolute paths outside its project root as root-relative unless they share an ancestor folder with it, so `pw-core/` must live inside the site repository (it does, by construction).
- pnpm is required (the workspace protocol links `pw-core/`). A blog also installs `pw-core`'s own devDependencies (vitest, typescript, vite) because pnpm installs them for workspace packages; they are unused there and harmless.
- Visual-regression baselines are committed for macOS; CI generates Linux baselines on first run.
