// =====================================================================
//  GELUID - alle geluidjes worden "gesynthetiseerd" met Web Audio
//  (geen geluidsbestanden nodig: we maken tonen met oscillators en ruis).
//
//  Gebruik:  playSound('coin')
//  Geluid uit/aan: de luidspreker-knop bovenin (save.muted)
// =====================================================================

const MASTER_VOLUME = 0.22; // totaal volume (0 = stil, 1 = hard)

let audioCtx = null;
let master = null;

// Maakt de audio-context (pas bij het eerste geluid).
function audio() {
  if (!audioCtx) {
    audioCtx = new AudioContext();
    master = audioCtx.createGain();
    master.gain.value = MASTER_VOLUME;
    master.connect(audioCtx.destination);
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

// Browsers laten pas geluid toe na een klik. Bij de eerste klik "wakker maken".
window.addEventListener('pointerdown', () => audio(), { once: true });

// Eén toon. at = wanneer (seconden vanaf nu), dur = hoe lang.
function tone(freq, at, dur, { type = 'sine', vol = 0.5, slideTo = null } = {}) {
  const ctx = audio();
  const t = ctx.currentTime + at;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(vol, t + 0.01); // snel aan
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur); // langzaam uit
  osc.connect(gain).connect(master);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

// Ruis (voor "whoosh", regen en de moersleutel). freq = filter-frequentie.
function noise(at, dur, { freq = 1000, slideTo = null, vol = 0.4, q = 1 } = {}) {
  const ctx = audio();
  const t = ctx.currentTime + at;
  const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.Q.value = q;
  filter.frequency.setValueAtTime(freq, t);
  if (slideTo) filter.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(vol, t + dur * 0.3);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(filter).connect(gain).connect(master);
  src.start(t);
}

// ---------------------------------------------------------------------
//  ALLE GELUIDEN - pas hier aan hoe iets klinkt
// ---------------------------------------------------------------------
const SOUNDS = {
  // Coin opgepakt: kort "ding-ding"
  coin() {
    tone(1320, 0, 0.08, { type: 'square', vol: 0.12 });
    tone(1760, 0.06, 0.15, { type: 'square', vol: 0.1 });
  },
  // Ronde voltooid
  lap() {
    tone(660, 0, 0.12, { type: 'triangle', vol: 0.4 });
    tone(990, 0.12, 0.25, { type: 'triangle', vol: 0.4 });
  },
  // Team radio: het bekende F1-piepje
  radio() {
    tone(1100, 0, 0.07, { type: 'sine', vol: 0.3 });
    tone(1100, 0.11, 0.07, { type: 'sine', vol: 0.3 });
    noise(0.2, 0.12, { freq: 2500, vol: 0.05, q: 0.5 });
  },
  // Start-lampen: piep... en dan hoge piep bij "lights out"
  lights() {
    tone(440, 0, 0.12, { type: 'square', vol: 0.15 });
    tone(880, 0.45, 0.35, { type: 'square', vol: 0.18 });
    tone(80, 0.45, 0.9, { type: 'sawtooth', vol: 0.12, slideTo: 260 }); // motor brult
  },
  // Inhalen: whoosh!
  overtake() {
    noise(0, 0.6, { freq: 400, slideTo: 3000, vol: 0.5, q: 2 });
    tone(180, 0, 0.5, { type: 'sawtooth', vol: 0.08, slideTo: 420 });
  },
  // Push: vrolijk akkoord omhoog
  push() {
    [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.08, 0.3, { type: 'triangle', vol: 0.35 }));
  },
  // GP gewonnen / kampioen: fanfare
  win() {
    const notes = [523, 523, 523, 659, 784, 659, 784, 1047];
    const times = [0, 0.12, 0.24, 0.36, 0.6, 0.84, 0.96, 1.1];
    notes.forEach((f, i) => tone(f, times[i], i === notes.length - 1 ? 0.8 : 0.2, { type: 'square', vol: 0.18 }));
  },
  // Achievement: "pling"
  achievement() {
    tone(988, 0, 0.15, { type: 'sine', vol: 0.4 });
    tone(1319, 0.1, 0.4, { type: 'sine', vol: 0.35 });
  },
  // Groene vlag (test geslaagd)
  green() {
    tone(784, 0, 0.1, { type: 'triangle', vol: 0.35 });
    tone(1047, 0.1, 0.2, { type: 'triangle', vol: 0.35 });
  },
  // Gele vlag (commando gefaald)
  fail() {
    tone(300, 0, 0.18, { type: 'square', vol: 0.15, slideTo: 200 });
    tone(220, 0.2, 0.3, { type: 'square', vol: 0.15, slideTo: 150 });
  },
  // Regen begint: gerommel
  thunder() {
    noise(0, 1.6, { freq: 120, slideTo: 60, vol: 0.6, q: 0.7 });
  },
  // Moersleutel bij de pitstop: "brrrt"
  wrench() {
    for (let i = 0; i < 6; i++) noise(i * 0.035, 0.03, { freq: 1800, vol: 0.35, q: 3 });
  },
  // Aftellen bij de pitstop
  beep() {
    tone(660, 0, 0.12, { type: 'square', vol: 0.15 });
  },
  beepHigh() {
    tone(1320, 0, 0.25, { type: 'square', vol: 0.18 });
  },
  // Fout geklikt bij de pitstop
  wrong() {
    tone(150, 0, 0.15, { type: 'sawtooth', vol: 0.2 });
  },
  // DRS open
  drs() {
    tone(600, 0, 0.3, { type: 'sawtooth', vol: 0.08, slideTo: 1400 });
  },
};

// Speelt een geluid af (als het geluid niet uit staat).
function playSound(name) {
  if (save.muted || !SOUNDS[name]) return;
  try {
    SOUNDS[name]();
  } catch (err) {
    tiny.log('Geluid mislukt: ' + err);
  }
}
