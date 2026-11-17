// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s
// steps (several in a slow frame, none in a fast one), and the renderer paints what is
// there. The game moves between five screens: title, play, upgrade choice, paused and
// game over. Sounds are synthesised; the mute key M silences them.
//
// ?seed=N fixes the spawn pattern. ?shot=cover|play|upgrade|end|start (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_HIT, EVENT_KILL, EVENT_OVER, EVENT_PICKUP, EVENT_SHOOT, EVENT_WAVE_CLEAR } from './world.js';
import { ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, ACTION_PICK_1, ACTION_PICK_2, ACTION_PICK_3, ACTION_RESTART, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer, pickCard, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_UPGRADE } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best, false);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();

  // Screen readers (and anyone watching the page's text) hear the screen changes and each hit.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    audio.unlock();
    world.reset();
    accumulator = 0;
    screen = SCREEN_PLAY;
    audio.horn();
    announce('Playing. Keep the lantern alive.');
  }

  function endGame() {
    screen = SCREEN_OVER;
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    audio.over();
    announce(`Game over. Score ${world.state.score}. Best ${best}.`);
  }

  function pickUpgrade(index) {
    const offer = world.state.offered[index];
    if (!offer) return;
    if (!world.applyUpgrade(offer.def.id)) return;
    audio.upgrade();
    world.nextWave();
    screen = SCREEN_PLAY;
    audio.horn();
    announce(`Blessing taken: ${offer.def.name}. Wave ${world.state.wave}.`);
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMute();
      announce(muted ? 'Sound off.' : 'Sound on.');
    }
    if (screen === SCREEN_TITLE) {
      if (actions & ACTION_CONFIRM) startGame();
      return;
    }
    if (screen === SCREEN_OVER) {
      if (actions & (ACTION_CONFIRM | ACTION_RESTART)) startGame();
      return;
    }
    if (screen === SCREEN_UPGRADE) {
      if (actions & ACTION_PICK_1) pickUpgrade(0);
      else if (actions & ACTION_PICK_2) pickUpgrade(1);
      else if (actions & ACTION_PICK_3) pickUpgrade(2);
      const click = input.takeClick();
      if (click) {
        const card = pickCard(click.x, click.y);
        if (card >= 0) pickUpgrade(card);
      }
      return;
    }
    if (screen === SCREEN_PAUSED) {
      if (actions & (ACTION_PAUSE | ACTION_CONFIRM)) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
      return;
    }
    // SCREEN_PLAY
    if (actions & ACTION_PAUSE) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  }

  function playSounds(events) {
    if (events & EVENT_SHOOT) audio.shoot();
    if (events & EVENT_KILL) audio.hit();
    if (events & EVENT_PICKUP) audio.pickup();
    if (events & EVENT_HIT) audio.hurt();
    if (events & EVENT_WAVE_CLEAR) audio.horn();
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      world.step(STEP, { mx: 0, my: 0, aimX: 640, aimY: 300, firing: false }, true);
      return;
    }
    if (screen !== SCREEN_PLAY) return;
    const move = input.move();
    const aim = input.aim();
    const events = world.step(STEP, { mx: move.x, my: move.y, aimX: aim.x, aimY: aim.y, firing: input.isFiring() }, false);
    playSounds(events);
    if (events & EVENT_OVER) endGame();
    else if (events & EVENT_HIT) announce(`Hit. Health ${Math.max(0, Math.round(world.state.player.hp))}.`);
    else if (world.isChoosing()) {
      screen = SCREEN_UPGRADE;
      // Drop any click queued while fighting: a shooting click must never pick a
      // blessing the moment the choice appears.
      input.takeClick();
      announce('Wave clear. Choose a blessing: 1, 2 or 3.');
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, best, audio.isMuted());
    // Debug hook for automated smoke tests: the live game state, read-only.
    const foe = world.nearestEnemy();
    window.__glowfall = {
      screen,
      score: world.state.score,
      wave: world.state.wave,
      fuel: Math.round(world.state.lantern.fuel * 10) / 10,
      hp: Math.round(world.state.player.hp),
      phase: world.state.phase,
      kills: world.state.kills,
      embers: world.state.embersCollected,
      enemies: world.countActive(world.state.enemies),
      offered: world.state.offered.length,
      player: { x: Math.round(world.state.player.x), y: Math.round(world.state.player.y) },
      foe: foe ? { x: Math.round(foe.x), y: Math.round(foe.y) } : null,
    };
  }

  // Leaving the tab pauses a running game rather than letting shadows close in unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Glowfall. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
