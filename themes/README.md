# themes/

Each folder here is a theme: `theme.json` + `styles/theme.css`, plus optional `components/` and `layouts/` that replace PaperWhite's defaults one file at a time. Select one with `theme: <folder-name>` in `paperwhite.config.yaml`.

```bash
paperwhite theme list           # built-in and local themes, the active one marked
paperwhite theme new mine       # copy the built-in theme here as themes/mine/ and select it
paperwhite add owner/repo       # install a theme published on GitHub
paperwhite theme eject Header   # one component only → overrides/components/Header.astro
```

Guide: `pw-docs/themes.md`. Restart `paperwhite dev` after adding new files to a theme.
