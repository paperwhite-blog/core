# Writing

## Where notes go

| Folder | Becomes |
| --- | --- |
| `content/posts/**.md` | posts, listed on the home page and in feeds; sub-folders are allowed |
| `content/pages/**.md` | pages such as `/about/`; no date, not in feeds |
| `content/attachments/` | images and files you embed (any folder in the vault works; this is the default for `![[file]]`) |
| `content/comments/` | imported comment threads (see the WordPress importer) |
| `content/_templates/` | templates for `paperwhite new`; never published |

Change the folder names with `dirs:` in the config.

## Publishing rules

- `draft: true` or `publish: false` excludes a note.
- `publishedOnly: true` in the config builds only notes with `publish: true` (Obsidian Publish parity).
- A `date` in the future is excluded until a build runs after that date. The deploy workflow rebuilds daily, so scheduled posts appear on time.
- Files and folders starting with `_` or `.` are ignored.

## Frontmatter

| Field | Meaning |
| --- | --- |
| `title` | Falls back to the first H1, then the file name |
| `description` | Meta description; an excerpt is generated when missing (the audit warns) |
| `date`, `updated` | ISO (`2024-10-05`) or Jalali (`1403/07/14`); `updated` falls back to git history |
| `slug` | Defaults to the slugified file name; Persian slugs are kept |
| `aliases` | Other names the note resolves under; each emits a 301 redirect |
| `tags`, `categories`, `series`, `series_order` | Archives, feeds, related posts, series navigation |
| `lang`, `dir` | Per-note locale; direction follows the locale |
| `cover`, `cover_alt` | `[[image.png]]` or a path; used for cards, feeds and the social image |
| `author`, `authors` | Keys from `authors` in the config, or names |
| `canonical`, `noindex` | SEO controls |
| `toc`, `math`, `cssclasses` | Per-note rendering switches |
| `redirect_from` | Legacy URLs such as `/?p=123` or `/2019/old-slug/` |
| `comments` | Path to an imported comment file, or `false` |
| `translations` | `{ fa: "[[سلام دنیا]]" }` links language versions and emits `hreflang` |

## Obsidian syntax

Everything renders at build time; callouts, math, code highlighting and transclusion ship zero JavaScript.

- **Wikilinks**: `[[Note]]`, `[[Note|alias]]`, `[[Note#Heading]]`, `[[Note#^block]]`. Resolution follows Obsidian (path, then shortest unique file name, then alias), plus note titles and slugs for imported vaults. Unresolved links render as `<span class="unresolved">` and fail a strict build.
- **Embeds**: `![[image.png|alt|400]]` (optimized AVIF/WebP with width and height, lazy, no layout shift), `![[file.pdf]]`, `![[audio.mp3]]`, `![[clip.mp4]]`, `![[note]]` and `![[note#heading]]` (transclusion, with a recursion guard).
- **Callouts** with custom types; `[!faq]-` folds with a pure `<details>`. FAQ callouts also produce `FAQPage` JSON-LD.
- `==highlights==`, `~~strikethrough~~`, `%% comments %%` (never published), `^block-ids`, inline `#tags` and nested `#parent/child` tags, GFM footnotes and `^[inline footnotes]`, tables, task lists.
- **Math** with `$…$` and `$$…$$` when `math: true` in frontmatter (or `markdown.math: always` in the config).
- **Code** with Shiki: ` ```ts title="file.ts" {2,4-5} ` for a file label and highlighted lines; a copy button is the only JavaScript.
- `cssclasses: [wide]` in frontmatter adds classes to the page body for per-note styling.

### Static queries instead of Dataview

Dataview needs a runtime, so it is not supported. For lists, use a build-time query block:

````markdown
```paperwhite:query
tags: guide          # any tag
folder: posts/notes  # optional
sort: date desc      # or title asc
limit: 10
```
````

### MDX

Set `mdx: true` in the config to also load `.mdx` files through Astro's MDX integration (install `@astrojs/mdx`). MDX notes can import components but bypass the Obsidian pipeline: no wikilinks, callouts or backlinks.

## Languages and RTL

```yaml
locales:
  default: en
  routing: prefix-other        # /post for en, /fa/post for fa; or prefix-all
  supported:
    en: {}
    fa: {}                     # Jalali calendar, Persian digits and typography by default
    ar: { calendar: gregorian, numerals: arab }
```

- A note's `lang` sets `<html lang dir>`. Paragraphs use `dir="auto"` and `unicode-bidi: plaintext`, so Latin snippets in Persian text keep their order. Code is always LTR.
- Dates render through `Intl` with the locale's calendar: Gregorian for English, Jalali with Persian digits for Persian.
- Persian typography is on by default for `fa`: ZWNJ fixes (`می‌روم`, `کتاب‌ها`), «quotes», and ی/ک normalization in content, slugs and the search index.
- UI strings come from `pw-core/i18n/<locale>.json`; override any per locale with `i18n:` in the config (see [Configuration](configuration.md#i18n)).
- `translations` in frontmatter links language versions and emits `hreflang` alternates; the header offers the switch.

## Importing from WordPress

```bash
pnpm exec paperwhite import wordpress-export.xml --download
```

Posts, pages, tags, categories, featured images and approved comments are imported; `--download` fetches media into `content/attachments/`. Legacy URLs (`/?p=123` and old permalinks) become `redirect_from`, so search equity is preserved. Shortcodes other than `[caption]` are dropped.
