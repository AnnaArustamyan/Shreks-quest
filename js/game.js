(() => {
  const VW = 400, VH = 225, TS = 16, STEP = 1 / 60;
  const GRAV = 1250, JUMP = 410, MAXFALL = 420;
  const FONT = '"Press Start 2P", monospace';
  const cv = document.getElementById('game');
  const ctx = cv.getContext('2d');
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rand = (a, b) => a + Math.random() * (b - a);
  const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  const other = h => (h === 'donkey' ? 'dragon' : 'donkey');
  const NAME = { donkey: 'DONKEY', dragon: 'DRAGON' };

  // ---------- screen fit ----------
  function fit() {
    let s = Math.min(innerWidth / VW, innerHeight / VH);
    if (s >= 2) s = Math.floor(s * 2) / 2;
    cv.style.width = Math.floor(VW * s) + 'px';
    cv.style.height = Math.floor(VH * s) + 'px';
  }
  addEventListener('resize', fit); fit();

  // ---------- input ----------
  const keys = {}, pressed = {};
  let tap = null;
  const KEYMAP = {
    ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
    ArrowUp: 'jump', KeyW: 'jump', Space: 'jump', KeyZ: 'jump',
    KeyX: 'action', KeyJ: 'action', KeyK: 'action', ShiftLeft: 'action', ShiftRight: 'action',
    Enter: 'start', KeyP: 'pause', Escape: 'pause', KeyM: 'mute',
  };
  // Browsers only allow sound after a real gesture; phones count touchend/click, not pointerdown.
  ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown'].forEach(n => addEventListener(n, () => Sound.init(), true));
  addEventListener('keydown', e => {
    const a = KEYMAP[e.code];
    if (!a) return;
    e.preventDefault();
    if (!e.repeat) pressed[a] = true;
    keys[a] = true;
  });
  addEventListener('keyup', e => { const a = KEYMAP[e.code]; if (a) keys[a] = false; });
  document.querySelectorAll('#touch button').forEach(btn => {
    const a = btn.dataset.act;
    const down = e => { e.preventDefault(); keys[a] = true; pressed[a] = true; btn.classList.add('on'); };
    const up = e => { e.preventDefault(); keys[a] = false; btn.classList.remove('on'); };
    btn.addEventListener('pointerdown', down);
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(n => btn.addEventListener(n, up));
  });
  cv.addEventListener('pointerdown', e => {
    const r = cv.getBoundingClientRect();
    tap = { x: (e.clientX - r.left) / r.width * VW, y: (e.clientY - r.top) / r.height * VH };
  });
  const muteBtn = document.getElementById('mute');
  const toggleMute = () => { muteBtn.classList.toggle('off', Sound.toggleMute()); };
  muteBtn.addEventListener('click', e => { e.stopPropagation(); toggleMute(); muteBtn.blur(); });
  const anyGo = () => pressed.jump || pressed.start || pressed.action || !!tap;

  // ---------- state ----------
  let mode = 'loading', modeT = 0, T = 0, paused = false;
  let hero = 'donkey', levelIdx = 0, hearts = 3, totalFlowers = 0, totalTreats = 0;
  let L = null, P = null, cam = 0, shake = 0;
  let parts = [], fireballs = [], shots = [], floaters = [], bubble = null, bouquet = null, partnerHop = 0;
  let tiles = { donkey: null, dragon: null };
  let embers = [], butterflies = [], W = null;

  // ---------- level building ----------
  function loadLevel(i) {
    const def = LEVELS[i];
    const grid = Array.from({ length: ROWS }, () => []);
    const lv = { grid, flowers: [], treats: [], enemies: [], checkpoints: [], movers: [], start: null, goal: null, got: 0, treatsGot: 0 };
    const kinds = ENEMY_KIND[hero];
    let off = 0;
    for (const name of def.chunks) {
      const ch = parseChunk(CHUNKS[name]);
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < ch.w; c++) {
        let t = ch.rows[r][c];
        const x = (off + c) * TS, y = r * TS;
        if (t === 'F') lv.flowers.push({ x: x + 3, y: y + 3, w: 10, h: 12, k: lv.flowers.length });
        else if (t === 'W') lv.treats.push({ x: x + 3, y: y + 3, w: 10, h: 10, k: lv.treats.length });
        else if (t === 'C') lv.checkpoints.push({ x: x + 4, y, w: 10, h: 16, on: false });
        else if (t === 'P') lv.start = { x: x + 2, y };
        else if (t === 'G') lv.goal = { x: x + 8, y: y + 16 };
        else if (t === 'M' || t === 'N' || t === 'n') lv.movers.push({ cx: x + 8, y, w: 48, h: 8, range: t === 'M' ? 80 : 64, ph: t === 'n' ? Math.PI : 0, x: x - 16, dx: 0 });
        else if ('ebshgc'.includes(t)) {
          const kind = kinds[t], E = ENEMY[kind];
          const sp = 26 * def.speed * (hero === 'dragon' ? 1.2 : 1);
          lv.enemies.push({ kind, x: x + (16 - E.w) / 2, y: y + 16 - E.h, w: E.w, h: E.h, x0: x, y0: y + 2, vx: 0, vy: 0, dir: -1, face: -1,
            speed: sp, lv: def.speed, fly: !!E.fly, spiky: !!E.spiky, hop: !!E.hop, shoot: !!E.shoot, charge: !!E.charge, t: Math.random() * 10, ph: Math.random() * 6, active: false, dead: false });
        } else { grid[r][off + c] = t; continue; }
        grid[r][off + c] = ' ';
      }
      off += ch.w;
    }
    lv.cols = off; lv.worldW = off * TS;
    lv.need = Math.max(1, Math.floor(lv.flowers.length * def.need));
    lv.respawn = { ...lv.start };
    return lv;
  }

  const tileAt = (c, r) => (r < 0 || r >= ROWS ? ' ' : c < 0 || c >= L.cols ? '#' : L.grid[r][c] || ' ');
  const solid = t => t === '#' || t === '=';

  function moveBody(b, dt) {
    let hit = 0;
    b.x += b.vx * dt;
    const r0 = Math.floor(b.y / TS), r1 = Math.floor((b.y + b.h - 0.01) / TS);
    if (b.vx > 0) {
      const c = Math.floor((b.x + b.w - 0.01) / TS);
      for (let r = r0; r <= r1; r++) if (solid(tileAt(c, r))) { b.x = c * TS - b.w; b.vx = 0; hit = 1; break; }
    } else if (b.vx < 0) {
      const c = Math.floor(b.x / TS);
      for (let r = r0; r <= r1; r++) if (solid(tileAt(c, r))) { b.x = (c + 1) * TS; b.vx = 0; hit = -1; break; }
    }
    const prevBottom = b.y + b.h;
    b.y += b.vy * dt;
    b.onGround = false;
    const c0 = Math.floor(b.x / TS), c1 = Math.floor((b.x + b.w - 0.01) / TS);
    if (b.vy >= 0) {
      const r = Math.floor((b.y + b.h) / TS);
      for (let c = c0; c <= c1; c++) {
        const t = tileAt(c, r);
        if (solid(t) || (t === '-' && prevBottom <= r * TS + 0.5)) { b.y = r * TS - b.h; b.vy = 0; b.onGround = true; break; }
      }
    } else {
      const r = Math.floor(b.y / TS);
      for (let c = c0; c <= c1; c++) if (solid(tileAt(c, r))) { b.y = (r + 1) * TS; b.vy = 0; break; }
    }
    return hit;
  }

  // ---------- particles ----------
  function burst(x, y, cols, n, spd = 60, grav = 120, life = 0.7, size = 2) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = rand(spd * 0.3, spd);
      parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - spd * 0.3, g: grav, life: rand(life * 0.6, life), max: life, col: cols[i % cols.length], s: size });
    }
  }
  function heartBurst(x, y, cols, scale = 4) {
    for (let k = 0; k < 30; k++) {
      const a = (k / 30) * Math.PI * 2;
      const hx = 16 * Math.pow(Math.sin(a), 3);
      const hy = -(13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a));
      parts.push({ x, y, vx: hx * scale, vy: hy * scale, g: 25, drag: 1.8, life: 1.5, max: 1.5, col: cols[k % cols.length], s: 2 });
    }
  }
  const floater = (x, y, text, col = '#fff') => floaters.push({ x, y, text, col, life: 1 });

  // ---------- flow ----------
  function startLevel(i) {
    levelIdx = i;
    L = loadLevel(i);
    hearts = 3;
    const w = hero === 'donkey' ? 12 : 14;
    P = { power: 0, x: L.start.x, y: L.start.y, w, h: 16, vx: 0, vy: 0, face: 1, onGround: false, coyote: 0, jbuf: 0, inv: 0, cd: 0, actT: 0, standOn: null, anim: 0, glide: false };
    cam = clamp(P.x - 120, 0, L.worldW - VW);
    parts = []; fireballs = []; shots = []; floaters = []; bubble = null; bouquet = null;
    mode = 'intro'; modeT = 0;
    Sound.play(hero);
    if (hero === 'donkey') Sound.fx.heehaw(); else Sound.fx.roar();
  }

  function respawn() {
    P.x = L.respawn.x; P.y = L.respawn.y; P.vx = P.vy = 0; P.inv = 1.2; P.standOn = null;
    cam = clamp(P.x - 120, 0, L.worldW - VW);
  }

  // a waffle sugar rush makes Donkey untouchable (pits still count)
  const POWER_TIME = 6;
  const rushing = () => hero === 'donkey' && P && P.power > 0;

  function hurt(fell) {
    if (!fell && (P.inv > 0 || rushing())) return;
    hearts--; shake = 0.25;
    Sound.fx.hurt();
    burst(P.x + P.w / 2, P.y + 8, ['#ff4a6a', '#ffffff'], 10);
    if (hearts <= 0) { mode = 'gameover'; modeT = 0; return; }
    if (fell) respawn();
    else { P.inv = 1.4; P.vy = -260; P.vx = -P.face * 100; }
  }

  function killEnemy(e, dir) {
    e.dead = true; e.vy = -220; e.vx = dir * 70;
    burst(e.x + e.w / 2, e.y + e.h / 2, hero === 'donkey' ? ['#ffffff', '#d8f0c0'] : ['#ffb02a', '#ff5a1a', '#ffffff'], 8);
  }

  function startWedding() {
    mode = 'wedding'; modeT = 0; parts = []; floaters = [];
    W = { line: -1, kissed: false, fw: 0, shells: [], flash: 0, cheerT: 0, shouts: [] };
    Sound.play('wedding');
  }

  // ---------- update ----------
  function update(dt) {
    T += dt; modeT += dt;
    if (pressed.mute) toggleMute();
    if (shake > 0) shake -= dt;
    updateParticles(dt);

    if (mode === 'loading') return;
    if (mode === 'title') return updateTitle();
    if (mode === 'intro') { if (modeT > 2.6 || (modeT > 0.5 && anyGo())) { mode = 'play'; modeT = 0; } return; }
    if (mode === 'gameover') { if (modeT > 1 && anyGo()) startLevel(levelIdx); return; }
    if (mode === 'wedding') return updateWedding(dt);
    if (mode === 'play') {
      if (pressed.pause) paused = !paused;
      if (paused) return;
      updateMovers(dt);
      updatePlayer(dt, true);
      updateWorld(dt);
    }
    if (mode === 'give' || mode === 'reject') {
      updateMovers(dt);
      updatePlayer(dt, false);
      if (mode === 'give') updateGive(dt); else updateReject(dt);
    }
    updateCamera(dt);
  }

  function updateTitle() {
    if (pressed.left || pressed.right) {
      hero = other(hero); Sound.fx.select(); Sound.play(hero);
      if (hero === 'donkey') Sound.fx.heehaw(); else Sound.fx.roar();
    }
    let go = pressed.jump || pressed.start || pressed.action;
    if (tap) {
      if (tap.y > 196 && Math.abs(tap.x - 200) < 50) go = true;
      else {
        const pick = tap.x < 200 ? 'donkey' : 'dragon';
        if (pick === hero) go = true;
        else { hero = pick; Sound.fx.select(); Sound.play(hero); if (hero === 'donkey') Sound.fx.heehaw(); else Sound.fx.roar(); }
      }
    }
    if (go && modeT > 0.3) { totalFlowers = 0; totalTreats = 0; startLevel(0); }
  }

  function updateMovers(dt) {
    for (const m of L.movers) {
      const nx = m.cx - m.w / 2 + Math.sin(T * 1.1 + m.ph) * m.range;
      m.dx = nx - m.x; m.x = nx;
    }
  }

  function updatePlayer(dt, control) {
    const p = P;
    if (p.standOn) p.x += p.standOn.dx;
    const left = control && keys.left, right = control && keys.right;
    const rush = rushing(), acc = (p.onGround ? 1100 : 750) * (rush ? 1.4 : 1), max = rush ? 165 : 110;
    if (left && !right) { p.vx -= acc * dt; p.face = -1; }
    else if (right && !left) { p.vx += acc * dt; p.face = 1; }
    else { const f = (p.onGround ? 1000 : 250) * dt; p.vx = Math.abs(p.vx) <= f ? 0 : p.vx - Math.sign(p.vx) * f; }
    p.vx = clamp(p.vx, -max, max);

    p.coyote = p.onGround ? 0.09 : p.coyote - dt;
    p.jbuf = control && pressed.jump ? 0.12 : p.jbuf - dt;
    if (p.jbuf > 0 && p.coyote > 0) {
      p.vy = rush ? -470 : -JUMP; p.jbuf = 0; p.coyote = 0; p.standOn = null;
      Sound.fx.jump(hero);
      burst(p.x + p.w / 2, p.y + p.h, ['#ffffff', '#d8d0c0'], 4, 30, 0, 0.3);
    }
    const holding = control && keys.jump;
    if (!holding && p.vy < -150) p.vy = -150;
    p.vy = Math.min(p.vy + GRAV * dt, MAXFALL);
    p.glide = false;
    if (hero === 'dragon' && holding && p.vy > 55) { p.vy = 55; p.glide = true; }

    const prevBottom = p.y + p.h, vyB = p.vy;
    moveBody(p, dt);
    p.standOn = null;
    if (!p.onGround && vyB >= 0) {
      for (const m of L.movers) {
        if (p.x + p.w > m.x + 1 && p.x < m.x + m.w - 1 && prevBottom <= m.y + 1 && p.y + p.h >= m.y) {
          p.y = m.y - p.h; p.vy = 0; p.onGround = true; p.standOn = m; break;
        }
      }
    }
    p.x = clamp(p.x, 0, Math.min(L.worldW, L.goal.x - 16) - p.w); // stop in front of your love
    if (p.onGround && Math.abs(p.vx) > 10) p.anim += dt * Math.abs(p.vx) / 14; else if (p.onGround) p.anim = 0;
    if (p.inv > 0) p.inv -= dt;
    p.cd -= dt; p.actT -= dt;
    if (p.power > 0) {
      p.power -= dt;
      if (Math.random() < 0.7) parts.push({ x: p.x + rand(0, p.w), y: p.y + rand(2, p.h), vx: -p.vx * 0.2, vy: rand(-20, 5), g: 0, life: 0.4, max: 0.4,
        col: hero === 'donkey' ? ['#ffd34d', '#e8a848', '#ffffff'][(Math.random() * 3) | 0] : ['#ffb02a', '#ff5a1a', '#ffd84a'][(Math.random() * 3) | 0], s: 2 });
      if (p.power <= 0) Sound.fx.powerdown();
    }

    if (control && pressed.action && p.cd <= 0) {
      if (hero === 'donkey') {
        p.actT = 0.25; p.cd = 0.45; Sound.fx.kick();
        const hb = { x: p.x - 20, y: p.y - 2, w: p.w + 40, h: p.h + 2 };
        burst(p.x + p.w / 2 - p.face * 14, p.y + 12, ['#e8dcc0', '#ffffff'], 6, 50, 60, 0.35);
        for (const e of L.enemies) if (e.active && !e.dead && overlap(hb, e)) { killEnemy(e, Math.sign(e.x - p.x) || 1); Sound.fx.stomp(); }
      } else {
        const fury = p.power > 0;
        p.actT = 0.22; p.cd = fury ? 0.18 : 0.38; Sound.fx.fire();
        for (const vy of fury ? [-80, 0, 80] : [0])
          fireballs.push({ x: p.face > 0 ? p.x + p.w : p.x - 6, y: p.y + 4, w: 6, h: 6, vx: p.face * 230 + p.vx * 0.3, vy, life: 0.6 });
      }
    }

    if (p.y > VH + 16) { hurt(true); return; }
    // hazards
    const c0 = Math.floor(p.x / TS), c1 = Math.floor((p.x + p.w - 0.01) / TS);
    const r0 = Math.floor(p.y / TS), r1 = Math.floor((p.y + p.h - 0.01) / TS);
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
      if (tileAt(c, r) === '^' && p.y + p.h > r * TS + 7 && P.inv <= 0 && !rushing()) { hurt(false); p.vy = -320; return; }
    }
  }

  function updateWorld(dt) {
    const p = P;
    for (const e of L.enemies) {
      if (!e.active) { if (e.x < cam + VW + 24) e.active = true; else continue; }
      if (e.dead) { e.vy += GRAV * dt; e.x += e.vx * dt; e.y += e.vy * dt; continue; }
      e.t += dt;
      if (e.fly) {
        e.x = e.x0 + Math.sin(e.t * 1.3 + e.ph) * 30;
        e.y = e.y0 + Math.sin(e.t * 2 + e.ph) * 6;
        e.face = Math.cos(e.t * 1.3 + e.ph) >= 0 ? 1 : -1;
      } else {
        const dxp = p.x + p.w / 2 - (e.x + e.w / 2);
        e.vy = Math.min(e.vy + GRAV * dt, MAXFALL);
        if (e.hop) { // crouch, then leap toward you
          e.face = dxp > 0 ? 1 : -1;
          if (e.onGround) {
            e.vx = 0; e.hopT = (e.hopT === undefined ? rand(0.4, 1.4) : e.hopT) - dt;
            if (e.hopT <= 0 && Math.abs(dxp) < 260) { e.vy = -330; e.vx = e.face * 70 * e.lv; e.hopT = 1.3 / e.lv; Sound.fx.boing(); }
          }
        } else if (e.shoot) { // stand still and fire at you
          e.vx = 0; e.face = dxp > 0 ? 1 : -1;
          e.shootT = (e.shootT === undefined ? 1 : e.shootT) - dt; e.fireT = (e.fireT || 0) - dt;
          if (e.shootT <= 0 && Math.abs(dxp) < 230) {
            e.shootT = 2.2 / e.lv; e.fireT = 0.25; Sound.fx.shoot();
            shots.push({ x: e.face > 0 ? e.x + e.w : e.x - 6, y: e.y + (hero === 'donkey' ? 3 : 7), w: 6, h: 3, vx: e.face * 120 * e.lv, life: 3 });
          }
        } else if (e.charge) { // patrol; when facing you, snort and rush
          e.cd = (e.cd || 0) - dt;
          if (e.state === 'wind') { e.vx = 0; e.stT -= dt; if (e.stT <= 0) { e.state = 'run'; e.stT = 1.1; } }
          else if (e.state === 'run') { e.vx = e.dir * 175; e.stT -= dt; if (e.stT <= 0) { e.state = null; e.cd = 1.4; } }
          else {
            e.vx = e.dir * e.speed * 0.7;
            if (e.cd <= 0 && Math.abs(dxp) < 150 && Math.abs(p.y + p.h - e.y - e.h) < 24 && Math.sign(dxp) === e.dir) { e.state = 'wind'; e.stT = 0.45; Sound.fx.snort(); }
          }
        } else e.vx = e.dir * e.speed;
        const hit = moveBody(e, dt);
        if (hit) {
          e.dir = -hit;
          if (e.state === 'run') { e.state = null; e.cd = 1.4; shake = 0.15; Sound.fx.stomp(); }
        } else if (e.onGround && !e.hop && !e.shoot) {
          const fx = e.dir > 0 ? e.x + e.w + 1 : e.x - 1;
          const t = tileAt(Math.floor(fx / TS), Math.floor((e.y + e.h + 2) / TS));
          if (!solid(t) && t !== '-') { e.dir *= -1; if (e.state === 'run') { e.state = null; e.cd = 1.4; } }
        }
        if (!e.hop && !e.shoot) e.face = e.dir;
        if (e.y > VH + 30) { e.dead = true; continue; }
      }
      if (overlap(p, e)) {
        if (rushing()) { killEnemy(e, p.face); Sound.fx.stomp(); shake = 0.1; floater(e.x, e.y - 6, 'BONK!', '#ffd34d'); }
        else if (!e.spiky && p.vy > 0 && p.y + p.h - e.y < 10) {
          killEnemy(e, p.face); p.vy = keys.jump ? -380 : -260; Sound.fx.stomp();
        } else hurt(false);
      }
    }
    L.enemies = L.enemies.filter(e => !(e.dead && e.y > VH + 40));

    for (const f of fireballs) {
      f.x += f.vx * dt; f.y += (f.vy || 0) * dt; f.life -= dt;
      if (Math.random() < 0.6) parts.push({ x: f.x + 3, y: f.y + 3 + rand(-2, 2), vx: -f.vx * 0.1, vy: rand(-20, 0), g: -30, life: 0.3, max: 0.3, col: Math.random() < 0.5 ? '#ffb02a' : '#ff5a1a', s: 2 });
      if (solid(tileAt(Math.floor((f.x + 3) / TS), Math.floor((f.y + 3) / TS)))) f.life = 0;
      for (const e of L.enemies) if (e.active && !e.dead && overlap(f, e)) { killEnemy(e, Math.sign(f.vx)); Sound.fx.stomp(); f.life = 0; }
      if (f.life <= 0) burst(f.x + 3, f.y + 3, ['#ffd84a', '#ff5a1a'], 5, 40, 0, 0.3);
    }
    fireballs = fireballs.filter(f => f.life > 0);

    for (const s of shots) {
      s.x += s.vx * dt; s.life -= dt;
      if (solid(tileAt(Math.floor((s.x + 3) / TS), Math.floor((s.y + 1) / TS)))) s.life = 0;
      if (s.life > 0 && overlap(p, s)) { s.life = 0; if (!rushing()) hurt(false); }
      for (const f of fireballs) if (s.life > 0 && overlap(f, s)) { s.life = 0; f.life = 0; } // fire burns shots
    }
    shots = shots.filter(s => s.life > 0);

    const th = THEMES[hero];
    for (const f of L.flowers) if (!f.taken && overlap(p, f)) {
      f.taken = true; L.got++; Sound.fx.collect();
      burst(f.x + 5, f.y + 4, [...th.flowerCols, '#ffffff'], 8, 50, 40, 0.5);
      floater(f.x, f.y - 4, '+1');
    }
    for (const w of L.treats) if (!w.taken && overlap(p, w)) {
      w.taken = true; L.treatsGot++; Sound.fx.powerup();
      burst(w.x + 5, w.y + 5, ['#ffd34d', '#ffffff'], 14, 70, 40, 0.7);
      // waffle = sugar rush, gold = dragon fury (and both heal)
      p.power = POWER_TIME;
      if (hearts < 3) hearts++;
      floater(w.x - 30, w.y - 4, hero === 'donkey' ? 'SUGAR RUSH!' : 'DRAGON FURY!', '#ffd34d');
    }
    for (const c of L.checkpoints) if (!c.on && overlap(p, c)) {
      c.on = true; L.respawn = { x: c.x, y: c.y }; Sound.fx.checkpoint();
      floater(c.x - 20, c.y - 10, 'CHECKPOINT', '#ffffff');
      burst(c.x + 6, c.y, [th.flag, '#ffffff'], 12, 60, 60, 0.6);
    }

    if (bubble) { bubble.life -= dt; if (bubble.life <= 0) bubble = null; }
    updateSad(dt);
    if (L.rejectCd > 0) L.rejectCd -= dt;
    const g = L.goal, zone = { x: g.x - 20, y: g.y - 30, w: 40, h: 30 };
    if (overlap(p, zone) && !(L.rejectCd > 0)) {
      if (L.got >= L.need) { mode = 'give'; modeT = 0; bouquet = null; bubble = null; L.sad = false; }
      else { mode = 'reject'; modeT = 0; bubble = null; bouquet = { x0: p.x + p.w / 2, y0: p.y, t: 0, done: false, few: true }; }
    }
  }

  // too few flowers: the bouquet gets dropped, your love bursts into tears
  function updateReject(dt) {
    const g = L.goal, p = P;
    p.face = 1;
    if (bouquet && !bouquet.done) {
      bouquet.t += dt / 0.7;
      if (bouquet.t >= 1) { bouquet.done = true; bubble = { text: `ONLY ${L.got}?!`, life: 1.3 }; Sound.fx.nope(); }
    } else if (bouquet && modeT > 1.5) {
      // the bouquet falls to the ground and wilts
      bouquet.fall = (bouquet.fall || 0) + dt * 90;
    }
    if (modeT > 1.5 && !L.sad) {
      L.sad = true; Sound.fx.sob();
      bubble = { text: `*SOB* I WANTED ${L.need}!`, life: 2.2 };
    }
    if (bubble) bubble.life -= dt;
    updateSad(dt);
    if (modeT > 3.4) {
      mode = 'play'; modeT = 10; bouquet = null; L.rejectCd = 1.5;
      hurt(false);
      if (mode === 'play') { P.vx = -220; P.vy = -230; P.inv = 1.4; floater(g.x - 60, g.y - 50, `NEED ${L.need - L.got} MORE`, '#8ab8ff'); }
    }
  }

  function updateSad(dt) {
    if (!L.sad) return;
    const g = L.goal, ex = g.x - 7, ey = g.y - (other(hero) === 'donkey' ? 18 : 16);
    L.tearT = (L.tearT || 0) - dt;
    if (L.tearT <= 0) {
      L.tearT = mode === 'reject' ? 0.04 : 0.18;
      const side = Math.random() < 0.5 ? -1 : 1, big = mode === 'reject';
      parts.push({ x: ex + side * 2, y: ey, vx: side * rand(big ? 25 : 8, big ? 55 : 18), vy: rand(-60, -20), g: 300, life: 0.8, max: 0.8, col: Math.random() < 0.5 ? '#8ad8ff' : '#c8f0ff', s: 2 });
    }
  }

  function updateGive(dt) {
    const g = L.goal;
    P.face = g.x > P.x ? 1 : -1;
    if (!bouquet && modeT > 0.4) bouquet = { x0: P.x + P.w / 2, y0: P.y, t: 0, done: false };
    if (bouquet && !bouquet.done) {
      bouquet.t += dt / 0.9;
      if (bouquet.t >= 1) {
        bouquet.done = true; partnerHop = 1.2;
        Sound.fx.give();
        heartBurst(g.x, g.y - 30, ['#ff4a6a', '#ff8aa8', '#ffffff'], 3);
        bubble = { text: other(hero) === 'donkey' ? 'FOR ME?! AWW!' : '*HAPPY ROAR*', life: 3 };
      }
    }
    if (bubble) bubble.life -= dt;
    if (partnerHop > 0) partnerHop -= dt;
    if (modeT > 6) {
      totalFlowers += L.got; totalTreats += L.treatsGot;
      if (levelIdx < LEVELS.length - 1) startLevel(levelIdx + 1);
      else startWedding();
    }
  }

  function updateCamera(dt) {
    const target = P.x + P.w / 2 - VW / 2 + P.face * 24;
    cam += (target - cam) * Math.min(1, dt * 5);
    cam = clamp(cam, 0, L.worldW - VW);
  }

  function updateParticles(dt) {
    for (const q of parts) {
      if (q.drag) { q.vx -= q.vx * q.drag * dt; q.vy -= q.vy * q.drag * dt; }
      q.vy += q.g * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.life -= dt;
    }
    parts = parts.filter(q => q.life > 0);
    for (const f of floaters) { f.y -= 20 * dt; f.life -= dt; }
    floaters = floaters.filter(f => f.life > 0);
  }

  // wedding timeline (seconds)
  const WED = { kiss: 11.4, banner: 12.2, stats: 13.4, done: 15 };
  const GUESTS = [
    { k: 'beetle', x: 14, row: 0 }, { k: 'hedgehog', x: 40, row: 0 }, { k: 'knight', x: 70, row: 0 }, { k: 'bee', x: 100, row: 0 },
    { k: 'bat', x: 26, row: 1 }, { k: 'pikeman', x: 56, row: 1 }, { k: 'frog', x: 88, row: 1 },
    { k: 'bee', x: 290, row: 0 }, { k: 'knight', x: 318, row: 0 }, { k: 'hedgehog', x: 346, row: 0 }, { k: 'boar', x: 368, row: 0 },
    { k: 'hedgehog', x: 300, row: 1 }, { k: 'bat', x: 330, row: 1 }, { k: 'pikeman', x: 360, row: 1 },
  ];
  function wedLines() {
    const first = hero, second = other(hero);
    const vow = { donkey: 'HECK YEAH, I DO!', dragon: '*ROOOAR* I DO!' };
    return [
      { from: 3.6, to: 5.4, who: 'ogre', text: 'DEARLY BELOVED...' },
      { from: 5.4, to: 7.2, who: 'ogre', text: 'DO YOU TAKE EACH OTHER?' },
      { from: 7.2, to: 8.6, who: first, text: vow[first] },
      { from: 8.6, to: 10, who: second, text: vow[second] },
      { from: 10, to: WED.kiss, who: 'ogre', text: 'YOU MAY NOW KISS!' },
    ];
  }

  function updateWedding(dt) {
    // jump skips straight to the kiss
    if (modeT > 0.5 && modeT < WED.kiss - 0.6 && anyGo()) modeT = WED.kiss - 0.6;
    const t = modeT;
    const lines = wedLines(), li = lines.findIndex(l => t >= l.from && t < l.to);
    if (li !== W.line) {
      W.line = li;
      if (li >= 0) {
        const w = lines[li].who;
        if (w === 'ogre') Sound.fx.talk(); else if (w === 'donkey') Sound.fx.heehaw(); else Sound.fx.roar();
      }
    }
    if (t > WED.kiss && !W.kissed) {
      W.kissed = true; W.flash = 1;
      Sound.fx.bells(); Sound.fx.cheer();
      heartBurst(200, 145, ['#ff4a6a', '#ff8aa8', '#ffffff'], 5);
      for (const gu of GUESTS) burst(gu.x + 6, 160 + gu.row * 10, ['#ff7aa8', '#ffd34d', '#ffffff', '#8ab8ff'], 6, 90, 120, 1.2);
    }
    if (W.flash > 0) W.flash -= dt * 2;
    if (W.kissed) { // the crowd keeps cheering
      W.cheerT -= dt;
      if (W.cheerT <= 0) { W.cheerT = 3.2; if (t > WED.kiss + 1) Sound.fx.cheer(0.6); }
      if (Math.random() < dt * 2.5) {
        const gi = (Math.random() * GUESTS.length) | 0;
        W.shouts.push({ gi, text: ['YAY!', 'WOO!', 'HOORAY!', '<3', 'BRAVO!'][(Math.random() * 5) | 0], life: 1.2 });
      }
    }
    for (const s of W.shouts) s.life -= dt;
    W.shouts = W.shouts.filter(s => s.life > 0);
    if (t > WED.kiss) for (let i = 0; i < 2; i++) {
      parts.push({ x: rand(0, VW), y: -4, vx: rand(-15, 15), vy: rand(25, 55), g: 8, life: 5, max: 5,
        col: ['#ff7aa8', '#ffd34d', '#8ab8ff', '#ffffff', '#c78aff', '#7dff8a'][(Math.random() * 6) | 0], s: 2 });
    }
    if (Math.random() < 0.15) parts.push({ x: rand(0, VW), y: -4, vx: rand(5, 20), vy: rand(15, 30), g: 0, life: 9, max: 9, col: '#ffb8d0', s: 2 });
    if (t > WED.kiss + 0.8) {
      W.fw -= dt;
      if (W.fw <= 0) {
        W.fw = 0.9; W.breath = 0.35;
        Sound.fx.whistle();
        W.shells.push({ x: W.rx - 20, y: 152, tx: rand(40, 360), ty: rand(50, 100), t: 0 });
      }
    }
    if (W.breath > 0) W.breath -= dt;
    for (const s of W.shells) {
      s.t += dt / 0.7;
      const k = Math.min(1, s.t);
      const nx = s.x + (s.tx - s.x) * k, ny = s.y + (s.ty - s.y) * (1 - (1 - k) * (1 - k));
      parts.push({ x: nx, y: ny, vx: 0, vy: 10, g: 0, life: 0.3, max: 0.3, col: '#ffb02a', s: 2 });
      if (s.t >= 1 && !s.done) {
        s.done = true; Sound.fx.firework();
        heartBurst(s.tx, s.ty, [['#ff4a6a', '#ff8aa8'], ['#ffd34d', '#ffffff'], ['#8ab8ff', '#c78aff'], ['#7dff8a', '#ffffff']][(Math.random() * 4) | 0], 2.4);
      }
    }
    W.shells = W.shells.filter(s => !s.done);
    if (t > WED.done && anyGo()) { mode = 'title'; modeT = 0; Sound.play(hero); }
  }

  // ---------- drawing helpers ----------
  function txt(s, x, y, col = '#fff', size = 8, align = 'left', sh = OUT) {
    ctx.font = `${size}px ${FONT}`; ctx.textAlign = align; ctx.textBaseline = 'top';
    if (sh) { ctx.fillStyle = sh; ctx.fillText(s, x + 1, y + 1); }
    ctx.fillStyle = col; ctx.fillText(s, x, y);
  }
  function speech(x, y, s) {
    ctx.font = `8px ${FONT}`;
    const w = Math.ceil(ctx.measureText(s).width) + 10, h = 16;
    let bx = Math.round(clamp(x - w / 2, 4, VW - w - 4)), by = Math.round(y - h - 6);
    ctx.fillStyle = OUT; ctx.fillRect(bx - 1, by - 1, w + 2, h + 2); ctx.fillRect(x - 3, by + h, 7, 4);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(bx, by, w, h); ctx.fillRect(x - 2, by + h, 5, 3); ctx.fillRect(x - 1, by + h + 3, 3, 1);
    txt(s, bx + 5, by + 4, OUT, 8, 'left', null);
  }
  function bands(cols, y0, y1) {
    const h = (y1 - y0) / cols.length;
    cols.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(0, Math.floor(y0 + i * h), VW, Math.ceil(h) + 1); });
  }
  function hills(par, base, amp, col, seed, cx) {
    ctx.fillStyle = col;
    for (let sx = 0; sx < VW; sx += 2) {
      const wx = sx + cx * par;
      const h = Math.round(base - (Math.sin(wx * 0.012 + seed) * amp + Math.sin(wx * 0.031 + seed * 2) * amp * 0.4));
      ctx.fillRect(sx, h, 2, VH - h);
    }
    return wx => Math.round(base - (Math.sin(wx * 0.012 + seed) * amp + Math.sin(wx * 0.031 + seed * 2) * amp * 0.4));
  }

  // every 20s a big ogre sneaks a peek from the top of the screen, then ducks away
  function drawPeekingOgre_(cx) {
    const cyc = Math.floor((T + 16) / 20), t = (T + 16) % 20;
    if (t > 7) return;
    const k = t < 0.9 ? 1 - Math.pow(1 - t / 0.9, 3) : t > 6.1 ? Math.pow(1 - (t - 6.1) / 0.9, 2) : 1;
    const x = 120 + hash(cyc) * (VW - 280), y = -108 + k * 78; // top of the head stays off-screen
    const look = t < 2.4 ? -1 : t < 3.9 ? 1 : 0;
    const blink = (t > 2.3 && t < 2.45) || (t > 4.2 && t < 4.35);
    const grin = t > 4.6 ? Math.min(1, (t - 4.6) * 2) : 0;
    drawPeekingOgre(ctx, x - cx * 0.02, y, look, blink, grin);
  }

  function drawBG(theme, cx) {
    if (theme === 'donkey') {
      bands(['#8fd3e0', '#a3dce0', '#b9e4d9', '#d2ecd0', '#ecefc4', '#f8e8b8'], 0, 170);
      pcircle(ctx, 310, 48, 22, '#fdf0b8'); pcircle(ctx, 310, 48, 17, '#fff8d8');
      for (let i = 0; i < 6; i++) { // clouds
        const span = VW + 160, x = ((i * 97 + T * 5 - cx * 0.1) % span + span) % span - 80, y = 22 + (i * 37) % 60;
        pcircle(ctx, x, y + 3, 9, '#e2f2f2'); pcircle(ctx, x + 12, y, 12, '#ffffff'); pcircle(ctx, x + 26, y + 3, 9, '#ffffff'); ctx.fillStyle = '#e2f2f2'; ctx.fillRect(x - 6, y + 9, 40, 3);
      }
      drawPeekingOgre_(cx);
      hills(0.15, 150, 16, '#a8d494', 1, cx);
      const near = hills(0.35, 172, 12, '#74b26c', 4, cx);
      const sp = 70, off = cx * 0.35;
      for (let wx = Math.floor(off / sp) * sp - sp; wx < off + VW + sp; wx += sp) {
        if (hash(wx) < 0.35) continue;
        const sx = Math.round(wx - off + hash(wx + 1) * 30), gy = near(wx + hash(wx + 1) * 30), r = 7 + Math.round(hash(wx + 2) * 6);
        ctx.fillStyle = '#6b4a2a'; ctx.fillRect(sx - 1, gy - r, 3, r + 2);
        pcircle(ctx, sx, gy - r - 4, r, '#4f9a5a'); pcircle(ctx, sx - 2, gy - r - 6, r - 3, '#62b06a');
      }
      if (butterflies.length === 0) for (let i = 0; i < 5; i++) butterflies.push({ x: rand(0, VW), y: rand(60, 160), sp: rand(4, 8), ph: rand(0, 6), col: ['#ff7aa8', '#ffd34d', '#ffffff'][i % 3] });
      for (const b of butterflies) {
        // position comes from the clock, so speed is the same on 60Hz and 120Hz screens
        const span = VW + 20, x = Math.round(((b.x + T * b.sp + Math.sin(T * 0.4 + b.ph) * 8) % span + span) % span - 10);
        const y = Math.round(b.y + Math.sin(T * 0.7 + b.ph) * 8), f = Math.floor(T * 2.5 + b.ph) % 2;
        ctx.fillStyle = b.col; ctx.fillRect(x - 2, y - (f ? 1 : 0), 2, f ? 2 : 1); ctx.fillRect(x + 1, y - (f ? 1 : 0), 2, f ? 2 : 1);
        ctx.fillStyle = OUT; ctx.fillRect(x, y, 1, 2);
      }
    } else {
      bands(['#1a0610', '#2a0814', '#45101c', '#6a1820', '#94261c', '#c4401a'], 0, 175);
      pcircle(ctx, 90, 62, 26, '#a8381a'); pcircle(ctx, 90, 62, 20, '#ff8a3a');
      drawPeekingOgre_(cx);
      // volcanoes
      const vsp = 260, voff = cx * 0.1;
      for (let wx = Math.floor(voff / vsp) * vsp - vsp; wx < voff + VW + vsp; wx += vsp) {
        const sx = wx - voff + 40, peak = 95 + Math.round(hash(wx) * 20);
        for (let y = peak; y < VH; y += 2) {
          const hw = (y - peak) * 1.3 + 8;
          ctx.fillStyle = '#2e0c14'; ctx.fillRect(Math.round(sx - hw), y, Math.round(hw * 2), 2);
        }
        ctx.fillStyle = '#ff6a1a'; ctx.fillRect(sx - 7, peak, 14, 2);
        ctx.fillStyle = '#c43a1a'; ctx.fillRect(sx - 2, peak + 2, 2, 10); ctx.fillRect(sx + 3, peak + 2, 2, 6);
      }
      // castles
      const csp = 300, coff = cx * 0.3;
      for (let wx = Math.floor(coff / csp) * csp - csp; wx < coff + VW + csp; wx += csp) {
        const sx = Math.round(wx - coff + hash(wx) * 80), base = 175;
        ctx.fillStyle = '#1c060c';
        ctx.fillRect(sx, base - 40, 70, 60);
        ctx.fillRect(sx - 12, base - 66, 20, 86); ctx.fillRect(sx + 62, base - 58, 20, 78); ctx.fillRect(sx + 28, base - 80, 16, 40);
        for (let k = 0; k < 4; k++) { ctx.fillRect(sx - 12 + k * 6, base - 70, 3, 4); ctx.fillRect(sx + 62 + k * 6, base - 62, 3, 4); }
        ctx.fillRect(sx + 26, base - 86, 20, 6); ctx.fillRect(sx + 35, base - 96, 2, 10);
        const fl = Math.sin(T * 6 + wx) > 0 ? '#ffb040' : '#ff8a2a';
        ctx.fillStyle = fl; ctx.fillRect(sx - 5, base - 54, 4, 6); ctx.fillRect(sx + 69, base - 46, 4, 6); ctx.fillRect(sx + 34, base - 70, 4, 6); ctx.fillRect(sx + 14, base - 26, 4, 6); ctx.fillRect(sx + 46, base - 26, 4, 6);
      }
      hills(0.45, 182, 8, '#2a0a10', 2, cx);
      if (embers.length === 0) for (let i = 0; i < 40; i++) embers.push({ x: rand(0, VW), y: rand(0, VH), sp: rand(10, 30), ph: rand(0, 6) });
      for (const e of embers) {
        const ey = ((e.y - T * e.sp) % (VH + 8) + VH + 8) % (VH + 8) - 4;
        ctx.fillStyle = Math.sin(T * 5 + e.ph) > 0 ? '#ffb02a' : '#ff5a1a';
        ctx.fillRect(Math.round(e.x + Math.sin(T + e.ph) * 6), Math.round(ey), 1 + (e.ph > 4 ? 1 : 0), 1 + (e.ph > 4 ? 1 : 0));
      }
    }
  }

  function drawTiles(cx) {
    const tl = tiles[hero], th = THEMES[hero];
    const c0 = Math.floor(cx / TS), c1 = c0 + Math.ceil(VW / TS) + 1;
    // liquid at the bottom of pits
    for (let c = c0; c <= c1; c++) {
      if (c < 0 || c >= L.cols) continue;
      if (tileAt(c, 13) === ' ' && tileAt(c, 12) === ' ') {
        const x = c * TS - cx;
        ctx.fillStyle = th.liquid[0]; ctx.fillRect(x, 202, 16, VH - 202);
        ctx.fillStyle = th.liquid[1];
        for (let i = 0; i < 16; i += 2) ctx.fillRect(x + i, 200 + Math.round(Math.sin((c * 16 + i) * 0.3 + T * 3) * 1.5), 2, 2);
      }
    }
    const hf = Math.floor(T * 4) % 2;
    for (let r = 0; r < ROWS; r++) for (let c = c0; c <= c1; c++) {
      const t = tileAt(c, r);
      if (t === ' ' || c < 0 || c >= L.cols) continue;
      const x = c * TS - cx, y = r * TS;
      if (t === '#') ctx.drawImage(solid(tileAt(c, r - 1)) || tileAt(c, r - 1) === '^' ? tl.fill : tl.top, x, y);
      else if (t === '=') ctx.drawImage(tl.brick, x, y);
      else if (t === '-') ctx.drawImage(tl.oneway, x, y);
      else if (t === '^') ctx.drawImage(tl.haz[hf], x, y);
    }
  }

  function heroState(p, kind) {
    const walk = p.onGround && Math.abs(p.vx) > 10 ? Math.floor(p.anim) % 4 : 0;
    return { walk, air: !p.onGround, act: p.actT > 0, glide: p.glide, flap: Math.floor(T * (p.glide ? 12 : 6)) % 2 === 0, blink: T % 3.3 < 0.12 };
  }

  function drawFlower(f, x, y) {
    const th = THEMES[hero], col = th.flowerCols[f.k % th.flowerCols.length];
    const bob = Math.round(Math.sin(T * 3 + f.k) * 1.5);
    drawParts(ctx, [
      [4, 7, 2, 5, '#3e8a44'], [6, 9, 2, 2, '#5cb85c'],
      [3, 0, 4, 2, col], [1, 2, 8, 4, col], [3, 6, 4, 2, col], [4, 3, 2, 2, th.flowerMid, 1],
    ], x, y + bob, 10, false);
    if (Math.sin(T * 2 + f.k * 1.7) > 0.96) { ctx.fillStyle = '#ffffff'; ctx.fillRect(x + 8, y + bob - 1, 1, 1); }
  }
  function drawTreat(w, x, y) {
    const bob = Math.round(Math.sin(T * 4 + w.k) * 1.5);
    if (hero === 'donkey') {
      drawParts(ctx, [[0, 0, 10, 10, '#e8a848'], [3, 0, 1, 10, '#b8782a', 1], [6, 0, 1, 10, '#b8782a', 1], [0, 3, 10, 1, '#b8782a', 1], [0, 6, 10, 1, '#b8782a', 1], [3, 3, 4, 3, '#fff0a0', 1]], x, y + bob, 10, false);
    } else {
      const sq = Math.abs(Math.cos(T * 3 + w.k)) > 0.4 ? 0 : 2;
      drawParts(ctx, [[2 + sq, 0, 6 - sq * 2, 10, '#ffd34d'], [0 + sq, 2, 10 - sq * 2, 6, '#ffd34d'], [4, 2, 1, 6, '#fff6c0', 1], [6 - sq, 3, 1, 4, '#c8962a', 1]], x, y + bob, 10, false);
    }
  }

  function drawEnemy(e, x, y) {
    const E = ENEMY[e.kind];
    let f = Math.floor(e.t * (E.fly ? 8 : e.state === 'run' ? 14 : 6)) % 2;
    if (E.hop) f = e.onGround ? 0 : 1;
    if (E.shoot) f = e.fireT > 0 ? 1 : 0;
    if (e.state === 'wind') x += Math.floor(e.t * 30) % 2; // shaking with rage before the charge
    const pr = E.parts(f, !!e.state);
    if (e.dead) {
      ctx.save(); ctx.translate(Math.round(x), Math.round(y + e.h)); ctx.scale(1, -1);
      drawParts(ctx, pr, 0, 0, E.w, e.face < 0); ctx.restore();
    } else drawParts(ctx, pr, Math.round(x), Math.round(y), E.w, e.face < 0);
  }

  function drawWorld() {
    const cx = Math.round(cam) + (shake > 0 ? Math.round(rand(-2, 2)) : 0);
    drawBG(hero, cx);
    drawTiles(cx);
    const th = THEMES[hero], vis = (x, w = 16) => x + w > cx - 8 && x < cx + VW + 8;

    for (const c of L.checkpoints) if (vis(c.x)) {
      const x = c.x - cx;
      ctx.fillStyle = OUT; ctx.fillRect(x, c.y - 1, 4, 18); ctx.fillStyle = '#e8dcc0'; ctx.fillRect(x + 1, c.y, 2, 16);
      if (c.on) { const wv = Math.floor(T * 6) % 2; ctx.fillStyle = OUT; ctx.fillRect(x + 3, c.y, 11, 8); ctx.fillStyle = th.flag; ctx.fillRect(x + 3, c.y + 1, 10 - wv, 6); }
      else { ctx.fillStyle = OUT; ctx.fillRect(x + 3, c.y + 9, 9, 7); ctx.fillStyle = '#7a7480'; ctx.fillRect(x + 3, c.y + 10, 8, 5); }
    }
    for (const m of L.movers) if (vis(m.x, m.w)) {
      const x = Math.round(m.x - cx);
      ctx.fillStyle = OUT; ctx.fillRect(x - 1, m.y - 1, m.w + 2, m.h + 2);
      if (hero === 'donkey') {
        ctx.fillStyle = '#b07a44'; ctx.fillRect(x, m.y, m.w, m.h); ctx.fillStyle = '#d09a5c'; ctx.fillRect(x, m.y, m.w, 2);
        ctx.fillStyle = '#8a5a30'; for (let i = 6; i < m.w; i += 12) ctx.fillRect(x + i, m.y + 2, 1, 6);
        ctx.fillStyle = '#5cb85c'; ctx.fillRect(x + 4, m.y - 2, 4, 2);
      } else {
        ctx.fillStyle = '#4a4a58'; ctx.fillRect(x, m.y, m.w, m.h); ctx.fillStyle = '#7a7a88'; ctx.fillRect(x, m.y, m.w, 2);
        ctx.fillStyle = Math.sin(T * 8) > 0 ? '#ff8a2a' : '#ffb02a'; ctx.fillRect(x + 4, m.y + m.h + 1, m.w - 8, 2);
      }
    }
    if (vis(L.goal.x - 70, 30)) drawGoalSign(L.goal.x - 62 - cx, L.goal.y);
    for (const f of L.flowers) if (!f.taken && vis(f.x)) drawFlower(f, f.x - cx, f.y);
    for (const w of L.treats) if (!w.taken && vis(w.x)) drawTreat(w, w.x - cx, w.y);

    // your love waits at the goal
    const g = L.goal, pk = other(hero);
    if (vis(g.x - 20, 40)) {
      const hop = partnerHop > 0 ? Math.round(Math.abs(Math.sin(partnerHop * 10)) * 6) : 0;
      const sob = L.sad ? Math.round(Math.abs(Math.sin(T * (mode === 'reject' ? 14 : 6))) * 1.5) : 0;
      drawHero(ctx, pk, g.x - cx, g.y - hop + sob, -1, { walk: 0, blink: L.sad || (T + 1.3) % 3.7 < 0.12 });
      if (L.sad) { // broken heart
        const hx = g.x - cx - 3, hy = g.y - 36;
        heart(ctx, hx, hy, '#6a4a78');
        ctx.fillStyle = OUT; ctx.fillRect(hx + 3, hy, 1, 2); ctx.fillRect(hx + 2, hy + 2, 1, 2); ctx.fillRect(hx + 3, hy + 4, 1, 2);
      } else heart(ctx, g.x - cx - 3, g.y - 36 + Math.round(Math.sin(T * 3) * 2), '#ff4a6a');
    }

    for (const e of L.enemies) if (e.active || vis(e.x)) drawEnemy(e, e.x - cx, e.y);
    for (const f of fireballs) { const x = f.x - cx + 3, y = f.y + 3; pcircle(ctx, x, y, 4, '#ff5a1a'); pcircle(ctx, x, y, 2, Math.floor(T * 20) % 2 ? '#ffd84a' : '#fff2a0'); }

    for (const s of shots) {
      const x = Math.round(s.x - cx), y = Math.round(s.y);
      if (hero === 'donkey') { ctx.fillStyle = OUT; ctx.fillRect(x - 1, y - 1, 6, 5); ctx.fillStyle = '#8a5a30'; ctx.fillRect(x, y, 4, 3); ctx.fillStyle = '#c8f0a0'; ctx.fillRect(x + (s.vx > 0 ? 3 : 0), y, 1, 1); }
      else { ctx.fillStyle = '#8a5a3a'; ctx.fillRect(x, y + 1, 6, 1); ctx.fillStyle = '#e6ecf4'; ctx.fillRect(s.vx > 0 ? x + 6 : x - 2, y, 2, 3); ctx.fillStyle = '#e0405a'; ctx.fillRect(s.vx > 0 ? x - 1 : x + 6, y, 1, 3); }
    }
    if (P.power > 0 && (P.power > 1.5 || Math.floor(T * 10) % 2)) {
      ctx.globalAlpha = 0.3 + 0.1 * Math.sin(T * 12);
      pcircle(ctx, P.x + P.w / 2 - cx, P.y + P.h / 2, 16, hero === 'donkey' ? '#ffd34d' : '#ff7a1a');
      ctx.globalAlpha = 1;
    }
    if (!(P.inv > 0 && Math.floor(T * 20) % 2)) drawHero(ctx, hero, P.x + P.w / 2 - cx, P.y + P.h, P.face, heroState(P, hero));

    for (const q of parts) { ctx.globalAlpha = clamp(q.life / q.max * 1.5, 0, 1); ctx.fillStyle = q.col; ctx.fillRect(Math.round(q.x - cx), Math.round(q.y), q.s, q.s); }
    ctx.globalAlpha = 1;

    if (bouquet) {
      const k = Math.min(1, bouquet.t), x = bouquet.x0 + (g.x - 10 - bouquet.x0) * k - cx;
      const y = Math.min(g.y - 8, bouquet.y0 + (g.y - 24 - bouquet.y0) * k - Math.sin(Math.PI * k) * 30 + (bouquet.fall || 0));
      if (!bouquet.done || bouquet.few) drawBouquet(x, y, bouquet.few);
    }
    if (bubble && bubble.life > 0) speech(g.x - cx, g.y - 40, bubble.text);
    for (const f of floaters) {
      ctx.globalAlpha = clamp(f.life * 2, 0, 1);
      ctx.font = `8px ${FONT}`;
      txt(f.text, Math.round(clamp(f.x - cx, 2, VW - ctx.measureText(f.text).width - 3)), Math.round(f.y), f.col);
    }
    ctx.globalAlpha = 1;
    drawHUD();
  }

  function drawGoalSign(x, y) {
    const ok = L.got >= L.need, label = String(L.need);
    ctx.font = `8px ${FONT}`;
    const bw = 18 + Math.ceil(ctx.measureText(label).width) + 4; // flower icon + number + padding
    x = Math.round(x);
    const bx = x + 13 - Math.round(bw / 2);
    ctx.fillStyle = OUT; ctx.fillRect(x + 11, y - 18, 4, 18); ctx.fillStyle = '#8a5a30'; ctx.fillRect(x + 12, y - 18, 2, 18);
    ctx.fillStyle = OUT; ctx.fillRect(bx - 1, y - 33, bw + 2, 17);
    ctx.fillStyle = ok ? '#5cb85c' : '#e8d8b0'; ctx.fillRect(bx, y - 32, bw, 15);
    drawParts(ctx, [[3, 0, 4, 2, '#ff7aa8'], [1, 2, 8, 4, '#ff7aa8'], [3, 6, 4, 2, '#ff7aa8'], [4, 3, 2, 2, '#ffd34d', 1]], bx + 3, y - 29, 10, false);
    txt(label, bx + 16, y - 28, ok ? '#ffffff' : OUT, 8, 'left', null);
  }

  function drawBouquet(x, y, few) {
    if (few) { // a sad, small bunch
      x = Math.round(x); y = Math.round(y);
      ctx.fillStyle = '#3e8a44'; ctx.fillRect(x - 1, y, 2, 7);
      pcircle(ctx, x, y - 2, 2, THEMES[hero].flowerCols[0]);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 2, y + 4, 5, 2);
      return;
    }
    const cols = THEMES[hero].flowerCols;
    x = Math.round(x); y = Math.round(y);
    ctx.fillStyle = '#3e8a44'; ctx.fillRect(x - 1, y, 3, 8);
    pcircle(ctx, x - 4, y - 2, 3, cols[0]); pcircle(ctx, x + 4, y - 2, 3, cols[1 % cols.length]); pcircle(ctx, x, y - 5, 3, cols[2 % cols.length]);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 3, y + 4, 7, 3);
  }

  function drawHUD() {
    for (let i = 0; i < 3; i++) heart(ctx, 6 + i * 11, 6, i < hearts ? '#ff4a6a' : '#4a3048');
    drawParts(ctx, [[3, 0, 4, 2, '#ff7aa8'], [1, 2, 8, 4, '#ff7aa8'], [3, 6, 4, 2, '#ff7aa8'], [4, 3, 2, 2, '#ffd34d', 1]], 6, 17, 10, false);
    txt(`${L.got}/${L.need}`, 20, 18, L.got >= L.need ? '#7dff8a' : '#ffffff');
    if (P.power > 0) {
      const lbl = hero === 'donkey' ? 'SUGAR RUSH' : 'FURY';
      txt(lbl, 6, 30, '#ffd34d');
      ctx.fillStyle = OUT; ctx.fillRect(6, 40, 52, 5);
      ctx.fillStyle = '#5a4030'; ctx.fillRect(7, 41, 50, 3);
      ctx.fillStyle = P.power > 1.5 || Math.floor(T * 10) % 2 ? '#ffd34d' : '#ffffff'; ctx.fillRect(7, 41, Math.round(50 * P.power / POWER_TIME), 3);
    }
    txt(`LV${levelIdx + 1}`, 42, 6, '#ffffff');
    if (mode === 'play' && modeT < 5) {
      const h = hero === 'donkey' ? 'X / B: BUCK KICK!  STOMP BUGS' : 'X / B: FIRE!  HOLD JUMP: GLIDE';
      txt(h, VW / 2, VH - 14, '#ffffff', 8, 'center');
    }
    if (L.got >= L.need && mode === 'play') txt(`GO TO ${NAME[other(hero)]}! >>`, VW - 6, 18, '#7dff8a', 8, 'right');
    if (paused) { shade(0.5); txt('PAUSED', VW / 2, 100, '#ffffff', 16, 'center'); }
  }

  function shade(a, col = '#0b0614') { ctx.globalAlpha = a; ctx.fillStyle = col; ctx.fillRect(0, 0, VW, VH); ctx.globalAlpha = 1; }

  let heroBuf = null;
  const PATH = { donkey: { x: 112, col: '#a6e49a', dark: '#2e5a34' }, dragon: { x: 288, col: '#ffb02a', dark: '#6a1e1e' } };

  function drawTitle() {
    drawBG(hero, T * 20);
    const tl = tiles[hero];
    for (let x = 0; x < VW; x += 16) { ctx.drawImage(tl.top, x, 192); ctx.drawImage(tl.fill, x, 208); }
    shade(0.22);
    const bob = Math.round(Math.sin(T * 2) * 2);
    txt("SHREK'S QUEST", VW / 2 + 2, 12 + bob + 2, OUT, 24, 'center', null);
    txt("SHREK'S QUEST", VW / 2, 12 + bob, PATH[hero].col, 24, 'center', null);
    txt('A LOVE STORY IN 3 LEVELS', VW / 2, 42, '#ffffff', 8, 'center');
    txt('< > CHOOSE YOUR PATH', VW / 2, 54, '#ffe08a', 8, 'center');
    if (!Sound.running()) { // gentle glow in the corner until sound is on
      ctx.globalAlpha = 0.65 + 0.35 * Math.sin(T * 2.5);
      txt('♪ TAP FOR SOUND', 8, 210, '#ffe08a');
      ctx.globalAlpha = 1;
    }
    drawPathHero(other(hero));
    drawPathHero(hero);
    ctx.fillStyle = OUT; ctx.fillRect(150, 199, 100, 20);
    ctx.fillStyle = PATH[hero].dark; ctx.fillRect(151, 200, 98, 18);
    ctx.fillStyle = PATH[hero].col; ctx.fillRect(151, 200, 98, 2);
    txt('START', VW / 2, 205, '#ffffff', 8, 'center');
  }

  function drawPathHero(k) {
    const c = PATH[k], sel = k === hero, cx = c.x, feet = 192;
    if (sel) {
      // spotlight beaming down onto the chosen hero
      ctx.fillStyle = 'rgba(255,250,220,0.13)';
      for (let y = 66; y < feet; y += 2) {
        const hw = Math.round(12 + (y - 66) * 0.24);
        ctx.fillRect(cx - hw, y, hw * 2, 2);
      }
      ctx.globalAlpha = 0.25 + 0.08 * Math.sin(T * 4);
      ctx.fillStyle = '#fffbe0';
      for (let i = 0; i < 4; i++) ctx.fillRect(cx - 30 + i * 4, feet - 2 + (i > 1 ? 1 : 0) - i, 60 - i * 8, 3);
      ctx.globalAlpha = 1;
      // big bouncing arrow
      const ab = Math.round(Math.abs(Math.sin(T * 5)) * 4);
      ctx.fillStyle = OUT; for (let i = 0; i < 8; i++) ctx.fillRect(cx - 8 + i, 64 + i + ab, 17 - i * 2, 1);
      ctx.fillStyle = '#ffffff'; for (let i = 0; i < 7; i++) ctx.fillRect(cx - 7 + i, 64 + i + ab, 15 - i * 2, 1);
    }
    txt('PATH OF THE', cx, 78, sel ? '#ffffff' : 'rgba(255,255,255,.45)', 8, 'center', sel ? OUT : null);
    txt(NAME[k], cx, 90, sel ? c.col : 'rgba(255,255,255,.4)', 16, 'center', sel ? OUT : null);
    const st = { walk: sel ? Math.floor(T * 6) % 4 : 0, blink: sel ? T % 3 < 0.12 : (T + 1) % 3 < 0.12 }, face = k === 'donkey' ? 1 : -1;
    if (sel) {
      const hop = Math.round(Math.abs(Math.sin(T * 4)) * 3);
      ctx.save(); ctx.translate(cx, feet - hop); ctx.scale(2, 2);
      drawHero(ctx, k, 0, 0, face, st);
      ctx.restore();
    } else {
      // draw at 1x offscreen, then enlarge 1.5x with crisp (nearest-neighbour) pixels
      if (!heroBuf) { heroBuf = document.createElement('canvas'); heroBuf.width = 40; heroBuf.height = 32; }
      const b = heroBuf.getContext('2d');
      b.clearRect(0, 0, 40, 32);
      drawHero(b, k, 20, 30, face, st);
      ctx.globalAlpha = 0.45; ctx.imageSmoothingEnabled = false;
      ctx.drawImage(heroBuf, Math.round(cx - 30), Math.round(feet - 45), 60, 48);
      ctx.globalAlpha = 1;
    }
  }

  function drawIntro() {
    drawWorld();
    shade(0.6);
    const name = LEVEL_NAMES[hero][levelIdx];
    txt(`LEVEL ${levelIdx + 1}`, VW / 2, 70, '#ffffff', 16, 'center');
    txt(name, VW / 2, 96, hero === 'donkey' ? '#a6e49a' : '#ffb02a', 16, 'center');
    txt(`COLLECT ${L.need} FLOWERS`, VW / 2, 130, '#ffffff', 8, 'center');
    txt(`AND BRING THEM TO ${NAME[other(hero)]}`, VW / 2, 144, '#ffffff', 8, 'center');
    const nk = ENEMY_KIND[hero][LEVELS[levelIdx].newFoe], NE = ENEMY[nk];
    const label = `NEW FOE: ${NE.name}!`;
    ctx.font = `8px ${FONT}`;
    const lw = ctx.measureText(label).width, lx = Math.round(VW / 2 - (lw + NE.w * 2 + 8) / 2);
    ctx.save(); ctx.translate(lx, 172 - NE.h * 2 + 8); ctx.scale(2, 2); drawParts(ctx, NE.parts(Math.floor(T * 4) % 2), 0, 0, NE.w, false); ctx.restore();
    txt(label, lx + NE.w * 2 + 8, 168, '#ff8a8a');
    txt(hero === 'donkey' ? 'EAT WAFFLES FOR A SUGAR RUSH!' : 'GRAB GOLD FOR DRAGON FURY!', VW / 2, 192, '#ffd34d', 8, 'center');
  }

  function drawGive() {
    drawWorld();
    if (modeT > 3.6) {
      const k = Math.min(1, (modeT - 3.6) * 3);
      shade(0.45 * k);
      txt('LEVEL CLEAR!', VW / 2, 80, '#ffd34d', 16, 'center');
      txt(`${L.got} FLOWERS GIVEN`, VW / 2, 108, '#ffffff', 8, 'center');
      if (levelIdx === LEVELS.length - 1) txt('...AND NOW, A WEDDING?!', VW / 2, 124, '#ff8aa8', 8, 'center');
    }
  }

  function drawGameOver() {
    drawWorld();
    shade(0.65);
    txt('OUT OF HEARTS', VW / 2, 84, '#ff4a6a', 16, 'center');
    if (modeT > 1 && Math.floor(T * 2) % 2 === 0) txt('PRESS JUMP TO TRY AGAIN', VW / 2, 120, '#ffffff', 8, 'center');
  }

  function drawWedding() {
    const t = modeT;
    bands(['#3a2a6a', '#6a3a8a', '#a64a8a', '#e0708a', '#f8a888', '#ffd0a0'], 0, 180);
    pcircle(ctx, 200, 150, 34, '#ffe0b0'); pcircle(ctx, 200, 150, 28, '#fff0c8');
    hills(0, 168, 10, '#8a4a7a', 3, 0);
    hills(0, 180, 6, '#5a8a5a', 6, 0);
    const tl = tiles.donkey;
    for (let x = 0; x < VW; x += 16) { ctx.drawImage(tl.top, x, 190); ctx.drawImage(tl.fill, x, 206); ctx.drawImage(tl.fill, x, 222); }
    // red carpet with scattered petals
    ctx.fillStyle = '#8a1a2a'; ctx.fillRect(0, 191, VW, 6); ctx.fillStyle = '#c4303e'; ctx.fillRect(0, 191, VW, 4);
    ctx.fillStyle = '#ffd34d'; ctx.fillRect(0, 191, VW, 1);
    for (let i = 0; i < 26; i++) { ctx.fillStyle = ['#ff8aa8', '#ffffff', '#ffd34d'][i % 3]; ctx.fillRect(Math.round(hash(i) * VW), 192 + (i % 3), 2, 1); }

    // flower arch
    ctx.fillStyle = OUT; ctx.fillRect(135, 98, 10, 93); ctx.fillRect(255, 98, 10, 93);
    ctx.fillStyle = '#f2e6d0'; ctx.fillRect(136, 98, 8, 92); ctx.fillRect(256, 98, 8, 92);
    const fc = ['#ff7aa8', '#ffffff', '#ffd34d', '#c78aff', '#ff4a6a'];
    for (let i = 0; i <= 20; i++) {
      const a = Math.PI + (i / 20) * Math.PI, x = 200 + Math.cos(a) * 60, y = 100 + Math.sin(a) * 56;
      pcircle(ctx, x, y, 6, '#4f9a5a'); pcircle(ctx, x + 2, y - 1, 3, fc[i % 5]);
    }
    for (let y = 110; y < 186; y += 14) { pcircle(ctx, 140, y, 3, fc[(y / 14) % 5 | 0]); pcircle(ctx, 260, y + 7, 3, fc[((y / 14) + 2) % 5 | 0]); }

    // the officiant on a little step
    ctx.fillStyle = OUT; ctx.fillRect(173, 165, 54, 26); ctx.fillStyle = '#9a8e80'; ctx.fillRect(174, 166, 52, 24); ctx.fillStyle = '#c4b8a8'; ctx.fillRect(174, 166, 52, 2);
    ctx.fillStyle = '#7a7064'; ctx.fillRect(174, 177, 52, 1); ctx.fillRect(190, 167, 1, 10); ctx.fillRect(208, 178, 1, 12);
    const lines = wedLines(), cur = lines.find(l => t >= l.from && t < l.to);
    const ogreTalk = cur && cur.who === 'ogre' && Math.floor(t * 8) % 2 === 0;
    ctx.save(); ctx.translate(176, 101); ctx.scale(2, 2);
    drawParts(ctx, ogreStandParts(ogreTalk, (t + 0.5) % 3.1 < 0.12), 0, 0, 24, false);
    ctx.restore();

    // guests: everyone you met on the way came to celebrate
    const party = t > WED.kiss;
    for (const row of [0, 1]) {
      const by = row ? 186 : 176;
      for (const side of [0, 1]) { // benches
        const x0 = side ? 284 : 8, x1 = side ? 392 : 116;
        ctx.fillStyle = OUT; ctx.fillRect(x0 - 1, by - 1, x1 - x0 + 2, 5);
        ctx.fillStyle = '#a06a3e'; ctx.fillRect(x0, by, x1 - x0, 3); ctx.fillStyle = '#c88a50'; ctx.fillRect(x0, by, x1 - x0, 1);
        ctx.fillStyle = '#6e4426'; ctx.fillRect(x0 + 4, by + 3, 2, 190 - by - 3); ctx.fillRect(x1 - 6, by + 3, 2, 190 - by - 3);
      }
      GUESTS.forEach((gu, i) => {
        if (gu.row !== row) return;
        const E = ENEMY[gu.k], f = Math.floor(t * (E.fly ? 8 : 3) + i) % 2;
        const hop = party ? Math.round(Math.abs(Math.sin(t * 7 + i)) * 7) : Math.round(Math.max(0, Math.sin(t * 2 + i * 1.7)) * 1.5);
        const fly = E.fly ? 8 + Math.round(Math.sin(t * 3 + i) * 2) : 0;
        drawParts(ctx, E.parts(f), gu.x, by - E.h - hop - fly, E.w, gu.x > 200);
      });
    }

    // the couple: donkey from the left, dragon from the right
    const walkK = Math.min(1, t / 3.5), e = 1 - Math.pow(1 - walkK, 2);
    const close = t > WED.kiss - 0.3 ? Math.min(1, (t - WED.kiss + 0.3) * 3) * 14 : 0;
    const dx = -40 + (158 + 40) * e + close, rx = 440 - (440 - 242) * e - close;
    W.rx = rx;
    const walking = t < 3.5;
    const drawBig = (k, x, face, st) => { ctx.save(); ctx.translate(Math.round(x), 190); ctx.scale(2, 2); drawHero(ctx, k, 0, 0, face, st); ctx.restore(); };
    const kissing = t > WED.kiss - 0.1 && t < WED.kiss + 1.2;
    drawBig('donkey', dx, 1, { walk: walking ? Math.floor(t * 8) % 4 : 0, blink: kissing || t % 3 < 0.12 });
    drawBig('dragon', rx, -1, { walk: walking ? Math.floor(t * 8) % 4 : 0, blink: kissing || (t + 1) % 3.4 < 0.12, act: W.breath > 0 });
    // donkey's bow tie, dragon's veil and bouquet
    ctx.fillStyle = OUT; ctx.fillRect(Math.round(dx) + 10, 154, 10, 6); ctx.fillStyle = '#e0405a'; ctx.fillRect(Math.round(dx) + 11, 155, 3, 4); ctx.fillRect(Math.round(dx) + 16, 155, 3, 4); ctx.fillStyle = '#ffd34d'; ctx.fillRect(Math.round(dx) + 14, 156, 2, 2);
    ctx.globalAlpha = 0.85; ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(rx) - 6, 146, 14, 4); ctx.fillRect(Math.round(rx) + 4, 148, 8, 22); ctx.globalAlpha = 1;
    pcircle(ctx, Math.round(rx) - 2, 147, 2, '#ff7aa8');
    const bqx = Math.round(rx) - 16, bqy = 170;
    ctx.fillStyle = '#3e8a44'; ctx.fillRect(bqx, bqy, 2, 6);
    pcircle(ctx, bqx - 2, bqy - 2, 2, '#ff7aa8'); pcircle(ctx, bqx + 3, bqy - 2, 2, '#ffd34d'); pcircle(ctx, bqx, bqy - 4, 2, '#ffffff');

    // speech
    if (cur) {
      const pos = { ogre: [200, 100], donkey: [dx + 6, 138], dragon: [rx - 6, 138] }[cur.who];
      speech(pos[0], pos[1], cur.text);
    }
    if (t > WED.kiss - 0.1) {
      const s = Math.min(2, 1 + (t - WED.kiss) * 3);
      heart(ctx, Math.round(200 - 3.5 * s), Math.round(150 - 3 * s - Math.max(0, Math.sin(t * 4)) * 2), '#ff4a6a', Math.round(s));
    }

    for (const q of parts) { ctx.globalAlpha = clamp(q.life / q.max * 1.5, 0, 1); ctx.fillStyle = q.col; ctx.fillRect(Math.round(q.x), Math.round(q.y), q.s, q.s); }
    ctx.globalAlpha = 1;
    for (const s of W.shouts) {
      const gu = GUESTS[s.gi];
      ctx.globalAlpha = Math.min(1, s.life * 2);
      ctx.font = `8px ${FONT}`;
      const hw = ctx.measureText(s.text).width / 2 + 2;
      txt(s.text, Math.round(clamp(gu.x + 6, hw, VW - hw)), Math.round(150 + gu.row * 10 - (1.2 - s.life) * 18), ['#ffd34d', '#ff8aa8', '#ffffff', '#a6e49a'][s.gi % 4], 8, 'center');
      ctx.globalAlpha = 1;
    }
    if (W.flash > 0) shade(W.flash * 0.55, '#ffffff');

    // "JUST MARRIED" ribbon banner drops in
    if (t > WED.banner) {
      const k = Math.min(1, (t - WED.banner) / 0.7), drop = 1 - Math.pow(1 - k, 3) + Math.sin(k * Math.PI) * 0.08;
      const by = Math.round(-40 + 46 * drop) + Math.round(Math.sin(t * 2) * 1);
      ctx.fillStyle = '#e8dcc0'; ctx.fillRect(100, 0, 1, by + 2); ctx.fillRect(299, 0, 1, by + 2);
      // swallowtail ribbon ends behind the banner
      const tail = (x0, dir) => {
        for (let r = 0; r < 18; r++) {
          const notch = 8 - Math.abs(r - 8.5) | 0; // V cut into the outer end
          const w = 24 - Math.max(0, notch);
          ctx.fillStyle = OUT; ctx.fillRect(dir > 0 ? x0 : x0 - w, by + 5 + r, w, 1);
          if (r > 0 && r < 17) { ctx.fillStyle = r < 4 ? '#e0405a' : '#9a1e2a'; ctx.fillRect(dir > 0 ? x0 + 1 : x0 - w + 1, by + 5 + r, w - 2, 1); }
        }
      };
      tail(91, -1); tail(309, 1);
      ctx.fillStyle = OUT; ctx.fillRect(83, by - 1, 234, 28);
      ctx.fillStyle = '#fff6e0'; ctx.fillRect(84, by, 232, 26);
      ctx.fillStyle = '#ffd34d'; ctx.fillRect(84, by, 232, 2); ctx.fillRect(84, by + 24, 232, 2);
      txt('JUST MARRIED!', VW / 2, by + 6, '#e0405a', 16, 'center', null);
      heart(ctx, 88, by + 10, '#ff4a6a', 1, false); heart(ctx, 305, by + 10, '#ff4a6a', 1, false);
    }
    if (t > WED.stats) {
      ctx.globalAlpha = Math.min(1, (t - WED.stats) * 2);
      txt(`${totalFlowers} FLOWERS   ${totalTreats} ${THEMES[hero].treat}   THE END`, VW / 2, 40, '#ffffff', 8, 'center');
      ctx.globalAlpha = 1;
    }
    if (t > WED.done) {
      ctx.globalAlpha = 0.7 + 0.3 * Math.sin(T * 2.5);
      txt('PRESS JUMP TO PLAY AGAIN', VW / 2, 52, '#ffe08a', 8, 'center');
      ctx.globalAlpha = 1;
    } else if (t < WED.kiss - 0.6 && t > 1) {
      ctx.globalAlpha = 0.55; txt('JUMP: SKIP', VW - 6, VH - 12, '#ffffff', 8, 'right'); ctx.globalAlpha = 1;
    }
  }

  function render() {
    ctx.imageSmoothingEnabled = false;
    if (mode === 'loading') { ctx.fillStyle = '#120c1c'; ctx.fillRect(0, 0, VW, VH); return; }
    if (mode === 'title') drawTitle();
    else if (mode === 'intro') drawIntro();
    else if (mode === 'play') drawWorld();
    else if (mode === 'give') drawGive();
    else if (mode === 'reject') drawWorld();
    else if (mode === 'gameover') drawGameOver();
    else if (mode === 'wedding') drawWedding();
  }

  // ---------- main loop ----------
  let last = performance.now(), acc = 0;
  function frame(now) {
    acc += Math.min(0.1, (now - last) / 1000);
    last = now;
    while (acc >= STEP) {
      update(STEP);
      acc -= STEP;
      for (const k in pressed) pressed[k] = false;
      tap = null;
    }
    render();
    requestAnimationFrame(frame);
  }

  function boot() {
    if (mode !== 'loading') return;
    tiles.donkey = THEMES.donkey.tiles();
    tiles.dragon = THEMES.dragon.tiles();
    mode = 'title'; modeT = 0;
    Sound.play(hero);
    // handy for testing: ?hero=dragon&level=3 or &wedding
    const q = new URLSearchParams(location.search);
    if (q.get('hero') === 'dragon') hero = 'dragon';
    if (q.has('wedding')) startWedding();
    else if (q.get('level')) startLevel(clamp((+q.get('level') | 0) - 1, 0, LEVELS.length - 1));
  }
  (document.fonts ? document.fonts.load(`8px ${FONT}`) : Promise.resolve()).then(boot, boot);
  setTimeout(boot, 2500);
  requestAnimationFrame(frame);

  window.ShreksQuest = window.PetalQuest = { get mode() { return mode; }, get level() { return L; }, get player() { return P; }, startLevel, startWedding };
})();
