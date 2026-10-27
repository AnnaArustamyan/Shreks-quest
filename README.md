# Petal Quest 🌸

A tiny pixel-art platformer love story. Pick **Donkey** or **Dragon**, collect flowers across 3 levels, hand each bouquet to your love at the end of the level, and finish with a wedding.

| | Donkey | Dragon |
|---|---|---|
| World | chill sunny swamp, lofi beats | lava & castles, intense chiptune |
| Power | stomp + **buck kick** (hits both sides) | stomp + **fire breath**, hold jump to **glide** |
| Bonus | waffles (heal a heart) | gold (heals a heart) |
| Enemies | beetles, bees, hedgehogs (spiky!) | knights, bats, pikemen (spiky!) |

Spiky enemies can't be stomped: kick them, burn them, or jump over them.

## Controls
- **Move:** ← → / A D
- **Jump:** Space / ↑ / W / Z (hold for higher jumps, or to glide as Dragon)
- **Kick / Fire:** X / J / Shift
- **Pause:** P · **Mute:** M
- **Phone:** on-screen buttons (play in landscape)

## Run locally
Plain HTML/JS, no build step. Serve the folder (e.g. `python3 -m http.server`) and open `http://localhost:8000`.
Shortcuts for testing: `?hero=dragon&level=3`, `?wedding`.

All graphics and music are generated in code (WebAudio synth, rectangle pixel art).
