import type { APIRoute } from 'astro';
import { netlifyRedirects } from '../../src/runtime/index.ts';

export const GET: APIRoute = async () => new Response(await netlifyRedirects(), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
