// Mounts the 3D hero on #hero. The copy, step words and pills are already in
// the page (server-rendered by Hero3D.astro); this adds the model and drives
// the sequence: each step once, in order, then rest on the last one.
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { createScene, ease, sharpenTextures } from './scene.js';
import { createLayers } from './layers.js';
import { createSite } from './site.js';
import { createOverlay } from './overlay.js';
import { createSequence } from './sequence.js';

const HOLD = 3600; // ms per step unless the step sets its own
const RESUME_AFTER_DRAG = 6000;

export async function mountHero(hero) {
  const steps = JSON.parse(hero.querySelector('#hero-steps').textContent);
  const words = [...hero.querySelectorAll('#word span')];
  const lines = [...hero.querySelectorAll('#line span')];
  const pills = [...hero.querySelectorAll('#steps .pill')];
  const pp = hero.querySelector('#steps .pp');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const seq = createSequence(steps, { hold: HOLD });
  const lastStep = steps.length - 1;

  const S = createScene(hero);
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const gltf = await loader.loadAsync(hero.dataset.detail);
  S.scene.add(gltf.scene);
  sharpenTextures(gltf.scene, S.renderer);
  const L = createLayers(gltf.scene);
  L.setLook('white', [], true);
  const site = createSite(loader, hero.dataset.site, S);
  const overlay = createOverlay({ hero, toScreen: S.toScreen, layers: L });

  let step = -1, stepStart = 0, elapsed = 0, playing = false, dragging = false;
  let look = null;
  // A step's look can change part-way through: `looks` is [{ t, look, focus }].
  const lookAt = (s, t) => (s.looks ?? []).findLast((l) => t >= l.t) ?? { look: 'white' };
  let idle = null, toReal = null;

  function go(i) {
    step = i;
    stepStart = performance.now();
    const s = steps[i];
    words.forEach((e, k) => { e.className = k === i ? 'in' : e.classList.contains('in') ? 'out' : ''; });
    lines.forEach((e, k) => e.classList.toggle('in', k === i));
    pills.forEach((p, k) => {
      p.setAttribute('aria-current', String(k === i));
      p.querySelector('b').style.width = k < i ? '100%' : '0';
    });
    look = null; // re-evaluated on the next frame
    toReal = null;
    const finale = s.kind === 'finale';
    // The finale keeps the wall where it is: it turns real and the site appears beneath it.
    site.show(finale, reduce);
    if (finale) {
      if (reduce) L.lerpReal(1);
      else toReal = { t0: performance.now() };
    }
    if (s.kind === 'build' && !reduce) L.startBuild();
    else L.finishBuild();
    S.camTo(s.cam, finale ? 3400 : 1500);
  }

  function setPlaying(p) {
    playing = p;
    const ended = !p && step === lastStep;
    pp.textContent = p ? '❚❚' : ended ? '↻' : '▶';
    pp.setAttribute('aria-label', p ? 'Pause the animation' : ended ? 'Play it again' : 'Play the animation');
  }

  pills.forEach((b, i) => b.addEventListener('click', () => {
    setPlaying(false);
    elapsed = seq.startOf(i);
    go(i);
  }));
  pp.addEventListener('click', () => {
    clearTimeout(idle);
    if (!playing && step === lastStep) {
      elapsed = 0;
      go(0);
      setPlaying(true);
    } else {
      setPlaying(!playing);
    }
  });

  // Dragging pauses the sequence; it picks up at the next step after a while.
  S.controls.addEventListener('start', () => {
    dragging = true;
    S.stopTween();
    L.finishBuild();
    setPlaying(false);
    clearTimeout(idle);
  });
  S.controls.addEventListener('end', () => {
    dragging = false;
    S.adoptControls();
    if (reduce || step >= lastStep) return;
    idle = setTimeout(() => {
      elapsed = seq.startOf(step + 1);
      go(step + 1);
      setPlaying(true);
    }, RESUME_AFTER_DRAG);
  });

  // Reduced motion: no sequence, straight to the resting last step.
  if (reduce) {
    elapsed = seq.startOf(lastStep);
    go(lastStep);
    setPlaying(false);
  } else {
    go(0);
    setPlaying(true);
  }
  S.applyCam();

  let last = performance.now(), frames = 0;
  function frame(now) {
    const dt = now - last;
    last = now;
    if (playing) {
      elapsed += dt;
      const at = seq.at(elapsed);
      if (at.step !== step) go(at.step);
      pills[step].querySelector('b').style.width = `${(at.t / seq.holdOf(step)) * 100}%`;
      if (at.done) setPlaying(false);
    }
    const want = lookAt(steps[step], reduce ? Infinity : now - stepStart);
    if (want !== look && steps[step].kind !== 'finale') {
      look = want;
      L.setLook(want.look, want.focus ?? [], reduce);
    }
    L.stepLook(dt);
    L.stepBuild(now);
    site.step(now);
    if (toReal) {
      const k = Math.min((now - toReal.t0) / 1100, 1);
      L.lerpReal(ease(k));
      if (k === 1) toReal = null;
    }
    if (!dragging) S.tickCamera(now, dt, playing);
    overlay.update(steps[step], now - stepStart, !S.tweening() && !dragging && !reduce, dt, look?.look);
    S.controls.update();
    S.render();
    if (++frames === 3) {
      hero.classList.add('live');
      window.heroReady = true;
    }
  }
  S.renderer.setAnimationLoop(frame);
  // Stop rendering while the hero is off screen.
  new IntersectionObserver(([e]) => {
    last = performance.now();
    S.renderer.setAnimationLoop(e.isIntersecting ? frame : null);
  }).observe(hero);
}
