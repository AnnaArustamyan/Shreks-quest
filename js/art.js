// Pixel art drawn from rectangles. A sprite is a list of parts:
// [x, y, w, h, color, detail?]. Non-detail parts get a 1px dark outline.
const OUT = '#1b1424';
const C = {
  dGrey: '#8e8c9e', dLight: '#c9c7d4', dDark: '#5d5a70', dMane: '#3a3346', hoof: '#2e2a38', earIn: '#d9a3b4',
  white: '#ffffff', black: '#14101c',
  rRed: '#e0405a', rDark: '#9a1f3c', rBelly: '#ffbf6b', rBelly2: '#e8954a', rWing: '#7a1e44', rMem: '#c44a6e',
  horn: '#f6ead0', blush: '#ff8aa8',
};

function drawParts(g, parts, x, y, w, flip) {
  g.fillStyle = OUT;
  for (const p of parts) {
    if (p[5]) continue;
    const px = flip ? w - p[0] - p[2] : p[0];
    g.fillRect(x + px - 1, y + p[1] - 1, p[2] + 2, p[3] + 2);
  }
  for (const p of parts) {
    const px = flip ? w - p[0] - p[2] : p[0];
    g.fillStyle = p[4];
    g.fillRect(x + px, y + p[1], p[2], p[3]);
  }
}

// ---------- heroes (facing right) ----------
// st: { walk: 0-3, air, act, glide, flap, blink }
const HERO_SIZE = { donkey: [22, 24], dragon: [26, 22] };

function donkeyParts(st) {
  const b = st.walk === 1 || st.walk === 3 ? 1 : 0, P = [];
  let legs = [[4, 0], [7, 0], [11, 0], [14, 0]];
  if (st.air) legs = [[3, 2], [6, 2], [12, 2], [15, 2]];
  else if (st.walk === 1) legs = [[5, 1], [7, 0], [11, 0], [15, 1]];
  else if (st.walk === 3) legs = [[4, 0], [8, 1], [12, 1], [14, 0]];
  if (st.act) { // buck kick: back legs fly out behind
    P.push([-3, 15, 7, 2, C.dGrey], [-3, 19, 7, 2, C.dGrey], [-5, 15, 2, 2, C.hoof], [-5, 19, 2, 2, C.hoof]);
    legs = legs.slice(2);
  }
  for (const [x, lift] of legs) P.push([x, 17, 2, 7 - lift, C.dGrey], [x, 22 - lift, 2, 2, C.hoof]);
  P.push(
    [1, 11 + b, 2, 5, C.dGrey], [0, 15 + b, 3, 3, C.dMane], // tail
    [3, 11 + b, 13, 7, C.dGrey], // body
    [13, 6 + b, 4, 8, C.dGrey], // neck
    [14, 4 + b, 7, 7, C.dGrey], // head
    [17, 8 + b, 5, 4, C.dLight], // muzzle
    [15, 0 + b, 2, 5, C.dGrey], [18, 0 + b, 2, 5, C.dGrey], // ears
    [15, 0 + b, 2, 1, C.dDark, 1], [18, 0 + b, 2, 1, C.dDark, 1],
    [16, 1 + b, 1, 3, C.earIn, 1], [19, 1 + b, 1, 3, C.earIn, 1],
    [5, 16 + b, 9, 2, C.dLight, 1], // belly
    [13, 5 + b, 2, 8, C.dMane, 1], // mane
    [20, 9 + b, 1, 1, C.dDark, 1], // nostril
    [18, 10 + b, 3, 1, C.dDark, 1], // grin
  );
  if (st.blink) P.push([17, 6 + b, 2, 1, C.black, 1]);
  else P.push([17, 5 + b, 2, 2, C.white, 1], [18, 5 + b, 1, 2, C.black, 1]);
  return P;
}

