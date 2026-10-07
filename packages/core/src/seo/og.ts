import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import * as satoriModule from 'satori';
import { Resvg } from '@resvg/resvg-js';
import type { ImageInfo } from '../types.ts';

const require = createRequire(import.meta.url);

// satori may be loaded as ESM or (when externalized by absolute path) as CJS.
type SatoriFn = typeof import('satori').default;
const satori: SatoriFn = ((satoriModule as unknown as { default?: { default?: SatoriFn } | SatoriFn }).default as { default?: SatoriFn })?.default
  ?? ((satoriModule as unknown as { default?: SatoriFn }).default as SatoriFn)
  ?? (satoriModule as unknown as SatoriFn);

let fontsPromise: Promise<{ name: string; data: Buffer; weight: 400 | 700; style: 'normal' }[]> | undefined;

/** satori reads TTF/OTF/WOFF (not WOFF2); fontsource ships WOFF alongside WOFF2. */
function fonts() {
  fontsPromise ??= (async () => {
    const inter = path.dirname(require.resolve('@fontsource/inter/package.json'));
    const vazir = path.dirname(require.resolve('@fontsource/vazirmatn/package.json'));
    const load = (dir: string, f: string) => fs.readFile(path.join(dir, 'files', f));
    return [
      { name: 'Inter', data: await load(inter, 'inter-latin-400-normal.woff'), weight: 400 as const, style: 'normal' as const },
      { name: 'Inter', data: await load(inter, 'inter-latin-700-normal.woff'), weight: 700 as const, style: 'normal' as const },
      { name: 'Vazirmatn', data: await load(vazir, 'vazirmatn-arabic-400-normal.woff'), weight: 400 as const, style: 'normal' as const },
      { name: 'Vazirmatn', data: await load(vazir, 'vazirmatn-arabic-700-normal.woff'), weight: 700 as const, style: 'normal' as const },
      { name: 'Vazirmatn', data: await load(vazir, 'vazirmatn-latin-700-normal.woff'), weight: 700 as const, style: 'normal' as const },
    ];
  })();
  return fontsPromise;
}

export interface OgInput {
  id: string;
  digest: string;
  title: string;
  site: string;
  lang: string;
  dir: 'ltr' | 'rtl';
  date?: Date;
  tags: string[];
  cover?: ImageInfo;
  root: string;
}

/**
 * satori shapes Arabic-script letters but has no bidi algorithm: it reverses whole runs,
 * so multi-word RTL text comes out in the wrong word order and digit runs come out backwards.
 * Lay RTL text out word by word in a reversed, wrapping flex row and pre-reverse digit runs.
 */
function rtlText(text: string, style: Record<string, unknown>): Node {
  const words = text
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => {
      if (!/[\u0600-\u06FF]/.test(w)) return w;
      return w.replace(/[0-9\u06F0-\u06F9\u0660-\u0669]+/g, (d) => [...d].reverse().join(''));
    });
  return h(
    'div',
    { display: 'flex', flexDirection: 'row-reverse', flexWrap: 'wrap', columnGap: '0.28em', justifyContent: 'flex-start', ...style },
    words.map((w) => h('span', { display: 'flex' }, w)),
  );
}

type Node = { type: string; props: Record<string, unknown> & { children?: unknown; style?: Record<string, unknown> } };
const h = (type: string, style: Record<string, unknown>, children?: unknown, extra: Record<string, unknown> = {}): Node => ({
  type,
  props: { style, children, ...extra },
});

/**
 * 1200×630 social card, cached by note digest in `.paperwhite/og/` so unchanged
 * posts are not re-rendered (satori + resvg costs ~50–100 ms per image).
 */
export async function renderOgImage(input: OgInput): Promise<Buffer> {
  const key = createHash('sha1').update(JSON.stringify([input.digest, input.title, input.site, 3])).digest('hex').slice(0, 16);
  const cacheFile = path.join(input.root, '.paperwhite/og', `${key}.png`);
  try {
    return await fs.readFile(cacheFile);
  } catch {}
  const rtl = input.dir === 'rtl';
  const family = rtl ? 'Vazirmatn' : 'Inter';
  const dateText = input.date
    ? new Intl.DateTimeFormat(rtl ? 'fa-IR' : 'en-US', {
        dateStyle: 'long',
        timeZone: 'UTC',
        calendar: input.lang === 'fa' ? 'persian' : 'gregory',
      }).format(input.date)
    : '';
  let coverData: string | undefined;
  if (input.cover && !/^https?:/.test(input.cover.src) && input.cover.assets) {
    const file = Object.values(input.cover.assets).find((f) => /\.(jpe?g|png)$/i.test(f));
    if (file) coverData = `data:image/${file.endsWith('png') ? 'png' : 'jpeg'};base64,${(await fs.readFile(file)).toString('base64')}`;
  }
  const titleSize = input.title.length > 70 ? 52 : input.title.length > 40 ? 62 : 74;
  const tree = h(
    'div',
    {
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: rtl ? 'row-reverse' : 'row',
      background: '#faf8f3',
      color: '#1c1917',
      fontFamily: family,
    },
    [
      h(
        'div',
        { display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '72px', flex: 1, alignItems: rtl ? 'flex-end' : 'flex-start' },
        [
          rtl
            ? rtlText(input.site, { fontSize: 30, fontWeight: 700, color: '#b45309' })
            : h('div', { display: 'flex', fontSize: 30, fontWeight: 700, color: '#b45309' }, input.site),
          rtl
            ? rtlText(input.title, { fontSize: titleSize, fontWeight: 700, lineHeight: 1.3 })
            : h('div', { display: 'flex', fontSize: titleSize, fontWeight: 700, lineHeight: 1.15 }, input.title),
          rtl
            ? rtlText([dateText, ...input.tags.slice(0, 3).map((t) => `#${t}`)].filter(Boolean).join(' · '), { fontSize: 26, color: '#57534e' })
            : h('div', { display: 'flex', fontSize: 26, color: '#57534e' }, [dateText, ...input.tags.slice(0, 3).map((t) => `#${t}`)].filter(Boolean).join('  ·  ')),
        ],
      ),
      ...(coverData
        ? [h('img', { width: 420, height: 630, objectFit: 'cover' }, undefined, { src: coverData, width: 420, height: 630 })]
        : [h('div', { width: 24, height: '100%', background: '#b45309' })]),
    ],
  );
  const svg = await satori(tree as never, { width: 1200, height: 630, fonts: await fonts() });
  // loadSystemFonts:false — text is already outlined by satori; scanning system fonts cost ~110 ms per image.
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: 1200 }, font: { loadSystemFonts: false } }).render().asPng();
  await fs.mkdir(path.dirname(cacheFile), { recursive: true });
  await fs.writeFile(cacheFile, png);
  return png;
}
