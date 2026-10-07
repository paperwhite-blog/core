// Progressive enhancements for rendered Markdown: copy-code, image lightbox, link previews.
const i18n = (document.getElementById('pw-i18n') as HTMLTemplateElement | null)?.dataset ?? {};

// Copy buttons (rendered hidden so no-JS users never see a dead button)
if (navigator.clipboard) {
  for (const btn of document.querySelectorAll<HTMLButtonElement>('[data-pw-copy]')) {
    btn.hidden = false;
    btn.textContent = i18n.copy ?? 'Copy';
    btn.addEventListener('click', async () => {
      const code = btn.parentElement?.querySelector('pre code')?.textContent ?? '';
      await navigator.clipboard.writeText(code);
      btn.textContent = i18n.copied ?? 'Copied';
      setTimeout(() => (btn.textContent = i18n.copy ?? 'Copy'), 1500);
    });
  }
}

// Lightbox: links to the full-size image open in a <dialog> instead of navigating.
const zooms = document.querySelectorAll<HTMLAnchorElement>('a[data-pw-lightbox]');
if (zooms.length && 'HTMLDialogElement' in window) {
  const dialog = document.createElement('dialog');
  dialog.className = 'pw-lightbox';
  const img = document.createElement('img');
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'pw-lightbox-close';
  close.setAttribute('aria-label', i18n.close ?? 'Close');
  close.textContent = '×';
  dialog.append(close, img);
  document.body.append(dialog);
  close.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (e) => e.target === dialog && dialog.close());
  for (const a of zooms) {
    a.addEventListener('click', (e) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey) return;
      e.preventDefault();
      const inner = a.querySelector('img');
      img.src = a.href;
      img.alt = inner?.alt ?? '';
      img.width = Number(a.dataset.pwWidth) || 0;
      img.height = Number(a.dataset.pwHeight) || 0;
      dialog.showModal();
    });
  }
}

// Hover previews for internal links (static JSON, fetched once per target).
const cache = new Map<string, Promise<{ title: string; excerpt: string; dir?: string; lang?: string }>>();
let card: HTMLDivElement | undefined;
let timer: number | undefined;
const hide = () => {
  clearTimeout(timer);
  card?.remove();
};
for (const a of document.querySelectorAll<HTMLAnchorElement>('a.internal[data-preview]')) {
  const show = () => {
    clearTimeout(timer);
    timer = window.setTimeout(async () => {
      const url = a.dataset.preview!;
      if (!cache.has(url)) cache.set(url, fetch(url).then((r) => r.json()));
      const d = await cache.get(url)!.catch(() => undefined);
      if (!d) return;
      card?.remove();
      card = document.createElement('div');
      card.className = 'pw-preview';
      card.setAttribute('role', 'tooltip');
      if (d.dir) card.dir = d.dir;
      if (d.lang) card.lang = d.lang;
      const h = document.createElement('strong');
      h.textContent = d.title;
      const p = document.createElement('p');
      p.textContent = d.excerpt;
      card.append(h, p);
      const r = a.getBoundingClientRect();
      card.style.top = `${r.bottom + scrollY + 8}px`;
      card.style.left = `${Math.max(8, Math.min(r.left + scrollX, scrollX + innerWidth - 360))}px`;
      document.body.append(card);
    }, 250);
  };
  a.addEventListener('mouseenter', show);
  a.addEventListener('focus', show);
  a.addEventListener('mouseleave', hide);
  a.addEventListener('blur', hide);
}
