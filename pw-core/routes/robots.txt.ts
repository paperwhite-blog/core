import type { APIRoute } from 'astro';
import { robotsTxt } from '../src/runtime/index.ts';

export const GET: APIRoute = async () => new Response(await robotsTxt(), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
