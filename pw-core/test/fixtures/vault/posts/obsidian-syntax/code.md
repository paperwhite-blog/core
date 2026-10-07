---
title: Code blocks
date: 2024-03-16
tags: [obsidian, syntax, code]
---

```ts title="paperwhite.config.ts" {2}
import { defineConfig } from '@paperwhite/core/config';
export default defineConfig({ site: { url: 'https://example.com', title: 'Blog' } });
```

```python
def hello():
    print("hi")  # [!code highlight]
```

```unknownlang
falls back to plain text
```
