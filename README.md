# Shrek's Quest 🌸

A pixel-art platformer love story you can play in your browser.

**▶ Play it: https://annaarustamyan.github.io/Shreks-quest/**

Choose your path: walk the **Path of the Donkey** or the **Path of the Dragon**. Collect flowers through 3 levels that get harder each time, hand the bouquet to your love at the end of each level, and finish with a wedding. Keep an eye on the sky: Shrek likes to sneak a peek.

| | Path of the Donkey | Path of the Dragon |
|---|---|---|
| World | sunny swamp, chill lofi beats | lava and castles, intense chiptune |
| Powers | stomp + **buck kick** (hits both sides) | stomp + **fire breath**, hold jump to **glide** |
| Treat | **waffles: SUGAR RUSH!** 6 s of speed and big jumps, and anything you touch gets flattened | **gold: DRAGON FURY!** 6 s of rapid triple fireballs |
| Your love | Dragon | Donkey |

Treats also heal a heart.

### Monsters
| | Path of the Donkey | Path of the Dragon |
|---|---|---|
| Every level | beetles, bees, spiky hedgehogs | knights, bats, spiky pikemen |
| New in level 1 | Hoppy Frog (leaps at you) | Ember Slime (leaps at you) |
| New in level 2 | Spitting Thistle (shoots seeds) | Crossbow Knight (shoots bolts) |
| New in level 3 | Wild Boar (snorts, then charges) | Iron Boar (snorts, then charges) |

Spiky enemies can't be stomped: kick them, burn them or jump over them. Fireballs burn up incoming shots.

## The flower goal
A signpost before your love shows how many flowers they want. Bring enough and they catch your bouquet with a burst of hearts. Show up with too few and they'll drop it and burst into tears: you lose a heart and have to go back for more.

## The wedding
After level 3, Shrek officiates the wedding under a flower arch while every monster you met cheers from the benches, followed by fireworks and the big kiss. Press jump to skip ahead.

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
