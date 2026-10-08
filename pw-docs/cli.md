# CLI

`paperwhite` is installed by `pnpm install` (it is the `bin` of `pw-core/`). Run it as `pnpm exec paperwhite <command>`, or through the root scripts (`pnpm dev`, `pnpm build`, …). Commands find the site from the nearest `paperwhite.config.yaml` (or `--site <dir>` / `PAPERWHITE_SITE`).

| Command | Does |
| --- | --- |
| `init [--yes] [--title …] [--description …] [--url …] [--author …] [--locale en,fa] [--deploy github-pages\|cloudflare\|netlify\|vercel\|none] [--keep-samples] [--fresh-history]` | Turns a repository created from the template (or a clone) into your blog. Interactive unless `--yes`. Git history and `origin` are kept; a remote pointing at core is removed; `--fresh-history` starts over with one commit. See [Getting started](getting-started.md). |
| `dev [--port N] [--host] [--open]` | Dev server with live reload on note edits. |
| `build [--strict]` | Static build into `dist/`, search index, SEO audit. `--strict` fails on audit errors. |
| `preview [--port N] [--open]` | Serves `dist/`. |
| `check [--external] [--force] [--strict] [--json]` | Vault-level audit without building: links, images, frontmatter, orphans. `--external` checks outgoing links (cached a week; `--force` ignores the cache). |
| `new "Title" [--lang fa] [--page] [--dir sub/folder]` | Creates a note from `content/_templates/post.md` with `draft: true`. |
| `theme list` | Available themes (`themes/` and built in), the active one, and where every component slot comes from. |
| `theme new <name> [--from paper] [--force]` | Copies a theme into `themes/<name>/` and sets `theme:`. |
| `theme eject <Component\|layouts/Name> [--force]` | Copies one component or layout into `overrides/`. |
| `add <owner/repo[#ref] \| github URL \| path> [--name x] [--force] [--no-install] [--no-config]` | Installs a theme or plugin folder from GitHub (latest release, else newest tag, else default branch) or a local folder; installs its declared dependencies; switches it on in the config. |
| `update [--check] [--from <dir\|.tar.gz>] [--force] [--no-install]` | Updates `pw-core/` and `pw-docs/` to the latest release. See [Updating](updating.md). |
| `import <export.xml\|.zip> [--download] [--drafts] [--lang fa] [--out dir]` | Imports a WordPress WXR export: posts, pages, taxonomies, media (`--download`), approved comments, legacy-URL redirects. |

`--help` on any command lists its flags. Set `DEBUG=1` to see stack traces instead of one-line errors.

## Exit codes

`0` success · `1` error (bad config, missing site, failed build, strict audit errors) · tests of `check --strict` exit `1` on warnings too.
