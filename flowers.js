(() => {
  const canvas = document.getElementById('garden');
  const ctx = canvas.getContext('2d');
  const hint = document.getElementById('hint');

  let W = 0, H = 0, DPR = 1;
  let stars = [], hills = [], grass = [];
  const flowers = [], petals = [], fireflies = [];
  let wind = 0, windTarget = 0, lastPointerX = null;
  const MAX_FLOWERS = 80;

  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = arr => arr[(Math.random() * arr.length) | 0];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const easeOutCubic = t => 1 - Math.pow(1 - t, 3);
  const easeOutBack = t => { const c = 1.70158; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };

  // Petal colour palettes: [outer hue, inner hue, saturation, lightness, center colour]
  const PALETTES = [
    { h: 340, h2: 350, s: 85, l: 72, c: '#ffd36b' }, // pink
    { h: 280, h2: 300, s: 70, l: 70, c: '#ffe08a' }, // lavender
    { h: 10,  h2: 25,  s: 90, l: 62, c: '#3a1d12' }, // coral / poppy
    { h: 48,  h2: 40,  s: 95, l: 62, c: '#5a3210' }, // sunflower
    { h: 200, h2: 215, s: 80, l: 70, c: '#fff1a8' }, // forget-me-not
    { h: 0,   h2: 0,   s: 0,  l: 96, c: '#ffcc33' }, // white daisy
    { h: 320, h2: 290, s: 75, l: 60, c: '#ffe7a0' }, // magenta
  ];
  const TYPES = ['daisy', 'cosmos', 'rose', 'poppy'];

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = W * DPR; canvas.height = H * DPR;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

    stars = Array.from({ length: Math.round(W * H / 4000) }, () => ({
      x: Math.random() * W, y: Math.random() * H * 0.65,
      r: Math.random() * 1.3 + 0.2, p: Math.random() * Math.PI * 2, s: rand(0.5, 2),
    }));

    hills = [0, 1, 2].map(i => {
      const pts = [], base = H * (0.62 + i * 0.07), amp = H * (0.06 - i * 0.012);
      const f1 = rand(0.002, 0.004), f2 = rand(0.006, 0.01), o1 = rand(0, 10), o2 = rand(0, 10);
      for (let x = 0; x <= W + 20; x += 20)
        pts.push([x, base - Math.sin(x * f1 + o1) * amp - Math.sin(x * f2 + o2) * amp * 0.4]);
      return pts;
    });

    grass = Array.from({ length: Math.round(W / 4) }, () => ({
      x: Math.random() * W, h: rand(10, 38), lean: rand(-0.3, 0.3), p: Math.random() * 6.28,
      hue: rand(110, 150), light: rand(14, 26),
    }));
  }

  function groundY() { return H * 0.86; }

  function plant(x, y, delay = 0) {
    if (flowers.length >= MAX_FLOWERS) flowers.shift();
    const depth = clamp((y - H * 0.74) / (H * 0.24), 0, 1); // 0 = far, 1 = near
    const scale = 0.55 + depth * 0.65;
    const type = pick(TYPES);
    const pal = pick(PALETTES);
    flowers.push({
      x, y, depth, scale, type, pal,
      height: rand(H * 0.16, H * 0.34) * scale,
      bend: rand(-0.25, 0.25),
      petals: type === 'daisy' ? (16 + (Math.random() * 8 | 0)) : type === 'cosmos' ? 8 : type === 'poppy' ? 5 : 5,
      size: rand(18, 30) * scale * (type === 'daisy' ? 0.9 : 1),
      phase: Math.random() * Math.PI * 2,
      swaySpeed: rand(0.6, 1.1),
      spin: rand(0, Math.PI * 2),
      age: -delay,
      leaves: [rand(0.25, 0.4), rand(0.5, 0.65)],
      leafSide: Math.random() < 0.5 ? 1 : -1,
    });
    flowers.sort((a, b) => a.y - b.y);
  }

  // Stem geometry at time t
  function stem(f, t) {
    const grow = easeOutCubic(clamp(f.age / 2.2, 0, 1));
    const h = f.height * grow;
    const sway = Math.sin(t * f.swaySpeed + f.phase) * 0.06 + Math.sin(t * 2.3 + f.phase * 2) * 0.015 + wind * 0.12;
    const tipX = f.x + (f.bend + sway) * h;
    const tipY = f.y - h;
    const cx = f.x + f.bend * h * 0.3;
    const cy = f.y - h * 0.55;
    return { grow, h, tipX, tipY, cx, cy, angle: Math.atan2(tipX - cx, cy - tipY) };
  }

  function qPoint(f, s, u) {
    const a = (1 - u) * (1 - u), b = 2 * (1 - u) * u, c = u * u;
    return [a * f.x + b * s.cx + c * s.tipX, a * f.y + b * s.cy + c * s.tipY];
  }

  function petalPath(len, wid, shape) {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    if (shape === 'round') {
      ctx.bezierCurveTo(wid * 1.2, -len * 0.25, wid * 1.1, -len * 1.05, 0, -len);
      ctx.bezierCurveTo(-wid * 1.1, -len * 1.05, -wid * 1.2, -len * 0.25, 0, 0);
    } else if (shape === 'notched') {
      ctx.bezierCurveTo(wid, -len * 0.3, wid * 1.0, -len * 0.95, wid * 0.4, -len);
      ctx.quadraticCurveTo(0, -len * 0.88, -wid * 0.4, -len);
      ctx.bezierCurveTo(-wid * 1.0, -len * 0.95, -wid, -len * 0.3, 0, 0);
    } else {
      ctx.bezierCurveTo(wid, -len * 0.3, wid * 0.8, -len * 0.9, 0, -len);
      ctx.bezierCurveTo(-wid * 0.8, -len * 0.9, -wid, -len * 0.3, 0, 0);
    }
    ctx.closePath();
  }

  function drawPetalRing(n, len, wid, shape, rot, h, s, l, alpha = 1) {
    for (let i = 0; i < n; i++) {
      ctx.save();
      ctx.rotate(rot + (i / n) * Math.PI * 2);
      const g = ctx.createLinearGradient(0, 0, 0, -len);
      g.addColorStop(0, `hsla(${h},${s}%,${l - 22}%,${alpha})`);
      g.addColorStop(0.55, `hsla(${h},${s}%,${l}%,${alpha})`);
      g.addColorStop(1, `hsla(${h},${s}%,${Math.min(l + 12, 98)}%,${alpha})`);
      ctx.fillStyle = g;
      petalPath(len, wid, shape);
      ctx.fill();
      ctx.strokeStyle = `hsla(${h},${s}%,${l - 30}%,${0.25 * alpha})`;
      ctx.lineWidth = 0.6;
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawFlower(f, t) {
    if (f.age <= 0) return;
    const s = stem(f, t);
    const fade = 0.55 + f.depth * 0.45; // distant flowers are a little darker

    // stem
    ctx.lineCap = 'round';
    ctx.strokeStyle = `hsl(120, 45%, ${18 * fade + 8}%)`;
    ctx.lineWidth = Math.max(1.2, 3.2 * f.scale);
    ctx.beginPath();
    ctx.moveTo(f.x, f.y);
    ctx.quadraticCurveTo(s.cx, s.cy, s.tipX, s.tipY);
    ctx.stroke();

    // leaves
    f.leaves.forEach((u, i) => {
      const lg = clamp((s.grow - u) * 3, 0, 1);
      if (lg <= 0) return;
      const [lx, ly] = qPoint(f, s, u);
      const side = i % 2 ? -f.leafSide : f.leafSide;
      ctx.save();
      ctx.translate(lx, ly);
      ctx.rotate(side * (0.9 + Math.sin(t * 1.4 + f.phase + i) * 0.12) + s.angle * 0.5);
      const L = 26 * f.scale * easeOutCubic(lg), Wd = 8 * f.scale * easeOutCubic(lg);
      const g = ctx.createLinearGradient(0, 0, 0, -L);
      g.addColorStop(0, `hsl(125, 50%, ${16 * fade + 8}%)`);
      g.addColorStop(1, `hsl(105, 55%, ${30 * fade + 8}%)`);
      ctx.fillStyle = g;
      petalPath(L, Wd, 'pointed');
      ctx.fill();
      ctx.strokeStyle = `hsla(110, 50%, 45%, .35)`;
      ctx.lineWidth = 0.6;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -L * 0.9); ctx.stroke();
      ctx.restore();
    });

    // head
    const bloomT = clamp((f.age - 1.6) / 2.4, 0, 1);
    const breathe = 1 + Math.sin(t * 1.2 + f.phase) * 0.03;
    const p = f.pal;
    ctx.save();
    ctx.translate(s.tipX, s.tipY);
    ctx.rotate(s.angle * 0.6);
    const R = f.size * breathe;

    if (bloomT < 0.05) {
      // bud
      const b = clamp(s.grow * 1.2, 0.2, 1);
      ctx.fillStyle = `hsl(115, 45%, ${22 * fade + 8}%)`;
      petalPath(R * 0.55 * b, R * 0.32 * b, 'round');
      ctx.fill();
      ctx.restore();
      return;
    }

    const open = easeOutBack(bloomT);
    const spin = f.spin + Math.sin(t * 0.5 + f.phase) * 0.05;
    const L = p.l * fade + (1 - fade) * 20;

    // soft glow behind the bloom
    const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, R * 2.2 * open);
    glow.addColorStop(0, `hsla(${p.h},${p.s}%,${p.l}%,${0.18 * bloomT})`);
    glow.addColorStop(1, `hsla(${p.h},${p.s}%,${p.l}%,0)`);
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(0, 0, R * 2.2 * open, 0, Math.PI * 2); ctx.fill();

    switch (f.type) {
      case 'daisy':
        drawPetalRing(f.petals, R * open, R * 0.16, 'round', spin, p.h, p.s, L);
        drawPetalRing(f.petals, R * 0.8 * open, R * 0.13, 'round', spin + Math.PI / f.petals, p.h2, p.s, L + 6);
        break;
      case 'cosmos':
        drawPetalRing(f.petals, R * open, R * 0.38, 'notched', spin, p.h, p.s, L);
        break;
      case 'poppy':
        drawPetalRing(f.petals, R * 1.05 * open, R * 0.62, 'round', spin, p.h, p.s, L - 4, 0.92);
        drawPetalRing(f.petals, R * 0.7 * open, R * 0.45, 'round', spin + 0.6, p.h2, p.s, L + 4, 0.9);
        break;
      case 'rose':
        for (let k = 0; k < 4; k++) {
          const sc = 1 - k * 0.22;
          drawPetalRing(5, R * sc * open, R * 0.55 * sc, 'round', spin + k * 0.7, p.h + k * 3, p.s, L - 8 + k * 7);
        }
        break;
    }

    // center
    const cR = R * (f.type === 'rose' ? 0.12 : f.type === 'daisy' ? 0.3 : 0.24) * open;
    const cg = ctx.createRadialGradient(-cR * 0.3, -cR * 0.3, 0, 0, 0, cR);
    cg.addColorStop(0, '#fff6cf');
    cg.addColorStop(0.35, p.c);
    cg.addColorStop(1, 'rgba(60,30,10,0.9)');
    ctx.fillStyle = cg;
    ctx.beginPath(); ctx.arc(0, 0, cR, 0, Math.PI * 2); ctx.fill();
    if (f.type !== 'rose' && cR > 3) {
      ctx.fillStyle = 'rgba(255,240,180,.55)';
      for (let i = 0; i < 10; i++) {
        const a = i * 2.39996 + f.phase, r = Math.sqrt(i / 10) * cR * 0.8;
        ctx.beginPath(); ctx.arc(Math.cos(a) * r, Math.sin(a) * r, cR * 0.08, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.restore();

    // occasionally release a petal
    if (bloomT >= 1 && Math.random() < 0.0015 && petals.length < 120) {
      petals.push({
        x: s.tipX, y: s.tipY, vx: rand(-0.3, 0.3), vy: rand(-0.2, 0.2),
        rot: Math.random() * 6.28, vr: rand(-0.04, 0.04), size: R * 0.45,
        h: p.h, s: p.s, l: p.l, life: 1, flip: Math.random() * 6.28,
      });
    }
  }

  function drawSky(t) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#0b0820');
    g.addColorStop(0.35, '#2a1b4d');
    g.addColorStop(0.6, '#7a3b6e');
    g.addColorStop(0.75, '#e0807a');
    g.addColorStop(0.85, '#f7c290');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    for (const s of stars) {
      const a = (0.5 + 0.5 * Math.sin(t * s.s + s.p)) * (1 - s.y / (H * 0.65));
      ctx.fillStyle = `rgba(255,255,255,${a})`;
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
    }

    // moon
    const mx = W * 0.8, my = H * 0.18, mr = Math.min(W, H) * 0.045;
    const mg = ctx.createRadialGradient(mx, my, mr * 0.5, mx, my, mr * 6);
    mg.addColorStop(0, 'rgba(255,240,220,.35)');
    mg.addColorStop(1, 'rgba(255,240,220,0)');
    ctx.fillStyle = mg;
    ctx.beginPath(); ctx.arc(mx, my, mr * 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff4e2';
    ctx.beginPath(); ctx.arc(mx, my, mr, 0, Math.PI * 2); ctx.fill();
  }

  function drawHills() {
    const cols = ['#4a2a5c', '#2f1d44', '#1b1430'];
    hills.forEach((pts, i) => {
      ctx.fillStyle = cols[i];
      ctx.beginPath();
      ctx.moveTo(0, H);
      for (const [x, y] of pts) ctx.lineTo(x, y);
      ctx.lineTo(W, H);
      ctx.fill();
    });
    const gy = H * 0.76;
    const gg = ctx.createLinearGradient(0, gy, 0, H);
    gg.addColorStop(0, '#16261c');
    gg.addColorStop(1, '#07100b');
    ctx.fillStyle = gg;
    ctx.beginPath();
    ctx.moveTo(0, H);
    for (let x = 0; x <= W + 30; x += 30) ctx.lineTo(x, gy + Math.sin(x * 0.01) * 6);
    ctx.lineTo(W, H);
    ctx.fill();
  }

  function drawGrass(t) {
    ctx.lineCap = 'round';
    for (const b of grass) {
      const sway = Math.sin(t * 1.3 + b.p + b.x * 0.01) * 0.25 + wind * 0.5 + b.lean;
      ctx.strokeStyle = `hsl(${b.hue}, 45%, ${b.light}%)`;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(b.x, H + 2);
      ctx.quadraticCurveTo(b.x + sway * b.h * 0.3, H - b.h * 0.6, b.x + sway * b.h, H - b.h);
      ctx.stroke();
    }
  }

  function updatePetals(dt) {
    for (let i = petals.length - 1; i >= 0; i--) {
      const q = petals[i];
      q.vx += (wind * 0.6 + 0.15 - q.vx) * 0.02;
      q.vy = Math.min(q.vy + 0.004, 0.7);
      q.x += q.vx + Math.sin(q.flip) * 0.4;
      q.y += q.vy;
      q.rot += q.vr; q.flip += 0.05;
      if (q.y > groundY() + 40) q.life -= dt * 0.8;
      if (q.life <= 0 || q.x < -50 || q.x > W + 50 || q.y > H + 20) { petals.splice(i, 1); continue; }
      ctx.save();
      ctx.translate(q.x, q.y);
      ctx.rotate(q.rot);
      ctx.scale(1, Math.abs(Math.cos(q.flip)) * 0.8 + 0.2);
      ctx.fillStyle = `hsla(${q.h},${q.s}%,${q.l}%,${q.life * 0.9})`;
      petalPath(q.size, q.size * 0.45, 'round');
      ctx.fill();
      ctx.restore();
    }
  }

  function updateFireflies(t, dt) {
    while (fireflies.length < Math.round(W / 40)) {
      fireflies.push({ x: Math.random() * W, y: rand(H * 0.5, H * 0.95), a: Math.random() * 6.28, sp: rand(8, 22), p: Math.random() * 6.28 });
    }
    ctx.globalCompositeOperation = 'lighter';
    for (const f of fireflies) {
      f.a += rand(-1, 1) * dt * 2;
      f.x += (Math.cos(f.a) * f.sp + wind * 30) * dt;
      f.y += Math.sin(f.a) * f.sp * dt * 0.6;
      if (f.x < -10) f.x = W + 10; if (f.x > W + 10) f.x = -10;
      f.y = clamp(f.y, H * 0.45, H * 0.98);
      const b = Math.pow(0.5 + 0.5 * Math.sin(t * 2 + f.p), 3);
      const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, 14);
      g.addColorStop(0, `rgba(255,250,170,${0.9 * b})`);
      g.addColorStop(0.2, `rgba(220,255,120,${0.4 * b})`);
      g.addColorStop(1, 'rgba(200,255,100,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(f.x, f.y, 14, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  let last = performance.now();
  function frame(now) {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    const t = now / 1000;

    windTarget *= 0.97;
    wind += (windTarget + Math.sin(t * 0.3) * 0.15 - wind) * 0.03;

    drawSky(t);
    drawHills();
    for (const f of flowers) { f.age += dt; drawFlower(f, t); }
    updatePetals(dt);
    updateFireflies(t, dt);
    drawGrass(t);
    requestAnimationFrame(frame);
  }

  function onPointerDown(e) {
    const y = clamp(e.clientY, H * 0.78, H * 0.97);
    plant(e.clientX, y);
    hint.classList.add('hidden');
  }
  function onPointerMove(e) {
    if (lastPointerX !== null) windTarget = clamp(windTarget + (e.clientX - lastPointerX) * 0.004, -1.2, 1.2);
    lastPointerX = e.clientX;
  }

  window.addEventListener('resize', resize);
  canvas.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);

  resize();
  const initial = clamp(Math.round(W / 70), 6, 26);
  for (let i = 0; i < initial; i++) {
    plant(rand(W * 0.03, W * 0.97), rand(H * 0.79, H * 0.96), i * 0.25 + Math.random() * 0.5);
  }
  setTimeout(() => hint.classList.add('hidden'), 9000);
  requestAnimationFrame(frame);
})();
