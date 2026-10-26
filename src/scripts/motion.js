/**
 * Page motion: a short fade-up the first time each .rv element arrives, and
 * stat numbers that count up once. Nothing is tied to scroll position, and
 * both are off under prefers-reduced-motion.
 */
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

const items = document.querySelectorAll('.rv');
if (reduce || !('IntersectionObserver' in window)) {
  items.forEach((el) => el.classList.add('in'));
} else {
  const reveal = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      e.target.classList.add('in');
      reveal.unobserve(e.target);
    }
  }, { rootMargin: '0px 0px -8% 0px' });
  items.forEach((el) => reveal.observe(el));
}

// "1,000+" counts 0 → 1,000 then shows its suffix; small numbers stay put.
const counter = !reduce && 'IntersectionObserver' in window && new IntersectionObserver((entries) => {
  for (const e of entries) {
    if (!e.isIntersecting) continue;
    counter.unobserve(e.target);
    const el = e.target.querySelector('.n') ?? e.target;
    const final = el.textContent;
    const m = /^([\d,]+)(.*)$/.exec(final);
    const to = m ? parseInt(m[1].replace(/,/g, ''), 10) : 0;
    if (to < 3) continue;
    const t0 = performance.now();
    const tick = (now) => {
      const k = Math.min((now - t0) / 1400, 1);
      el.textContent = Math.round(to * (1 - (1 - k) ** 3)).toLocaleString('en-AU') + m[2];
      if (k < 1) requestAnimationFrame(tick);
      else el.textContent = final;
    };
    requestAnimationFrame(tick);
  }
}, { threshold: 0.6 });
if (counter) document.querySelectorAll('.stat .num').forEach((el) => counter.observe(el));
