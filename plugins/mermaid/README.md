# @paperwhite/plugin-mermaid

```ts
import mermaid from '@paperwhite/plugin-mermaid';
export default defineConfig({ plugins: [mermaid({ launchOptions: { channel: 'chrome' } })] });
```

Renders ```` ```mermaid ```` fences to static SVG with a headless browser (Playwright) and caches results in `.paperwhite/mermaid/`.