function dragonParts(st) {
  const b = st.walk === 1 || st.walk === 3 ? 1 : 0, P = [];
  if (st.glide || st.air) {
    const up = st.flap;
    P.push([3, up ? 0 : 3, 11, up ? 7 : 6, C.rWing], [0, up ? 2 : 6, 4, 4, C.rWing], [4, (up ? 1 : 4), 9, 4, C.rMem, 1]);
  } else {
    P.push([7, 4 + b, 7, 7, C.rWing], [8, 5 + b, 5, 4, C.rMem, 1]);
  }
  P.push([2, 15 + b, 6, 3, C.rRed], [0, 13 + b, 3, 4, C.rDark]); // tail + spade
  let lifts = [0, 0];
  if (st.air) lifts = [1, 1];
  else if (st.walk === 1) lifts = [1, 0];
  else if (st.walk === 3) lifts = [0, 1];
  [8, 15].forEach((x, k) => P.push([x, 18, 3, 4 - lifts[k], C.rRed], [x, 21 - lifts[k], 3, 1, C.horn, 1]));
  P.push(
    [6, 9 + b, 12, 10, C.rRed], // body
    [8, 7 + b, 2, 2, C.rDark], [12, 7 + b, 2, 2, C.rDark], // back spikes
    [15, 3 + b, 8, 8, C.rRed], // head
    [21, 6 + b, 5, 4, C.rRed], // snout
    [16, 0 + b, 2, 4, C.horn], [19, 0 + b, 2, 3, C.horn], // horns
    [11, 11 + b, 6, 7, C.rBelly, 1], [11, 13 + b, 6, 1, C.rBelly2, 1], [11, 16 + b, 6, 1, C.rBelly2, 1],
    [18, 9 + b, 2, 1, C.blush, 1],
    [24, 7 + b, 1, 1, C.rDark, 1],
  );
  P.push(st.act ? [22, 9 + b, 4, 2, '#3a0a14', 1] : [22, 9 + b, 3, 1, C.rDark, 1]);
  if (st.blink) P.push([18, 6 + b, 3, 1, C.black, 1]);
  else P.push([18, 5 + b, 3, 3, C.white, 1], [20, 5 + b, 1, 3, C.black, 1], [21, 4 + b, 1, 1, C.black, 1]);
  return P;
}

function drawHero(g, kind, cx, feetY, face, st) {
  const [w, h] = HERO_SIZE[kind];
  const parts = kind === 'donkey' ? donkeyParts(st) : dragonParts(st);
  drawParts(g, parts, Math.round(cx - w / 2), Math.round(feetY - h), w, face < 0);
}

// ---------- enemies (facing right) ----------
const ENEMY = {
  beetle: { w: 14, h: 9, parts: f => [
    [1, 0, 11, 7, '#2f7a46'], [11, 2, 3, 4, '#1e2a24'],
    [3, 1, 4, 1, '#6fc27a', 1], [6, 0, 1, 7, '#1e4a2c', 1], [12, 3, 1, 1, '#ffffff', 1],
    [2 + f, 7, 1, 2, '#1e2a24'], [6 - f, 7, 1, 2, '#1e2a24'], [10 + f, 7, 1, 2, '#1e2a24'],
  ] },
  bee: { w: 12, h: 10, fly: true, parts: f => [
    [2, 3, 8, 6, '#f6c638'], [9, 4, 3, 4, '#2b2233'], [0, 5, 2, 2, '#2b2233'],
    [4, 3, 1, 6, '#2b2233', 1], [7, 3, 1, 6, '#2b2233', 1], [10, 5, 1, 1, '#ffffff', 1],
    [3, f ? 0 : 1, 3, f ? 3 : 2, '#dff4ff'], [6, f ? 0 : 1, 3, f ? 3 : 2, '#dff4ff'],
  ] },
  hedgehog: { w: 15, h: 10, spiky: true, parts: f => [
    [1, 2, 2, 3, '#4a2e1e'], [4, 0, 2, 4, '#4a2e1e'], [7, 0, 2, 4, '#4a2e1e'], [10, 1, 2, 3, '#4a2e1e'],
    [1, 3, 11, 6, '#8a5a3a'], [10, 4, 5, 5, '#ead2a8'],
    [4, 0, 2, 1, '#d8c0a0', 1], [7, 0, 2, 1, '#d8c0a0', 1], [14, 5, 1, 1, OUT, 1], [12, 5, 1, 1, OUT, 1],
    [3 + f, 9, 2, 1, '#4a2e1e', 1], [8 - f, 9, 2, 1, '#4a2e1e', 1],
  ] },
  knight: { w: 12, h: 16, parts: f => [
    [3, 12, 2, 4 - f, '#6a7080'], [7, 12, 2, 3 + f, '#6a7080'],
    [2, 6, 8, 7, '#9aa2b2'], [4, 7, 4, 5, '#3a5fbe', 1], [5, 8, 2, 3, '#ffd34d', 1],
    [2, 0, 8, 7, '#b8c0d0'], [5, 3, 5, 1, OUT, 1], [4, -2, 3, 2, '#e0405a'],
    [10, 3, 1, 8, '#e6ecf4'], [9, 9, 3, 1, '#8a5a3a'],
  ] },
  bat: { w: 12, h: 8, fly: true, parts: f => [
    [0, f ? 0 : 3, 4, 3, '#6e3a92'], [8, f ? 0 : 3, 4, 3, '#6e3a92'],
    [4, 2, 4, 5, '#4a2a6a'], [4, 0, 1, 2, '#4a2a6a'], [7, 0, 1, 2, '#4a2a6a'],
    [5, 3, 1, 1, '#ffd84a', 1], [7, 3, 1, 1, '#ffd84a', 1], [5, 6, 1, 1, '#ffffff', 1], [7, 6, 1, 1, '#ffffff', 1],
  ] },
  pikeman: { w: 12, h: 16, spiky: true, parts: f => [
    [3, 12, 2, 4 - f, '#6a7080'], [7, 12, 2, 3 + f, '#6a7080'],
    [2, 6, 8, 7, '#8a92a2'], [4, 7, 4, 5, '#7a2a3a', 1],
    [2, 0, 8, 7, '#a8b0c0'], [5, 3, 5, 1, OUT, 1],
    [10, -10, 1, 22, '#8a5a3a'], [9, -14, 3, 4, '#e6ecf4'],
  ] },
};
const ENEMY_KIND = { donkey: { e: 'beetle', b: 'bee', s: 'hedgehog' }, dragon: { e: 'knight', b: 'bat', s: 'pikeman' } };

