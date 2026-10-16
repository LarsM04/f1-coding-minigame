// =====================================================================
//  RENDER: alles wat getekend wordt op het <canvas>
//
//  De baan is een ZIJAANZICHT met lagen die op verschillende snelheden
//  scrollen ("parallax"), zodat het diepte krijgt:
//     lucht -> skyline -> tribunes -> hek + reclameborden -> asfalt -> kerb
//  Lagen die niet veranderen worden 1x vooraf getekend ("tiles") en daarna
//  steeds opnieuw geplakt. Dat is veel sneller dan elke frame alles tekenen.
//
//  Het thema (dag / zonsondergang / nacht) hangt af van hoe laat het ECHT is.
//  In de PITS teken je de garage in plaats van de baan.
// =====================================================================

// Afmetingen van de scène (in CSS-pixels).
const TRACK = {
  W: 344,
  H: 140,
  ROAD_TOP: 100,     // bovenkant van het asfalt
  ROAD_BOTTOM: 130,  // onderkant van het asfalt (daarna kerb + gras)
  GROUND_Y: 123,     // waar de banden van de auto de grond raken
  CAR_X: 52,         // x-positie van de achterkant van de auto
  CAR_LEN: 100,      // lengte van de auto
  COIN_Y: 109,       // hoogte waarop coins zweven
};

const FONT = '"Titillium Web", "Segoe UI", sans-serif';

// ---------------------------------------------------------------------
//  KLEURENTHEMA'S per tijd van de dag
// ---------------------------------------------------------------------
const PALETTES = {
  day: {
    sky: ['#3d7fd1', '#a8d6f7'], far: '#8fb0cf', farWindows: 'rgba(255,255,255,0.25)',
    stand: '#5d6773', standDark: '#3c434d', roof: '#2f353d', seats: ['#c9ced6', '#b3bac5'],
    tree: '#2f7d3a', treeDark: '#256332', road: '#50545c', grass: '#3e9a46', grassDark: '#358a3d',
    lights: false, stars: false, sun: '#fff6c9', tint: null,
  },
  sunset: {
    sky: ['#3a2f73', '#ff9d5c'], far: '#5a4a78', farWindows: 'rgba(255,214,120,0.6)',
    stand: '#4d4659', standDark: '#322e3d', roof: '#26222f', seats: ['#958fa6', '#7d7790'],
    tree: '#3a5a3a', treeDark: '#2c472d', road: '#47454f', grass: '#4c7d3e', grassDark: '#426d36',
    lights: true, stars: false, sun: '#ffcf70', tint: 'rgba(255,120,60,0.06)',
  },
  night: {
    sky: ['#03050c', '#1b2445'], far: '#10172b', farWindows: 'rgba(255,214,120,0.85)',
    stand: '#2b303b', standDark: '#1d212a', roof: '#14171d', seats: ['#4a5160', '#3d4350'],
    tree: '#16301c', treeDark: '#10251a', road: '#363941', grass: '#1f4a25', grassDark: '#1a3f20',
    lights: true, stars: true, sun: null, tint: null,
  },
};

// Welk thema hoort bij het huidige uur?
function currentPeriod() {
  const h = new Date().getHours();
  if (h >= 8 && h < 18) return 'day';
  if ((h >= 18 && h < 21) || (h >= 6 && h < 8)) return 'sunset';
  return 'night';
}

// Kleuren voor het publiek op de tribune.
const CROWD = ['#e10600', '#ffd400', '#ffffff', '#1e88e5', '#ff8000', '#00c853', '#f48fb1', '#222222'];

// Teksten op de reclameborden langs de baan: [tekst, achtergrond, tekstkleur]
const BOARDS = [
  ['TINYJS', '#111111', '#ffd400'],
  ['GIT PUSH', '#e10600', '#ffffff'],
  ['NO BUGS', '#0a84ff', '#ffffff'],
  ['TXIKI.JS', '#1c1c1c', '#19d16b'],
];

// =====================================================================
//  OPSTARTEN
// =====================================================================

let ctx = null;
let DPR = 1;
let layers = null;      // vooraf getekende lagen (tiles)
let layersPeriod = '';  // voor welk thema de lagen gemaakt zijn
let garageFade = 0;     // 0 = baan zichtbaar, 1 = garage zichtbaar

// Koppelt het canvas en zorgt voor scherpe pixels op HD-schermen.
function renderInit(canvas) {
  DPR = window.devicePixelRatio || 1;
  canvas.width = TRACK.W * DPR;
  canvas.height = TRACK.H * DPR;
  canvas.style.width = TRACK.W + 'px';
  canvas.style.height = TRACK.H + 'px';
  ctx = canvas.getContext('2d');
  ctx.scale(DPR, DPR);
}

