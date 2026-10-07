import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import LZString from 'lz-string';
import { resolveConfig } from '@paperwhite/core/config';
import { buildVault } from '@paperwhite/core/vault';
import excalidraw, { parseDrawing, renderSvg } from '../src/index.ts';

const scene = {
  type: 'excalidraw',
  elements: [
    { type: 'rectangle', x: 0, y: 0, width: 120, height: 60, strokeColor: '#1e1e1e', backgroundColor: '#a5d8ff', roundness: { type: 3 } },
    { type: 'arrow', x: 120, y: 30, width: 80, height: 0, points: [[0, 0], [80, 0]], strokeColor: '#1e1e1e', endArrowhead: 'arrow' },
    { type: 'text', x: 10, y: 20, width: 100, height: 25, text: 'Vault & <notes>', fontSize: 20, fontFamily: 1, strokeColor: '#1e1e1e' },
    { type: 'ellipse', x: 200, y: 0, width: 60, height: 60, strokeColor: '#e03131', isDeleted: true },
  ],
  appState: { viewBackgroundColor: '#ffffff' },
};

describe('excalidraw', () => {
  it('parses json and compressed-json drawings', () => {
    expect(parseDrawing(JSON.stringify(scene)).elements).toHaveLength(4);
    const md = `---\nexcalidraw-plugin: parsed\n---\n# Drawing\n\`\`\`compressed-json\n${LZString.compressToBase64(JSON.stringify(scene))}\n\`\`\`\n`;
    expect(parseDrawing(md).elements).toHaveLength(4);
  });
  it('renders shapes, arrows and escaped text, skipping deleted elements', () => {
    const svg = renderSvg(parseDrawing(JSON.stringify(scene)), 'Flow');
    expect(svg).toContain('<rect');
    expect(svg).toContain('marker-end="url(#pw-xd-arrow)"');
    expect(svg).toContain('Vault &amp; &lt;notes&gt;');
    expect(svg).not.toContain('<ellipse');
    expect(svg).toContain('aria-label="Flow"');
  });
  it('embeds through the vault pipeline', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pw-xd-'));
    fs.mkdirSync(path.join(dir, 'posts'));
    fs.writeFileSync(path.join(dir, 'posts/a.md'), '---\ndate: 2024-01-01\n---\n![[flow.excalidraw|Flow chart]]\n');
    fs.writeFileSync(path.join(dir, 'flow.excalidraw.md'), `# Excalidraw\n\`\`\`json\n${JSON.stringify(scene)}\n\`\`\`\n`);
    const config = resolveConfig({ site: { url: 'https://x.test', title: 'x' }, contentDir: dir, plugins: [excalidraw()] }, dir);
    const r = await buildVault(config, { cacheDir: path.join(dir, '.c') });
    expect(r.unresolved).toEqual([]);
    expect(r.notes[0]!.html).toMatch(/<figure class="pw-excalidraw"><svg role="img" aria-label="Flow chart"/);
  });
});
