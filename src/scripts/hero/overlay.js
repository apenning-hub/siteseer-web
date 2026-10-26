// The interface laid over the hero model: red + pins on inspection points, one
// info card, and the Hierarchy panel whose toggles follow the layer pulls.

// How long after a step starts its first inspection card shows, and how long
// each card stays before the next.
const CARD_DELAY = 1500, CARD_EACH = 1800;

export function createOverlay({ hero, toScreen, layers }) {
  const pinsEl = hero.querySelector('#pins3d');
  const card = hero.querySelector('#icard');
  const panel = hero.querySelector('#lpanel');
  const copy = hero.querySelector('.copy');
  const legend = hero.querySelector('#spanel');
  const sysRows = [...legend.querySelectorAll('li')].map((li) => ({ li, layers: li.dataset.layers.split(',').map(Number) }));
  const rows = [...panel.querySelectorAll('li')].map((li) => ({ li, layers: li.dataset.layers.split(',').map(Number) }));
  const pinEls = [];
  let cardInfo = null;

  function setCard(info, at, dock = false) {
    if (info !== cardInfo) {
      cardInfo = info;
      if (info) {
        card.replaceChildren();
        const k = document.createElement('span'); k.className = 'k'; k.textContent = info.kicker;
        const b = document.createElement('b'); b.textContent = info.title;
        const p = document.createElement('p'); p.textContent = info.text;
        card.append(k, b, p);
        if (info.refs) { const r = document.createElement('div'); r.className = 'rf'; r.textContent = info.refs; card.append(r); }
      }
    }
    card.classList.toggle('on', !!info);
    card.classList.toggle('docked', !!info && dock);
    if (!info) return;
    const w = card.offsetWidth, h = card.offsetHeight;
    if (dock) {
      // Pulls: the card sits under the Hierarchy panel, so it never covers the model or the copy.
      const hr = hero.getBoundingClientRect(), pr = panel.getBoundingClientRect();
      const docked = pr.width > 0;
      const left = docked ? pr.right - hr.left - w : 16;
      const top = docked ? pr.bottom - hr.top + 12 : hero.clientHeight - h - 84;
      card.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
      return;
    }
    const [x, y] = toScreen(at);
    // Sit beside the point; flip to its left if it would run off screen, but
    // never over the copy. On stacked (phone) layouts, stay below the copy.
    const cr = copy.getBoundingClientRect(), hr = hero.getBoundingClientRect();
    const stacked = hero.clientWidth <= 900;
    let left = x + 26 + w > hero.clientWidth - 16 ? x - 26 - w : x + 26;
    if (!stacked) left = Math.max(left, cr.right - hr.left + 16);
    left = Math.min(Math.max(left, 16), hero.clientWidth - w - 16);
    const minTop = stacked ? cr.bottom - hr.top + 12 : 72;
    card.style.transform = `translate(${Math.round(left)}px, ${Math.round(Math.min(Math.max(y - 30, minTop), hero.clientHeight - h - 90))}px)`;
  }

  // step: the current step's data; t: ms since it began; settled: the camera
  // has arrived and nobody is dragging. Returns the pull that is active now.
  function update(step, t, settled, dt) {
    const points = step.inspect && settled ? step.inspect : [];
    const active = points.length ? points[Math.min(points.length - 1, Math.floor(Math.max(0, t - CARD_DELAY) / CARD_EACH))] : null;
    while (pinEls.length < points.length) {
      const e = document.createElement('span');
      e.className = 'pin3d';
      e.textContent = '+';
      pinsEl.appendChild(e);
      pinEls.push(e);
    }
    pinEls.forEach((e, i) => {
      const p = points[i];
      e.classList.toggle('on', !!p);
      e.classList.toggle('active', !!p && p === active);
      if (p) {
        const [x, y] = toScreen(p.at);
        e.style.transform = `translate(${x}px, ${y}px)`;
      }
    });

    const pull = step.pulls && settled ? step.pulls.findLast((q) => t >= q.t) : null;
    const pulling = pull && t < pull.t + pull.dur ? pull : null;
    layers.stepPulls(dt, pulling);
    panel.classList.toggle('on', !!step.pulls && settled);
    // Systems legend: shown while the wall builds and while one layer is picked
    // out. Rows light up as their system's layers land.
    const showLegend = step.kind === 'build' || step.kind === 'focus';
    legend.classList.toggle('on', showLegend);
    for (const r of sysRows) {
      r.li.classList.toggle('lit', r.layers.some(layers.landed));
      r.li.classList.toggle('active', !!step.focus && r.layers.includes(step.focus));
    }
    legend.classList.toggle('focusing', !!step.focus);
    for (const r of rows) r.li.classList.toggle('off', r.layers.some(layers.isOut));

    if (active) setCard(active, active.at);
    else if (pulling && t > pulling.t + 450 && t < pulling.t + pulling.dur - 300) setCard(pulling, null, true);
    else setCard(null);
  }

  return { update };
}
