---
title: Getting started
description: Create a PaperWhite blog from an Obsidian vault in under a minute.
date: 2026-09-21
series: Guide
series_order: 1
tags: [guide]
---

PaperWhite turns a folder of Markdown — written the Obsidian way — into a fast, SEO-complete static blog.

## Create a site

```bash
npx paperwhite init my-blog --locale en,fa
cd my-blog
pnpm install
pnpm dev
```

`init` writes a typed `paperwhite.config.ts`, an Astro config, a starter vault in `content/` and an empty `themes/` folder. The site uses the built-in `paper` theme until you add your own — see [[Themes]].

## Point it at your vault

Set `contentDir` to your Obsidian vault (or a sub-folder of it):

```ts title="paperwhite.config.ts"
export default defineConfig({
  site: { url: 'https://example.com', title: 'My Blog' },
  contentDir: '../my-obsidian-vault/Blog',
});
```

Files and folders starting with `_` or `.` are ignored, so `_templates/` and `.obsidian/` never ship.

## Build and deploy

```bash
pnpm build          # static build + search index + SEO audit
pnpm build:ci       # same, but fails on audit errors
```

The output is a plain `dist/` folder: deploy it to any static host. See [[Deploying]].

Next: [[Writing notes]].
