# Configuration

Everything is in `paperwhite.config.yaml` at the repository root. Only `site.url` and `site.title` are required; every other key has a default. Unknown keys and wrong types fail the build with a one-line message.

```yaml
site:
  url: https://blog.example.com      # absolute production URL, no trailing slash
  title: My Blog
  description: Notes from an Obsidian vault.
  author: me                          # key from `authors`, or a plain name
  logo: /logo.svg                     # from public/; used in JSON-LD
  organization: Example Ltd           # JSON-LD publisher; defaults to the title
  footer: "© 2026 Me · <a href=\"/now/\">now</a>"   # HTML allowed; replaces "Built with PaperWhite"
  social:
    github: https://github.com/me
    twitter: https://x.com/me
    mastodon: https://mastodon.social/@me
  i18n:                               # per-locale title / description / footer
    fa:
      title: وبلاگ من
      footer: "© ۲۰۲۶"

authors:
  me:
    name: My Name
    url: https://blog.example.com/about/
    email: me@example.com
    bio: One line about me.
    avatar: /me.jpg
    social: { github: https://github.com/me }

contentDir: ./content                 # or an Obsidian vault: ../MyVault/Blog
dirs:                                 # folder names inside contentDir
  posts: posts
  pages: pages
  attachments: attachments
  comments: comments

publishedOnly: false                  # true: only notes with `publish: true`
includeDrafts: false
includeFuture: false                  # true: build future-dated posts (scheduled posts off)
permalink: /:slug/                    # /:year/:slug/ · /:year/:month/:slug/ · folder (mirrors the vault)
trailingSlash: true

locales:
  default: en
  routing: prefix-other               # prefix-all puts every locale under /xx/
  supported:
    en: {}
    fa:                               # all optional; shown with their defaults for fa
      intl: fa-IR                     # BCP-47 tag for Intl formatting
      label: فارسی
      dir: rtl
      calendar: jalali                # or gregorian
      numerals: arabext               # latn · arab · arabext
      wpm: 180                        # reading-time speed
      typography: true                # ZWNJ, «», ی/ک normalization

theme: paper                          # themes/<name>/ in the repo, else built in; or a path

plugins:                              # folders under plugins/ (see plugins.md)
  - mermaid
  - excalidraw:
      cacheDir: .paperwhite/excalidraw

markdown:
  inlineTags: link                    # link · strip · keep — how `#tags` in text render
  math: frontmatter                   # frontmatter (`math: true` per note) · always · never
  transclusion: full                  # or first-section
  shikiThemes: { light: github-light, dark: github-dark }
  demoteHeadings: true                # body H1 → H2 so the page has one H1

seo:
  titleTemplate: "%s · %site"
  twitterHandle: "@me"
  defaultImage: /og-default.png       # when a note has no cover and OG images are off
  ogImages: true                      # generate a 1200×630 card per note
  audit:
    strict: false                     # true: every build fails on audit errors
    maxTitle: 60
    maxDescription: 160
  robots:
    disallow: [/drafts/]
    extra: "Crawl-delay: 1"
  humans: "Written by me."            # false to skip humans.txt
  security:                           # false (default) to skip security.txt
    contact: mailto:security@example.com
    expires: 2027-01-01
    policy: https://example.com/security/
  llms: true                          # llms.txt and llms-full.txt
  sitemapSplit: 10000

feeds:
  limit: 20
  fullContent: true
  perTag: true                        # /tags/<tag>/rss.xml

pagination:
  pageSize: 10

search: true                          # Pagefind index + search page
toc:
  default: true                       # per-note `toc: false` turns it off
  minHeadings: 3
  maxDepth: 3
related:
  count: 3

comments:
  provider: none                      # giscus · cusdis · webmentions
  giscus: { repo: me/blog, repoId: R_…, category: Comments, categoryId: DIC_…, mapping: pathname }
  cusdis: { appId: …, host: https://cusdis.com }
  webmentions: { domain: blog.example.com }

editUrl: https://github.com/me/blog/edit/main/content/   # "Edit on GitHub" links
graph: true                           # dist/graph.json
api: true                             # dist/api/posts.json and tags.json
mdx: false                            # load .mdx notes through @astrojs/mdx

i18n:                                 # override any UI string per locale
  en:
    footer.poweredBy: Made with care
  fa:
    nav.archive: بایگانی
```

## i18n

UI string keys (defaults in `pw-core/i18n/en.json` and `fa.json`): `nav.home`, `nav.archive`, `nav.tags`, `nav.search`, `nav.skip`, `nav.menu`, `post.readMore`, `post.readingTime`, `post.words`, `post.updated`, `post.published`, `post.by`, `post.toc`, `post.backlinks`, `post.related`, `post.series`, `post.seriesAll`, `post.prevInSeries`, `post.nextInSeries`, `post.edit`, `post.tags`, `post.translations`, `post.footnotes`, `code.copy`, `code.copied`, `comments.title`, `comments.archived`, `comments.count`, `comments.reply`, `search.placeholder`, `search.label`, `search.noResults`, `search.results`, `archive.title`, `archive.year`, `tags.title`, `tag.title`, `category.title`, `author.title`, `series.title`, `pagination.prev`, `pagination.next`, `pagination.page`, `404.title`, `404.body`, `404.home`, `theme.toggle`, `feed.rss`, `footer.poweredBy`, `redirect.body`, `image.close`.

Strings merge in this order: core → theme (`i18n` in its `theme.json`) → your config. Placeholders look like `{n}` and `{series}`.

## Environment variables

| Variable | Effect |
| --- | --- |
| `PAPERWHITE_STRICT=1` | same as `--strict` |
| `PAPERWHITE_SITE=<dir>` | which site to operate on (otherwise the nearest `paperwhite.config.yaml`) |
| `PAPERWHITE_NO_UPDATE_CHECK=1` | no daily "a newer PaperWhite is available" line |
| `PAPERWHITE_CORE_REPO=owner/repo` | where `paperwhite update` looks (for forks) |
| `GITHUB_TOKEN` | used for GitHub API calls by `add` and `update` when set (higher rate limit) |
