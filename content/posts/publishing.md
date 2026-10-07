---
title: Publishing
description: Build output, hosting, scheduled posts and keeping PaperWhite up to date.
date: 2026-01-02
tags: [guide, deploy]
---

`paperwhite build` writes a complete static site to `dist/`: HTML with inlined CSS, optimized images, a search index, RSS/Atom/JSON feeds, sitemaps, social cards and redirect files for Netlify, Vercel and nginx. Any static host serves it.

## GitHub

`paperwhite init` writes a GitHub Actions workflow for the host you pick: GitHub Pages deploys from the workflow itself; Cloudflare Pages, Netlify and Vercel build from your repository and the workflow only triggers a rebuild on a schedule.

## Scheduled posts

A post dated in the future is skipped until a build runs after that date. The workflow rebuilds once a day, so scheduled posts appear on time without you touching anything.

## Staying current

PaperWhite's code lives in `pw-core/`. When a new version is released:

```bash
paperwhite update --check   # what is new
paperwhite update           # replace pw-core/ and pw-docs/, keep everything of yours
```

A post dated in the future, like this one, is a good test: set `date` to tomorrow and watch it appear after the scheduled build.
