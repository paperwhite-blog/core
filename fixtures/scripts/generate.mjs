// Generates filler notes and binary attachments for the fixture vault.
// Run: node fixtures/scripts/generate.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const here = path.dirname(fileURLToPath(import.meta.url));
const vault = path.join(here, '..', 'vault');
const require = createRequire(path.join(here, '../../packages/core/package.json'));
const sharp = require('sharp');

const topics = ['strategy', 'writing', 'design', 'performance', 'seo', 'typescript', 'astro', 'markdown', 'search', 'images'];
const words = 'lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua'.split(' ');
const para = (seed, n = 60) => Array.from({ length: n }, (_, i) => words[(seed * 7 + i * 3) % words.length]).join(' ') + '.';

fs.mkdirSync(path.join(vault, 'posts/notes'), { recursive: true });
for (let i = 1; i <= 20; i++) {
  const id = String(i).padStart(2, '0');
  const t1 = topics[i % topics.length];
  const t2 = topics[(i * 3) % topics.length];
  const next = String((i % 20) + 1).padStart(2, '0');
  const prev = String(((i + 18) % 20) + 1).padStart(2, '0');
  const month = String(((i - 1) % 12) + 1).padStart(2, '0');
  fs.writeFileSync(
    path.join(vault, `posts/notes/note-${id}.md`),
    `---\ntitle: Note ${id} on ${t1}\ndate: 2023-${month}-${String((i % 27) + 1).padStart(2, '0')}\ntags: [${t1}, ${t2}]\ncategories: [Notes]\n---\n\n${para(i)}\n\nSee also [[note-${next}]] and [[note-${prev}|the previous note]].\n\n## Details\n\n${para(i + 1, 90)}\n\n## More\n\n${para(i + 2, 40)}\n`,
  );
}
const faTitles = ['یادداشت یکم', 'یادداشت دوم', 'یادداشت سوم', 'یادداشت چهارم', 'یادداشت پنجم'];
faTitles.forEach((t, i) => {
  fs.writeFileSync(
    path.join(vault, `posts/fa/${t}.md`),
    `---\ntitle: ${t}\ndate: 1402/${String(i + 2).padStart(2, '0')}/10\nlang: fa\ntags: [یادداشت, فراداده]\n---\n\nاین ${t} است که برای آزمودن بایگانی و برچسب‌ها نوشته شده. کتاب ها و نوشته ها را مي خوانيم.\n\n## بخش نخست\n\nمتنی کوتاه برای آزمون. پیوند به [[${faTitles[(i + 1) % faTitles.length]}]].\n`,
  );
});

const att = path.join(vault, 'attachments');
fs.mkdirSync(att, { recursive: true });
const gradient = (w, h, a, b) =>
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/><circle cx="${w / 2}" cy="${h / 2}" r="${h / 4}" fill="#fff" fill-opacity=".35"/></svg>`,
  );
await sharp(gradient(1600, 1000, '#f59e0b', '#7c2d12')).jpeg({ quality: 82 }).toFile(path.join(att, 'cat.jpg'));
await sharp(gradient(1200, 700, '#0ea5e9', '#1e3a8a')).png().toFile(path.join(att, 'diagram.png'));
// minimal valid PDF
const pdf = `%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n`;
fs.writeFileSync(path.join(att, 'sample.pdf'), pdf);
// placeholder media (content type matters, not playback)
fs.writeFileSync(path.join(att, 'sound.mp3'), Buffer.from('ID3\u0003\u0000\u0000\u0000\u0000\u0000\u0000', 'binary'));
fs.writeFileSync(path.join(att, 'clip.mp4'), Buffer.alloc(32));
console.log('fixtures generated');
