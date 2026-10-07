import type { APIRoute } from 'astro';
import { nginxRedirects } from '../../src/runtime/index.ts';

export const GET: APIRoute = async () => new Response(await nginxRedirects(), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
