# @paperwhite/plugin-excalidraw

```ts
import excalidraw from '@paperwhite/plugin-excalidraw';
export default defineConfig({ plugins: [excalidraw()] });
```

`![[drawing.excalidraw]]` embeds an Obsidian Excalidraw drawing. If an exported `drawing.excalidraw.svg` exists (Excalidraw plugin "auto-export SVG"), it is inlined. Otherwise the scene JSON (plain or compressed) is rendered to a clean SVG.
