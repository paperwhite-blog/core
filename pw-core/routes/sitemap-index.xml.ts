import type { APIRoute } from 'astro';
import { sitemapIndexXml } from '../src/runtime/index.ts';

export const GET: APIRoute = async () => new Response(await sitemapIndexXml(), { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
