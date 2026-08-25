/**
 * All motion behaviour for the site: marquee pause control, scroll-triggered
 * reveals, and the cursor spotlight. Every behaviour is off under
 * prefers-reduced-motion; the spotlight is additionally off without a fine
 * pointer, so touch devices never run pointer tracking.
 */
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');

/* ---------- marquee pause/play (WCAG 2.2.2) ---------- */
function initMarquee() {
  const toggle = document.querySelector('[data-marquee-toggle]');
  const marquee = document.querySelector('.marquee');
  if (!toggle || !marquee) return;

  // Under reduced motion the animation never runs, so the control is redundant.
  if (reduceMotion.matches) {
    toggle.hidden = true;
    return;
  }

  toggle.addEventListener('click', () => {
    const paused = marquee.classList.toggle('is-paused');
    toggle.setAttribute('aria-pressed', String(paused));
    toggle.textContent = paused ? 'Resume scrolling' : 'Pause scrolling';
  });
}

initMarquee();

/* ---------- cursor spotlight ---------- */
function initSpotlight() {
  if (reduceMotion.matches || !finePointer.matches) return;

  const cards = document.querySelectorAll('.glass, .postcard');
  for (const card of cards) {
    let frame = null;
    let latest = null;

    card.addEventListener('pointermove', (event) => {
      latest = event;
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = null;
        const rect = card.getBoundingClientRect();
        const x = ((latest.clientX - rect.left) / rect.width) * 100;
        const y = ((latest.clientY - rect.top) / rect.height) * 100;
        card.style.setProperty('--mx', `${x.toFixed(1)}%`);
        card.style.setProperty('--my', `${y.toFixed(1)}%`);
      });
    });

    card.addEventListener('pointerleave', () => {
      if (frame) {
        cancelAnimationFrame(frame);
        frame = null;
      }
      card.style.removeProperty('--mx');
      card.style.removeProperty('--my');
    });
  }
}

initSpotlight();

/* ---------- scroll-triggered entrances ---------- */
function initReveals() {
  const items = document.querySelectorAll('.reveal');
  if (!items.length) return;

  // No observer support, or motion is unwanted: show everything immediately.
  if (reduceMotion.matches || !('IntersectionObserver' in window)) {
    for (const item of items) item.classList.add('in');
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('in');
        observer.unobserve(entry.target);
      }
    },
    { threshold: 0, rootMargin: '0px 0px -12% 0px' }
  );

  for (const item of items) observer.observe(item);
}

initReveals();
