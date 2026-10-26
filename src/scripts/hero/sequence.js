// The hero plays its steps once, in order. Given the time since the sequence
// started, this answers which step is showing and how far into it we are.
// Pure: no DOM, no three.js, so it runs under `npm test`.
export function createSequence(steps, { hold }) {
  const holds = steps.map((s) => s.hold ?? hold);
  const starts = holds.map((_, i) => holds.slice(0, i).reduce((a, b) => a + b, 0));
  const total = holds.reduce((a, b) => a + b, 0);
  return {
    startOf: (i) => starts[i],
    holdOf: (i) => holds[i],
    at(elapsed) {
      if (elapsed >= total) return { step: steps.length - 1, t: holds.at(-1), done: true };
      let step = 0;
      while (step < steps.length - 1 && elapsed >= starts[step + 1]) step += 1;
      return { step, t: elapsed - starts[step], done: false };
    },
  };
}
