import { defineConfig } from '@paperwhite/core/config';

export default defineConfig({
  site: {
    url: 'https://paperwhite.example',
    title: 'PaperWhite Fixture',
    description: 'A fixture blog exercising every Obsidian feature PaperWhite supports.',
    author: 'ada',
    social: { github: 'https://github.com/paperwhite' },
    i18n: { fa: { title: 'نمونهٔ PaperWhite', description: 'وبلاگ نمونه برای آزمودن همهٔ قابلیت‌ها.' } },
  },
  authors: { ada: { name: 'Ada Lovelace', url: 'https://paperwhite.example/about/' } },
  contentDir: '../../fixtures/vault',
  locales: { default: 'en', supported: { en: {}, fa: {} } },
  theme: 'paperwhite-theme-paper',
  seo: { twitterHandle: '@paperwhite', security: { contact: 'mailto:security@paperwhite.example' } },
  editUrl: 'https://github.com/paperwhite/paperwhite/edit/main/fixtures/vault/',
});
