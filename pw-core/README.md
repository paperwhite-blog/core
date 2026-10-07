# @paperwhite/core

The PaperWhite Astro integration, Obsidian vault loader, Markdown pipeline, SEO and i18n.

```ts
// astro.config.ts
import { defineConfig } from 'astro/config';
import paperwhite from '@paperwhite/core';
import config from './paperwhite.config';
export default defineConfig({ integrations: [paperwhite(config)] });

// src/content.config.ts
import { paperwhiteCollections } from '@paperwhite/core/content';
import config from '../paperwhite.config';
export const collections = paperwhiteCollections(config);
```

Entry points: `@paperwhite/core` (integration), `/config` (`defineConfig`, types), `/content` (collections), `/vault` (`buildVault` for tools), `/pipeline`, `/runtime` (helpers for components), `/audit`, `/i18n`, `/types`.

Plugins implement `PaperwhitePlugin`: `remarkPlugins`, `rehypePlugins`, `embeds` (by file extension) and `fences` (by code language).
