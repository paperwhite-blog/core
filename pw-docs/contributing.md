# Contributing to PaperWhite

The core repository is also the blog template, so it carries both: `pw-core/` (the code) and the development tooling under `dev/` and `pw-core/test/` that `paperwhite init` strips from blogs.

```bash
git clone https://github.com/paperwhite-blog/core && cd core
pnpm install
pnpm dev                 # the sample site at the root, http://localhost:4321
pnpm fixture:dev         # the 50-note fixture vault (every syntax, en + fa, two deliberate audit errors)
pnpm test                # unit + golden-file tests (pw-core/test)
pnpm typecheck
pnpm fixture:build && node dev/assert-audit.mjs   # fixture build must report exactly the 2 deliberate errors
pnpm e2e                 # Playwright visual + behaviour tests against the fixture build (install chromium once)
pnpm lhci                # Lighthouse ≥ 95 everywhere
pnpm bench               # 1,000-post cold and incremental build budgets
```

Node ≥ 22.12, pnpm 10. `pnpm link-cli` puts `paperwhite` on your PATH pointing at this checkout.

## Where things live

| Change | Place |
| --- | --- |
| Markdown syntax, wikilinks, embeds | `pw-core/src/pipeline/plugins/` (one file per feature) + a fixture note in `pw-core/test/fixtures/vault/posts/obsidian-syntax/` + a golden test |
| Vault loading, indexing, cache key | `pw-core/src/content/` |
| SEO output | `pw-core/src/seo/`, `pw-core/routes/` |
| i18n, dates, Persian typography, slugs | `pw-core/src/i18n/` |
| Default UI | `pw-core/components/`, `layouts/`, `styles/base.css`, `islands/` |
| Theme resolution, override cascade, stylesheet inlining | `pw-core/src/theme/resolve.ts`, Vite plugin in `src/integration.ts` |
| The built-in theme | `pw-core/themes/paper/` |
| Config schema and YAML loading | `pw-core/src/config.ts`, `pw-core/src/config/load.ts` (update `pw-docs/configuration.md` too) |
| CLI commands | `pw-core/src/cli/commands/` |
| Deploy workflow templates, user README | `pw-core/templates/` |
| Documentation | `pw-docs/` |

## Rules of the house

- **Themes set tokens, core owns components.** New visual elements read `--pw-*` tokens and use logical properties so RTL works with no theme effort. If a theme cannot restyle something with tokens alone, add a token.
- **Zero runtime JS by default.** Client code goes in `islands/` as a small module loaded by `ContentIslands.astro`; the post-page budget (30 KB, currently 5.5 KB) is reported by the build and asserted by `dev/assert-audit.mjs`.
- **Deterministic output.** No `Date.now()` in rendered HTML (`security.txt`'s `Expires` excepted), sorted iteration over maps and file lists, ids derived from vault-relative paths. `determinism.test.ts` checks it.
- **Site folders are not the monorepo.** Route code is bundled into the user's site, where core's dependencies are not visible. Resolve files from core's dependencies at config time in the integration and pass paths through `virtual:paperwhite/config`; never `require.resolve` in route code.
- **Every syntax feature has a golden file.** Add the note to the fixture vault, run `pnpm vitest -u` inside `pw-core`, read the diff before committing it.
- **Keep the audit honest.** The fixture vault contains exactly two deliberate errors; `dev/assert-audit.mjs` fails CI if that changes.
- **Never run `paperwhite init` or `update` in this checkout.** Both delete folders; test them on a throwaway `git clone` (the `init` and `update` tests do exactly that on temp directories).

## Contracts

| Contract | Where | Bump when |
| --- | --- | --- |
| `paperwhite.config.yaml` | `validateUserConfig` | an option is removed or changes meaning (document it in the changelog under **Breaking**) |
| `themeApi: 1` | `readManifest` | what a theme folder may contain, or how slots resolve, changes |
| `pluginApi: 1` | `detectKind` / `resolvePlugins` | the `PaperwhitePlugin` interface changes incompatibly |

## Releasing

Bump `version` in `pw-core/package.json`, add the entry to `pw-docs/changelog.md`, commit, tag `vX.Y.Z` and push the tag, then create a GitHub release from it with the changelog entry as notes. `paperwhite update` in every blog picks it up from there. Conventional commits (`feat(core): …`, `fix(cli): …`, `docs: …`); `!` marks breaking changes.
