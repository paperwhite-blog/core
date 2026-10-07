import type { APIRoute, GetStaticPaths } from 'astro';
import { getNotes, previewUrl } from '../src/runtime/index.ts';

/** Static JSON snippets for hover link previews. */
export const getStaticPaths = (async () =>
  (await getNotes()).map((n) => ({
    params: { id: previewUrl(n.id).split('/').pop()!.replace(/\.json$/, '') },
    props: {
      title: n.data.title,
      url: n.data.url,
      excerpt: n.data.excerpt,
      date: n.data.date?.toISOString(),
      lang: n.data.lang,
      dir: n.data.dir,
      cover: n.data.cover ? { src: n.data.cover.src, width: n.data.cover.width, height: n.data.cover.height } : undefined,
    },
  }))) satisfies GetStaticPaths;

export const GET: APIRoute = ({ props }) => new Response(JSON.stringify(props), { headers: { 'Content-Type': 'application/json' } });
