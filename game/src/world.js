// The simulation: one state object, one fixed step, no allocation in the hot loop.
// The Keeper moves, aims and fires light bolts. Shadows spawn at the arena's dark edge and
// crawl toward the light; inside the lantern's glow they slow down. Slain shadows drop
// embers; collecting them refuels the lantern and scores. Clearing a wave offers a choice
// of three upgrades. The light dies when the fuel runs out; the Keeper falls when health
// runs out. Either ends the game.

import { ENEMY, FIELD, LANTERN, PLAYER, POOL, STEP, UPGRADES, WAVE } from './config.js';
import { createParticles } from './particles.js';

export const EVENT_NONE = 0;
export const EVENT_SHOOT = 1;
export const EVENT_HIT = 2;
export const EVENT_PICKUP = 4;
export const EVENT_KILL = 8;
export const EVENT_WAVE_CLEAR = 16;
export const EVENT_OVER = 32;
export const EVENT_UPGRADE = 64;

const PHASE_BANNER = 'banner';
const PHASE_FIGHT = 'fight';
const PHASE_UPGRADE = 'upgrade';
const PHASE_OVER = 'over';

function makeEnemy() {
  return { active: false, type: 'crawler', x: 0, y: 0, hp: 1, maxHp: 1, speed: 0, radius: 10, touchCd: 0, wanderX: 0, wanderY: 0 };
}
function makeBolt() {
  return { active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, damage: 0, pierce: 0 };
}
function makeEmber() {
  return { active: false, x: 0, y: 0, vx: 0, vy: 0, value: 10, life: 0 };
}