// ---------- small things ----------
const HEART = ['.XX.XX.', 'XXXXXXX', 'XXXXXXX', '.XXXXX.', '..XXX..', '...X...'];
function heart(g, x, y, col, s = 1, outline = true) {
  const pass = (ox, oy, c) => {
    g.fillStyle = c;
    HEART.forEach((row, j) => { for (let i = 0; i < 7; i++) if (row[i] === 'X') g.fillRect(x + ox + i * s, y + oy + j * s, s, s); });
  };
  if (outline) pass(s, s, OUT);
  pass(0, 0, col);
}

function pcircle(g, cx, cy, r, col) {
  g.fillStyle = col;
  for (let dy = -r; dy <= r; dy++) {
    const w = Math.floor(Math.sqrt(r * r - dy * dy));
    g.fillRect(Math.round(cx - w), Math.round(cy + dy), w * 2 + 1, 1);
  }
}

function rng(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }
function hash(n) { const x = Math.sin(n * 127.1) * 43758.5453; return x - Math.floor(x); }

// ---------- tiles (16x16, cached per theme) ----------
function makeTile(fn) { const c = document.createElement('canvas'); c.width = c.height = 16; fn(c.getContext('2d')); return c; }
function specks(g, r, cols, n, y0 = 0) { for (let i = 0; i < n; i++) { g.fillStyle = cols[i % cols.length]; g.fillRect((r() * 16) | 0, y0 + ((r() * (16 - y0)) | 0), 1 + (r() < 0.3), 1); } }

