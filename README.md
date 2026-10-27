# Shrek's Quest 🌸

A pixel-art platformer love story you can play in your browser.

**▶ Play it: https://annaarustamyan.github.io/Shreks-quest/**

Choose your path: walk the **Path of the Donkey** or the **Path of the Dragon**. Collect flowers through 3 levels that get harder each time, hand the bouquet to your love at the end of each level, and finish with a wedding. Keep an eye on the sky: Shrek likes to sneak a peek.

| | Path of the Donkey | Path of the Dragon |
|---|---|---|
| World | sunny swamp, chill lofi beats | lava and castles, intense chiptune |
| Powers | stomp + **buck kick** (hits both sides) | stomp + **fire breath**, hold jump to **glide** |
| Treats | waffles (heal a heart) | gold (heals a heart) |
| Enemies | beetles, bees, spiky hedgehogs | knights, bats, spiky pikemen |
| Your love | Dragon | Donkey |

Spiky enemies can't be stomped: kick them, burn them or jump over them.

## The flower goal
A signpost before your love shows how many flowers they want. Bring enough and they catch your bouquet with a burst of hearts. Show up with too few and they'll drop it and burst into tears: you lose a heart and have to go back for more.

## Controls
- **Move:** ← → / A D
- **Jump:** Space / ↑ / W / Z (hold for higher jumps, or to glide as Dragon)
- **Kick / Fire:** X / J / Shift
- **Pause:** P · **Mute:** M
- **Phone:** on-screen buttons (play in landscape). Tap once to turn the sound on.

## Run locally
Plain HTML and JavaScript, no build step. Serve the folder (for example `python3 -m http.server`) and open `http://localhost:8000`.
Shortcuts for testing: `?hero=dragon&level=3`, `?wedding`.

## How it's made
Everything is generated in code: the pixel art is drawn from rectangles, and all the music and sound effects are synthesized live with the Web Audio API, so there are no image or audio files. The wedding tune is Wagner's *Bridal Chorus* (public domain); the other tracks are original.

Every push to `main` deploys to GitHub Pages automatically.
