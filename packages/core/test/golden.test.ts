/**
 * Golden-file tests: one per Obsidian feature (§4.3). Each fixture note renders through the
 * full pipeline and is compared to `test/golden/<feature>.html`. Update with `vitest -u`.
 */
import { describe, it, expect } from 'vitest';
import { noteHtml } from './helpers.ts';

const GOLDEN: [feature: string, noteId: string][] = [
  ['wikilinks', 'posts/obsidian-syntax/wikilinks'],
  ['embeds', 'posts/obsidian-syntax/embeds'],
  ['callouts', 'posts/obsidian-syntax/callouts'],
  ['formatting', 'posts/obsidian-syntax/formatting'],
  ['math', 'posts/obsidian-syntax/math'],
  ['code', 'posts/obsidian-syntax/code'],
  ['query', 'posts/obsidian-syntax/query'],
  ['recursion', 'posts/obsidian-syntax/recursion-a'],
  ['persian', 'posts/fa/سلام دنیا'],
  ['mixed-direction', 'posts/fa/یادداشت ترکیبی'],
];

describe('golden files', () => {
  for (const [feature, id] of GOLDEN) {
    it(feature, async () => {
      await expect(await noteHtml(id)).toMatchFileSnapshot(`./golden/${feature}.html`);
    });
  }
});
