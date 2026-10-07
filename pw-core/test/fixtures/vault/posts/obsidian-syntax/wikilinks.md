---
title: Wikilinks
date: 2024-03-05
tags: [obsidian, syntax]
series: Obsidian syntax tour
series_order: 1
---

Every wikilink form Obsidian supports.

## Basic

- Plain: [[Hello World]] (resolved by filename, case-insensitive)
- With alias: [[Hello World|the first post]]
- To a heading: [[Hello World#Why PaperWhite]]
- To a block: [[Hello World#^why-block]]
- Same-note heading: [[#Basic]]
- Via an alias: [[first-post]]
- By path: [[obsidian-syntax/callouts]]
- Markdown link to a note: [the callouts note](callouts.md)
- Broken on purpose: [[This Note Does Not Exist]]
- Link to a draft: [[Draft post]]

## In a table

| Link | Note |
| --- | --- |
| [[Hello World\|aliased in a table]] | pipes must be escaped |
