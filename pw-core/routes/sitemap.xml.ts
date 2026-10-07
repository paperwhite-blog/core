import type { APIRoute, GetStaticPaths } from 'astro';
import { sitemapChunks, sitemap } from '../src/runtime/index.ts';

export const getStaticPaths = (async () => (await sitemapChunks()).map((c) => ({ params: { name: c.name }, props: { urls: c.urls } }))) satisfies GetStaticPaths;

export const GET: APIRoute = ({ props }) =>
  new Response(sitemap((props as { urls: Parameters<typeof sitemap>[0] }).urls), { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
