# Getting started

## 1. Clone and run

```bash
git clone https://github.com/paperwhite-blog/core my-blog
cd my-blog
pnpm install
pnpm dev
```

Open http://localhost:4321. What you see is the sample content in `content/` rendered by the built-in **paper** theme.

## 2. Make it yours

```bash
pnpm exec paperwhite init
```

`init` asks for the site title, description, production URL, your name, locales and a deploy target. It then:

- writes the answers into `paperwhite.config.yaml`;
- removes PaperWhite's own development files (`dev/`, `pw-core/test`, the core CI workflow, dev scripts);
- replaces the sample posts with a hello-world post and an about page (say no to keep the samples);
- writes `.github/workflows/deploy.yml` for the host you picked;
- replaces the README with a short one for your blog;
- starts a fresh git history with one commit (or just removes the `origin` remote with `--keep-history`).

Every question has a flag, so a script can run `paperwhite init --yes --title "My Blog" --url https://blog.example.com --deploy netlify`.

Then connect your own repository:

```bash
git remote add origin git@github.com:you/my-blog.git
git push -u origin main
```

## 3. Write

```bash
pnpm exec paperwhite new "My first post"      # content/posts/my-first-post.md, draft: true
pnpm exec paperwhite new "Now" --page         # content/pages/now.md
pnpm exec paperwhite new "سلام" --lang fa      # content/posts/fa/سلام.md
```

Or point `contentDir` in the config at an Obsidian vault (or a sub-folder of one) anywhere on disk and keep writing in Obsidian. Files and folders starting with `_` or `.` are ignored, so `_templates/` and `.obsidian/` never ship. Remove `draft: true` to publish a note.

## 4. Build and publish

```bash
pnpm build                     # dist/ + SEO audit
pnpm build --strict            # same, fails on audit errors (what the deploy workflow runs)
pnpm preview                   # serve dist/ locally
pnpm exec paperwhite check     # links, images, frontmatter, no build
```

Push to `main` and the workflow builds and deploys. See [Deploying](deploying.md).

## What is in the repository

```
paperwhite.config.yaml   title, URL, locales, theme, plugins, SEO
content/                 posts/, pages/, attachments/, _templates/
themes/                  your themes (folders)
plugins/                 your plugins (folders)
overrides/               single components you ejected (optional)
public/                  copied to the site root as-is: favicon, CNAME, robots additions
pw-core/                 PaperWhite itself — replaced by `paperwhite update`, never edit
pw-docs/                 this manual — also replaced by `paperwhite update`
dist/                    the built site (ignored by git)
.paperwhite/             caches and the generated Astro project (ignored by git)
paperwhite.slugs.json    slug history so renamed notes keep redirecting — commit it
```
