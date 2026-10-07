import { defineConfig } from 'astro/config';
import paperwhite from '@paperwhite/core';
import config from './paperwhite.config';
export default defineConfig({ integrations: [paperwhite(config)] });
