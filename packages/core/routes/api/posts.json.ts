import type { APIRoute } from 'astro';
import { apiPosts } from '../../src/runtime/index.ts';

export const GET: APIRoute = async () => new Response(await apiPosts(), { headers: { 'Content-Type': 'application/json' } });
