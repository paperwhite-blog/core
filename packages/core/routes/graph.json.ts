import type { APIRoute } from 'astro';
import { graphJson } from '../src/runtime/index.ts';

export const GET: APIRoute = async () => new Response(await graphJson(), { headers: { 'Content-Type': 'application/json' } });
