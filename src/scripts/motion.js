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
