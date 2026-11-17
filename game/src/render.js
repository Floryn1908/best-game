// All canvas drawing: the arena, the lantern light and the darkness outside it, the
// Keeper, the shadows, bolts, embers and particles, the HUD, and the title, upgrade,
// pause and game-over screens. Drawing never touches the simulation except to read it.

import { ENEMY, FIELD, FONT, LANTERN, PALETTE, PLAYER, WAVE } from './config.js';
import { createRandom } from './random.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_UPGRADE = 'upgrade';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

/** The three upgrade cards' rectangles, in field coordinates; shared with the click test. */
export function upgradeCardRects() {
  const w = 260;
  const h = 190;
  const gap = 24;
  const total = 3 * w + 2 * gap;
  const x0 = (FIELD.width - total) / 2;
  const y = 268;
  return [0, 1, 2].map((i) => ({ x: x0 + i * (w + gap), y, w, h }));
}

/** Which upgrade card (0, 1, 2) a field point lands on, or -1. */
export function pickCard(x, y) {
  const rects = upgradeCardRects();
  for (let i = 0; i < rects.length; i += 1) {
    const r = rects[i];
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return i;
  }
  return -1;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = FIELD.width;
  canvas.height = FIELD.height;

  // Old rune stones scattered on the arena floor: fixed positions, so every visit
  // (and every screenshot) shows the same arena. Pure decoration, no collision.
  const stones = [];
  {
    const random = createRandom(20261117);
    for (let i = 0; i < 12; i += 1) {
      stones.push({
        x: 90 + random() * (FIELD.width - 180),
        y: 90 + random() * (FIELD.height - 180),
        r: 9 + random() * 14,
        angle: random() * Math.PI,
      });
    }
  }

  function circle(x, y, radius, color) {
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }

  function drawArena(state) {
    ctx.fillStyle = PALETTE.arena;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    // Faint starfield dots in the dark.
    ctx.fillStyle = PALETTE.grid;
    for (let gx = 80; gx < FIELD.width; gx += 80) {
      for (let gy = 60; gy < FIELD.height; gy += 60) {
        ctx.fillRect(gx, gy, 2, 2);
      }
    }
    // Rune stones: dark slabs with a faint violet mark, for the eye to land on.
    for (let i = 0; i < stones.length; i += 1) {
      const s = stones[i];
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(s.angle);
      ctx.fillStyle = '#1d1c33';
      ctx.beginPath();
      ctx.ellipse(0, 0, s.r, s.r * 0.7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(139, 124, 246, 0.35)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(-s.r * 0.35, -s.r * 0.35, s.r * 0.7, s.r * 0.7);
      ctx.restore();
    }
    // Arena border: a low stone rim the shadows crawl over.
    ctx.strokeStyle = PALETTE.arenaEdge;
    ctx.lineWidth = 4;
    ctx.strokeRect(FIELD.margin, FIELD.margin, FIELD.width - 2 * FIELD.margin, FIELD.height - 2 * FIELD.margin);
  }

  function drawEmbers(state) {
    for (let i = 0; i < state.embers.length; i += 1) {
      const e = state.embers[i];
      if (!e.active) continue;
      const pulse = 0.75 + 0.25 * Math.sin(state.time * 6 + i);
      ctx.save();
      ctx.translate(e.x, e.y);
      ctx.rotate(Math.PI / 4);
      ctx.globalAlpha = pulse;
      ctx.fillStyle = PALETTE.ember;
      ctx.fillRect(-5, -5, 10, 10);
      ctx.restore();
      ctx.globalAlpha = 1;
    }
  }

  function drawEnemies(state) {
    const p = state.player;
    for (let i = 0; i < state.enemies.length; i += 1) {
      const e = state.enemies[i];
      if (!e.active) continue;
      const def = ENEMY[e.type];
      const wobble = Math.sin(state.time * 5 + i * 1.7) * 2;
      // A faint violet aura, so the shadow reads even in the dark beyond the light.
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const aura = ctx.createRadialGradient(e.x, e.y, 2, e.x, e.y, e.radius * 3);
      aura.addColorStop(0, 'rgba(139, 124, 246, 0.22)');
      aura.addColorStop(1, 'rgba(139, 124, 246, 0)');
      ctx.fillStyle = aura;
      ctx.fillRect(e.x - e.radius * 3, e.y - e.radius * 3, e.radius * 6, e.radius * 6);
      ctx.restore();
      // Shadow body: a dark blob with a violet rim, darker than the night around it.
      circle(e.x, e.y + wobble * 0.3, e.radius + 3, 'rgba(8, 6, 24, 0.95)');
      ctx.beginPath();
      ctx.arc(e.x, e.y + wobble * 0.3, e.radius, 0, Math.PI * 2);
      ctx.strokeStyle = def.color;
      ctx.lineWidth = 2.5;
      ctx.stroke();
      // Glowing eyes that track the Keeper.
      const angle = Math.atan2(p.y - e.y, p.x - e.x);
      const ex = Math.cos(angle) * e.radius * 0.35;
      const ey = Math.sin(angle) * e.radius * 0.35;
      circle(e.x + ex - 4, e.y + ey - 2 + wobble * 0.3, 5, 'rgba(255, 93, 115, 0.35)');
      circle(e.x + ex + 4, e.y + ey - 2 + wobble * 0.3, 5, 'rgba(255, 93, 115, 0.35)');
      circle(e.x + ex - 4, e.y + ey - 2 + wobble * 0.3, 2.6, '#ff5d73');
      circle(e.x + ex + 4, e.y + ey - 2 + wobble * 0.3, 2.6, '#ff5d73');
      // Brutes wear a cracked crown of spikes; splitters pulse.
      if (e.type === 'brute') {
        ctx.beginPath();
        for (let s = 0; s < 6; s += 1) {
          const a = (s / 6) * Math.PI * 2;
          ctx.moveTo(e.x + Math.cos(a) * e.radius, e.y + Math.sin(a) * e.radius);
          ctx.lineTo(e.x + Math.cos(a) * (e.radius + 8), e.y + Math.sin(a) * (e.radius + 8));
        }
        ctx.strokeStyle = def.color;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      // Health arc for hurt shadows.
      if (e.hp < e.maxHp) {
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.radius + 7, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * e.hp) / e.maxHp);
        ctx.strokeStyle = '#cbb8ff';
        ctx.lineWidth = 3;
        ctx.stroke();
      }
    }
  }

  function drawBolts(state) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < state.bolts.length; i += 1) {
      const b = state.bolts[i];
      if (!b.active) continue;
      const tail = 0.03;
      ctx.beginPath();
      ctx.moveTo(b.x - b.vx * tail, b.y - b.vy * tail);
      ctx.lineTo(b.x, b.y);
      ctx.strokeStyle = '#ffe9b0';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.stroke();
      circle(b.x, b.y, 4, '#fff6d8');
    }
    ctx.restore();
  }

  function drawPlayer(state) {
    const p = state.player;
    const blink = p.invuln > 0 && Math.floor(state.time * 14) % 2 === 0;
    if (blink) return;
    // Robe: a hooded figure in deep violet.
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - 16);
    ctx.quadraticCurveTo(p.x + 14, p.y - 4, p.x + 11, p.y + 14);
    ctx.quadraticCurveTo(p.x, p.y + 18, p.x - 11, p.y + 14);
    ctx.quadraticCurveTo(p.x - 14, p.y - 4, p.x, p.y - 16);
    ctx.fillStyle = PALETTE.playerRobe;
    ctx.fill();
    ctx.strokeStyle = '#6b5aa8';
    ctx.lineWidth = 2;
    ctx.stroke();
    // Face in shadow, two lit eyes.
    circle(p.x - 4, p.y - 4, 1.8, '#ffe9b0');
    circle(p.x + 4, p.y - 4, 1.8, '#ffe9b0');
    // The lantern: a small brass cage swinging toward the aim, flame inside.
    const aim = Math.atan2(p.aimY - p.y, p.aimX - p.x);
    const lx = p.x + Math.cos(aim) * 22;
    const ly = p.y + Math.sin(aim) * 22;
    ctx.beginPath();
    ctx.arc(lx, ly, 8, 0, Math.PI * 2);
    ctx.fillStyle = '#2a2118';
    ctx.fill();
    ctx.strokeStyle = '#c9973f';
    ctx.lineWidth = 2;
    ctx.stroke();
    circle(lx, ly, 4.5, PALETTE.lightCore);
    ctx.beginPath();
    ctx.moveTo(p.x + Math.cos(aim) * 10, p.y + Math.sin(aim) * 10);
    ctx.lineTo(lx, ly);
    ctx.strokeStyle = '#c9973f';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  function drawParticles(state) {
    for (let i = 0; i < state.particles.particles.length; i += 1) {
      const p = state.particles.particles[i];
      if (!p.active) continue;
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      circle(p.x, p.y, p.size, p.color);
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center';
    for (let i = 0; i < state.particles.floaters.length; i += 1) {
      const f = state.particles.floaters[i];
      if (!f.active) continue;
      ctx.globalAlpha = Math.max(0, f.life / f.maxLife);
      ctx.font = `bold ${f.size}px ${FONT}`;
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
  }

  function drawDarkness(state) {
    // The night presses in from beyond the lantern light. The falloff is wide and the
    // far dark stops short of black, so the arena and its shadows stay readable.
    const p = state.player;
    const r = state.lightRadius;
    const dark = ctx.createRadialGradient(p.x, p.y, r * 0.55, p.x, p.y, r * 1.9);
    dark.addColorStop(0, 'rgba(5, 5, 18, 0)');
    dark.addColorStop(0.6, 'rgba(5, 5, 18, 0.5)');
    dark.addColorStop(1, 'rgba(5, 5, 18, 0.88)');
    ctx.fillStyle = dark;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  }

  function drawLightPool(state) {
    // Warm glow pooled around the Keeper, painted over the darkness.
    const p = state.player;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const glow = ctx.createRadialGradient(p.x, p.y, 8, p.x, p.y, 140);
    glow.addColorStop(0, 'rgba(255, 196, 107, 0.42)');
    glow.addColorStop(1, 'rgba(255, 196, 107, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(p.x - 140, p.y - 140, 280, 280);
    ctx.restore();
  }

  function drawHud(state, best, muted) {
    const p = state.player;
    ctx.textAlign = 'left';
    ctx.font = `bold 26px ${FONT}`;
    ctx.fillStyle = PALETTE.text;
    ctx.fillText(`SCORE ${state.score}`, 24, 40);
    ctx.font = `16px ${FONT}`;
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText(`BEST ${Math.max(best, state.score)}`, 24, 64);
    ctx.textAlign = 'center';
    ctx.font = `bold 24px ${FONT}`;
    ctx.fillStyle = PALETTE.text;
    ctx.fillText(`WAVE ${state.wave}`, FIELD.width / 2, 40);
    ctx.font = `15px ${FONT}`;
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText(`${state.kills} shadows banished  •  ${state.embersCollected} embers`, FIELD.width / 2, 64);
    // Fuel bar and health, top right.
    const barX = FIELD.width - 264;
    const barW = 240;
    ctx.textAlign = 'left';
    ctx.font = `bold 15px ${FONT}`;
    ctx.fillStyle = state.lantern.fuel < 25 ? PALETTE.danger : PALETTE.light;
    ctx.fillText('LANTERN', barX, 30);
    ctx.fillStyle = '#241f3d';
    ctx.fillRect(barX, 38, barW, 14);
    const fuelFrac = state.lantern.fuel / state.lantern.maxFuel;
    ctx.fillStyle = fuelFrac < 0.25 ? PALETTE.danger : PALETTE.light;
    ctx.fillRect(barX, 38, barW * fuelFrac, 14);
    ctx.strokeStyle = '#4a3f7d';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(barX, 38, barW, 14);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `bold 15px ${FONT}`;
    ctx.fillText('HEALTH', barX, 76);
    const hpFrac = p.hp / p.maxHp;
    ctx.fillStyle = '#241f3d';
    ctx.fillRect(barX, 82, barW, 12);
    ctx.fillStyle = hpFrac < 0.3 ? PALETTE.danger : '#7ee081';
    ctx.fillRect(barX, 82, barW * hpFrac, 12);
    ctx.strokeStyle = '#4a3f7d';
    ctx.strokeRect(barX, 82, barW, 12);
    // Controls reminder, bottom left; mute state, bottom right.
    ctx.font = `13px ${FONT}`;
    ctx.fillStyle = PALETTE.muted;
    ctx.textAlign = 'left';
    ctx.fillText('WASD move  •  Mouse aim  •  Hold click to shoot  •  P pause', 24, FIELD.height - 16);
    ctx.textAlign = 'right';
    ctx.fillText(muted ? 'M — sound off' : 'M — sound on', FIELD.width - 24, FIELD.height - 16);
  }

  function drawBanner(state) {
    if (state.phase !== 'banner') return;
    const alpha = Math.min(1, state.phaseTimer * 2);
    ctx.globalAlpha = alpha;
    ctx.textAlign = 'center';
    ctx.font = `bold 64px ${FONT}`;
    ctx.fillStyle = PALETTE.light;
    ctx.fillText(state.bannerText, FIELD.width / 2, 250);
    ctx.font = `18px ${FONT}`;
    ctx.fillStyle = PALETTE.text;
    ctx.fillText('The dark sends its shadows. Keep the light alive.', FIELD.width / 2, 288);
    ctx.globalAlpha = 1;
  }

  function dimOverlay(alpha) {
    ctx.fillStyle = `rgba(6, 6, 18, ${alpha})`;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  }

  function drawTitle(state, best) {
    dimOverlay(0.55);
    ctx.textAlign = 'center';
    ctx.font = `bold 72px ${FONT}`;
    ctx.fillStyle = PALETTE.light;
    ctx.fillText('GLOWFALL', FIELD.width / 2, 210);
    ctx.font = `28px ${FONT}`;
    ctx.fillStyle = PALETTE.text;
    ctx.fillText('Keeper of the Last Lantern', FIELD.width / 2, 254);
    ctx.font = `18px ${FONT}`;
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText('The last lantern is yours. Its light is your shield and your fuel.', FIELD.width / 2, 306);
    ctx.fillText('Blast the shadows, gather their embers, and do not let the light die.', FIELD.width / 2, 332);
    ctx.font = `bold 17px ${FONT}`;
    ctx.fillStyle = PALETTE.text;
    ctx.fillText('WASD / arrows — move      Mouse — aim      Hold click — shoot light', FIELD.width / 2, 396);
    ctx.fillText('Embers refuel the lantern  •  Clear a wave to choose a blessing', FIELD.width / 2, 424);
    const pulse = 0.65 + 0.35 * Math.sin(state.time * 4);
    ctx.globalAlpha = pulse;
    ctx.font = `bold 24px ${FONT}`;
    ctx.fillStyle = PALETTE.lightCore;
    ctx.fillText('PRESS SPACE OR CLICK TO BEGIN', FIELD.width / 2, 500);
    ctx.globalAlpha = 1;
    if (best > 0) {
      ctx.font = `16px ${FONT}`;
      ctx.fillStyle = PALETTE.muted;
      ctx.fillText(`Best score ${best}`, FIELD.width / 2, 540);
    }
  }

  function drawUpgrade(state) {
    dimOverlay(0.6);
    ctx.textAlign = 'center';
    ctx.font = `bold 40px ${FONT}`;
    ctx.fillStyle = PALETTE.light;
    ctx.fillText('CHOOSE A BLESSING', FIELD.width / 2, 200);
    ctx.font = `18px ${FONT}`;
    ctx.fillStyle = PALETTE.text;
    ctx.fillText(`Wave ${state.wave} is clear — bonus +${WAVE.clearBonus * state.wave}. Pick one — press 1, 2 or 3, or click a card.`, FIELD.width / 2, 234);
    const rects = upgradeCardRects();
    for (let i = 0; i < state.offered.length; i += 1) {
      const offer = state.offered[i];
      const r = rects[i];
      ctx.fillStyle = PALETTE.card;
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.strokeStyle = PALETTE.cardEdge;
      ctx.lineWidth = 2;
      ctx.strokeRect(r.x, r.y, r.w, r.h);
      ctx.fillStyle = PALETTE.light;
      ctx.font = `bold 15px ${FONT}`;
      ctx.fillText(`[${i + 1}]`, r.x + r.w / 2, r.y + 30);
      ctx.fillStyle = PALETTE.text;
      ctx.font = `bold 22px ${FONT}`;
      ctx.fillText(offer.def.name, r.x + r.w / 2, r.y + 66);
      ctx.font = `16px ${FONT}`;
      ctx.fillStyle = PALETTE.muted;
      wrapText(offer.def.desc, r.x + r.w / 2, r.y + 100, r.w - 32, 22);
      ctx.font = `bold 15px ${FONT}`;
      ctx.fillStyle = PALETTE.light;
      ctx.fillText(`Level ${offer.level}`, r.x + r.w / 2, r.y + r.h - 20);
    }
  }

  function wrapText(text, x, y, maxWidth, lineHeight) {
    const words = text.split(' ');
    let line = '';
    let cy = y;
    for (let i = 0; i < words.length; i += 1) {
      const test = line === '' ? words[i] : `${line} ${words[i]}`;
      if (ctx.measureText(test).width > maxWidth && line !== '') {
        ctx.fillText(line, x, cy);
        line = words[i];
        cy += lineHeight;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, x, cy);
  }

  function drawPaused() {
    dimOverlay(0.6);
    ctx.textAlign = 'center';
    ctx.font = `bold 48px ${FONT}`;
    ctx.fillStyle = PALETTE.text;
    ctx.fillText('PAUSED', FIELD.width / 2, 330);
    ctx.font = `18px ${FONT}`;
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText('Press P or Space to keep playing.', FIELD.width / 2, 372);
  }

  function drawOver(state, best) {
    dimOverlay(0.65);
    ctx.textAlign = 'center';
    ctx.font = `bold 56px ${FONT}`;
    ctx.fillStyle = PALETTE.danger;
    ctx.fillText(state.overReason === 'fuel' ? 'THE LIGHT HAS DIED' : 'THE KEEPER HAS FALLEN', FIELD.width / 2, 220);
    ctx.font = `20px ${FONT}`;
    ctx.fillStyle = PALETTE.text;
    ctx.fillText(
      state.overReason === 'fuel'
        ? 'The lantern burned down to nothing, and the dark closed in.'
        : 'The shadows overwhelmed the last Keeper of the lantern.',
      FIELD.width / 2,
      262,
    );
    ctx.font = `bold 34px ${FONT}`;
    ctx.fillStyle = PALETTE.light;
    ctx.fillText(`SCORE  ${state.score}`, FIELD.width / 2, 340);
    ctx.font = `19px ${FONT}`;
    ctx.fillStyle = PALETTE.text;
    ctx.fillText(`Best wave ${state.bestWave}  •  ${state.kills} shadows banished  •  ${state.embersCollected} embers gathered`, FIELD.width / 2, 382);
    ctx.fillText(`Best score ${Math.max(best, state.score)}`, FIELD.width / 2, 412);
    const pulse = 0.65 + 0.35 * Math.sin(state.time * 4);
    ctx.globalAlpha = pulse;
    ctx.font = `bold 24px ${FONT}`;
    ctx.fillStyle = PALETTE.lightCore;
    ctx.fillText('PRESS R OR CLICK TO LIGHT THE LANTERN AGAIN', FIELD.width / 2, 486);
    ctx.globalAlpha = 1;
  }

  return {
    draw(state, screen, best, muted) {
      ctx.save();
      if (state.shake > 0) {
        const mag = state.shake * 9;
        ctx.translate((Math.random() - 0.5) * mag, (Math.random() - 0.5) * mag);
      }
      drawArena(state);
      drawDarkness(state);
      drawLightPool(state);
      drawEmbers(state);
      drawEnemies(state);
      drawBolts(state);
      drawPlayer(state);
      drawParticles(state);
      if (state.flash > 0) {
        ctx.fillStyle = `rgba(255, 60, 80, ${state.flash * 0.22})`;
        ctx.fillRect(0, 0, FIELD.width, FIELD.height);
      }
      ctx.restore();
      if (screen === SCREEN_PLAY || screen === SCREEN_UPGRADE || screen === SCREEN_PAUSED) {
        drawHud(state, best, muted);
      }
      if (screen === SCREEN_PLAY) drawBanner(state);
      if (screen === SCREEN_TITLE) drawTitle(state, best);
      else if (screen === SCREEN_UPGRADE) drawUpgrade(state);
      else if (screen === SCREEN_PAUSED) drawPaused();
      else if (screen === SCREEN_OVER) drawOver(state, best);
      // The fuel gauge is the game's heartbeat: warn when it runs low.
      if (screen === SCREEN_PLAY && state.lantern.fuel < 25 && state.phase !== 'upgrade') {
        ctx.textAlign = 'center';
        ctx.globalAlpha = 0.6 + 0.4 * Math.sin(state.time * 6);
        ctx.font = `bold 20px ${FONT}`;
        ctx.fillStyle = PALETTE.danger;
        ctx.fillText('THE LANTERN IS DYING — GATHER EMBERS', FIELD.width / 2, 120);
        ctx.globalAlpha = 1;
      }
    },
  };
}

export { LANTERN, PLAYER };