const THEMES = {
  donkey: {
    flowerCols: ['#ff7aa8', '#ffd34d', '#8ab8ff', '#ffffff', '#c78aff'], flowerMid: '#ffb02a',
    flag: '#ff7aa8', liquid: ['#3d7a5c', '#8fd0a8'], treat: 'WAFFLES',
    tiles: () => ({
      top: makeTile(g => {
        const r = rng(3); g.fillStyle = '#8a5a34'; g.fillRect(0, 0, 16, 16); specks(g, r, ['#6e4426', '#a06a3e'], 14, 5);
        g.fillStyle = '#5cb85c'; g.fillRect(0, 0, 16, 5); g.fillStyle = '#86d47e'; g.fillRect(0, 0, 16, 1);
        for (let x = 0; x < 16; x++) if (r() < 0.55) { g.fillStyle = '#5cb85c'; g.fillRect(x, 5, 1, 1 + (r() < 0.4)); }
        g.fillStyle = '#a6e49a'; for (let i = 0; i < 4; i++) g.fillRect((r() * 16) | 0, 1 + ((r() * 3) | 0), 1, 1);
      }),
      fill: makeTile(g => {
        const r = rng(7); g.fillStyle = '#8a5a34'; g.fillRect(0, 0, 16, 16); specks(g, r, ['#6e4426', '#a06a3e', '#6e4426'], 16);
        if (r() < 0.7) { g.fillStyle = '#9a8e80'; g.fillRect(4 + ((r() * 8) | 0), 4 + ((r() * 8) | 0), 3, 2); }
      }),
      brick: makeTile(g => { // wooden crate
        g.fillStyle = '#7a4e26'; g.fillRect(0, 0, 16, 16); g.fillStyle = '#c88a48'; g.fillRect(1, 1, 14, 14);
        g.fillStyle = '#a8703a'; g.fillRect(1, 5, 14, 1); g.fillRect(1, 10, 14, 1);
        g.fillStyle = '#e0a868'; g.fillRect(1, 1, 14, 1);
        g.fillStyle = '#e8dcc0'; [[2, 2], [13, 2], [2, 13], [13, 13]].forEach(([x, y]) => g.fillRect(x, y, 1, 1));
      }),
      oneway: makeTile(g => {
        g.fillStyle = '#6e4426'; g.fillRect(0, 0, 16, 6); g.fillStyle = '#b07a44'; g.fillRect(0, 1, 16, 4);
        g.fillStyle = '#d09a5c'; g.fillRect(0, 1, 16, 1); g.fillStyle = '#8a5a30'; g.fillRect(5, 2, 1, 2); g.fillRect(11, 3, 2, 1);
      }),
      haz: [0, 1].map(f => makeTile(g => { // bramble with thorns
        g.fillStyle = '#244a2a'; g.fillRect(0, 9, 16, 7); g.fillStyle = '#3e7a42'; g.fillRect(1, 10, 3, 2); g.fillRect(9, 11, 4, 2);
        for (let i = 0; i < 4; i++) {
          const x = 1 + i * 4 + f;
          g.fillStyle = OUT; g.fillRect(x, 4, 3, 6); g.fillStyle = '#e8dcc0'; g.fillRect(x + 1, 4, 1, 5); g.fillRect(x, 7, 3, 2);
        }
      })),
    }),
  },
  dragon: {
    flowerCols: ['#ff4a2a', '#ff8a1a', '#ffb02a'], flowerMid: '#fff2a0',
    flag: '#ffb02a', liquid: ['#ff5a1a', '#ffd84a'], treat: 'GOLD',
    tiles: () => ({
      top: makeTile(g => {
        const r = rng(5); g.fillStyle = '#3b2329'; g.fillRect(0, 0, 16, 16); specks(g, r, ['#2a171c', '#4e2e34'], 16, 4);
        g.fillStyle = '#5e2a2a'; g.fillRect(0, 0, 16, 4); g.fillStyle = '#8a3a2a'; g.fillRect(0, 0, 16, 1);
        g.fillStyle = '#ff7a1a'; for (let i = 0; i < 3; i++) { const x = (r() * 14) | 0, y = 5 + ((r() * 9) | 0); g.fillRect(x, y, 2, 1); g.fillRect(x + 1, y + 1, 1, 1); }
      }),
      fill: makeTile(g => {
        const r = rng(9); g.fillStyle = '#3b2329'; g.fillRect(0, 0, 16, 16); specks(g, r, ['#2a171c', '#4e2e34'], 18);
        g.fillStyle = '#c43a1a'; for (let i = 0; i < 2; i++) g.fillRect((r() * 15) | 0, (r() * 15) | 0, 1 + (r() < 0.5), 1);
      }),
      brick: makeTile(g => { // castle stone
        g.fillStyle = '#2e242c'; g.fillRect(0, 0, 16, 16); g.fillStyle = '#5a4a54';
        g.fillRect(0, 0, 7, 7); g.fillRect(8, 0, 8, 7); g.fillRect(0, 8, 3, 7); g.fillRect(4, 8, 8, 7); g.fillRect(13, 8, 3, 7);
        g.fillStyle = '#77666f'; g.fillRect(0, 0, 7, 1); g.fillRect(8, 0, 8, 1); g.fillRect(4, 8, 8, 1);
      }),
      oneway: makeTile(g => {
        g.fillStyle = '#2a2a34'; g.fillRect(0, 0, 16, 6); g.fillStyle = '#4a4a58'; g.fillRect(0, 1, 16, 4);
        g.fillStyle = '#7a7a88'; g.fillRect(0, 1, 16, 1); g.fillStyle = '#9a9aa8'; g.fillRect(2, 3, 1, 1); g.fillRect(13, 3, 1, 1);
      }),
      haz: [0, 1].map(f => makeTile(g => { // lava pool
        g.fillStyle = '#ff5a1a'; g.fillRect(0, 6, 16, 10); g.fillStyle = '#ffb02a'; g.fillRect(3 + f * 6, 10, 3, 2); g.fillRect(11 - f * 7, 13, 2, 1);
        g.fillStyle = '#ffd84a'; for (let x = 0; x < 16; x++) g.fillRect(x, 6 + ((x + f * 2) % 4 < 2 ? 0 : 1), 1, 1);
      })),
    }),
  },
};
