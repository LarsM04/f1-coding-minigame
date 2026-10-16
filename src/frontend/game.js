// =====================================================================
//  GAME: de race-logica (natuurkunde) en het tekenen op het <canvas>
//
//  Zo werkt de game:
//   - Je zit in een coding-app (zie src/backend/coding-apps.js)
//       -> modus RACE: elke toetsaanslag geeft je auto gas.
//   - Je zit in een andere app (Brave, Discord...)
//       -> modus PITS: je auto staat stil in de pits.
//   - Rijden = afstand. Elke ronde (LAP_LENGTH meter) = coins.
//   - Onderweg liggen coins op de baan die je auto oppakt.
// =====================================================================

// ---------------------------------------------------------------------
//  CONFIG - hier kun je de game makkelijk balanceren
// ---------------------------------------------------------------------
const CONFIG = {
  LAP_LENGTH: 1500,           // meter per ronde
  PX_PER_M: 2.4,              // hoeveel pixels 1 meter is op het scherm

  BASE_MAX_SPEED: 300,        // topsnelheid in km/u (zonder upgrades)
  MAX_SPEED_PER_ENGINE: 15,   // + km/u topsnelheid per Motor-level
  BASE_BOOST: 16,             // km/u erbij per toetsaanslag
  BOOST_PER_ENGINE: 3,        // + km/u boost per Motor-level

  BASE_DECAY: 0.35,           // hoe snel je afremt (deel van je snelheid per seconde)
  AERO_DECAY_FACTOR: 0.88,    // elke Aero-level vermenigvuldigt de afremming hiermee
  FRICTION: 4,                // vaste afremming in km/u per seconde
  PIT_DECAY: 2.5,             // hoe hard je remt als je de pits in gaat

  DRS_THRESHOLD: 0.85,        // DRS gaat aan boven 85% van je topsnelheid
  DRS_BONUS: 1.2,             // met DRS rij je 20% meer afstand

  LAP_COINS: 10,              // coins per ronde
  COIN_VALUE: 1,              // coins per opgepakte coin op de baan
  COIN_GAP_MIN: 120,          // minimale afstand (m) tussen coins op de baan
  COIN_GAP_MAX: 260,          // maximale afstand (m) tussen coins op de baan
  RADAR_GAP_FACTOR: 0.9,      // elke Coin-radar-level maakt de afstand kleiner
};

// Afmetingen van de baan op het canvas (in CSS-pixels).
const TRACK = {
  W: 344,
  H: 120,
  ASPHALT_TOP: 20,
  ASPHALT_BOTTOM: 100,
  CAR_X: 70,           // x-positie van de achterkant van de auto
  CAR_LEN: 58,         // lengte van de auto
};

// ---------------------------------------------------------------------
//  GAME STATE - alles wat tijdens het spelen verandert
//  (wat bewaard moet blijven staat in `save`, zie progress.js)
// ---------------------------------------------------------------------
const game = {
  mode: 'pits',        // 'race' of 'pits'
  appName: '',         // naam van de actieve app
  speed: 0,            // huidige snelheid in km/u
  pos: 0,              // positie op de wereld in meters (voor het scrollen)
  carY: 60,            // y-positie van de auto (stuurt naar coins toe)
  coins: [],           // coins op de baan: { at: meters, y: pixels }
  nextCoinAt: 80,      // waar de volgende coin komt te liggen
  effects: [],         // tekst-effecten op het canvas (bijv. "+1")
  lastKeyTime: 0,      // tijdstip van de laatste toetsaanslag
  time: 0,             // tijd in seconden sinds start (voor animaties)

  // Callbacks die app.js invult (om de UI bij te werken):
  onCoin: null,        // (gekregenCoins) => {}
  onLap: null,         // (rondeNummer, gekregenCoins) => {}
};

// ---------------------------------------------------------------------
//  UPGRADE-EFFECTEN - hier worden de upgrades uit progress.js gebruikt
// ---------------------------------------------------------------------
function maxSpeed() {
  return CONFIG.BASE_MAX_SPEED + CONFIG.MAX_SPEED_PER_ENGINE * save.upgrades.engine;
}
function boostPerKey() {
  return CONFIG.BASE_BOOST + CONFIG.BOOST_PER_ENGINE * save.upgrades.engine;
}
function decayRate() {
  return CONFIG.BASE_DECAY * Math.pow(CONFIG.AERO_DECAY_FACTOR, save.upgrades.aero);
}
function coinGap() {
  const g = CONFIG.COIN_GAP_MIN + Math.random() * (CONFIG.COIN_GAP_MAX - CONFIG.COIN_GAP_MIN);
  return g * Math.pow(CONFIG.RADAR_GAP_FACTOR, save.upgrades.radar);
}
function drsActive() {
  return game.mode === 'race' && game.speed >= maxSpeed() * CONFIG.DRS_THRESHOLD;
}

