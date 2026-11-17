// Every tuning number and colour in one place. The arena is a fixed 1280x720 logical
// area; the renderer scales it to the window, so no rule below depends on the screen size.
// Glowfall: the Keeper carries the last lantern. Its light is the safe zone and the fuel:
// embers dropped by slain shadows refuel it. Lose when the fuel or your health hits zero.

export const FIELD = { width: 1280, height: 720, margin: 28 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

export const PLAYER = {
  radius: 16,
  speed: 265,
  maxHp: 100,
  fireRate: 4.2, // bolts per second
  boltSpeed: 720,
  boltDamage: 26,
  boltRadius: 5,
  invulnerable: 1.0, // seconds of mercy after a hit
  touchDamage: 12,
};

export const LANTERN = {
  maxFuel: 100,
  drainPerSecond: 1.35, // base burn
  drainPerWave: 0.16, // extra burn each wave
  baseRadius: 175, // pixels of safe light
  radiusPerFuel: 0.55, // light shrinks as the fuel falls
  emberFuel: 7, // fuel each collected ember restores
  emberScore: 10,
};

export const ENEMY = {
  skitterer: { hp: 20, speed: 132, radius: 11, score: 15, color: '#8b7cf6' },
  crawler: { hp: 42, speed: 86, radius: 16, score: 25, color: '#6d5bd0' },
  brute: { hp: 130, speed: 46, radius: 26, score: 60, color: '#4c3f9e' },
  splitter: { hp: 52, speed: 72, radius: 18, score: 35, color: '#a78bfa' },
  /** Shadows move slower inside the lantern light. */
  lightSlow: 0.58,
  /** Seconds a shadow must touch the Keeper before it can hurt again. */
  touchCooldown: 0.9,
};

/** How many of each thing can exist at once; the pools are allocated once, at boot. */
export const POOL = { enemies: 48, bolts: 64, embers: 96, particles: 256, floaters: 32 };

export const WAVE = {
  baseCount: 8, // shadows in wave 1
  perWave: 4, // extra shadows each later wave
  spawnInterval: 1.0, // seconds between spawns at wave 1
  intervalScale: 0.93, // spawn interval multiplier per wave
  minInterval: 0.34,
  clearBonus: 50, // score per wave number on clearing a wave
  bannerSeconds: 2.2, // "WAVE N" banner before the shadows come
};

/** Upgrade cards offered between waves. level is the level the card would grant. */
export const UPGRADES = [
  { id: 'wide', name: 'Wide Beam', desc: '+1 bolt per shot, fanned out', max: 3 },
  { id: 'rapid', name: 'Rapid Wick', desc: '+30% fire rate', max: 4 },
  { id: 'radius', name: 'Bright Lantern', desc: '+32 light radius', max: 4 },
  { id: 'magnet', name: 'Ember Magnet', desc: 'embers drift to you from farther away', max: 3 },
  { id: 'fuel', name: 'Deep Reservoir', desc: '+25 max fuel, refilled 25', max: 3 },
  { id: 'heart', name: 'Warm Heart', desc: '+30 max health, healed 30', max: 3 },
  { id: 'pierce', name: 'Piercing Light', desc: 'bolts pass through +1 shadow', max: 3 },
  { id: 'boots', name: 'Swift Steps', desc: '+12% move speed', max: 3 },
  { id: 'power', name: 'Seared Bolt', desc: '+35% bolt damage', max: 4 },
];

export const PALETTE = {
  backdrop: '#0a0a18',
  arena: '#12122a',
  arenaEdge: '#1e1e3f',
  grid: '#1a1a36',
  light: '#ffc46b',
  lightCore: '#ffe9b0',
  ember: '#ffb347',
  player: '#ffd98a',
  playerRobe: '#3a2f5e',
  text: '#f4ead2',
  muted: '#9a8fb8',
  danger: '#ff5d73',
  card: '#1c1a38',
  cardEdge: '#4a3f7d',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'glowfall.best';
