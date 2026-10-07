import { defineConfig } from '@paperwhite/core/config';
export default defineConfig({
  site: { url: 'https://bench.example', title: 'Bench' },
  contentDir: './vault',
  locales: { supported: { en: {}, fa: {} } },
  seo: { ogImages: process.env.NO_OG !== '1' },
});
