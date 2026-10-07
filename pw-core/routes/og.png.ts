import type { APIRoute, GetStaticPaths } from 'astro';
import { getNotes, config, siteTitle, paths } from '../src/runtime/index.ts';
import { renderOgImage } from '../src/seo/og.ts';

export const getStaticPaths = (async () => (await getNotes()).map((n) => ({ params: { id: n.id }, props: { id: n.id } }))) satisfies GetStaticPaths;

export const GET: APIRoute = async ({ props }) => {
  const n = (await getNotes()).find((x) => x.id === (props as { id: string }).id)!;
  const png = await renderOgImage({
    id: n.id,
    digest: n.data.digest,
    title: n.data.title,
    site: siteTitle(n.data.lang),
    lang: n.data.lang,
    dir: n.data.dir,
    date: n.data.date,
    tags: n.data.tags,
    cover: n.data.cover,
    root: config.root,
    fonts: paths.ogFonts,
  });
  return new Response(new Uint8Array(png), { headers: { 'Content-Type': 'image/png' } });
};
