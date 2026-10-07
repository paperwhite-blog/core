# Plugins

A plugin is a **folder** in `plugins/` that extends the build-time Markdown pipeline: new fenced-code languages, new embed types, extra remark/rehype plugins. It is enabled by name in the config.

```yaml
plugins:
  - mermaid                       # plugins/mermaid/, default options
  - excalidraw:                   # with options
      cacheDir: .paperwhite/excalidraw
```

## Install one

```bash
pnpm exec paperwhite add paperwhite-blog/plugin-mermaid       # latest release
pnpm exec paperwhite add paperwhite-blog/plugin-excalidraw
pnpm exec paperwhite add owner/repo#v1.2.0                     # a tag or branch
pnpm exec paperwhite add ./some/folder                         # a local folder
```

`add` copies the folder to `plugins/<name>/`, installs the npm packages listed in its `plugin.json` into your repository, and appends the name to `plugins:`. Remove a plugin by deleting its folder and the line in the config.

Available: [plugin-mermaid](https://github.com/paperwhite-blog/plugin-mermaid) (` ```mermaid ` fences → static SVG, needs a browser once per new diagram), [plugin-excalidraw](https://github.com/paperwhite-blog/plugin-excalidraw) (`![[drawing.excalidraw]]` → SVG).

## Write one

```
plugins/shout/
  plugin.json
  index.ts
  README.md
```

```json
{
  "name": "shout",
  "pluginApi": 1,
  "description": "```shout fences in UPPER CASE.",
  "dependencies": {}
}
```

```ts
// plugins/shout/index.ts
import type { PaperwhitePlugin } from '@paperwhite/core/types';

export default function shout(options: { suffix?: string } = {}): PaperwhitePlugin {
  return {
    name: 'shout',
    fences: {
      shout: (code) => `<p class="shout">${code.toUpperCase()}${options.suffix ?? ''}</p>`,
    },
  };
}
```

The default export is a factory: it receives the options from the config and returns the plugin object. The module runs in Node at config time (TypeScript is fine; no build step), and its imports resolve from your repository's `node_modules`, which is why `dependencies` in `plugin.json` exist.

### The plugin object

```ts
interface PaperwhitePlugin {
  name: string;
  /** unified plugins run on the Markdown AST, after PaperWhite's own */
  remarkPlugins?: unknown[];
  /** unified plugins run on the HTML AST, before sanitizing and output */
  rehypePlugins?: unknown[];
  /** `![[file.ext]]` by extension (without the dot). Return HTML. */
  embeds?: Record<string, (ctx: EmbedContext) => Promise<string> | string>;
  /** fenced code by language. Return HTML, or null to let the normal highlighter run. */
  fences?: Record<string, (code: string, meta: string | null) => Promise<string | null> | string | null>;
}

interface EmbedContext {
  target: string;      // the link target as written
  absPath: string;     // the resolved file
  alias?: string;      // `![[file|alias]]`
  width?: number;      // `![[file|400]]` or `|400x300`
  height?: number;
}
```

Rules of thumb:

- Return static HTML. Anything that needs the browser goes against the spirit of PaperWhite's zero-JS pages.
- Cache expensive work under `.paperwhite/<plugin>/` keyed by a hash of the input; `mermaid` does this so rebuilds never launch a browser.
- Changing any file in the plugin folder invalidates the render cache for every note, so the next build re-renders everything once.
- `pluginApi` must be `1`. If the contract above changes incompatibly, core bumps the number and refuses older plugins with a clear message.

## Publish one

Put the folder in a GitHub repository (the files above at the top level), tag a release, and tell people to run `paperwhite add you/repo`. Tests, lockfiles, `package.json` and `.github/` in the repository are not copied into sites. The two official plugins are the reference: they keep `test/` and a `package.json` with core linked as a dev dependency for their own test suite.
