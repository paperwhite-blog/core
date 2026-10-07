# SEO

## Generated for every page

- Title template, meta description, canonical, robots, Open Graph and Twitter cards.
- A social image per note (1200×630, Persian fonts included), cached between builds in `.paperwhite/og/`.
- JSON-LD: `BlogPosting`, `BreadcrumbList`, `WebSite` with `SearchAction`, `FAQPage` for FAQ callouts, `ItemList` for series.
- Sitemaps per locale with `lastmod`, images and `hreflang`, split at 10,000 URLs (`sitemap-index.xml`).
- RSS 2.0, Atom and JSON Feed per locale, RSS per tag.
- `robots.txt`, `humans.txt`, `.well-known/security.txt`, `llms.txt` and `llms-full.txt`.
- Clean URLs with trailing slashes, `rel=prev/next` on paginated lists, tag/category/author/year/series archives.
- Redirects for aliases, `redirect_from` and renamed notes: `_redirects` (Netlify, Cloudflare Pages), `vercel.json`, `nginx-redirects.conf`, and meta-refresh pages for everyone else. Slug history lives in `paperwhite.slugs.json`; commit it.
- `dist/api/posts.json`, `dist/api/tags.json` and `dist/graph.json` for anything you want to build on top.
- Edit-on-GitHub links when `editUrl` is set; "last updated" from `updated` in frontmatter or git history.

## The audit

Every build checks the output and the vault:

| Level | Rules |
| --- | --- |
| error | broken internal links, unresolved wikilinks, duplicate titles, images without alt text |
| warning | titles over 60 characters, descriptions over 160, missing descriptions, heading order, more than one H1 |
| note | orphan notes (nothing links to them) |

`paperwhite build --strict` (or `PAPERWHITE_STRICT=1`, or `seo.audit.strict: true`) fails the build on errors; the deploy workflow uses it. The full report is written to `.paperwhite/audit.json`. `paperwhite check` runs the vault-level rules without building; `paperwhite check --external` also checks outgoing links, cached for a week in `.paperwhite/`.

## Performance

The default theme measures 100/100/100/100 in Lighthouse on mobile, 0 CLS, and about 5.5 KB of JavaScript on a post page (the search index loads only on the search page). The build reports the JavaScript size of the heaviest post page and warns above 30 KB. Keep it that way in a theme: no client frameworks, no font loading from third parties, images through `![[embed]]` so they get dimensions and modern formats.
