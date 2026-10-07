---
title: Customizing your blog
description: Config, themes, overrides and plugins, in the order you will need them.
date: 2026-01-03
tags: [guide]
---

Everything lives in your repository; nothing is hidden in a package.

## Config

`paperwhite.config.yaml` holds the site title, URL, locales, theme and plugins. Every option is listed in `pw-docs/configuration.md`.

## Themes

The built-in theme is **paper**. To change colors, fonts or spacing, copy it into your repo and edit the tokens:

```bash
paperwhite theme new mine       # themes/mine/, selected in the config
```

`themes/mine/styles/theme.css` sets `--pw-*` variables for light and dark mode. Any component in `themes/mine/components/` replaces the default of the same name. Someone else's theme installs the same way: `paperwhite add owner/repo`.

## One component

To change just the footer or the post card without a whole theme:

```bash
paperwhite theme eject Footer   # overrides/components/Footer.astro
```

## Plugins

Plugins add syntax at build time. Diagrams, for example:

```bash
paperwhite add paperwhite-blog/plugin-mermaid
```

That copies the plugin into `plugins/mermaid/`, installs what it needs and enables it in the config. Writing your own is a folder with a `plugin.json` and an `index.ts`; see `pw-docs/plugins.md`.
