// Pooled particles and floating score text. Both pools are allocated once and reused:
// spawning never allocates, and stepping never creates objects in the hot loop.

import { POOL } from './config.js';

export function createParticles() {
  const particles = [];
  for (let i = 0; i < POOL.particles; i += 1) {
    particles.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, size: 3, color: '#ffffff' });
  }
  const floaters = [];
  for (let i = 0; i < POOL.floaters; i += 1) {
    floaters.push({ active: false, x: 0, y: 0, life: 0, maxLife: 1, text: '', color: '#ffffff', size: 16 });
  }
  let cursor = 0;
  let textCursor = 0;

  function burst(x, y, color, count, speed, size, life) {
    for (let n = 0; n < count; n += 1) {
      const p = particles[cursor];
      cursor = (cursor + 1) % particles.length;
      const angle = Math.random() * Math.PI * 2;
      const v = speed * (0.35 + Math.random() * 0.65);
      p.active = true;
      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * v;
      p.vy = Math.sin(angle) * v;
      p.maxLife = life * (0.6 + Math.random() * 0.7);
      p.life = p.maxLife;
      p.size = size * (0.6 + Math.random() * 0.8);
      p.color = color;
    }
  }

  return {
    particles,
    floaters,
    burst,
    /** A short-lived sparkle that drifts up from a point. */
    sparkle(x, y, color) {
      burst(x, y, color, 6, 60, 2.5, 0.5);
    },
    /** A bright flash of embers on an enemy's death. */
    explode(x, y, color) {
      burst(x, y, color, 18, 190, 4, 0.7);
      burst(x, y, '#ffd98a', 8, 120, 3, 0.5);
    },
    /** Floating text that rises and fades ("+10", "WAVE 2"). */
    text(x, y, message, color, size) {
      const f = floaters[textCursor];
      textCursor = (textCursor + 1) % floaters.length;
      f.active = true;
      f.x = x;
      f.y = y;
      f.maxLife = 1.1;
      f.life = f.maxLife;
      f.text = message;
      f.color = color;
      f.size = size || 16;
    },
    step(dt) {
      for (let i = 0; i < particles.length; i += 1) {
        const p = particles[i];
        if (!p.active) continue;
        p.life -= dt;
        if (p.life <= 0) {
          p.active = false;
          continue;
        }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= 0.94;
        p.vy *= 0.94;
      }
      for (let i = 0; i < floaters.length; i += 1) {
        const f = floaters[i];
        if (!f.active) continue;
        f.life -= dt;
        if (f.life <= 0) {
          f.active = false;
          continue;
        }
        f.y -= 34 * dt;
      }
    },
    clear() {
      for (let i = 0; i < particles.length; i += 1) particles[i].active = false;
      for (let i = 0; i < floaters.length; i += 1) floaters[i].active = false;
    },
  };
}
