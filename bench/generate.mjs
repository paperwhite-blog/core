// Generates a synthetic vault: N posts with wikilinks, tags, code, callouts, images.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const N = Number(process.env.N ?? 1000);
const here = path.dirname(fileURLToPath(import.meta.url));
const vault = path.join(here, 'vault');
fs.rmSync(vault, { recursive: true, force: true });
fs.mkdirSync(path.join(vault, 'posts'), { recursive: true });
fs.mkdirSync(path.join(vault, 'attachments'), { recursive: true });
for (const f of ['cat.jpg', 'diagram.png']) fs.copyFileSync(path.join(here, '../fixtures/vault/attachments', f), path.join(vault, 'attachments', f));
const words = 'the quick brown fox jumps over a lazy dog while markdown notes link together into a graph of ideas'.split(' ');
const para = (s, n) => Array.from({ length: n }, (_, i) => words[(s * 13 + i * 7) % words.length]).join(' ') + '.';
for (let i = 0; i < N; i++) {
  const id = String(i).padStart(4, '0');
  const t = [`topic-${i % 40}`, `area-${i % 7}`];
  const fa = i % 10 === 0;
  const body = [
    `---`,
    `title: Post ${id}`,
    `date: 20${10 + (i % 15)}-${String((i % 12) + 1).padStart(2, '0')}-${String((i % 27) + 1).padStart(2, '0')}`,
    `tags: [${t.join(', ')}]`,
    fa ? 'lang: fa' : '',
    `description: Synthetic post ${id} for the benchmark.`,
    `---`,
    '',
    para(i, 80),
    '',
    `See [[post-${String((i + 1) % N).padStart(4, '0')}]] and [[post-${String((i + 7) % N).padStart(4, '0')}|another]].`,
    '',
    '## Section one',
    '',
    para(i + 1, 120),
    '',
    i % 5 === 0 ? '![[cat.jpg|A cat]]' : '',
    '',
    '> [!tip] A callout',
    `> ${para(i + 2, 20)}`,
    '',
    '```ts',
    `export const n${i} = ${i};`,
    'console.log(n);',
    '```',
    '',
    '## Section two',
    '',
    para(i + 3, 150),
    '',
  ].join('\n');
  fs.writeFileSync(path.join(vault, 'posts', `post-${id}.md`), body);
}
console.log(`generated ${N} posts`);
