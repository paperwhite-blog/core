import type { APIRoute } from 'astro';
import { humansTxt } from '../src/runtime/index.ts';

export const GET: APIRoute = async () => new Response(await humansTxt(), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
