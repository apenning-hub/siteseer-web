/**
 * Mobile navigation disclosure. Below 880px the nav links collapse behind a
 * Menu button; above it the button is hidden by CSS and this is inert.
 */
const header = document.querySelector('.nav');
const toggle = document.querySelector('.navtoggle');
const panel = document.getElementById('navmenu');

if (header && toggle && panel) {
  const setOpen = (open) => {
    header.dataset.open = String(open);
    toggle.setAttribute('aria-expanded', String(open));
  };

  setOpen(false);

  toggle.addEventListener('click', () => {
    setOpen(header.dataset.open !== 'true');
  });

  // Escape closes and returns focus to the trigger.
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (header.dataset.open !== 'true') return;
    setOpen(false);
    toggle.focus();
  });

  // Following a link closes the panel.
  panel.addEventListener('click', (event) => {
    if (event.target.closest('a')) setOpen(false);
  });

  // Returning to desktop width must not leave a stale open state behind.
  window.matchMedia('(min-width: 881px)').addEventListener('change', (event) => {
    if (event.matches) setOpen(false);
  });
}