export function createWorld(random) {
  const particles = createParticles();
  const state = {
    time: 0,
    wave: 1,
    phase: PHASE_BANNER,
    phaseTimer: WAVE.bannerSeconds,
    spawnQueue: [],
    spawnTimer: 0,
    score: 0,
    embersCollected: 0,
    kills: 0,
    bestWave: 1,
    bannerText: 'WAVE 1',
    shake: 0,
    flash: 0,
    overReason: null,
    lightRadius: LANTERN.baseRadius,
    offered: [],
    upgradeLevels: {},
    player: {
      x: FIELD.width / 2, y: FIELD.height / 2, hp: PLAYER.maxHp, maxHp: PLAYER.maxHp,
      radius: PLAYER.radius, speed: PLAYER.speed, fireCd: 0, invuln: 0, aimX: FIELD.width / 2, aimY: 240,
      beam: 1, fireRateMul: 1, damageMul: 1, pierce: 0, magnetRadius: 80, radiusBonus: 0,
    },
    lantern: { fuel: LANTERN.maxFuel, maxFuel: LANTERN.maxFuel },
    enemies: [],
    bolts: [],
    embers: [],
    particles,
  };
  for (let i = 0; i < POOL.enemies; i += 1) state.enemies.push(makeEnemy());
  for (let i = 0; i < POOL.bolts; i += 1) state.bolts.push(makeBolt());
  for (let i = 0; i < POOL.embers; i += 1) state.embers.push(makeEmber());

  function countActive(list) {
    let n = 0;
    for (let i = 0; i < list.length; i += 1) if (list[i].active) n += 1;
    return n;
  }

  function spawnPoint() {
    // Shadows crawl in from the dark edge: a random point on the arena border.
    const side = Math.floor(random() * 4);
    const m = FIELD.margin;
    if (side === 0) return { x: m + random() * (FIELD.width - 2 * m), y: m };
    if (side === 1) return { x: m + random() * (FIELD.width - 2 * m), y: FIELD.height - m };
    if (side === 2) return { x: m, y: m + random() * (FIELD.height - 2 * m) };
    return { x: FIELD.width - m, y: m + random() * (FIELD.height - 2 * m) };
  }

  function spawnEnemy(type) {
    for (let i = 0; i < state.enemies.length; i += 1) {
      const e = state.enemies[i];
      if (e.active) continue;
      const def = ENEMY[type];
      const point = spawnPoint();
      e.active = true;
      e.type = type;
      e.x = point.x;
      e.y = point.y;
      e.maxHp = def.hp + Math.floor((state.wave - 1) * def.hp * 0.12);
      e.hp = e.maxHp;
      e.speed = def.speed * (1 + (state.wave - 1) * 0.03);
      e.radius = def.radius;
      e.touchCd = 0;
      e.wanderX = FIELD.width / 2;
      e.wanderY = FIELD.height / 2;
      return e;
    }
    return null;
  }

  function spawnEmber(x, y) {
    for (let i = 0; i < state.embers.length; i += 1) {
      const e = state.embers[i];
      if (e.active) continue;
      const angle = random() * Math.PI * 2;
      e.active = true;
      e.x = x;
      e.y = y;
      e.vx = Math.cos(angle) * 60;
      e.vy = Math.sin(angle) * 60;
      e.value = LANTERN.emberScore;
      e.life = 14;
      return e;
    }
    return null;
  }

  function buildWaveQueue(wave) {
    const total = WAVE.baseCount + WAVE.perWave * (wave - 1);
    const queue = [];
    for (let i = 0; i < total; i += 1) {
      const roll = random();
      let type = 'crawler';
      if (wave >= 4 && roll < 0.16) type = 'splitter';
      else if (wave >= 3 && roll < 0.34) type = 'brute';
      else if (roll < 0.62) type = 'skitterer';
      queue.push(type);
    }
    // Shuffle so the wave never arrives in a predictable order.
    for (let i = queue.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1));
      const tmp = queue[i];
      queue[i] = queue[j];
      queue[j] = tmp;
    }
    return queue;
  }

  function rollUpgrades() {
    const available = [];
    for (let i = 0; i < UPGRADES.length; i += 1) {
      const def = UPGRADES[i];
      const level = state.upgradeLevels[def.id] || 0;
      if (level < def.max) available.push({ def, level: level + 1 });
    }
    const picked = [];
    while (picked.length < 3 && available.length > 0) {
      const index = Math.floor(random() * available.length);
      picked.push(available.splice(index, 1)[0]);
    }
    return picked;
  }

  function applyUpgrade(id) {
    const def = UPGRADES.find((u) => u.id === id);
    if (!def) return false;
    const level = (state.upgradeLevels[id] || 0) + 1;
    if (level > def.max) return false;
    state.upgradeLevels[id] = level;
    const p = state.player;
    if (id === 'wide') p.beam += 1;
    else if (id === 'rapid') p.fireRateMul *= 1.3;
    else if (id === 'radius') p.radiusBonus += 32;
    else if (id === 'magnet') p.magnetRadius += 95;
    else if (id === 'fuel') {
      state.lantern.maxFuel += 25;
      state.lantern.fuel = Math.min(state.lantern.maxFuel, state.lantern.fuel + 25);
    } else if (id === 'heart') {
      p.maxHp += 30;
      p.hp = Math.min(p.maxHp, p.hp + 30);
    } else if (id === 'pierce') p.pierce += 1;
    else if (id === 'boots') p.speed *= 1.12;
    else if (id === 'power') p.damageMul *= 1.35;
    return true;
  }

  function fireBolts() {
    const p = state.player;
    const baseAngle = Math.atan2(p.aimY - p.y, p.aimX - p.x);
    const spread = 0.1;
    let fired = 0;
    for (let b = 0; b < p.beam; b += 1) {
      let bolt = null;
      for (let i = 0; i < state.bolts.length; i += 1) {
        if (!state.bolts[i].active) {
          bolt = state.bolts[i];
          break;
        }
      }
      if (!bolt) break;
      const offset = p.beam === 1 ? 0 : (b - (p.beam - 1) / 2) * spread;
      const angle = baseAngle + offset;
      bolt.active = true;
      bolt.x = p.x + Math.cos(angle) * (p.radius + 8);
      bolt.y = p.y + Math.sin(angle) * (p.radius + 8);
      bolt.vx = Math.cos(angle) * PLAYER.boltSpeed;
      bolt.vy = Math.sin(angle) * PLAYER.boltSpeed;
      bolt.life = 1.1;
      bolt.damage = PLAYER.boltDamage * p.damageMul;
      bolt.pierce = p.pierce;
      fired += 1;
    }
    return fired > 0;
  }

  function killEnemy(e) {
    const def = ENEMY[e.type];
    e.active = false;
    state.kills += 1;
    state.score += def.score;
    state.particles.explode(e.x, e.y, def.color);
    state.particles.text(e.x, e.y - 10, `+${def.score}`, '#cbb8ff', 15);
    const drops = e.type === 'brute' ? 3 : e.type === 'splitter' ? 2 : 1;
    for (let i = 0; i < drops; i += 1) spawnEmber(e.x, e.y);
    if (e.type === 'splitter') {
      for (let i = 0; i < 2; i += 1) {
        const child = spawnEnemy('skitterer');
        if (child) {
          child.x = e.x + (i === 0 ? -14 : 14);
          child.y = e.y;
        }
      }
    }
  }

  function reset() {
    state.time = 0;
    state.wave = 1;
    state.phase = PHASE_BANNER;
    state.phaseTimer = WAVE.bannerSeconds;
    state.spawnQueue = [];
    state.spawnTimer = 0;
    state.score = 0;
    state.embersCollected = 0;
    state.kills = 0;
    state.bestWave = 1;
    state.bannerText = 'WAVE 1';
    state.shake = 0;
    state.flash = 0;
    state.overReason = null;
    state.offered = [];
    state.upgradeLevels = {};
    const p = state.player;
    p.x = FIELD.width / 2;
    p.y = FIELD.height / 2;
    p.hp = PLAYER.maxHp;
    p.maxHp = PLAYER.maxHp;
    p.speed = PLAYER.speed;
    p.fireCd = 0;
    p.invuln = 0;
    p.aimX = FIELD.width / 2;
    p.aimY = 240;
    p.beam = 1;
    p.fireRateMul = 1;
    p.damageMul = 1;
    p.pierce = 0;
    p.magnetRadius = 80;
    p.radiusBonus = 0;
    state.lantern.fuel = LANTERN.maxFuel;
    state.lantern.maxFuel = LANTERN.maxFuel;
    state.lightRadius = LANTERN.baseRadius + LANTERN.maxFuel * LANTERN.radiusPerFuel;
    for (let i = 0; i < state.enemies.length; i += 1) state.enemies[i].active = false;
    for (let i = 0; i < state.bolts.length; i += 1) state.bolts[i].active = false;
    for (let i = 0; i < state.embers.length; i += 1) state.embers[i].active = false;
    state.particles.clear();
  }

  function step(dt, input, attract) {
    let events = EVENT_NONE;
    state.time += dt;
    if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 2.2);
    if (state.flash > 0) state.flash = Math.max(0, state.flash - dt * 3);
    const p = state.player;

    if (attract) {
      // Title-screen backdrop: a few shadows wander the dark, the lantern burns full.
      if (countActive(state.enemies) < 6 && random() < dt * 0.8) spawnEnemy(random() < 0.5 ? 'skitterer' : 'crawler');
      updateEnemies(dt, true);
      state.particles.step(dt);
      return events;
    }

    if (state.phase === PHASE_OVER) {
      state.particles.step(dt);
      return events;
    }

    if (state.phase === PHASE_UPGRADE) {
      // The choice is untimed: the lantern holds its breath while the Keeper picks.
      state.particles.step(dt);
      return events;
    }

    // The lantern always burns; the light shrinks as the fuel falls.
    const drain = LANTERN.drainPerSecond + LANTERN.drainPerWave * (state.wave - 1);
    state.lantern.fuel -= drain * dt;
    state.lightRadius = LANTERN.baseRadius + p.radiusBonus + state.lantern.fuel * LANTERN.radiusPerFuel;
    if (state.lantern.fuel <= 0) {
      state.lantern.fuel = 0;
      state.phase = PHASE_OVER;
      state.overReason = 'fuel';
      state.bannerText = '';
      return EVENT_OVER;
    }

    // Movement and aim.
    p.x += input.mx * p.speed * dt;
    p.y += input.my * p.speed * dt;
    p.x = Math.min(FIELD.width - FIELD.margin - p.radius, Math.max(FIELD.margin + p.radius, p.x));
    p.y = Math.min(FIELD.height - FIELD.margin - p.radius, Math.max(FIELD.margin + p.radius, p.y));
    p.aimX = input.aimX;
    p.aimY = input.aimY;
    if (p.invuln > 0) p.invuln -= dt;
    if (p.fireCd > 0) p.fireCd -= dt;

    if (state.phase === PHASE_BANNER) {
      state.phaseTimer -= dt;
      if (state.phaseTimer <= 0) {
        state.phase = PHASE_FIGHT;
        state.spawnQueue = buildWaveQueue(state.wave);
        state.spawnTimer = 0.4;
      }
    } else if (state.phase === PHASE_FIGHT) {
      if (state.spawnQueue.length > 0) {
        state.spawnTimer -= dt;
        if (state.spawnTimer <= 0) {
          spawnEnemy(state.spawnQueue.shift());
          const interval = Math.max(WAVE.minInterval, WAVE.spawnInterval * Math.pow(WAVE.intervalScale, state.wave - 1));
          state.spawnTimer = interval * (0.7 + random() * 0.6);
        }
      } else if (countActive(state.enemies) === 0) {
        state.score += WAVE.clearBonus * state.wave;
        state.bestWave = Math.max(state.bestWave, state.wave);
        state.offered = rollUpgrades();
        state.phase = PHASE_UPGRADE;
        events |= EVENT_WAVE_CLEAR;
      }
    }

    if (input.firing && state.phase === PHASE_FIGHT && p.fireCd <= 0) {
      if (fireBolts()) {
        p.fireCd = 1 / (PLAYER.fireRate * p.fireRateMul);
        events |= EVENT_SHOOT;
      }
    }

    updateEnemies(dt, false);
    events |= updateBolts(dt);
    events |= updateEmbers(dt);
    state.particles.step(dt);

    // A shadow's touch hurts the Keeper.
    if (p.invuln <= 0) {
      for (let i = 0; i < state.enemies.length; i += 1) {
        const e = state.enemies[i];
        if (!e.active || e.touchCd > 0) continue;
        const dx = e.x - p.x;
        const dy = e.y - p.y;
        const dist = Math.hypot(dx, dy);
        if (dist < e.radius + p.radius - 2) {
          e.touchCd = ENEMY.touchCooldown;
          p.hp -= PLAYER.touchDamage;
          p.invuln = PLAYER.invulnerable;
          state.shake = 1;
          state.flash = 1;
          state.particles.burst(p.x, p.y, '#ff5d73', 14, 200, 4, 0.6);
          events |= EVENT_HIT;
          if (p.hp <= 0) {
            p.hp = 0;
            state.phase = PHASE_OVER;
            state.overReason = 'health';
            events |= EVENT_OVER;
          }
          break;
        }
      }
    }
    return events;
  }

  function updateEnemies(dt, attract) {
    const p = state.player;
    for (let i = 0; i < state.enemies.length; i += 1) {
      const e = state.enemies[i];
      if (!e.active) continue;
      if (e.touchCd > 0) e.touchCd -= dt;
      let tx;
      let ty;
      if (attract) {
        tx = e.wanderX;
        ty = e.wanderY;
        if (Math.hypot(tx - e.x, ty - e.y) < 30) {
          e.wanderX = FIELD.margin + random() * (FIELD.width - 2 * FIELD.margin);
          e.wanderY = FIELD.margin + random() * (FIELD.height - 2 * FIELD.margin);
        }
      } else {
        tx = p.x;
        ty = p.y;
      }
      const dx = tx - e.x;
      const dy = ty - e.y;
      const dist = Math.hypot(dx, dy) || 1;
      const inLight = Math.hypot(e.x - p.x, e.y - p.y) < state.lightRadius;
      const speed = e.speed * (inLight ? ENEMY.lightSlow : 1);
      e.x += (dx / dist) * speed * dt;
      e.y += (dy / dist) * speed * dt;
    }
  }

  function updateBolts(dt) {
    let events = EVENT_NONE;
    for (let i = 0; i < state.bolts.length; i += 1) {
      const b = state.bolts[i];
      if (!b.active) continue;
      b.life -= dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.life <= 0 || b.x < 0 || b.x > FIELD.width || b.y < 0 || b.y > FIELD.height) {
        b.active = false;
        continue;
      }
      for (let j = 0; j < state.enemies.length; j += 1) {
        const e = state.enemies[j];
        if (!e.active) continue;
        const dx = e.x - b.x;
        const dy = e.y - b.y;
        const reach = e.radius + PLAYER.boltRadius;
        if (dx * dx + dy * dy < reach * reach) {
          e.hp -= b.damage;
          state.particles.burst(b.x, b.y, '#ffe9b0', 5, 120, 3, 0.35);
          if (e.hp <= 0) {
            killEnemy(e);
            events |= EVENT_KILL;
          }
          if (b.pierce > 0) {
            b.pierce -= 1;
          } else {
            b.active = false;
          }
          break;
        }
      }
    }
    return events;
  }

  function updateEmbers(dt) {
    let events = EVENT_NONE;
    const p = state.player;
    for (let i = 0; i < state.embers.length; i += 1) {
      const e = state.embers[i];
      if (!e.active) continue;
      e.life -= dt;
      if (e.life <= 0) {
        e.active = false;
        continue;
      }
      const dx = p.x - e.x;
      const dy = p.y - e.y;
      const dist = Math.hypot(dx, dy) || 1;
      if (dist < p.magnetRadius) {
        const pull = 420 * (1 - dist / (p.magnetRadius + 40));
        e.vx += (dx / dist) * pull * dt * 10;
        e.vy += (dy / dist) * pull * dt * 10;
      }
      e.vx *= 0.92;
      e.vy *= 0.92;
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      if (dist < p.radius + 12) {
        e.active = false;
        state.embersCollected += 1;
        state.score += e.value;
        state.lantern.fuel = Math.min(state.lantern.maxFuel, state.lantern.fuel + LANTERN.emberFuel);
        state.particles.sparkle(p.x, p.y, '#ffb347');
        state.particles.text(p.x, p.y - 26, `+${e.value}`, '#ffb347', 14);
        events |= EVENT_PICKUP;
      }
    }
    return events;
  }

  return {
    state,
    reset,
    step,
    applyUpgrade,
    countActive,
    /** The nearest live shadow to the Keeper, or null. */
    nearestEnemy() {
      let best = null;
      let bestDist = Infinity;
      for (let i = 0; i < state.enemies.length; i += 1) {
        const e = state.enemies[i];
        if (!e.active) continue;
        const d = Math.hypot(e.x - state.player.x, e.y - state.player.y);
        if (d < bestDist) {
          bestDist = d;
          best = e;
        }
      }
      return best;
    },
    /** The nearest ember to the Keeper, or null. */
    nearestEmber() {
      let best = null;
      let bestDist = Infinity;
      for (let i = 0; i < state.embers.length; i += 1) {
        const e = state.embers[i];
        if (!e.active) continue;
        const d = Math.hypot(e.x - state.player.x, e.y - state.player.y);
        if (d < bestDist) {
          bestDist = d;
          best = e;
        }
      }
      return best;
    },
    /** True while the upgrade choice is on screen. */
    isChoosing() {
      return state.phase === PHASE_UPGRADE;
    },
    /** True once the game has ended. */
    isOver() {
      return state.phase === PHASE_OVER;
    },
    /** Start the next wave after an upgrade was picked. */
    nextWave() {
      state.wave += 1;
      state.phase = PHASE_BANNER;
      state.phaseTimer = WAVE.bannerSeconds;
      state.bannerText = `WAVE ${state.wave}`;
      state.offered = [];
    },
  };
}

export { STEP };
