import type { APIRoute } from 'astro';
import { vercelJson } from '../../src/runtime/index.ts';

export const GET: APIRoute = async () => new Response(await vercelJson(), { headers: { 'Content-Type': 'application/json' } });
