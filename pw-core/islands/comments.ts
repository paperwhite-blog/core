// Live comment providers, loaded only when their container scrolls into view.
const load = (el: Element, fn: () => void) => {
  const io = new IntersectionObserver((es) => {
    if (es.some((e) => e.isIntersecting)) {
      io.disconnect();
      fn();
    }
  });
  io.observe(el);
};

for (const el of document.querySelectorAll<HTMLElement>('[data-pw-giscus]')) {
  load(el, () => {
    const c = JSON.parse(el.dataset.pwGiscus!) as Record<string, string>;
    const s = document.createElement('script');
    s.src = 'https://giscus.app/client.js';
    s.async = true;
    s.crossOrigin = 'anonymous';
    const attrs: Record<string, string> = {
      'data-repo': c.repo!,
      'data-repo-id': c.repoId!,
      'data-category': c.category!,
      'data-category-id': c.categoryId!,
      'data-mapping': c.mapping ?? 'pathname',
      'data-reactions-enabled': '1',
      'data-theme': 'preferred_color_scheme',
      'data-lang': c.lang ?? 'en',
      'data-loading': 'lazy',
    };
    for (const [k, v] of Object.entries(attrs)) s.setAttribute(k, v);
    el.append(s);
  });
}

for (const el of document.querySelectorAll<HTMLElement>('[data-pw-cusdis]')) {
  load(el, () => {
    const s = document.createElement('script');
    s.src = `${el.dataset.host}/js/cusdis.es.js`;
    s.async = true;
    el.after(s);
  });
}

for (const el of document.querySelectorAll<HTMLElement>('[data-pw-webmentions]')) {
  load(el, async () => {
    const target = el.dataset.pwWebmentions!;
    const res = await fetch(`https://webmention.io/api/mentions.jf2?target=${encodeURIComponent(target)}&per-page=100`);
    const data = (await res.json()) as { children: { author?: { name?: string; url?: string }; url: string; content?: { text?: string }; 'wm-property': string }[] };
    const ul = document.createElement('ul');
    ul.className = 'pw-webmentions';
    for (const m of data.children) {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = m.url;
      a.rel = 'nofollow ugc noopener';
      a.textContent = m.author?.name ?? m.url;
      li.append(a, document.createTextNode(m.content?.text ? `: ${m.content.text.slice(0, 280)}` : ` (${m['wm-property']})`));
      ul.append(li);
    }
    if (data.children.length) el.append(ul);
  });
}
