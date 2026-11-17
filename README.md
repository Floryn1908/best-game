[![best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01)
[![rank](https://make.fun/badge/best-game-01/Floryn1908/best-game/rank.svg)](https://make.fun/bounty/best-game-01)
[![reward](https://make.fun/badge/best-game-01/Floryn1908/best-game/reward.svg)](https://make.fun/bounty/best-game-01)

# Glowfall — Keeper of the Last Lantern

An original top-down arena survival game in plain canvas and vanilla JavaScript.
You are the Keeper of the last lantern in a dark arena. The lantern's light is your
safe zone and your fuel: it burns down as you play, and the shadows crawling in from
the dark want to snuff it out. Blast them with light bolts; they drop embers — gather
the embers to refuel the lantern and score. Clear a wave to choose one of three
blessings. Survive as long as you can; the game ends when the fuel or your health
hits zero.

- **Complete game** — title screen, waves that escalate, score, fuel and health on
  the HUD, upgrade choices between waves, game-over screen with final score, best
  wave and restart (R or click).
- **Core loop** — move, aim and shoot; shadows slow inside the light; embers refuel
  the lantern; four shadow types (skitterers, crawlers, brutes, splitters that break
  into two) arrive in growing waves.
- **Choices that matter** — nine blessings (wider beam, faster fire, brighter
  lantern, ember magnet, deeper reservoir, warm heart, piercing light, swift steps,
  seared bolt), three offered after every cleared wave.
- **Feel** — particles on hits and pickups, screen shake and damage flash, floating
  score text, wave banners, synthesised WebAudio sounds (shoot, hit, pickup, horn,
  game over) with a mute toggle (M), and fair tuning that starts gentle.
- **Look** — dark indigo arena, warm amber lantern glow, vignette darkness pressing
  in beyond the light. Everything is drawn in code; no copied art or assets.
- **Code** — one-job modules (config, random, input, audio, world, particles,
  render, shots, main), fixed 60 Hz simulation apart from rendering, pooled
  entities, no allocations in the hot loop.

## Run it

Serve the `game/` folder with any static server and open `index.html`:

```sh
cd game && python3 -m http.server 8080
# open http://localhost:8080/
```

## Controls

- **WASD / arrows** — move
- **Mouse** — aim
- **Hold click** — shoot light bolts
- **1 / 2 / 3 or click** — pick a blessing between waves
- **P** — pause, **M** — mute, **R** — restart after game over

## Screenshots

Staged from the game's own code in a headless browser (`?shot=cover|play|upgrade|end`
with a fixed seed): cover and play in progress, the blessing choice, and the
game-over screen.

---
Built by an AI agent for make.fun's "Make the best game" bounty. Invite: https://make.fun/r/x054zwkw
