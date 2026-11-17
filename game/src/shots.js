// The screenshot scenes behind ?shot=cover|play|upgrade|end|start. Each one plays the real
// rules forward from a fresh world for a fixed number of steps, steered by a simple
// autopilot (chase embers, keep away from shadows, shoot the nearest one), so the frame
// is what a short game really looks like and the same seed always gives the same frame.
import { FIELD, STEP } from './config.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_UPGRADE } from './render.js';

const START_SECONDS = 5;
const COVER_SECONDS = 11;
const PLAY_SECONDS = 40;
const UPGRADE_LIMIT_SECONDS = 240;
const END_LIMIT_SECONDS = 600;

/** The autopilot's steering for one step: where to move, where to aim, whether to fire. */
function autopilot(world, doomed) {
  const state = world.state;
  const p = state.player;
  const enemy = world.nearestEnemy();
  const ember = world.nearestEmber();
  if (doomed) {
    // A hurried Keeper who chases embers and shoots wild: a few bolts land, most
    // miss, and the dark catches them — the frame shows a game really played.
    const enemy = world.nearestEnemy();
    if (enemy) {
      const edx = enemy.x - p.x;
      const edy = enemy.y - p.y;
      const edist = Math.hypot(edx, edy) || 1;
      const px = -edy / edist;
      const py = edx / edist;
      return {
        mx: ember ? (ember.x - p.x) / (Math.hypot(ember.x - p.x, ember.y - p.y) || 1) : 0,
        my: ember ? (ember.y - p.y) / (Math.hypot(ember.x - p.x, ember.y - p.y) || 1) : 0,
        aimX: enemy.x + px * 70,
        aimY: enemy.y + py * 70,
        firing: edist < 260,
      };
    }
    if (ember) {
      const dx = ember.x - p.x;
      const dy = ember.y - p.y;
      const dist = Math.hypot(dx, dy) || 1;
      return { mx: dx / dist, my: dy / dist, aimX: p.x, aimY: p.y, firing: false };
    }
    return { mx: 0, my: 0, aimX: p.x, aimY: p.y, firing: false };
  }
  let mx = 0;
  let my = 0;
  if (enemy) {
    const edx = enemy.x - p.x;
    const edy = enemy.y - p.y;
    const edist = Math.hypot(edx, edy) || 1;
    if (edist < 90) {
      // Too close: back away from the shadow.
      mx = -edx / edist;
      my = -edy / edist;
    } else if (edist > 420) {
      // Too far to hit: close the distance.
      mx = edx / edist;
      my = edy / edist;
    } else if (ember) {
      const mdx = ember.x - p.x;
      const mdy = ember.y - p.y;
      const mdist = Math.hypot(mdx, mdy) || 1;
      if (mdist < 280) {
        mx = mdx / mdist;
        my = mdy / mdist;
      }
    }
    // Keep inside the arena with a little margin from the rim.
    if (p.x < FIELD.margin + 60) mx = Math.max(mx, 0.4);
    if (p.x > FIELD.width - FIELD.margin - 60) mx = Math.min(mx, -0.4);
    if (p.y < FIELD.margin + 60) my = Math.max(my, 0.4);
    if (p.y > FIELD.height - FIELD.margin - 60) my = Math.min(my, -0.4);
    // Drift back toward the middle when far from it, so the fight stays in frame.
    const cdx = FIELD.width / 2 - p.x;
    const cdy = FIELD.height / 2 - p.y;
    const cdist = Math.hypot(cdx, cdy);
    if (cdist > 240) {
      mx += (cdx / cdist) * 0.45;
      my += (cdy / cdist) * 0.45;
    }
    const length = Math.hypot(mx, my) || 1;
    // Hold fire until the shadow is close: the frame fills with shadows crowding
    // the light before the bolts fly, as a bold player fights.
    return { mx: mx / length, my: my / length, aimX: enemy.x, aimY: enemy.y, firing: edist < 330 };
  }
  if (ember) {
    const dx = ember.x - p.x;
    const dy = ember.y - p.y;
    const dist = Math.hypot(dx, dy) || 1;
    return { mx: dx / dist, my: dy / dist, aimX: ember.x, aimY: ember.y, firing: false };
  }
  return { mx: 0, my: 0, aimX: p.x, aimY: p.y - 100, firing: false };
}

/**
 * Set `world` to the named scene and return the screen to draw over it and the best
 * score to show. cover/play are play in progress (cover earlier, play a wave later);
 * upgrade plays until the first wave clears; end plays a doomed Keeper until the game
 * ends; anything else is the title screen over a live arena.
 */
export function stageShot(name, world) {
  world.reset();
  if (name !== 'cover' && name !== 'play' && name !== 'upgrade' && name !== 'end') {
    for (let index = 0; index < START_SECONDS / STEP; index += 1) {
      world.step(STEP, { mx: 0, my: 0, aimX: 640, aimY: 300, firing: false }, true);
    }
    return { screen: SCREEN_TITLE, best: 0 };
  }
  const doomed = name === 'end';
  const limit = name === 'cover' ? COVER_SECONDS : name === 'play' ? PLAY_SECONDS : name === 'upgrade' ? UPGRADE_LIMIT_SECONDS : END_LIMIT_SECONDS;
  let over = false;
  for (let index = 0; index < limit / STEP; index += 1) {
    const events = world.step(STEP, autopilot(world, doomed), false);
    if (world.isChoosing()) {
      // The play scene keeps going past the first wave: the autopilot takes the first
      // blessing and fights on, so the frame shows a later wave in full swing.
      if (name === 'play') {
        world.applyUpgrade(world.state.offered[0].def.id);
        world.nextWave();
      } else break;
    }
    if (world.isOver()) {
      over = true;
      break;
    }
    void events;
  }
  if (world.isChoosing()) return { screen: SCREEN_UPGRADE, best: world.state.score };
  if (over || world.isOver()) return { screen: SCREEN_OVER, best: world.state.score };
  return { screen: SCREEN_PLAY, best: world.state.score };
}
