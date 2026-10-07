# Deploying

`pnpm build` writes a complete static site to `dist/`. Any static host serves it. `paperwhite init` writes `.github/workflows/deploy.yml` for the target you choose; the templates live in `pw-core/templates/deploy/` if you want to look or switch later (copy one over `deploy.yml`).

## GitHub Pages

The workflow builds with `pnpm build --strict` and deploys with `actions/deploy-pages`. In the repository: Settings → Pages → Source: **GitHub Actions**. It runs on every push to `main`, once a day, and on demand.

Project sites live under `https://<user>.github.io/<repo>/`; PaperWhite assumes the site is served from the root of `site.url`. Use a custom domain (put it in `public/CNAME` and in `site.url`) or name the repository `<user>.github.io`.

## Cloudflare Pages, Netlify, Vercel

These hosts build from your repository themselves. Connect the repository in their dashboard with:

| Setting | Value |
| --- | --- |
| Build command | `pnpm build --strict` |
| Output directory | `dist` |
| Node version | 22 (environment variable `NODE_VERSION=22` on Cloudflare and Netlify) |

The workflow `init` writes for these targets only triggers a rebuild once a day through a deploy hook, so scheduled posts appear on time: create a deploy/build hook in the dashboard and save its URL as the repository secret `DEPLOY_HOOK_URL`.

Redirect files are picked up automatically: `_redirects` on Netlify and Cloudflare Pages (query-string rules are Netlify-only), `vercel.json` on Vercel.

## Your own server

Copy `dist/` to the web root. For nginx, `include` `dist/nginx-redirects.conf` inside `http {}` and add `if ($paperwhite_redirect) { return 301 $paperwhite_redirect; }` to the server block. Everything else is plain files; enable gzip or brotli and long cache headers for `/_astro/` and `/_pw/`.

## Scheduled posts

Posts dated in the future are skipped. Every deploy template rebuilds daily at 06:00 UTC (`cron: '0 6 * * *'`); change the hour in the workflow if you like. A build on your laptop skips them too, so what you preview is what will be published.

## Checks before you push

```bash
pnpm exec paperwhite check --external   # links, images, frontmatter, outgoing links
pnpm build --strict                     # what the workflow runs
pnpm preview                            # look at dist/ on http://localhost:4321
```
