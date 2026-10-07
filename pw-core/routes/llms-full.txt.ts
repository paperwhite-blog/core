import type { APIRoute } from 'astro';
import { llmsTxt } from '../src/runtime/index.ts';

export const GET: APIRoute = async () => new Response(await llmsTxt(true), { headers: { 'Content-Type': 'text/markdown; charset=utf-8' } });
