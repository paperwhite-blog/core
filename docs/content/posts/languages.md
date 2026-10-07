---
title: Languages and RTL
description: Bilingual sites with English and Persian, Jalali dates, and correct mixed-direction text.
date: 2026-09-23
series: Guide
series_order: 3
tags: [guide, i18n]
---

```ts
locales: {
  default: 'en',
  routing: 'prefix-other', // /post for en, /fa/post for fa; or 'prefix-all'
  supported: { en: {}, fa: { calendar: 'jalali', numerals: 'arabext' } },
},
```

- Each note's `lang` sets `<html lang dir>`. Paragraphs use `dir="auto"` and `unicode-bidi: plaintext`, so Latin snippets in Persian text keep their order. Code is always LTR.
- Dates render through `Intl` with the locale's calendar: Gregorian for English, Jalali with Persian digits for Persian.
- Persian typography is on by default for `fa`: ZWNJ fixes (`می‌روم`, `کتاب‌ها`), «quotes», and ی/ک normalization in slugs and the search index.
- UI strings live in `i18n/*.json`; themes and sites override them per locale via `i18n` in the config.
- `translations` in frontmatter links language versions and emits `hreflang` alternates.

Next: [[SEO]].
