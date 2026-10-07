import type { APIRoute } from 'astro';
import { apiTags } from '../../src/runtime/index.ts';

export const GET: APIRoute = async () => new Response(await apiTags(), { headers: { 'Content-Type': 'application/json' } });
