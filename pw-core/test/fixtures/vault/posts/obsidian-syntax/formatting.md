---
title: Formatting
date: 2024-03-12
tags: [obsidian, syntax]
cssclasses: [wide, formatting-demo]
series: Obsidian syntax tour
series_order: 4
---

This is ==highlighted text== and ==**bold highlighted**== text.

%% This comment must never reach the HTML. %%

Inline %%hidden%% comments vanish too.

%%
Multi-line comments
are also removed.
%%

A paragraph with a block id. ^para-1

- List item with an id ^item-1
- Second item

| A | B |
| --- | --- |
| 1 | 2 |

^table-1

Inline tags: #syntax and #nested/tag-name, but not in `#code` or URLs like https://example.com/#anchor.

Footnote reference[^1] and an inline footnote^[This one is written inline.].

[^1]: The classic footnote text.

- [x] Done task
- [ ] Open task

~~Strikethrough~~ text.

Code with `%% not a comment %%` inside stays.
