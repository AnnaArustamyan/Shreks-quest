// Tiny WebAudio synth: all music and sound effects are generated, no audio files.
const Sound = (() => {
  let ac = null, master = null, sfxBus = null, musicBus = null, noiseBuf = null;
  let muted = false, wantSong = null, song = null, step = 0, nextT = 0, timer = null;
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

  let unlockEl = null;
  // iPhones mute Web Audio when the silent switch is on, unless the page is
  // also playing a media element; a looping silent clip puts it in "playback" mode.
  function iosUnlock() {
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) {}
    if (unlockEl) return;
    const rate = 8000, n = 800, buf = new ArrayBuffer(44 + n), v = new DataView(buf);
    const str = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
    str(0, 'RIFF'); v.setUint32(4, 36 + n, true); str(8, 'WAVEfmt '); v.setUint32(16, 16, true);
    v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, rate, true); v.setUint32(28, rate, true);
    v.setUint16(32, 1, true); v.setUint16(34, 8, true); str(36, 'data'); v.setUint32(40, n, true);
    for (let i = 0; i < n; i++) v.setUint8(44 + i, 128);
    unlockEl = new Audio(URL.createObjectURL(new Blob([buf], { type: 'audio/wav' })));
    unlockEl.loop = true; unlockEl.setAttribute('playsinline', '');
    const p = unlockEl.play();
    if (p && p.catch) p.catch(() => { unlockEl = null; }); // retry on the next gesture
  }

  // Called on every user gesture: creates the context once, then keeps resuming
  // it until the browser lets it run.
  function init() {
    if (ac) {
      if (ac.state !== 'running') { ac.resume(); iosUnlock(); }
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ac = new AC();
    iosUnlock();
    if (ac.state !== 'running') ac.resume();
    // a one-sample blip, played inside the gesture, unlocks older Safari
    const blip = ac.createBufferSource(); blip.buffer = ac.createBuffer(1, 1, 22050); blip.connect(ac.destination); blip.start(0);
    master = ac.createGain(); master.gain.value = muted ? 0 : 0.8; master.connect(ac.destination);
    sfxBus = ac.createGain(); sfxBus.gain.value = 0.7; sfxBus.connect(master);
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    if (wantSong) play(wantSong, true);
  }

  function tone({ type = 'square', f, f2 = null, t = ac.currentTime, dur = 0.1, vol = 0.1, dest = sfxBus, a = 0.005, lp = null, detune = 0 }) {
    if (!ac) return;
    const osc = ac.createOscillator(), g = ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f, t);
    if (f2) osc.frequency.exponentialRampToValueAtTime(f2, t + dur);
    osc.detune.value = detune;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = osc;
    if (lp) { const fl = ac.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = lp; osc.connect(fl); node = fl; }
    node.connect(g); g.connect(dest);
    osc.start(t); osc.stop(t + dur + 0.05);
  }

  function noise({ t = ac.currentTime, dur = 0.1, vol = 0.2, type = 'lowpass', freq = 2000, freq2 = null, dest = sfxBus, q = 1 }) {
    if (!ac) return;
    const src = ac.createBufferSource(), fl = ac.createBiquadFilter(), g = ac.createGain();
    src.buffer = noiseBuf; src.loop = true;
    fl.type = type; fl.Q.value = q;
    fl.frequency.setValueAtTime(freq, t);
    if (freq2) fl.frequency.exponentialRampToValueAtTime(freq2, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(fl); fl.connect(g); g.connect(dest);
    src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.05);
  }

  // ---------- drum kit ----------
  const kick = (t, v, d) => tone({ type: 'sine', f: 150, f2: 42, t, dur: 0.28, vol: v, dest: d });
  const snare = (t, v, d, soft) => {
    noise({ t, dur: soft ? 0.14 : 0.1, vol: v, type: soft ? 'bandpass' : 'highpass', freq: soft ? 1800 : 1200, dest: d });
    if (!soft) tone({ type: 'triangle', f: 210, f2: 120, t, dur: 0.08, vol: v * 0.6, dest: d });
  };
  const hat = (t, v, d) => noise({ t, dur: 0.035, vol: v, type: 'highpass', freq: 7000, dest: d });

  // ---------- songs ----------
  const LOFI_MEL = [
    { 2: 76, 4: 72, 7: 69, 10: 72, 14: 74 },
    { 2: 74, 4: 67, 7: 71, 11: 74 },
    { 2: 72, 4: 69, 6: 65, 10: 69, 12: 72 },
    { 0: 67, 4: 64, 8: 67, 11: 71 },
  ];
  const ROCK_MEL = [
    { 0: 69, 4: 72, 8: 76, 12: 74 },
    { 0: 72, 6: 69, 8: 65, 12: 69 },
    { 0: 71, 4: 74, 8: 79, 12: 77 },
    { 0: 76, 4: 75, 8: 71, 12: 68 },
  ];
  const WED_MEL = [
    { 0: [67, 4], 4: [72, 3], 7: [72, 1], 8: [72, 8] },
    { 0: [67, 4], 4: [74, 3], 7: [71, 1], 8: [72, 8] },
    { 0: [67, 4], 4: [72, 3], 7: [77, 1], 8: [77, 4], 12: [76, 2], 14: [74, 2] },
    { 0: [72, 3], 3: [71, 1], 4: [72, 4], 8: [74, 8] },
  ];

  const SONGS = {
    // chill lofi: jazzy 7th chords, swung soft drums
    donkey: {
      bpm: 78, swing: 0.3,
      step(i, t, sd, d) {
        const bar = (i >> 4) % 4, s = i % 16;
        const ch = [[53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60], [48, 52, 55, 59]][bar];
        const ep = (n, tt, dur, v) => {
          tone({ type: 'sine', f: mtof(n), t: tt, dur, vol: v, dest: d, a: 0.02, lp: 1500 });
          tone({ type: 'triangle', f: mtof(n), t: tt, dur: dur * 0.6, vol: v * 0.4, dest: d, a: 0.02, lp: 1200, detune: 7 });
        };
        if (s === 0) ch.forEach((n, k) => ep(n, t + k * 0.015, sd * 14, 0.035));
        if (s === 10) ch.slice(1).forEach((n, k) => ep(n, t + k * 0.012, sd * 6, 0.018));
        if (s === 0 || s === 10) tone({ type: 'sine', f: mtof(ch[0] - 12), t, dur: sd * 5, vol: 0.13, dest: d, a: 0.01 });
        if (s === 7) tone({ type: 'sine', f: mtof(ch[0] - 5), t, dur: sd * 2.5, vol: 0.09, dest: d, a: 0.01 });
        if (s === 0 || s === 10) kick(t, 0.32, d);
        if (s === 4 || s === 12) snare(t, 0.07, d, true);
        if (s % 2 === 0) hat(t, s % 4 === 2 ? 0.035 : 0.02, d);
        const m = LOFI_MEL[bar][s];
        if (m) {
          tone({ type: 'sine', f: mtof(m), t, dur: sd * 6, vol: 0.05, dest: d, a: 0.005 });
          tone({ type: 'sine', f: mtof(m + 12), t, dur: sd * 2, vol: 0.012, dest: d, a: 0.005 });
        }
      },
    },
    // intense: fast minor chiptune, driving bass and arps
    dragon: {
      bpm: 152, swing: 0,
      step(i, t, sd, d) {
        const bar = (i >> 4) % 4, s = i % 16;
        const root = [45, 41, 43, 40][bar];
        const tri = [[57, 60, 64], [53, 57, 60], [55, 59, 62], [52, 56, 59]][bar];
        if (s % 2 === 0) tone({ type: 'sawtooth', f: mtof(root + (s % 8 === 6 ? 12 : 0)), t, dur: sd * 1.7, vol: 0.075, dest: d, lp: 750 });
        tone({ type: 'square', f: mtof(tri[[0, 1, 2, 1][s % 4]] + 12), t, dur: sd * 0.85, vol: 0.02, dest: d, lp: 3200 });
        if (s % 4 === 0 || s === 14) kick(t, 0.4, d);
        if (s === 4 || s === 12) snare(t, 0.16, d, false);
        if (s % 2 === 1) hat(t, 0.035, d);
        const m = ROCK_MEL[bar][s];
        if (m) {
          tone({ type: 'square', f: mtof(m), t, dur: sd * 3.6, vol: 0.04, dest: d, lp: 2600 });
          tone({ type: 'sawtooth', f: mtof(m), t, dur: sd * 3.6, vol: 0.018, dest: d, lp: 2000, detune: 9 });
        }
      },
    },
    // Wagner's Bridal Chorus (public domain), chiptune organ + bells
    wedding: {
      bpm: 72, swing: 0,
      step(i, t, sd, d) {
        const bar = (i >> 4) % 4, s = i % 16;
        const pad = [[48, 55, 64], [43, 55, 62], [41, 57, 65], [43, 55, 62]][bar];
        if (s === 0) pad.forEach(n => tone({ type: 'sine', f: mtof(n), t, dur: sd * 16, vol: 0.03, dest: d, a: 0.15 }));
        const m = WED_MEL[bar][s];
        if (m) {
          tone({ type: 'square', f: mtof(m[0]), t, dur: sd * m[1] * 0.95, vol: 0.035, dest: d, a: 0.02, lp: 1800 });
          tone({ type: 'sine', f: mtof(m[0] - 12), t, dur: sd * m[1] * 0.95, vol: 0.05, dest: d, a: 0.02 });
        }
        if (s === 0 || s === 8) {
          const b = s === 0 ? 84 : 79;
          tone({ type: 'sine', f: mtof(b), t, dur: 1.4, vol: 0.03, dest: d });
          tone({ type: 'sine', f: mtof(b) * 2.76, t, dur: 0.6, vol: 0.01, dest: d });
        }
        if (s % 4 === 0) kick(t, 0.12, d);
      },
    },
  };

  function schedule() {
    if (!song) return;
    const sd = 60 / song.bpm / 4;
    if (nextT < ac.currentTime - 0.2) nextT = ac.currentTime + 0.05; // tab was asleep: skip ahead
    while (nextT < ac.currentTime + 0.12) {
      const sw = step % 2 === 1 ? sd * song.swing : 0;
      song.step(step % 64, nextT + sw, sd, musicBus);
      nextT += sd; step++;
    }
  }

  function stop() {
    if (timer) clearInterval(timer);
    timer = null; song = null;
    if (musicBus) {
      const old = musicBus;
      old.gain.setTargetAtTime(0, ac.currentTime, 0.1);
      setTimeout(() => old.disconnect(), 800);
      musicBus = null;
    }
  }

  function play(name, force) {
    if (!force && wantSong === name && song) return;
    wantSong = name;
    if (!ac) return;
    stop();
    song = SONGS[name];
    musicBus = ac.createGain(); musicBus.gain.value = 0.55; musicBus.connect(master);
    step = 0; nextT = ac.currentTime + 0.1;
    timer = setInterval(schedule, 25);
  }

  const now = () => ac.currentTime;
  const fx = {
    jump(h) {
      if (h === 'dragon') tone({ type: 'triangle', f: 200, f2: 520, dur: 0.16, vol: 0.16 });
      else tone({ type: 'square', f: 260, f2: 620, dur: 0.13, vol: 0.06 });
    },
    collect() { const t = now(); tone({ f: 988, t, dur: 0.07, vol: 0.05 }); tone({ f: 1480, t: t + 0.06, dur: 0.14, vol: 0.05 }); },
    bonus() { [660, 880, 1100, 1320, 1760].forEach((f, i) => tone({ f, t: now() + i * 0.05, dur: 0.1, vol: 0.05 })); },
    stomp() { tone({ type: 'triangle', f: 320, f2: 70, dur: 0.15, vol: 0.22 }); noise({ dur: 0.06, vol: 0.12, freq: 900 }); },
    kick() { noise({ dur: 0.1, vol: 0.32, type: 'bandpass', freq: 700 }); tone({ f: 160, f2: 50, dur: 0.12, vol: 0.09 }); },
    fire() { noise({ dur: 0.32, vol: 0.2, freq: 3500, freq2: 400 }); tone({ type: 'sawtooth', f: 140, f2: 60, dur: 0.25, vol: 0.05 }); },
    hurt() { tone({ f: 520, f2: 110, dur: 0.35, vol: 0.08 }); },
    checkpoint() { [523, 659, 784, 1046].forEach((f, i) => tone({ type: 'triangle', f, t: now() + i * 0.07, dur: 0.22, vol: 0.12 })); },
    give() { [784, 988, 1175, 1568, 1976].forEach((f, i) => tone({ type: 'sine', f, t: now() + i * 0.09, dur: 0.7, vol: 0.08 })); },
    nope() { const t = now(); tone({ f: 220, t, dur: 0.1, vol: 0.05 }); tone({ f: 165, t: t + 0.12, dur: 0.16, vol: 0.05 }); },
    select() { tone({ f: 660, dur: 0.06, vol: 0.05 }); },
    firework() { noise({ dur: 0.5, vol: 0.14, type: 'bandpass', freq: 1400, freq2: 250 }); },
    bells() { [1046, 1318, 1568].forEach((f, i) => { tone({ type: 'sine', f, t: now() + i * 0.18, dur: 1.6, vol: 0.06 }); tone({ type: 'sine', f: f * 2.76, t: now() + i * 0.18, dur: 0.5, vol: 0.015 }); }); },
    heehaw() {
      const t = now();
      for (let k = 0; k < 2; k++) {
        tone({ type: 'sawtooth', f: 620, f2: 900, t: t + k * 0.6, dur: 0.25, vol: 0.06, lp: 1800 });
        tone({ type: 'sawtooth', f: 520, f2: 290, t: t + k * 0.6 + 0.27, dur: 0.3, vol: 0.07, lp: 1400 });
      }
    },
    sob() {
      const t = now();
      [0, 0.3, 0.6, 1.1, 1.4].forEach((d, i) => {
        tone({ type: 'triangle', f: 640 - i * 40, f2: 380 - i * 30, t: t + d, dur: 0.22, vol: 0.09, lp: 2200 });
        noise({ t: t + d, dur: 0.12, vol: 0.05, type: 'bandpass', freq: 1500 });
      });
      tone({ type: 'sine', f: 520, f2: 260, t: t + 1.8, dur: 0.8, vol: 0.08 }); // long wail
    },
    roar() { tone({ type: 'sawtooth', f: 180, f2: 55, dur: 0.75, vol: 0.12, lp: 900 }); noise({ dur: 0.75, vol: 0.25, freq: 1000, freq2: 180 }); },
  };
  // fx calls before the first user gesture are silently ignored
  for (const k in fx) { const f = fx[k]; fx[k] = (...a) => { if (ac && !muted) f(...a); }; }

  function toggleMute() {
    muted = !muted;
    if (master) master.gain.setTargetAtTime(muted ? 0 : 0.8, ac.currentTime, 0.02);
    return muted;
  }

  const running = () => !!ac && ac.state === 'running';
  return { init, play, stop, fx, toggleMute, running };
})();
