---
title: About
description: Design decisions and known limitations of PaperWhite v1.
---

## Decisions

- **Transclusion** renders the full note (Obsidian parity); `![[note#heading]]` renders one section.
- **Persian slugs** stay Unicode, percent-encoded in URLs and readable in links.
- **Search** uses Pagefind. Persian text and queries are normalized (ی/ک); stemming falls back to exact terms.
- **MDX** is opt-in with `mdx: true`. MDX notes bypass the Obsidian pipeline (no wikilinks or backlinks).
- **Wikilinks** resolve like Obsidian (path, then shortest-path filename, then alias), plus note titles and slugs as a fallback for imported vaults.

## Limitations

- Dataview is not supported (it needs a runtime). Use `paperwhite:query` fences.
- Mermaid needs a headless browser at build time (results are cached). Excalidraw uses an exported SVG when present, otherwise a clean built-in renderer without the hand-drawn style.
- The WordPress importer reads the standard WXR export; shortcodes other than `[caption]` are dropped.
