# Contributing

PaperWhite is a pnpm monorepo. Node ≥ 22.12 and pnpm 10.

```bash
pnpm install
pnpm link-cli          # `paperwhite` on your PATH, pointing at this checkout
pnpm dev               # examples/site at http://localhost:4321
pnpm test              # unit + golden-file tests
pnpm typecheck
pnpm build && node scripts/assert-audit.mjs   # fixture build must report exactly 2 audit errors
pnpm e2e               # Playwright, after a build (pnpm exec playwright install chromium once)
```

## Where things live

| Change | Place |
| --- | --- |
| Markdown syntax, wikilinks, embeds | `packages/core/src/pipeline/plugins/` (one file per feature) + a fixture note in `fixtures/vault/posts/obsidian-syntax/` + golden test |
| Vault loading, indexing, cache key | `packages/core/src/content/` |
| SEO output (meta, JSON-LD, sitemaps, feeds, audit) | `packages/core/src/seo/`, `packages/core/routes/` |
| i18n, dates, Persian typography, slugs | `packages/core/src/i18n/` |
| Default UI | `packages/core/components/`, `layouts/`, `styles/base.css`, `islands/` |
| Theme resolution and the override cascade | `packages/core/src/theme/resolve.ts`, Vite plugin in `src/integration.ts` |
| The built-in theme | `packages/core/themes/paper/` |
| CLI commands | `packages/cli/src/commands/` |
| Docs | `docs/content/posts/` (built with PaperWhite itself: `pnpm docs:dev`) |

## Rules of the house

- **Themes set tokens, core owns components.** A new visual element must read `--pw-*` tokens and use logical properties (`margin-inline`, `inset-inline-start`) so RTL works with no theme effort. If a theme cannot restyle it with tokens alone, add a token.
- **Zero runtime JS by default.** Anything that needs the client goes in `islands/` as a small module loaded by `ContentIslands.astro`, and the post-page JS budget (30 KB, currently 5.5 KB) must hold. The build reports it and `scripts/assert-audit.mjs` fails CI when it is exceeded.
- **Deterministic output.** Builds must be byte-identical for identical input: no `Date.now()` in rendered HTML (security.txt's `Expires` is the one exception), sorted iteration over maps and file lists. `determinism.test.ts` checks it.
- **Site folders are not the monorepo.** Code that runs in routes is bundled into the user's site, where core's dependencies are not visible. Resolve files from core's dependencies at config time in the integration and pass paths through `virtual:paperwhite/config`, never `require.resolve` in route code.
- **Every syntax feature has a golden file.** Add the note to the fixture vault, run `pnpm vitest -u`, and read the diff before committing it.
- **Keep the audit honest.** The fixture vault contains exactly two deliberate errors; `scripts/assert-audit.mjs` fails CI if that changes.

## Theme contract (`themeApi: 1`)

A theme is a folder: `theme.json` (name, `themeApi: 1`, `rtl`, fonts, tokens, i18n) + `styles/theme.css` + optional `components/` and `layouts/`. Resolution order is `<site>/themes/<name>/`, then `packages/core/themes/<name>/`, then a path. Changing what a theme may contain or how slots resolve is a `themeApi` bump; document it in the changelog and refuse older manifests in `readManifest()`.

## Commits and releases

Conventional commits (`feat(core): …`, `fix(cli): …`, `docs: …`). Breaking changes go under **Breaking** in `CHANGELOG.md` in the same PR. Packages are versioned together; publishing to npm is not set up yet.

## Related repositories

- [starter](https://github.com/paperwhite-blog/starter): the template site (`paperwhite init` output + README).
- [plugin-mermaid](https://github.com/paperwhite-blog/plugin-mermaid), [plugin-excalidraw](https://github.com/paperwhite-blog/plugin-excalidraw): build-time diagram plugins. They link `@paperwhite/core` from a sibling checkout of this repo.
