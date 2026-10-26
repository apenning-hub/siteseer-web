// The building systems the hero model is coloured by, and the trades that
// build each one. Colours are Apple's standard system colours (light mode).
// Layer numbers are the detail's Lnn layers (tools/models/README.md).
// No three.js here: the legend markup is server-rendered from this too.
export const SYSTEMS = [
  { key: 'structure', name: 'Primary structure', trade: 'Framers and carpenters', color: '#007AFF', layers: [2, 6] },
  { key: 'facade', name: 'Facade', trade: 'Bricklayers', color: '#FF9500', layers: [1, 3, 4, 5] },
  { key: 'firstfix', name: 'First fix', trade: 'Carpenters and window installers', color: '#AF52DE', layers: [7, 8] },
  { key: 'glazing', name: 'Glazing', trade: 'Glaziers', color: '#32ADE6', layers: [11] },
  { key: 'secondfix', name: 'Second fix', trade: 'Plasterers and finishers', color: '#34C759', layers: [9, 10, 12] },
];

export const systemOf = (layer) => SYSTEMS.find((s) => s.layers.includes(layer));
