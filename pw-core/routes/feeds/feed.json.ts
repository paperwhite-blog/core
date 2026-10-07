import type { APIRoute, GetStaticPaths } from 'astro';
import { feedVariants, feedChannel, renderFeed } from '../../src/runtime/index.ts';

export const getStaticPaths = (async () =>
  (await feedVariants('json')).map((v) => ({ params: { base: v.base }, props: { lang: v.lang, tag: v.tag } }))) satisfies GetStaticPaths;

export const GET: APIRoute = async ({ props }) => {
  const { lang, tag } = props as { lang: string; tag?: string };
  return renderFeed(await feedChannel(lang, 'json', tag), 'json');
};