// ---------------------------------------------------------------------
//  INPUT - wordt aangeroepen vanuit app.js
// ---------------------------------------------------------------------

// n toetsaanslagen binnengekomen van de backend.
function gameOnKeys(n) {
  if (game.mode !== 'race') return; // in de pits telt typen niet
  save.totalKeys += n;
  game.speed = Math.min(maxSpeed(), game.speed + n * boostPerKey());
  game.lastKeyTime = game.time;
  saveDirty = true;
}

// De actieve app is veranderd.
function gameSetApp(name, coding) {
  game.appName = name;
  game.mode = coding ? 'race' : 'pits';
}

// ---------------------------------------------------------------------
//  UPDATE - elke frame: snelheid, afstand, coins en rondes
//  dt = tijd sinds vorige frame in seconden
// ---------------------------------------------------------------------
function gameUpdate(dt) {
  game.time += dt;

  // --- 1. Snelheid afremmen ---
  if (game.mode === 'race') {
    game.speed -= (game.speed * decayRate() + CONFIG.FRICTION) * dt;
  } else {
    game.speed -= (game.speed * CONFIG.PIT_DECAY + CONFIG.FRICTION * 5) * dt;
  }
  if (game.speed < 0) game.speed = 0;
  if (game.speed > save.bestSpeed) save.bestSpeed = Math.round(game.speed);

  // --- 2. Afstand rijden (km/u -> m/s = delen door 3.6) ---
  let meters = (game.speed / 3.6) * dt;
  if (drsActive()) meters *= CONFIG.DRS_BONUS;
  game.pos += meters;
  save.distance += meters;
  save.totalDistance += meters;

  // --- 3. Ronde voltooid? ---
  while (save.distance >= CONFIG.LAP_LENGTH) {
    save.distance -= CONFIG.LAP_LENGTH;
    save.laps += 1;
    const gained = addCoins(CONFIG.LAP_COINS);
    addEffect(`RONDE ${save.laps}!  +${fmtCoins(gained)} 🪙`, TRACK.W / 2, 40, '#ffd400', 2.2, true);
    if (game.onLap) game.onLap(save.laps, gained);
  }

  // --- 4. Nieuwe coins op de baan leggen (net buiten beeld rechts) ---
  const visibleAhead = TRACK.W / CONFIG.PX_PER_M;
  if (game.nextCoinAt < game.pos) game.nextCoinAt = game.pos + 40;
  while (game.nextCoinAt < game.pos + visibleAhead) {
    const y = TRACK.ASPHALT_TOP + 14 + Math.random() * (TRACK.ASPHALT_BOTTOM - TRACK.ASPHALT_TOP - 28);
    game.coins.push({ at: game.nextCoinAt, y });
    game.nextCoinAt += coinGap();
  }

  // --- 5. Coins oppakken (als de neus van de auto erbij is) ---
  const noseAt = game.pos + TRACK.CAR_LEN / CONFIG.PX_PER_M;
  game.coins = game.coins.filter((c) => {
    if (c.at > noseAt) return true; // nog niet bereikt
    const gained = addCoins(CONFIG.COIN_VALUE);
    addEffect(`+${fmtCoins(gained)}`, TRACK.CAR_X + TRACK.CAR_LEN, c.y - 6, '#ffd400', 0.9, false);
    if (game.onCoin) game.onCoin(gained);
    return false;
  });

  // --- 6. Auto stuurt richting de volgende coin ---
  const next = game.coins.find((c) => c.at > noseAt && c.at - noseAt < 90);
  const targetY = next ? next.y : (TRACK.ASPHALT_TOP + TRACK.ASPHALT_BOTTOM) / 2;
  const steer = Math.min(1, dt * (1.5 + game.speed / 60));
  game.carY += (targetY - game.carY) * steer;

  // --- 7. Effecten ouder maken en oude weghalen ---
  for (const e of game.effects) e.age += dt;
  game.effects = game.effects.filter((e) => e.age < e.life);
}

// Coins netjes tonen: hele getallen, of 1 decimaal als het een kommagetal is.
function fmtCoins(n) {
  return Number.isInteger(Math.round(n * 10) / 10) ? String(Math.round(n)) : n.toFixed(1);
}

// Voegt een tekst-effect toe op het canvas.
function addEffect(text, x, y, color, life, big) {
  game.effects.push({ text, x, y, color, life, big, age: 0 });
}

// =====================================================================
//  TEKENEN
// =====================================================================

