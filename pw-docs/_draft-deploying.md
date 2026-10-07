---
title: Deploying
description: Hosting the static output, wiring redirects, and scheduling posts.
date: 2026-09-26
series: Guide
series_order: 6
tags: [guide, deploy]
---

`dist/` is plain static files with clean URLs (`/slug/`). Any host works.

## Redirects

Aliases, `redirect_from` and changed slugs (tracked in `paperwhite.slugs.json` — commit it) produce:

| File | Host |
| --- | --- |
| `_redirects` | Netlify, Cloudflare Pages (query-string rules are Netlify-only) |
| `vercel.json` | Vercel |
| `nginx-redirects.conf` | nginx: `include` it in `http {}`, then `if ($paperwhite_redirect) { return 301 $paperwhite_redirect; }` |
| meta-refresh pages | everywhere else (path redirects only) |

## Scheduled publishing

Posts dated in the future are skipped. Rebuild on a schedule so they appear on time, for example daily with GitHub Actions:

```yaml
on:
  schedule:
    - cron: '0 6 * * *'
```

## Migrating from WordPress

```bash
paperwhite import wordpress-export.xml --download
```

Posts, pages, tags, categories, featured images and approved comments are imported. Legacy URLs (`/?p=123` and old permalinks) become `redirect_from`, so search equity is preserved. See [[About|the decisions page]] for what is not imported.
