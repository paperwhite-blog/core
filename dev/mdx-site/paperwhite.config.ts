import { defineConfig } from '@paperwhite/core/config';
// `mdx: true` loads .mdx notes through @astrojs/mdx alongside regular Obsidian notes.
export default defineConfig({ site: { url: 'https://mdx.example', title: 'MDX example' }, contentDir: './content', mdx: true });
