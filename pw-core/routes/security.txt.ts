import type { APIRoute } from 'astro';
import { securityTxt } from '../src/runtime/index.ts';

export const GET: APIRoute = async () => new Response(await securityTxt(), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
