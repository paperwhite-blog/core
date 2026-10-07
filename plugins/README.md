# plugins/

Each folder here is a plugin: `plugin.json` (`name`, `pluginApi: 1`, `dependencies`) + `index.ts` whose default export is `(options) => plugin`. Enable one by listing its folder name under `plugins:` in `paperwhite.config.yaml`.

```bash
paperwhite add paperwhite-blog/plugin-mermaid      # copies, installs dependencies, enables
paperwhite add paperwhite-blog/plugin-excalidraw
```

Guide and the plugin API: `pw-docs/plugins.md`.
