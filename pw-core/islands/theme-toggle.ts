// Dark-mode toggle. The pre-paint inline script in <head> applies the stored choice.
const root = document.documentElement;
for (const btn of document.querySelectorAll<HTMLButtonElement>('[data-pw-theme-toggle]')) {
  btn.hidden = false;
  const current = () =>
    root.dataset.theme ?? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  btn.setAttribute('aria-pressed', String(current() === 'dark'));
  btn.addEventListener('click', () => {
    const next = current() === 'dark' ? 'light' : 'dark';
    root.dataset.theme = next;
    btn.setAttribute('aria-pressed', String(next === 'dark'));
    try {
      localStorage.setItem('pw-theme', next);
    } catch {}
  });
}
