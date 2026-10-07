---
title: SEO
description: What PaperWhite generates automatically and how the build-time audit works.
date: 2026-09-24
series: Guide
series_order: 4
tags: [guide, seo]
---

## Generated for every page

- Title templates, meta description, canonical, robots, Open Graph and Twitter cards.
- An OG image per note (1200×630, Persian fonts included), cached between builds.
- JSON-LD: `BlogPosting`, `BreadcrumbList`, `WebSite` with `SearchAction`, `FAQPage` for FAQ callouts, `ItemList` for series.
- Sitemaps per locale with `lastmod`, images and `hreflang`, split at 10,000 URLs.
- RSS 2.0, Atom and JSON Feed per locale, RSS per tag.
- `robots.txt`, `humans.txt`, `security.txt`, `llms.txt` and `llms-full.txt`.

## The audit

Every build checks the output and the vault:

| Level | Rules |
| --- | --- |
| error | broken internal links, unresolved wikilinks, duplicate titles, images without alt |
| warning | titles over 60 chars, descriptions over 160, missing descriptions, heading order, H1 count |
| info | orphan notes |

`paperwhite build --strict` (or `PAPERWHITE_STRICT=1`) fails the build on errors. The full report is written to `.paperwhite/audit.json`. `paperwhite check --external` also checks outgoing links, cached for a week.

Next: [[Themes]].
