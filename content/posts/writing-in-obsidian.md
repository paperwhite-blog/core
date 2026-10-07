---
title: Writing in Obsidian
description: Every piece of Obsidian syntax PaperWhite renders, on one page.
date: 2026-01-04
tags: [guide, obsidian]
cover: "[[cat.jpg]]"
cover_alt: A cat on a stack of books, used as the cover image
---

Write the way you already do in Obsidian. This note uses each feature once.

## Links and embeds

A wikilink to a note: [[Welcome to your new blog]]. With an alias: [[Publishing|how to publish]]. To a heading: [[Customizing your blog#Themes]]. Unresolved links are reported by the build audit so they never ship broken.

Images are embedded with the same syntax and come out optimized, sized and lazy-loaded:

![[cat.jpg|A cat, resized to 480px|480]]

Embedding another note, or a section of it, pastes its rendered content here:

![[About]]

## Callouts

> [!note] A note
> Callouts render as static HTML. Custom types work too.

> [!faq]- Can callouts fold?
> Yes. A `-` after the type makes a `<details>` element, no JavaScript needed.

## Text

Some ==highlighted== words, ~~struck~~ words, **bold**, *italic*, `inline code`, and a footnote[^1]. Inline footnotes work as well.^[Like this one.] Comments like %% this %% never reach the page. Tags inline: #obsidian #guide.

- [x] Task lists
- [ ] render as checkboxes

| Feature | Build-time | Runtime JS |
| --- | --- | --- |
| Math | KaTeX | none |
| Code | Shiki | copy button only |
| Search | Pagefind index | loaded on demand |

## Math and code

Inline $E = mc^2$ and display math:

$$
\int_0^\infty e^{-x^2}\,dx = \frac{\sqrt{\pi}}{2}
$$

```ts title="hello.ts" {2}
export function hello(name: string) {
  return `Hello, ${name}`;
}
```

## Queries

A static replacement for Dataview lists:

```paperwhite:query
tags: guide
sort: date desc
```

[^1]: Footnotes gather at the end of the post.
