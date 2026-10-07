// TOC scroll-spy. Uses IntersectionObserver; marks the active link with aria-current.
const links = [...document.querySelectorAll<HTMLAnchorElement>('[data-pw-toc-link]')];
if (links.length && 'IntersectionObserver' in window) {
  const byId = new Map(links.map((a) => [decodeURIComponent(a.hash.slice(1)), a]));
  const visible = new Set<string>();
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) (e.isIntersecting ? visible.add(e.target.id) : visible.delete(e.target.id));
      const first = [...byId.keys()].find((id) => visible.has(id));
      if (!first) return;
      for (const a of links) a.removeAttribute('aria-current');
      byId.get(first)?.setAttribute('aria-current', 'true');
    },
    { rootMargin: '0px 0px -70% 0px' },
  );
  for (const id of byId.keys()) {
    const el = document.getElementById(id);
    if (el) io.observe(el);
  }
}