let ctx = null;

// Koppelt het canvas en zorgt voor scherpe pixels op HD-schermen.
function gameInitCanvas(canvas) {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = TRACK.W * dpr;
  canvas.height = TRACK.H * dpr;
  canvas.style.width = TRACK.W + 'px';
  canvas.style.height = TRACK.H + 'px';
  ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
}

// Wereld-meters -> x-pixel op het scherm.
function worldToX(at) {
  return TRACK.CAR_X + (at - game.pos) * CONFIG.PX_PER_M;
}

// Tekent één frame.
function gameDraw() {
  if (!ctx) return;
  const { W, H, ASPHALT_TOP: AT, ASPHALT_BOTTOM: AB } = TRACK;
  const scroll = game.pos * CONFIG.PX_PER_M; // hoeveel pixels de baan gescrold is

  // --- Gras ---
  ctx.fillStyle = '#2f8a3a';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#287a32'; // donkere grasstrepen
  for (let x = -(scroll % 40); x < W; x += 40) {
    ctx.fillRect(x, 0, 20, AT - 6);
    ctx.fillRect(x + 10, AB + 6, 20, H - AB - 6);
  }

  // --- Asfalt ---
  ctx.fillStyle = '#3b3f47';
  ctx.fillRect(0, AT, W, AB - AT);

  // --- Kerbs (rood-witte randen) ---
  for (let x = -(scroll % 32); x < W; x += 32) {
    ctx.fillStyle = '#e10600';
    ctx.fillRect(x, AT - 6, 16, 6);
    ctx.fillRect(x + 16, AB, 16, 6);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x + 16, AT - 6, 16, 6);
    ctx.fillRect(x, AB, 16, 6);
  }

  // --- Middenstreep ---
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  const mid = (AT + AB) / 2;
  for (let x = -(scroll % 44); x < W; x += 44) ctx.fillRect(x, mid - 1, 24, 2);

  // --- Start/finish-lijn (geblokt) ---
  const lineAts = [
    game.pos - save.distance,                       // de lijn die we net passeerden
    game.pos - save.distance + CONFIG.LAP_LENGTH,   // de volgende lijn
  ];
  for (const at of lineAts) {
    const x = worldToX(at);
    if (x > -20 && x < W + 20) drawFinishLine(x);
  }

  // --- Snelheidsstrepen (bij hoge snelheid) ---
  if (game.speed > 120) {
    const alpha = Math.min(0.35, (game.speed - 120) / 400);
    ctx.fillStyle = `rgba(255,255,255,${alpha})`;
    for (let i = 0; i < 7; i++) {
      const y = AT + 6 + ((i * 37) % (AB - AT - 12));
      const x = W - ((scroll * 1.8 + i * 97) % (W + 60));
      ctx.fillRect(x, y, 20 + game.speed / 10, 1);
    }
  }

  // --- Coins op de baan ---
  for (const c of game.coins) {
    const x = worldToX(c.at);
    if (x > -10 && x < W + 10) drawCoin(x, c.y);
  }

  // --- De auto ---
  drawCar(TRACK.CAR_X, game.carY, currentLivery());

  // --- Overlay: pits of "begin met typen" ---
  if (game.mode === 'pits') {
    ctx.fillStyle = 'rgba(8,10,18,0.62)';
    ctx.fillRect(0, 0, W, H);
    drawText('🔧 IN DE PITS', W / 2, H / 2 - 8, '#ff9f1a', 18, true);
    drawText('Ga terug naar je code om te racen', W / 2, H / 2 + 14, '#d6d9e0', 11, false);
  } else if (game.speed < 1 && game.time - game.lastKeyTime > 2) {
    drawText('⌨️ Typ om gas te geven!', W / 2, 14, '#ffffff', 11, true);
  }

  // --- Tekst-effecten (+1, RONDE X!) ---
  for (const e of game.effects) {
    const p = e.age / e.life;
    ctx.globalAlpha = 1 - p * p;
    const y = e.big ? e.y : e.y - p * 18; // kleine effecten zweven omhoog
    drawText(e.text, e.x, y, e.color, e.big ? 16 : 11, true);
    ctx.globalAlpha = 1;
  }
}

