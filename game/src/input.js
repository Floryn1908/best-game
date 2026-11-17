// Keyboard and pointer input. Held keys give a steering vector and the mouse gives an aim
// point; one-shot presses (start, restart, pause, mute, upgrade picks) are queued as bit
// flags and taken once by the loop, so a press between two frames is never lost or counted
// twice. All coordinates are in the 1280x720 logical field.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_MUTE = 4;
export const ACTION_RESTART = 8;
export const ACTION_PICK_1 = 16;
export const ACTION_PICK_2 = 32;
export const ACTION_PICK_3 = 64;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const MUTE = new Set(['KeyM']);
const RESTART = new Set(['KeyR']);
const PICKS = new Map([['Digit1', ACTION_PICK_1], ['Digit2', ACTION_PICK_2], ['Digit3', ACTION_PICK_3]]);

export function createInput(canvas) {
  let up = false;
  let down = false;
  let left = false;
  let right = false;
  let firing = false;
  let actions = 0;
  let mouseX = 640;
  let mouseY = 300;
  let clickX = -1;
  let clickY = -1;
  let clicked = false;

  function toField(event) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = 1280 / rect.width;
    const scaleY = 720 / rect.height;
    return { x: (event.clientX - rect.left) * scaleX, y: (event.clientY - rect.top) * scaleY };
  }

  window.addEventListener('keydown', (event) => {
    if (UP.has(event.code)) up = true;
    else if (DOWN.has(event.code)) down = true;
    else if (LEFT.has(event.code)) left = true;
    else if (RIGHT.has(event.code)) right = true;
    else if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (MUTE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_MUTE;
    } else if (RESTART.has(event.code)) {
      if (!event.repeat) actions |= ACTION_RESTART;
    } else if (PICKS.has(event.code)) {
      if (!event.repeat) actions |= PICKS.get(event.code);
    } else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    if (UP.has(event.code)) up = false;
    else if (DOWN.has(event.code)) down = false;
    else if (LEFT.has(event.code)) left = false;
    else if (RIGHT.has(event.code)) right = false;
  });
  // A key released while the tab is hidden never sends keyup: let go of everything on blur.
  window.addEventListener('blur', () => {
    up = false;
    down = false;
    left = false;
    right = false;
    firing = false;
  });
  canvas.addEventListener('pointermove', (event) => {
    const point = toField(event);
    mouseX = point.x;
    mouseY = point.y;
  });
  canvas.addEventListener('pointerdown', (event) => {
    const point = toField(event);
    mouseX = point.x;
    mouseY = point.y;
    firing = true;
    clickX = point.x;
    clickY = point.y;
    clicked = true;
    actions |= ACTION_CONFIRM;
  });
  window.addEventListener('pointerup', () => {
    firing = false;
  });

  return {
    /** Normalised steering vector from the held movement keys. */
    move() {
      const x = (right ? 1 : 0) - (left ? 1 : 0);
      const y = (down ? 1 : 0) - (up ? 1 : 0);
      if (x === 0 && y === 0) return { x: 0, y: 0 };
      const length = Math.hypot(x, y);
      return { x: x / length, y: y / length };
    },
    aim() {
      return { x: mouseX, y: mouseY };
    },
    isFiring() {
      return firing;
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** The last pointer click in field coordinates, or null when there was none. */
    takeClick() {
      if (!clicked) return null;
      clicked = false;
      return { x: clickX, y: clickY };
    },
    /** Steer the autopilot's aim and fire state (used by the screenshot scenes). */
    setAim(x, y, fire) {
      mouseX = x;
      mouseY = y;
      firing = fire;
    },
    /** Steer the autopilot's movement keys (used by the screenshot scenes). */
    setMove(x, y) {
      left = x < -0.2;
      right = x > 0.2;
      up = y < -0.2;
      down = y > 0.2;
    },
  };
}
