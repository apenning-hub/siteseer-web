/**
 * Header behaviour: a hairline once the page has scrolled, and the mobile
 * menu disclosure. Below 960px the links collapse behind the Menu button;
 * above it the button is hidden by CSS and this is inert.
 */
const header = document.getElementById('nav');
const toggle = header?.querySelector('.menu');
const panel = document.getElementById('navmenu');

if (header) {
  const onScroll = () => header.classList.toggle('solid', scrollY > 8);
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

if (header && toggle && panel) {
  const setOpen = (open) => {
    panel.classList.toggle('open', open);
    toggle.setAttribute('aria-expanded', String(open));
  };

  toggle.addEventListener('click', () => setOpen(!panel.classList.contains('open')));

  // Escape closes and returns focus to the trigger.
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || !panel.classList.contains('open')) return;
    setOpen(false);
    toggle.focus();
  });

  // Following a link closes the panel.
  panel.addEventListener('click', (event) => {
    if (event.target.closest('a')) setOpen(false);
  });

  // Close when focus or a click moves outside the header (WCAG 2.4.11: the
  // open panel would otherwise cover whatever gets focus next).
  header.addEventListener('focusout', (event) => {
    if (panel.classList.contains('open') && !header.contains(event.relatedTarget)) setOpen(false);
  });
  document.addEventListener('click', (event) => {
    if (panel.classList.contains('open') && !header.contains(event.target)) setOpen(false);
  });

  // Returning to desktop width must not leave a stale open state behind.
  window.matchMedia('(min-width: 961px)').addEventListener('change', (event) => {
    if (event.matches) setOpen(false);
  });
}