// Tekst met een donkere rand (goed leesbaar op elke achtergrond).
function drawText(text, x, y, color, size, bold) {
  ctx.font = `${bold ? '800 italic ' : '600 '}${size}px "Segoe UI", system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(0,0,0,0.75)';
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

// Geblokte start/finish-lijn.
function drawFinishLine(x) {
  const { ASPHALT_TOP: AT, ASPHALT_BOTTOM: AB } = TRACK;
  const size = 5;
  for (let row = 0; row * size < AB - AT; row++) {
    for (let col = 0; col < 2; col++) {
      ctx.fillStyle = (row + col) % 2 ? '#111' : '#fff';
      ctx.fillRect(x + col * size, AT + row * size, size, size);
    }
  }
}

// Een gouden coin die een beetje "draait".
function drawCoin(x, y) {
  const spin = Math.abs(Math.sin(game.time * 4 + x * 0.05)); // 0..1, voor het draai-effect
  const rx = 2 + 4 * spin;
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(x + 2, y + 3, rx, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffd400';
  ctx.beginPath();
  ctx.ellipse(x, y, rx, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffef80';
  ctx.beginPath();
  ctx.ellipse(x - rx * 0.3, y - 1.5, rx * 0.35, 2.5, 0, 0, Math.PI * 2);
  ctx.fill();
}

// De F1-auto, van bovenaf gezien, rijdend naar rechts.
// x = achterkant van de auto, y = midden van de auto.
function drawCar(x, y, livery) {
  // Een klein beetje trillen bij hoge snelheid
  const shake = game.speed > 200 ? Math.sin(game.time * 60) * 0.4 : 0;
  y += shake;

  // Schaduw
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(x + 30, y + 3, 30, 14, 0, 0, Math.PI * 2);
  ctx.fill();

  // Banden (met een draaiend streepje)
  const wheelSpin = (game.pos * 6) % 11;
  const wheels = [
    [x + 7, y - 16, 13, 7], [x + 7, y + 9, 13, 7],   // achter
    [x + 40, y - 15, 11, 6], [x + 40, y + 9, 11, 6], // voor
  ];
  for (const [wx, wy, ww, wh] of wheels) {
    ctx.fillStyle = '#121212';
    ctx.fillRect(wx, wy, ww, wh);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(wx + (wheelSpin % ww), wy, 1.5, wh);
  }

  // Ophanging (dunne lijntjes naar de wielen)
  ctx.strokeStyle = '#222';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x + 13, y - 9); ctx.lineTo(x + 18, y - 4);
  ctx.moveTo(x + 13, y + 9); ctx.lineTo(x + 18, y + 4);
  ctx.moveTo(x + 45, y - 9); ctx.lineTo(x + 42, y - 3);
  ctx.moveTo(x + 45, y + 9); ctx.lineTo(x + 42, y + 3);
  ctx.stroke();

  // Carrosserie
  ctx.fillStyle = livery.main;
  ctx.beginPath();
  ctx.moveTo(x + 5, y - 5);
  ctx.lineTo(x + 20, y - 9);
  ctx.lineTo(x + 34, y - 9);
  ctx.lineTo(x + 40, y - 4);
  ctx.lineTo(x + 54, y - 2.5);
  ctx.lineTo(x + 54, y + 2.5);
  ctx.lineTo(x + 40, y + 4);
  ctx.lineTo(x + 34, y + 9);
  ctx.lineTo(x + 20, y + 9);
  ctx.lineTo(x + 5, y + 5);
  ctx.closePath();
  ctx.fill();

  // Streep over de auto
  ctx.fillStyle = livery.accent;
  ctx.fillRect(x + 12, y - 1.2, 41, 2.4);

  // Achtervleugel (bij DRS gaat de flap open = streepje in het midden)
  ctx.fillStyle = livery.accent;
  ctx.fillRect(x, y - 12, 5, 24);
  if (drsActive()) {
    ctx.fillStyle = '#00ff88';
    ctx.fillRect(x + 2, y - 11, 1, 22);
  }

  // Cockpit + helm
  ctx.fillStyle = '#0d0d0d';
  ctx.beginPath();
  ctx.ellipse(x + 29, y, 6, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = livery.helmet;
  ctx.beginPath();
  ctx.arc(x + 28, y, 2.8, 0, Math.PI * 2);
  ctx.fill();

  // Voorvleugel
  ctx.fillStyle = livery.accent;
  ctx.fillRect(x + 53, y - 13, 4, 26);
  ctx.fillStyle = livery.main;
  ctx.fillRect(x + 53, y - 13, 4, 3);
  ctx.fillRect(x + 53, y + 10, 4, 3);

  // Uitlaatvlammetje als je net getypt hebt
  if (game.mode === 'race' && game.time - game.lastKeyTime < 0.15 && game.speed > 30) {
    ctx.fillStyle = Math.random() < 0.5 ? '#ffb300' : '#ff5a00';
    ctx.beginPath();
    ctx.moveTo(x - 1, y - 2);
    ctx.lineTo(x - 7 - Math.random() * 5, y);
    ctx.lineTo(x - 1, y + 2);
    ctx.fill();
  }
}
