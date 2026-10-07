---
title: Writing notes
description: Frontmatter, publishing rules, and every Obsidian syntax PaperWhite renders.
date: 2026-09-22
series: Guide
series_order: 2
tags: [guide, obsidian]
---

## Publishing rules

- `draft: true` or `publish: false` excludes a note.
- `publishedOnly: true` in the config builds only notes with `publish: true` (Obsidian Publish parity).
- A `date` in the future is excluded until a build after that date — see [[Deploying#Scheduled publishing]].

## Frontmatter

| Field | Meaning |
| --- | --- |
| `title` | Falls back to the first H1, then the filename |
| `description` | Meta description; an excerpt is generated when missing |
| `date`, `updated` | ISO (`2024-10-05`) or Jalali (`1403/07/14`) |
| `slug` | Defaults to the slugified filename; Persian slugs are kept |
| `aliases` | Resolve wikilinks and emit 301 redirects |
| `tags`, `categories`, `series` | Archives, feeds, related posts, series navigation |
| `lang`, `dir` | Per-note locale; direction follows the locale |
| `cover` | `[[image.png]]` or a path; used for cards and feeds |
| `canonical`, `noindex` | SEO controls |
| `toc`, `math`, `cssclasses` | Per-note rendering switches |
| `redirect_from` | Legacy URLs such as `/?p=123` |
| `comments` | Path to imported comments, or `false` |
| `translations` | `{ fa: "[[سلام دنیا]]" }` → hreflang alternates |

## Obsidian syntax

> [!tip] Everything renders at build time
> Callouts, math, code highlighting and transclusion ship **zero** JavaScript.

- Wikilinks: `[[Note]]`, `[[Note|alias]]`, `[[Note#Heading]]`, `[[Note#^block]]`. Unresolved links render as `<span class="unresolved">` and are reported by the audit.
- Embeds: `![[image.png|400]]` (optimized AVIF/WebP with dimensions), `![[file.pdf]]`, `![[audio.mp3]]`, `![[note]]`, `![[note#heading]]`.
- Callouts with custom types and `[!faq]-` folding (pure `<details>`).
- ==Highlights==, `%% comments %%`, `^block-ids`, inline `#tags`, footnotes and `^[inline footnotes]`.
- Math with `$…$` / `$$…$$` when `math: true`.

### Static queries instead of Dataview

Dataview needs a runtime, so it is not supported. For simple lists use a build-time query:

```paperwhite:query
tags: guide
sort: date asc
```

Next: [[Languages and RTL]].