// Willekeurige getallen die ELKE keer hetzelfde zijn (zelfde "seed"),
// zodat de tribunes er na het opnieuw tekenen hetzelfde uitzien.
function seededRandom(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Maakt een onzichtbaar canvas en tekent er 1x iets op (een "tile").
function makeLayer(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = Math.ceil(w * DPR);
  c.height = Math.ceil(h * DPR);
  const g = c.getContext('2d');
  g.scale(DPR, DPR);
  draw(g, w, h);
  return { canvas: c, w, h };
}

// Tekent alle vaste lagen voor een thema.
function buildLayers(p) {
  return {
    sky: makeLayer(TRACK.W, TRACK.ROAD_TOP, (g, w, h) => drawSkyLayer(g, w, h, p)),
    skyline: makeLayer(320, 46, (g, w, h) => drawSkylineLayer(g, w, h, p)),
    stands: makeLayer(300, 66, (g, w, h) => drawStandsLayer(g, w, h, p)),
    boards: makeLayer(360, 30, (g, w, h) => drawBoardsLayer(g, w, h, p)),
    grain: makeLayer(120, 30, (g, w, h) => drawGrainLayer(g, w, h)),
  };
}

// =====================================================================
//  ELKE FRAME TEKENEN
// =====================================================================
function gameDraw(dt) {
  if (!ctx) return;

  // Thema veranderd (bijv. het wordt avond)? Lagen opnieuw tekenen.
  const period = currentPeriod();
  if (period !== layersPeriod) {
    layers = buildLayers(PALETTES[period]);
    layersPeriod = period;
  }
  const p = PALETTES[period];

  // Garage in- of uitfaden (pas als de auto stilstaat in de pits).
  const wantGarage = game.mode === 'pits' && game.speed < 1 ? 1 : 0;
  garageFade += (wantGarage - garageFade) * Math.min(1, dt * 5);

  if (garageFade < 0.99) drawTrackScene(p);
  if (garageFade > 0.01) {
    ctx.globalAlpha = garageFade;
    drawGarageScene();
    ctx.globalAlpha = 1;
  }

  // Confetti (bij een push of als je een GP wint) - over alles heen
  for (const c of game.confetti) {
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(c.rot);
    ctx.fillStyle = c.color;
    ctx.fillRect(-2.5, -1.2, 5, 2.4 * Math.abs(Math.cos(c.rot * 2)) + 0.6);
    ctx.restore();
  }
}

// ---------------------------------------------------------------------
//  DE BAAN
// ---------------------------------------------------------------------
function drawTrackScene(p) {
  const { W, ROAD_TOP: RT, ROAD_BOTTOM: RB } = TRACK;
  const scroll = game.pos * CONFIG.PX_PER_M; // hoeveel pixels de baan gescrold is

  // --- Achtergrond-lagen (verder weg = langzamer) ---
  ctx.drawImage(layers.sky.canvas, 0, 0, layers.sky.w, layers.sky.h);
  drawTiled(layers.skyline, scroll * 0.05, 42);
  drawTiled(layers.stands, scroll * 0.3, 22);
  drawTiled(layers.boards, scroll * 0.9, 72);

  // --- Start/finish-gantry (achter de auto) ---
  const lineAts = [game.pos - save.distance, game.pos - save.distance + CONFIG.LAP_LENGTH];
  for (const at of lineAts) {
    const x = worldToX(at);
    if (x > -40 && x < W + 40) drawGantry(x);
  }

  // --- Asfalt ---
  const road = ctx.createLinearGradient(0, RT, 0, RB);
  road.addColorStop(0, shade(p.road, -12));
  road.addColorStop(1, p.road);
  ctx.fillStyle = road;
  ctx.fillRect(0, RT, W, RB - RT);
  drawTiled(layers.grain, scroll, RT);
  ctx.fillStyle = 'rgba(0,0,0,0.13)'; // donkere "racing line" van rubber
  ctx.fillRect(0, TRACK.GROUND_Y - 8, W, 9);
  ctx.fillStyle = 'rgba(255,255,255,0.85)'; // witte lijn aan de rand
  ctx.fillRect(0, RT + 1, W, 1.5);

  // --- Natte baan (glimt in de regen) ---
  if (game.rain > 0.05) {
    const wet = ctx.createLinearGradient(0, RT, 0, RB);
    wet.addColorStop(0, `rgba(170,190,220,${0.05 * game.rain})`);
    wet.addColorStop(0.5, `rgba(170,190,220,${0.22 * game.rain})`);
    wet.addColorStop(1, `rgba(170,190,220,${0.05 * game.rain})`);
    ctx.fillStyle = wet;
    ctx.fillRect(0, RT + 3, W, RB - RT - 3);
  }

  // --- Finishlijn op het asfalt ---
  for (const at of lineAts) {
    const x = worldToX(at);
    if (x > -20 && x < W + 20) drawFinishStripe(x);
  }

  // --- Kerb (rood-wit) en gras vooraan ---
  const kerbScroll = scroll * 1.05;
  for (let x = -(kerbScroll % 44); x < W; x += 44) {
    ctx.fillStyle = '#e10600';
    ctx.fillRect(x, RB, 22, 5);
    ctx.fillStyle = '#f2f2f2';
    ctx.fillRect(x + 22, RB, 22, 5);
  }
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(0, RB, W, 1);
  ctx.fillStyle = p.grass;
  ctx.fillRect(0, RB + 5, W, TRACK.H - RB - 5);
  ctx.fillStyle = p.grassDark;
  for (let x = -(kerbScroll % 30); x < W; x += 30) ctx.fillRect(x, RB + 5, 15, TRACK.H - RB - 5);

  // --- Coins ---
  for (const c of game.coins) {
    const x = worldToX(c.at);
    if (x > -12 && x < W + 12) drawCoin(ctx, x, TRACK.COIN_Y + Math.sin(game.time * 3 + c.bob) * 2, p.lights);
  }

  // --- Tegenstanders (op de baan achter je, iets kleiner = verder weg) ---
  for (const r of game.rivals) {
    ctx.save();
    ctx.translate(r.x, TRACK.GROUND_Y - 7);
    ctx.scale(0.86, 0.86);
    ctx.filter = 'brightness(0.78)';
    drawCarSide(ctx, 0, 0, r.livery, { wheelAngle: scroll / 9, speed: game.speed, wet: game.rain > 0.3 });
    ctx.restore();
    // Naamkaartje boven de tegenstander (zoals op F1 TV)
    if (r.code) {
      const tx = r.x + 40;
      const ty = TRACK.GROUND_Y - 44;
      ctx.fillStyle = 'rgba(10,11,15,0.85)';
      ctx.fillRect(tx - 14, ty - 6, 28, 11);
      ctx.fillStyle = r.livery.main;
      ctx.fillRect(tx - 14, ty - 6, 2.5, 11);
      ctx.font = `900 italic 8px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fff';
      ctx.fillText(r.code, tx + 1, ty);
    }
  }

  // --- Opspattend water achter de auto (in de regen) ---
  if (game.rain > 0.2 && game.speed > 40) drawSpray();

  // --- ERS-spoor achter de auto ---
  if (ersActive()) drawErsTrail();

  // --- Vonken ---
  for (const s of game.sparks) {
    const a = 1 - s.age / s.life;
    ctx.fillStyle = `rgba(255,${180 + Math.floor(a * 75)},${Math.floor(a * 120)},${a})`;
    ctx.fillRect(s.x, s.y, 2.2, 1.2);
  }

  // --- De auto ---
  const shake = game.speed > 150 ? Math.sin(game.time * 70) * 0.35 : 0;
  drawCarSide(ctx, TRACK.CAR_X, TRACK.GROUND_Y + shake, currentLivery(), {
    wheelAngle: scroll / 10,
    speed: game.speed,
    ers: ersActive(),
    drs: drsActive(),
    wet: game.rain > 0.3,
    time: game.time,
  });

  // --- Snelheidsstrepen ---
  if (game.speed > 140) {
    const a = Math.min(0.4, (game.speed - 140) / 250);
    ctx.fillStyle = `rgba(255,255,255,${a})`;
    for (let i = 0; i < 9; i++) {
      const y = 8 + ((i * 53) % 118);
      const x = W - ((scroll * 2.2 + i * 131) % (W + 80));
      ctx.fillRect(x, y, 18 + game.speed / 8, 1);
    }
  }

  // --- Zwevende "+1" teksten ---
  for (const e of floatTexts) {
    const t = e.age / 1.2;
    ctx.globalAlpha = 1 - t * t;
    drawLabel(e.text, e.x, e.y - t * 20, '#ffd400', 12);
    ctx.globalAlpha = 1;
  }

  // --- Kleurfilter voor het thema (bijv. oranje bij zonsondergang) ---
  if (p.tint) {
    ctx.fillStyle = p.tint;
    ctx.fillRect(0, 0, W, TRACK.H);
  }

  // --- Regen ---
  if (game.rain > 0.02) drawRain(scroll);
}

// Regen: grijze lucht, vallende druppels en af en toe bliksem.
function drawRain(scroll) {
  const { W, H } = TRACK;
  const r = game.rain;
  ctx.fillStyle = `rgba(25,32,48,${0.45 * r})`;
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = `rgba(210,225,250,${0.75 * r})`;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  const drops = Math.floor(140 * r);
  for (let i = 0; i < drops; i++) {
    const speed = 380 + (i % 5) * 40;
    const y = (((i * 61) % (H + 20)) + game.time * speed) % (H + 20) - 10;
    const x = ((((i * 97) - scroll * 0.6 - y * 0.35) % (W + 30)) + W + 30) % (W + 30) - 15;
    ctx.moveTo(x, y);
    ctx.lineTo(x - 3, y + 9);
  }
  ctx.stroke();

  // Bliksem bij zware regen (heel af en toe)
  if (r > 0.75 && Math.sin(game.time * 0.9) > 0.995) {
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(0, 0, W, H);
  }
}

// Water dat achter de banden opspat.
function drawSpray() {
  const a = Math.min(1, game.rain) * Math.min(1, game.speed / 150);
  for (let i = 0; i < 9; i++) {
    const jitter = Math.sin(game.time * 40 + i * 7) * 3;
    const x = TRACK.CAR_X + 10 - i * 7 + jitter;
    const y = TRACK.GROUND_Y - 6 - i * 1.6 + jitter * 0.5;
    const rad = 4 + i * 1.8;
    ctx.fillStyle = `rgba(220,228,240,${0.22 * a * (1 - i / 9)})`;
    ctx.beginPath();
    ctx.arc(x, y, rad, 0, Math.PI * 2);
    ctx.fill();
  }
}

// Wereld-meters -> x-pixel op het scherm.
function worldToX(at) {
  return TRACK.CAR_X + (at - game.pos) * CONFIG.PX_PER_M;
}

// Plakt een laag herhaald naast elkaar, verschoven met `offset` pixels.
function drawTiled(layer, offset, y) {
  const start = -(((offset % layer.w) + layer.w) % layer.w);
  for (let x = start; x < TRACK.W; x += layer.w) {
    ctx.drawImage(layer.canvas, Math.round(x), y, layer.w, layer.h);
  }
}

// Kleur lichter (+) of donkerder (-) maken. Werkt met '#rrggbb'.
function shade(hex, amount) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, (n >> 16) + amount));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amount));
  const b = Math.max(0, Math.min(255, (n & 255) + amount));
  return `rgb(${r},${g},${b})`;
}

// Tekst met een donkere rand (goed leesbaar op elke achtergrond).
function drawLabel(text, x, y, color, size) {
  ctx.font = `900 italic ${size}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(0,0,0,0.8)';
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

// ---------------------------------------------------------------------
//  VASTE LAGEN (worden 1x getekend per thema)
// ---------------------------------------------------------------------

// Lucht met zon of sterren.
function drawSkyLayer(g, w, h, p) {
  const sky = g.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, p.sky[0]);
  sky.addColorStop(1, p.sky[1]);
  g.fillStyle = sky;
  g.fillRect(0, 0, w, h);

  if (p.stars) {
    const rnd = seededRandom(7);
    for (let i = 0; i < 60; i++) {
      g.fillStyle = `rgba(255,255,255,${0.3 + rnd() * 0.7})`;
      g.fillRect(rnd() * w, rnd() * 60, rnd() < 0.15 ? 1.5 : 1, rnd() < 0.15 ? 1.5 : 1);
    }
    // Maan
    g.fillStyle = '#f4f1e1';
    g.beginPath();
    g.arc(290, 16, 7, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = p.sky[0];
    g.beginPath();
    g.arc(293, 14, 6, 0, Math.PI * 2);
    g.fill();
  }
  if (p.sun) {
    const glow = g.createRadialGradient(285, 26, 2, 285, 26, 40);
    glow.addColorStop(0, p.sun);
    glow.addColorStop(0.25, p.sun + 'aa');
    glow.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = glow;
    g.fillRect(230, 0, 110, 70);
  }
}

// Stad in de verte.
function drawSkylineLayer(g, w, h, p) {
  const rnd = seededRandom(3);
  let x = 0;
  while (x < w) {
    const bw = 12 + rnd() * 22;
    const bh = 8 + rnd() * (h - 8);
    g.fillStyle = p.far;
    g.fillRect(x, h - bh, bw - 1, bh);
    // Raampjes
    g.fillStyle = p.farWindows;
    for (let wy = h - bh + 3; wy < h - 2; wy += 4) {
      for (let wx = x + 2; wx < x + bw - 3; wx += 3) {
        if (rnd() < 0.35) g.fillRect(wx, wy, 1.2, 1.4);
      }
    }
    x += bw;
  }
}

// Tribune met publiek, bomen en (bij nacht) lichtmasten.
function drawStandsLayer(g, w, h, p) {
  const rnd = seededRandom(11);
  const S = 60; // x waar de tribune begint (daarvoor staan bomen)

  // Bomen
  for (const [tx, r] of [[10, 9], [26, 12], [44, 8]]) {
    g.fillStyle = '#4a3526';
    g.fillRect(tx - 1, h - 14, 2, 14);
    g.fillStyle = p.treeDark;
    g.beginPath();
    g.arc(tx, h - 14 - r * 0.6, r, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = p.tree;
    g.beginPath();
    g.arc(tx - r * 0.25, h - 16 - r * 0.7, r * 0.75, 0, Math.PI * 2);
    g.fill();
  }

  // Lichtmast (bij nacht en zonsondergang met licht)
  if (p.lights) {
    const lx = 34;
    g.fillStyle = '#20242c';
    g.fillRect(lx - 1, 6, 2, h - 6);
    g.fillStyle = '#fffbe0';
    g.fillRect(lx - 6, 3, 12, 4);
    const glow = g.createRadialGradient(lx, 5, 1, lx, 5, 26);
    glow.addColorStop(0, 'rgba(255,250,215,0.75)');
    glow.addColorStop(1, 'rgba(255,250,215,0)');
    g.fillStyle = glow;
    g.fillRect(lx - 26, 0, 52, 32);
  }

  // Achterwand van de tribune
  g.fillStyle = p.standDark;
  g.fillRect(S, 12, w - S, h - 12);

  // Rijen stoelen met publiek
  for (let row = 0; row < 7; row++) {
    const y = 16 + row * 6.5;
    g.fillStyle = p.seats[row % 2];
    g.fillRect(S + 2, y + 2.5, w - S - 4, 3);
    for (let x = S + 4; x < w - 4; x += 3.2) {
      if (rnd() < 0.78) {
        g.fillStyle = CROWD[Math.floor(rnd() * CROWD.length)];
        g.fillRect(x, y, 2.2, 2.6); // lichaam
        g.fillStyle = '#e0b48f';
        g.fillRect(x + 0.4, y - 1.4, 1.4, 1.4); // hoofd
      }
    }
  }

  // Dak met pilaren
  g.fillStyle = p.roof;
  g.beginPath();
  g.moveTo(S - 4, 8);
  g.lineTo(w, 2);
  g.lineTo(w, 9);
  g.lineTo(S - 4, 14);
  g.closePath();
  g.fill();
  g.fillStyle = shade(p.roof, 25);
  g.fillRect(S - 4, 12, w - S + 4, 1);
  g.fillStyle = p.roof;
  for (let x = S + 8; x < w; x += 58) g.fillRect(x, 10, 2, h - 18);

  // Muur vooraan met vlaggetjes
  g.fillStyle = p.stand;
  g.fillRect(S - 2, h - 8, w - S + 2, 8);
  for (let x = S + 6; x < w - 6; x += 24) {
    g.fillStyle = CROWD[Math.floor(rnd() * 6)];
    g.fillRect(x, h - 6, 8, 4);
  }
}

// Hek (catch fence) met reclameborden eronder.
function drawBoardsLayer(g, w, h, p) {
  // Hekpalen en gaas
  g.strokeStyle = 'rgba(200,205,215,0.35)';
  g.lineWidth = 0.6;
  for (let x = -16; x < w + 16; x += 4) {
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x + 12, 16);
    g.moveTo(x + 12, 0);
    g.lineTo(x, 16);
    g.stroke();
  }
  g.fillStyle = '#6b717c';
  for (let x = 0; x < w; x += 45) g.fillRect(x, 0, 1.5, 16);
  g.fillRect(0, 0, w, 1);

  // Reclameborden
  const bw = w / BOARDS.length;
  BOARDS.forEach(([text, bg, fg], i) => {
    const x = i * bw;
    g.fillStyle = bg;
    g.fillRect(x, 16, bw, 14);
    g.fillStyle = 'rgba(255,255,255,0.12)';
    g.fillRect(x, 16, bw, 1);
    g.fillStyle = 'rgba(0,0,0,0.5)';
    g.fillRect(x + bw - 1, 16, 1, 14);
    g.font = `900 italic 10px ${FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = fg;
    g.fillText(text, x + bw / 2, 23.5);
  });
}

// Korreltjes in het asfalt (zodat je ziet dat de baan beweegt).
function drawGrainLayer(g, w, h) {
  const rnd = seededRandom(21);
  for (let i = 0; i < 140; i++) {
    g.fillStyle = rnd() < 0.5 ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.12)';
    g.fillRect(rnd() * w, 3 + rnd() * (h - 3), 1 + rnd() * 2, 1);
  }
}

// ---------------------------------------------------------------------
//  ONDERDELEN VAN DE BAAN
// ---------------------------------------------------------------------

// Start/finish-brug boven de baan.
function drawGantry(x) {
  ctx.fillStyle = '#3a3f48';
  ctx.fillRect(x - 2, 30, 4, TRACK.ROAD_TOP - 30);
  ctx.fillStyle = '#16181d';
  ctx.fillRect(x - 32, 24, 64, 14);
  // Geblokte rand
  for (let i = 0; i < 16; i++) {
    ctx.fillStyle = i % 2 ? '#fff' : '#111';
    ctx.fillRect(x - 32 + i * 4, 24, 4, 3);
    ctx.fillStyle = i % 2 ? '#111' : '#fff';
    ctx.fillRect(x - 32 + i * 4, 35, 4, 3);
  }
  // Start-lampen
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = '#2a0000';
    ctx.beginPath();
    ctx.arc(x - 16 + i * 8, 31, 2.3, 0, Math.PI * 2);
    ctx.fill();
  }
}

// Geblokte finishlijn op het asfalt (schuin, voor een beetje perspectief).
function drawFinishStripe(x) {
  const size = 4;
  for (let row = 0; row * size < TRACK.ROAD_BOTTOM - TRACK.ROAD_TOP - 2; row++) {
    const y = TRACK.ROAD_TOP + 2 + row * size;
    const skew = (y - TRACK.ROAD_TOP) * 0.35;
    for (let col = 0; col < 3; col++) {
      ctx.fillStyle = (row + col) % 2 ? '#111' : '#f4f4f4';
      ctx.fillRect(x + skew + col * size, y, size, size);
    }
  }
}

// Een gouden coin die ronddraait.
function drawCoin(g, x, y, glow) {
  const spin = Math.abs(Math.sin(game.time * 3.5 + x * 0.04));
  const rx = 1.5 + 5 * spin;
  if (glow) {
    const gl = g.createRadialGradient(x, y, 1, x, y, 13);
    gl.addColorStop(0, 'rgba(255,212,0,0.45)');
    gl.addColorStop(1, 'rgba(255,212,0,0)');
    g.fillStyle = gl;
    g.fillRect(x - 13, y - 13, 26, 26);
  }
  g.fillStyle = 'rgba(0,0,0,0.25)'; // schaduw op de grond
  g.beginPath();
  g.ellipse(x, TRACK.GROUND_Y, 5, 1.5, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#b8860b'; // rand
  g.beginPath();
  g.ellipse(x, y, rx + 0.8, 6.8, 0, 0, Math.PI * 2);
  g.fill();
  const face = g.createLinearGradient(x - rx, y - 6, x + rx, y + 6);
  face.addColorStop(0, '#fff3a0');
  face.addColorStop(0.5, '#ffd400');
  face.addColorStop(1, '#e0a800');
  g.fillStyle = face;
  g.beginPath();
  g.ellipse(x, y, rx, 6, 0, 0, Math.PI * 2);
  g.fill();
  if (rx > 3) {
    g.strokeStyle = 'rgba(160,110,0,0.7)';
    g.lineWidth = 0.8;
    g.beginPath();
    g.ellipse(x, y, rx * 0.6, 3.6, 0, 0, Math.PI * 2);
    g.stroke();
  }
}

// Blauw/paars energiespoor achter de auto als ERS aan staat.
function drawErsTrail() {
  const x = TRACK.CAR_X;
  const y = TRACK.GROUND_Y - 14;
  const trail = ctx.createLinearGradient(x - 60, 0, x + 4, 0);
  trail.addColorStop(0, 'rgba(80,160,255,0)');
  trail.addColorStop(1, 'rgba(120,200,255,0.55)');
  ctx.fillStyle = trail;
  const wobble = Math.sin(game.time * 30) * 1.2;
  ctx.beginPath();
  ctx.moveTo(x + 4, y - 6);
  ctx.lineTo(x - 60, y - 2 + wobble);
  ctx.lineTo(x - 60, y + 2 + wobble);
  ctx.lineTo(x + 4, y + 7);
  ctx.closePath();
  ctx.fill();
}

// =====================================================================
//  DE F1-AUTO (zijaanzicht, rijdt naar rechts)
//  x = achterkant van de auto, gy = grond (onderkant banden)
//  opts: wheelAngle (draaien van de wielen), speed, ers, drs, wet, time, blankets
// =====================================================================
function drawCarSide(g, x, gy, livery, opts = {}) {
  const { wheelAngle = 0, speed = 0, ers = false, drs = false, wet = false, time = 0, blankets = false } = opts;
  g.save();
  g.translate(x, gy);

  // Schaduw
  g.fillStyle = 'rgba(0,0,0,0.4)';
  g.beginPath();
  g.ellipse(50, 1, 50, 3, 0, 0, Math.PI * 2);
  g.fill();

  // Achtervleugel
  g.fillStyle = livery.dark;
  g.beginPath();
  g.moveTo(0, -31); g.lineTo(9, -31); g.lineTo(9, -14); g.lineTo(3, -11); g.lineTo(0, -13);
  g.closePath();
  g.fill();
  // Bovenste flap gaat omhoog als DRS open staat
  g.fillStyle = livery.accent;
  g.fillRect(-2, drs ? -37 : -34, 14, 3);
  g.fillStyle = livery.main;
  g.fillRect(-1, -29, 12, 2.5);
  if (drs) {
    g.font = `900 italic 7px ${FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = '#19d16b';
    g.fillText('DRS', 5, -42);
  }
  g.fillStyle = '#222';
  g.fillRect(5, -27, 2, 14); // pyloon
  // Achterlicht (knippert als ERS aan staat, net als echt)
  const blink = ers && Math.floor(time * 6) % 2 === 0;
  g.fillStyle = blink ? '#ff2a2a' : '#5a0000';
  g.fillRect(-1, -12, 3, 3);
  if (blink) {
    const gl = g.createRadialGradient(0, -10.5, 0.5, 0, -10.5, 9);
    gl.addColorStop(0, 'rgba(255,40,40,0.8)');
    gl.addColorStop(1, 'rgba(255,40,40,0)');
    g.fillStyle = gl;
    g.fillRect(-9, -20, 18, 18);
  }

  // Ophanging (dunne armen naar de wielen)
  g.strokeStyle = '#1b1b1b';
  g.lineWidth = 1.2;
  g.beginPath();
  g.moveTo(26, -15); g.lineTo(19, -11);
  g.moveTo(26, -7); g.lineTo(19, -9);
  g.moveTo(66, -14); g.lineTo(79, -11);
  g.moveTo(66, -7); g.lineTo(79, -9);
  g.stroke();

  // Carrosserie
  const body = new Path2D();
  body.moveTo(5, -9);
  body.lineTo(7, -15);
  body.lineTo(21, -17);
  body.quadraticCurveTo(29, -19, 33, -25);
  body.lineTo(37, -28.5);
  body.lineTo(42, -28.5);
  body.lineTo(44, -22);
  body.lineTo(47, -18);
  body.lineTo(59, -17);
  body.quadraticCurveTo(71, -15, 80, -12);
  body.lineTo(95, -8.5);
  body.quadraticCurveTo(98, -7, 97, -5);
  body.lineTo(70, -5);
  body.lineTo(30, -4);
  body.lineTo(6, -5);
  body.closePath();
  g.fillStyle = livery.main;
  g.fill(body);

  // Glans en schaduw (geeft het een 3D-look)
  g.save();
  g.clip(body);
  const shine = g.createLinearGradient(0, -29, 0, -4);
  shine.addColorStop(0, 'rgba(255,255,255,0.45)');
  shine.addColorStop(0.35, 'rgba(255,255,255,0.05)');
  shine.addColorStop(0.7, 'rgba(0,0,0,0.1)');
  shine.addColorStop(1, 'rgba(0,0,0,0.45)');
  g.fillStyle = shine;
  g.fillRect(0, -30, 100, 27);
  // Sidepod-schaduw en zwarte vloer
  g.fillStyle = livery.dark;
  g.fillRect(0, -7.5, 100, 4);
  g.beginPath();
  g.moveTo(24, -7); g.quadraticCurveTo(30, -14, 44, -14.5); g.lineTo(58, -12); g.lineTo(60, -7);
  g.closePath();
  g.globalAlpha = 0.25;
  g.fill();
  g.globalAlpha = 1;
  // Streep
  g.fillStyle = livery.accent;
  g.beginPath();
  g.moveTo(22, -12.5); g.lineTo(96, -7.5); g.lineTo(96, -6); g.lineTo(22, -10);
  g.closePath();
  g.fill();
  g.restore();

  // Luchthapper boven de coureur
  g.fillStyle = '#0c0c0c';
  g.beginPath();
  g.ellipse(41, -26, 1.6, 2, 0, 0, Math.PI * 2);
  g.fill();

  // Sidepod-inlaat
  g.fillStyle = '#0c0c0c';
  g.beginPath();
  g.moveTo(55, -15); g.lineTo(59, -15.5); g.lineTo(59, -9); g.lineTo(56, -10);
  g.closePath();
  g.fill();

  // Startnummer
  g.font = `900 italic 7.5px ${FONT}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = '#ffffff';
  g.fillText(String(livery.number), 31, -13.5);

  // Helm + vizier
  g.fillStyle = livery.helmet;
  g.beginPath();
  g.arc(50, -21, 4.3, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#111';
  g.fillRect(50.5, -23, 4, 2.2);
  g.fillStyle = 'rgba(255,255,255,0.5)';
  g.fillRect(48, -24.5, 2, 1);

  // Halo (veiligheidsbeugel)
  g.strokeStyle = '#1a1a1a';
  g.lineWidth = 1.8;
  g.beginPath();
  g.moveTo(44, -23.5);
  g.quadraticCurveTo(51, -28, 59, -20.5);
  g.stroke();
  g.lineWidth = 1.4;
  g.beginPath();
  g.moveTo(58, -20.5); g.lineTo(59, -17);
  g.stroke();

  // Spiegel
  g.fillStyle = '#1a1a1a';
  g.fillRect(61, -21, 4, 1.8);
  g.fillRect(62, -19.5, 0.8, 2.5);

  // Wielen (voor de carrosserie, want ze zitten aan jouw kant)
  drawWheel(g, 19, -10, 10, wheelAngle, speed, blankets ? livery : null, wet);
  drawWheel(g, 79, -10, 10, wheelAngle, speed, blankets ? livery : null, wet);

  // Voorvleugel
  g.fillStyle = livery.dark;
  g.beginPath();
  g.moveTo(86, -10); g.lineTo(100, -9); g.lineTo(101, -1.5); g.lineTo(86, -1.5);
  g.closePath();
  g.fill();
  g.fillStyle = livery.accent;
  g.fillRect(87, -5, 14, 1.6);
  g.fillStyle = livery.main;
  g.fillRect(87, -3, 14, 1.4);

  g.restore();
}

// Eén wiel met draaiende velg. blanketLivery = bandenwarmer eromheen (in de garage).
// wet = regenbanden (groene streep in plaats van rood).
function drawWheel(g, cx, cy, r, angle, speed, blanketLivery, wet = false) {
  if (blanketLivery) {
    // Bandenwarmer: een dekentje in teamkleur
    g.fillStyle = blanketLivery.dark;
    g.beginPath();
    g.arc(cx, cy, r + 0.6, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = blanketLivery.main;
    g.beginPath();
    g.arc(cx, cy, r - 1.5, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#fff';
    g.font = `900 italic 5px ${FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('F1', cx, cy);
    return;
  }
  // Band
  g.fillStyle = '#121212';
  g.beginPath();
  g.arc(cx, cy, r, 0, Math.PI * 2);
  g.fill();
  // Gekleurde streep op de band (rood = soft, groen = regenband)
  g.strokeStyle = wet ? '#19d16b' : '#e10600';
  g.lineWidth = 1;
  g.beginPath();
  g.arc(cx, cy, r - 2.3, 0, Math.PI * 2);
  g.stroke();
  // Velg
  const rim = g.createRadialGradient(cx - 1, cy - 1, 0.5, cx, cy, r - 3);
  rim.addColorStop(0, '#9aa0a8');
  rim.addColorStop(1, '#2b2e33');
  g.fillStyle = rim;
  g.beginPath();
  g.arc(cx, cy, r - 3.2, 0, Math.PI * 2);
  g.fill();
  // Spaken (worden wazig bij hoge snelheid)
  g.strokeStyle = `rgba(30,30,30,${speed > 120 ? 0.25 : 0.85})`;
  g.lineWidth = 1.2;
  for (let i = 0; i < 5; i++) {
    const a = angle + (i * Math.PI * 2) / 5;
    g.beginPath();
    g.moveTo(cx, cy);
    g.lineTo(cx + Math.cos(a) * (r - 3.5), cy + Math.sin(a) * (r - 3.5));
    g.stroke();
  }
  if (speed > 120) {
    g.strokeStyle = 'rgba(200,200,210,0.25)';
    g.lineWidth = 2;
    g.beginPath();
    g.arc(cx, cy, r - 5, 0, Math.PI * 2);
    g.stroke();
  }
  // Wielmoer
  g.fillStyle = '#d0d0d0';
  g.beginPath();
  g.arc(cx, cy, 1.4, 0, Math.PI * 2);
  g.fill();
}

// =====================================================================
//  DE GARAGE (als je in de pits staat)
// =====================================================================
function drawGarageScene() {
  const { W, H } = TRACK;
  const floorY = TRACK.GROUND_Y;
  const livery = currentLivery();

  // Achterwand
  const wall = ctx.createLinearGradient(0, 0, 0, floorY);
  wall.addColorStop(0, '#1d2028');
  wall.addColorStop(1, '#2c303a');
  ctx.fillStyle = wall;
  ctx.fillRect(0, 0, W, floorY);
  ctx.fillStyle = 'rgba(255,255,255,0.04)';
  for (let x = 0; x < W; x += 43) ctx.fillRect(x, 0, 1, floorY);

  // Plafondlampen met lichtbundels
  for (const lx of [70, 172, 274]) {
    ctx.fillStyle = '#f5f7ff';
    ctx.fillRect(lx - 18, 2, 36, 3);
    const beam = ctx.createLinearGradient(0, 5, 0, floorY);
    beam.addColorStop(0, 'rgba(235,240,255,0.18)');
    beam.addColorStop(1, 'rgba(235,240,255,0)');
    ctx.fillStyle = beam;
    ctx.beginPath();
    ctx.moveTo(lx - 18, 5); ctx.lineTo(lx + 18, 5); ctx.lineTo(lx + 45, floorY); ctx.lineTo(lx - 45, floorY);
    ctx.closePath();
    ctx.fill();
  }

  // Teamstreep met naam
  ctx.fillStyle = livery.main;
  ctx.fillRect(0, 20, W, 12);
  ctx.fillStyle = livery.accent;
  ctx.fillRect(0, 32, W, 2);
  ctx.font = `900 italic 9px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fff';
  ctx.fillText('F1 CODING RACING  ·  PIT GARAGE', 10, 26.5);

  // Scherm aan de muur met de app waar je nu in zit
  ctx.fillStyle = '#0a0b0e';
  ctx.fillRect(112, 40, 120, 44);
  ctx.fillStyle = '#121826';
  ctx.fillRect(114, 42, 116, 40);
  ctx.font = `700 7px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ff9f1a';
  ctx.fillText('COUREUR IS IN', 172, 50);
  ctx.font = `900 italic 12px ${FONT}`;
  ctx.fillStyle = '#fff';
  const name = (game.appName || '...').toUpperCase();
  ctx.fillText(name.length > 16 ? name.slice(0, 15) + '…' : name, 172, 62);
  ctx.font = `600 7px ${FONT}`;
  ctx.fillStyle = Math.floor(game.time * 1.5) % 2 ? '#8a92a6' : '#19d16b'; // knippert
  ctx.fillText('ga terug naar je code om te racen', 172, 75);

  // Bandenstapels
  drawTyreStack(18, floorY, 4, '#e10600');
  drawTyreStack(40, floorY, 3, '#ffd400');
  drawTyreStack(318, floorY, 4, '#f2f2f2');

  // Gereedschapskast
  ctx.fillStyle = '#b3120d';
  ctx.fillRect(270, floorY - 36, 30, 36);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  for (let i = 0; i < 4; i++) ctx.fillRect(272, floorY - 33 + i * 8.5, 26, 1);
  ctx.fillStyle = '#ddd';
  for (let i = 0; i < 4; i++) ctx.fillRect(282, floorY - 30 + i * 8.5, 6, 1.2);

  // Vloer (glanzend) met gele pitbox-lijnen
  const floor = ctx.createLinearGradient(0, floorY, 0, H);
  floor.addColorStop(0, '#3a3e48');
  floor.addColorStop(1, '#22252c');
  ctx.fillStyle = floor;
  ctx.fillRect(0, floorY, W, H - floorY);
  ctx.fillStyle = '#e6b800';
  ctx.fillRect(0, floorY + 3, W, 1.5);
  ctx.fillRect(110, floorY, 2, H - floorY);
  ctx.fillRect(250, floorY, 2, H - floorY);

  // De auto (een beetje omhoog op de krik, met bandenwarmers)
  const bob = Math.sin(game.time * 2) * 0.3;
  drawCarSide(ctx, 122, floorY - 1 + bob, livery, { blankets: true });
}

// Stapel banden.
function drawTyreStack(x, floorY, count, stripe) {
  for (let i = 0; i < count; i++) {
    const y = floorY - (i + 1) * 7;
    ctx.fillStyle = '#141414';
    ctx.beginPath();
    ctx.roundRect(x - 10, y, 20, 7, 2.5);
    ctx.fill();
    ctx.fillStyle = stripe;
    ctx.fillRect(x - 8, y + 3, 16, 1);
  }
}
