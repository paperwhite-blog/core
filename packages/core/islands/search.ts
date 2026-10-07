// Pagefind search island. The ~100 KB Pagefind bundle loads on first focus/input only.
type PagefindResult = { data: () => Promise<{ url: string; meta: { title?: string }; excerpt: string }> };
type Pagefind = { search: (q: string) => Promise<{ results: PagefindResult[] }>; init?: () => Promise<void> };

const normalize = (s: string) => s.replace(/[يى]/g, 'ی').replace(/ك/g, 'ک');

for (const form of document.querySelectorAll<HTMLFormElement>('[data-pw-search]')) {
  const input = form.querySelector('input')!;
  const list = form.querySelector('.pw-search-results')!;
  const status = form.querySelector('.pw-search-status')!;
  let pf: Promise<Pagefind> | undefined;
  // Bypass Vite's import rewriting: inlined scripts have no preload helper.
  const dynamicImport = new Function('u', 'return import(u)') as (u: string) => Promise<Pagefind>;
  const load = () => (pf ??= dynamicImport('/pagefind/pagefind.js'));
  let seq = 0;
  const run = async () => {
    const q = normalize(input.value.trim());
    const my = ++seq;
    if (!q) {
      list.replaceChildren();
      status.textContent = '';
      return;
    }
    const pagefind = await load();
    const res = await pagefind.search(q);
    const data = await Promise.all(res.results.slice(0, 10).map((r) => r.data()));
    if (my !== seq) return;
    status.textContent = data.length
      ? (form.dataset.i18nCount ?? '{n}').replace('{n}', String(res.results.length))
      : (form.dataset.i18nNone ?? '').replace('{q}', q);
    list.replaceChildren(
      ...data.map((d) => {
        const li = document.createElement('li');
        const a = document.createElement('a');
        a.href = d.url;
        a.textContent = d.meta.title ?? d.url;
        const p = document.createElement('p');
        p.innerHTML = d.excerpt; // Pagefind escapes content and only adds <mark>
        li.append(a, p);
        return li;
      }),
    );
  };
  input.addEventListener('focus', () => void load().catch(() => {}), { once: true });
  input.addEventListener('input', () => void run());
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    void run();
  });
  const q = new URLSearchParams(location.search).get('q');
  if (q) {
    input.value = q;
    void run();
  }
}
