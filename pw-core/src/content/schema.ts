import { z } from 'astro/zod';

const stringList = z
  .union([z.string(), z.array(z.union([z.string(), z.number()]))])
  .transform((v) => (Array.isArray(v) ? v.map(String) : v.split(',').map((s) => s.trim())).filter(Boolean));

const dateLike = z.union([z.date(), z.string(), z.number()]);

/**
 * Frontmatter schema (§4.2). Unknown keys are kept (`passthrough`) so themes and
 * plugins can read their own fields; themes may `.extend()` it via `extendSchema`.
 */
export const frontmatterSchema = z
  .object({
    title: z.union([z.string(), z.number()]).transform(String).optional(),
    description: z.string().optional(),
    date: dateLike.optional(),
    updated: dateLike.optional(),
    slug: z.union([z.string(), z.number()]).transform(String).optional(),
    aliases: stringList.optional(),
    alias: stringList.optional(),
    tags: stringList.optional(),
    categories: stringList.optional(),
    category: stringList.optional(),
    series: z.string().optional(),
    series_order: z.number().optional(),
    lang: z.string().optional(),
    dir: z.enum(['ltr', 'rtl']).optional(),
    cover: z.string().optional(),
    cover_alt: z.string().optional(),
    author: stringList.optional(),
    authors: stringList.optional(),
    draft: z.boolean().optional(),
    publish: z.boolean().optional(),
    canonical: z.url().optional(),
    noindex: z.boolean().optional(),
    toc: z.boolean().optional(),
    math: z.boolean().optional(),
    cssclasses: stringList.optional(),
    cssclass: stringList.optional(),
    redirect_from: stringList.optional(),
    comments: z.union([z.boolean(), z.string()]).optional(),
    translations: z.record(z.string(), z.string()).optional(),
    type: z.enum(['post', 'page']).optional(),
  })
  .loose();

export type Frontmatter = z.infer<typeof frontmatterSchema>;

export function validateFrontmatter(data: unknown): { ok: true; data: Frontmatter } | { ok: false; error: string } {
  const r = frontmatterSchema.safeParse(data ?? {});
  if (r.success) return { ok: true, data: r.data };
  return {
    ok: false,
    error: r.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; '),
  };
}
