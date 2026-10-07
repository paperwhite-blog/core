# paper

PaperWhite's built-in default theme: minimal and typography-first, with Inter, Vazirmatn and JetBrains Mono self-hosted, full RTL, light and dark modes.

It is a plain theme folder, the same shape as one you would put in your site's `themes/`:

```
theme.json              name, themeApi, fonts, tokens, UI strings
styles/theme.css        --pw-* tokens for light and dark, font faces, a few typographic rules
components/PostCard.astro
components/HeadExtra.astro   font preloads
```

Everything not in `components/` comes from core's defaults. Copy it into a site with `paperwhite theme new mytheme` and edit from there.
