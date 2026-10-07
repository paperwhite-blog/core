# Updating PaperWhite

PaperWhite's code is the `pw-core/` folder in your repository, with its version in `pw-core/package.json`. Releases are tags on [paperwhite-blog/core](https://github.com/paperwhite-blog/core).

```bash
pnpm exec paperwhite update --check     # is there a newer release? shows the release notes
pnpm exec paperwhite update             # fetch it and replace pw-core/ and pw-docs/
```

`update`:

1. compares your version with the latest release (or newest tag);
2. refuses to continue if `pw-core/` or `pw-docs/` have uncommitted changes (you were not supposed to edit them; `--force` overrides);
3. downloads the release tarball and replaces the **contents** of `pw-core/` and `pw-docs/` only. `pw-core/node_modules` is kept, `pw-core/test` is not copied into a site that `init` slimmed down, and nothing outside the two folders is touched: your config, content, themes, plugins, overrides and workflows stay as they are;
4. runs `pnpm install` so dependency changes land (the root `package.json` is yours, so a new Astro major version is one line for you to bump there; the changelog says when);
5. points you at `pw-docs/changelog.md`.

Commit the result like any other change. `dev` and `build` print a one-line notice once a day when a newer version exists (`PAPERWHITE_NO_UPDATE_CHECK=1` disables it).

## Breaking changes

The changelog marks them. The three contracts that can break are the config file (`paperwhite.config.yaml`, validated with clear messages, so a removed option fails the next build with its name), `themeApi` for themes and `pluginApi` for plugins: core refuses a theme or plugin that targets another number instead of rendering it wrong.

## Offline or from a fork

```bash
pnpm exec paperwhite update --from ../paperwhite-core          # a local checkout
pnpm exec paperwhite update --from ./core-v0.3.0.tar.gz        # a downloaded release
PAPERWHITE_CORE_REPO=you/core pnpm exec paperwhite update      # follow a fork's releases
```

## If you edited pw-core/ anyway

Keep your change as a patch (`git diff -- pw-core > my.patch`), update, re-apply, and consider making it a theme component override or a plugin instead, which survive updates without any of that.
