import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import type { PaperwhitePlugin } from '@paperwhite/core/types';

export interface MermaidOptions {
  /** Cache directory for rendered SVGs (keyed by diagram source). Default `.paperwhite/mermaid` */
  cacheDir?: string;
  /** Playwright launch options, e.g. `{ channel: 'chrome' }` to use an installed Chrome */
  launchOptions?: Record<string, unknown>;
  /** Mermaid config passed to `mermaid.initialize` */
  mermaidConfig?: Record<string, unknown>;
}

type Renderer = (diagrams: string[], options?: Record<string, unknown>) => Promise<PromiseSettledResult<{ svg: string; id: string }>[]>;

/**
 * Off by default: add `mermaid()` to `plugins` in paperwhite.config.ts. Diagrams are rendered once
 * in a headless browser (Playwright) and cached, so rebuilds don't need a browser.
 */
export default function mermaid(opts: MermaidOptions = {}): PaperwhitePlugin {
  const cacheDir = path.resolve(opts.cacheDir ?? '.paperwhite/mermaid');
  let renderer: Promise<Renderer> | undefined;
  const getRenderer = () =>
    (renderer ??= import('mermaid-isomorphic').then(({ createMermaidRenderer }) =>
      createMermaidRenderer({ launchOptions: opts.launchOptions }) as unknown as Renderer,
    ));
  return {
    name: '@paperwhite/plugin-mermaid',
    fences: {
      async mermaid(code) {
        const key = createHash('sha1').update(JSON.stringify([code, opts.mermaidConfig ?? {}])).digest('hex').slice(0, 16);
        const file = path.join(cacheDir, `${key}.svg`);
        let svg: string;
        try {
          svg = await fs.readFile(file, 'utf8');
        } catch {
          const render = await getRenderer();
          const [result] = await render([code], { prefix: `pw-mermaid-${key}`, mermaidConfig: opts.mermaidConfig });
          if (!result || result.status === 'rejected') {
            const reason = result && 'reason' in result ? String(result.reason) : 'unknown error';
            return `<pre class="pw-mermaid-error" dir="ltr"><code>${escapeHtml(code)}</code></pre><!-- mermaid: ${escapeHtml(reason)} -->`;
          }
          svg = result.value.svg;
          await fs.mkdir(cacheDir, { recursive: true });
          await fs.writeFile(file, svg);
        }
        return `<figure class="pw-mermaid" dir="ltr">${svg}</figure>`;
      },
    },
  };
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
