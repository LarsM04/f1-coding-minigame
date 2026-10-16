// =====================================================================
//  GAME: de race-logica (geen tekenwerk, dat zit in render.js)
//
//  Zo werkt de game:
//   - Je zit in een coding-app (zie src/backend/coding-apps.js)
//       -> modus RACE.
//   - BRANDSTOF (= denktijd): elke toets vult je tank weer helemaal.
//     Zolang er brandstof is rijdt je auto op kruissnelheid, ook als je
//     even niet typt (nadenken over je code telt ook!).
//     Typ je een minuut niks, dan valt je auto stil.
//   - ERS: typen laadt je batterij op. Een volle batterij = extra boost.
//   - STREAK: hoe langer je achter elkaar codeert, hoe meer coins (max ×2).
//   - Andere app (Brave, Discord...) -> modus PITS: auto staat in de garage.
//   - Elke ronde = coins. Onderweg liggen ook coins op de baan.
//   - DRS (na F5) en INHALEN van tegenstanders (na commit/push) worden
//     hier uitgevoerd; WANNEER dat gebeurt staat in career.js.
// =====================================================================

// ---------------------------------------------------------------------
//  CONFIG - hier kun je de game makkelijk balanceren
// ---------------------------------------------------------------------
const CONFIG = {
  LAP_LENGTH: 1500,           // meter per ronde (±30 sec per ronde aan het begin)
  PX_PER_M: 3,                // hoeveel pixels 1 meter is op het scherm

  BASE_CRUISE: 180,           // kruissnelheid in km/u (zonder upgrades)
  CRUISE_PER_ENGINE: 12,      // + km/u per Motor-level
  ACCEL: 70,                  // optrekken in km/u per seconde
  BRAKE: 110,                 // afremmen als je brandstof op is
  PIT_BRAKE: 240,             // hard remmen als je de pits in gaat

  BASE_THINK_TIME: 60,        // seconden denktijd (brandstof) na je laatste toets
  THINK_PER_FUEL: 20,         // + seconden per Brandstoftank-level

  ERS_PER_KEY: 2.5,           // % batterij per toetsaanslag
  ERS_PER_KEY_LEVEL: 0.4,     // + % per toets per ERS-level
  ERS_DRAIN: 5,               // % batterij die per seconde verbruikt wordt
  ERS_BOOST: 30,              // + km/u als ERS aan staat
  ERS_BOOST_PER_LEVEL: 6,     // + km/u boost per ERS-level

  DRS_BOOST: 35,              // + km/u als DRS open staat (na F5)

  RAIN_DELAY: 20,             // seconden errors voordat het gaat regenen
  RAIN_SPEED_FACTOR: 0.85,    // in de regen rijd je 15% langzamer

  STREAK_STEP: 0.1,          // streak gaat elke minuut met dit omhoog...
  STREAK_MAX: 2,              // ...tot maximaal ×2
  STREAK_GRACE: 60,           // seconden stilstand/pits voordat je streak weg is

  LAP_COINS: 5,               // coins per ronde
  COIN_VALUE: 1,              // coins per opgepakte coin op de baan
  COIN_GAP_MIN: 250,          // minimale afstand (m) tussen coins op de baan
  COIN_GAP_MAX: 450,          // maximale afstand (m) tussen coins op de baan
  RADAR_GAP_FACTOR: 0.88,     // elke Coin-radar-level maakt de afstand kleiner
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
  fuel: 0,             // seconden brandstof (denktijd) over
  ers: 0,              // ERS-batterij 0..100 %
  streak: 1,           // coin-multiplier door lang achter elkaar coderen
  activeTime: 0,       // seconden achter elkaar actief aan het coderen
  idleTime: 0,         // seconden NIET aan het rijden (voor het resetten van je streak)
  lapTime: 0,          // tijd van de huidige ronde in seconden
  lapTimeValid: false, // false = deze ronde telt niet voor "beste ronde" (bijv. na opstarten)
  wasDriving: false,   // reed de auto vorige frame? (voor "lights out")
  coins: [],           // coins op de baan: { at: meters, bob: fase voor het zweven }
  nextCoinAt: 100,     // waar de volgende coin komt te liggen
  sparks: [],          // vonken onder de auto bij hoge snelheid
  drsTime: 0,          // seconden DRS over (na F5, zie career.js)
  rivals: [],          // tegenstanders die je aan het inhalen bent: { x, livery, passed }
  overtakeQueue: 0,    // hoeveel inhaalacties er nog komen
  nextRivalAt: 0,      // tijdstip waarop de volgende tegenstander mag verschijnen
  confetti: [],        // confetti-deeltjes (bij push en winst)
  errors: 0,           // aantal errors in VS Code (van de extensie)
  errorsSince: null,   // sinds wanneer er errors zijn
  raining: false,      // regent het? (na RAIN_DELAY seconden errors)
  rain: 0,             // hoe hard het regent 0..1 (voor de graphics, gaat geleidelijk)
  lastKeyTime: -99,    // tijdstip van de laatste toetsaanslag
  time: 0,             // tijd in seconden sinds start (voor animaties)

  // Callbacks die app.js invult (om de UI bij te werken):
  onCoin: null,        // (gekregenCoins) => {}
  onLap: null,         // ({ lap, gained, lapTime, best }) => {}
  onStreak: null,      // (streak) => {}
  onLightsOut: null,   // () => {}   auto vertrekt weer
};

// ---------------------------------------------------------------------
//  UPGRADE-EFFECTEN - hier worden de upgrades uit progress.js gebruikt
// ---------------------------------------------------------------------
function cruiseSpeed() {
  return CONFIG.BASE_CRUISE + CONFIG.CRUISE_PER_ENGINE * save.upgrades.engine;
}
function thinkTime() {
  return CONFIG.BASE_THINK_TIME + CONFIG.THINK_PER_FUEL * save.upgrades.fuel;
}
function ersPerKey() {
  return CONFIG.ERS_PER_KEY + CONFIG.ERS_PER_KEY_LEVEL * save.upgrades.ers;
}
function ersBoost() {
  return CONFIG.ERS_BOOST + CONFIG.ERS_BOOST_PER_LEVEL * save.upgrades.ers;
}
function coinGap() {
  const g = CONFIG.COIN_GAP_MIN + Math.random() * (CONFIG.COIN_GAP_MAX - CONFIG.COIN_GAP_MIN);
  return g * Math.pow(CONFIG.RADAR_GAP_FACTOR, save.upgrades.radar);
}

// Rijdt de auto nu? (in een coding-app EN nog brandstof)
function isDriving() {
  return game.mode === 'race' && game.fuel > 0;
}
// Staat de ERS-boost aan?
function ersActive() {
  return isDriving() && game.ers > 0;
}
// Staat DRS open? (na F5)
function drsActive() {
  return isDriving() && game.drsTime > 0;
}

// ---------------------------------------------------------------------
//  INPUT - wordt aangeroepen vanuit app.js
// ---------------------------------------------------------------------

// n toetsaanslagen binnengekomen van de backend.
function gameOnKeys(n) {
  if (game.mode !== 'race') return; // in de pits telt typen niet
  save.totalKeys += n;
  game.fuel = thinkTime();                              // tank weer vol
  game.ers = Math.min(100, game.ers + n * ersPerKey()); // batterij opladen
  game.lastKeyTime = game.time;
  saveDirty = true;
}

// De actieve app is veranderd.
function gameSetApp(name, coding) {
  game.appName = name;
  game.mode = coding ? 'race' : 'pits';
}

// ---------------------------------------------------------------------
//  UPDATE - elke frame: snelheid, afstand, coins, rondes en streak
//  dt = tijd sinds vorige frame in seconden
// ---------------------------------------------------------------------
function gameUpdate(dt) {
  game.time += dt;
  game.fuel = Math.max(0, game.fuel - dt);
  const driving = isDriving();

  // --- 1. Lights out: auto vertrekt (weer) ---
  if (driving && !game.wasDriving && game.speed < 5 && game.onLightsOut) game.onLightsOut();
  game.wasDriving = driving;

  // --- 2. Snelheid naar de doelsnelheid brengen ---
  game.drsTime = Math.max(0, game.drsTime - dt);
  let target = 0;
  if (driving) {
    target = cruiseSpeed();
    if (game.ers > 0) target += ersBoost();
    if (game.drsTime > 0) target += CONFIG.DRS_BOOST;
    if (game.rain > 0.3) target *= CONFIG.RAIN_SPEED_FACTOR; // regenbanden
  }
  if (game.speed < target) {
    game.speed = Math.min(target, game.speed + CONFIG.ACCEL * dt);
  } else {
    const brake = game.mode === 'pits' ? CONFIG.PIT_BRAKE : CONFIG.BRAKE;
    game.speed = Math.max(target, game.speed - brake * dt);
  }
  if (game.speed > save.bestSpeed) save.bestSpeed = Math.round(game.speed);

  // --- 3. ERS-batterij verbruiken ---
  if (driving && game.ers > 0) game.ers = Math.max(0, game.ers - CONFIG.ERS_DRAIN * dt);

  // --- 4. Streak (langer achter elkaar coderen = meer coins) ---
  if (driving) {
    game.activeTime += dt;
    game.idleTime = 0;
    save.codingSeconds += dt;
  } else {
    game.idleTime += dt;
    if (game.idleTime > CONFIG.STREAK_GRACE) game.activeTime = 0;
  }
  const minutes = Math.floor(game.activeTime / 60);
  const newStreak = Math.min(CONFIG.STREAK_MAX, 1 + minutes * CONFIG.STREAK_STEP);
  if (Math.abs(newStreak - game.streak) > 0.001) {
    const up = newStreak > game.streak;
    game.streak = Math.round(newStreak * 10) / 10;
    if (game.streak > save.bestStreak) save.bestStreak = game.streak;
    if (up && game.onStreak) game.onStreak(game.streak);
  }

  // --- 5. Afstand rijden (km/u -> m/s = delen door 3.6) ---
  const meters = (game.speed / 3.6) * dt;
  game.pos += meters;
  save.distance += meters;
  save.totalDistance += meters;
  if (game.speed > 0) game.lapTime += dt;

  // --- 6. Ronde voltooid? ---
  while (save.distance >= CONFIG.LAP_LENGTH) {
    save.distance -= CONFIG.LAP_LENGTH;
    save.laps += 1;
    const gained = addCoins(CONFIG.LAP_COINS);
    const lapTime = game.lapTime;
    const best = game.lapTimeValid && (save.bestLap === null || lapTime < save.bestLap);
    if (best) save.bestLap = lapTime;
    if (game.onLap) game.onLap({ lap: save.laps, gained, lapTime: game.lapTimeValid ? lapTime : null, best });
    game.lapTime = 0;
    game.lapTimeValid = true;
  }

  // --- 7. Nieuwe coins op de baan leggen (net buiten beeld rechts) ---
  const visibleAhead = TRACK.W / CONFIG.PX_PER_M;
  if (game.nextCoinAt < game.pos) game.nextCoinAt = game.pos + 60;
  while (game.nextCoinAt < game.pos + visibleAhead) {
    game.coins.push({ at: game.nextCoinAt, bob: Math.random() * 6 });
    game.nextCoinAt += coinGap();
  }

  // --- 8. Coins oppakken (als de neus van de auto erbij is) ---
  const noseAt = game.pos + (TRACK.CAR_LEN - 8) / CONFIG.PX_PER_M;
  game.coins = game.coins.filter((c) => {
    if (c.at > noseAt) return true; // nog niet bereikt
    const gained = addCoins(CONFIG.COIN_VALUE);
    addFloatText(`+${fmtCoins(gained)}`, TRACK.CAR_X + TRACK.CAR_LEN - 4, TRACK.COIN_Y - 10);
    if (game.onCoin) game.onCoin(gained);
    return false;
  });

  // --- 9. Vonken onder de auto (zoals echte F1-auto's) ---
  if (game.speed > 190 && Math.random() < (game.speed - 190) / 120) {
    for (let i = 0; i < 2; i++) {
      game.sparks.push({
        x: TRACK.CAR_X + 20 + Math.random() * 30,
        y: TRACK.GROUND_Y - 2,
        vx: -60 - Math.random() * 120,
        vy: -20 - Math.random() * 40,
        life: 0.25 + Math.random() * 0.25,
        age: 0,
      });
    }
  }
  for (const s of game.sparks) {
    s.age += dt;
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.vy += 300 * dt; // zwaartekracht
  }
  game.sparks = game.sparks.filter((s) => s.age < s.life && s.y < TRACK.GROUND_Y + 4);

  // --- 10. Zwevende teksten (+1) ouder maken ---
  for (const e of floatTexts) e.age += dt;
  floatTexts = floatTexts.filter((e) => e.age < 1.2);

  // --- 11. Tegenstanders inhalen ---
  updateRivals(dt, driving);

  // --- 12. Weer: regen als je al een tijdje errors hebt ---
  const wantRain = game.errors > 0 && game.errorsSince !== null && game.time - game.errorsSince >= CONFIG.RAIN_DELAY;
  if (wantRain && !game.raining) {
    game.raining = true;
    careerOnRainStart(game.errors);
  } else if (!wantRain && game.raining) {
    game.raining = false;
    careerOnRainStop();
  }
  const rainTarget = game.raining ? Math.min(1, 0.45 + game.errors * 0.1) : 0;
  game.rain += (rainTarget - game.rain) * Math.min(1, dt * 0.6);

  // --- 13. Confetti laten vallen ---
  for (const c of game.confetti) {
    c.x += c.vx * dt;
    c.y += c.vy * dt;
    c.vx *= 0.99;
    c.rot += c.spin * dt;
  }
  game.confetti = game.confetti.filter((c) => c.y < TRACK.H + 10);
}

// ---------------------------------------------------------------------
//  INHALEN - een tegenstander rijdt (langzamer) voor je en jij gaat erlangs
// ---------------------------------------------------------------------

// Zet `n` inhaalacties in de wachtrij (aangeroepen vanuit career.js).
function queueOvertake(n) {
  game.overtakeQueue += n;
}

function updateRivals(dt, driving) {
  // Staat de auto stil of in de pits? Dan meteen inhalen (zonder animatie).
  if (!driving && game.speed < 20) {
    while (game.overtakeQueue > 0) {
      game.overtakeQueue -= 1;
      careerOnOvertake();
    }
  }

  // Nieuwe tegenstander laten verschijnen (rechts, net buiten beeld).
  if (game.overtakeQueue > 0 && game.rivals.length === 0 && game.time >= game.nextRivalAt) {
    game.overtakeQueue -= 1;
    const rival = rivalAhead(); // wie rijdt er voor je? (career.js)
    if (rival) {
      game.rivals.push({
        x: TRACK.W + 10,
        livery: { ...LIVERIES[rival.livery], number: rival.number },
        code: rival.code,
        passed: false,
      });
    }
  }

  // Tegenstanders schuiven naar links (jij bent sneller).
  for (const r of game.rivals) {
    r.x -= (60 + game.speed * 0.15) * dt;
    if (!r.passed && r.x < TRACK.CAR_X - 10) {
      r.passed = true; // jij bent er voorbij!
      careerOnOvertake();
      game.nextRivalAt = game.time + 1.2;
    }
  }
  game.rivals = game.rivals.filter((r) => r.x > -TRACK.CAR_LEN - 20);
}

// ---------------------------------------------------------------------
//  WEER - aantal errors komt van de VS Code-extensie (via career.js)
// ---------------------------------------------------------------------
function gameSetErrors(n) {
  if (n > 0 && game.errors === 0) game.errorsSince = game.time; // errors begonnen
  if (n === 0) game.errorsSince = null;
  game.errors = n;
}

// ---------------------------------------------------------------------
//  CONFETTI
// ---------------------------------------------------------------------
const CONFETTI_COLORS = ['#e10600', '#ffd400', '#ffffff', '#19d16b', '#3fb6ff', '#b43cff', '#ff8000'];

function spawnConfetti(n) {
  for (let i = 0; i < n; i++) {
    game.confetti.push({
      x: Math.random() * TRACK.W,
      y: -10 - Math.random() * 60,
      vx: (Math.random() - 0.5) * 40,
      vy: 35 + Math.random() * 45,
      rot: Math.random() * Math.PI,
      spin: (Math.random() - 0.5) * 10,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
    });
  }
}

// ---------------------------------------------------------------------
//  HULPFUNCTIES
// ---------------------------------------------------------------------

// Coins netjes tonen: hele getallen, of 1 decimaal als het een kommagetal is.
function fmtCoins(n) {
  const r = Math.round(n * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}

// Rondetijd netjes tonen: 1:23.4
function fmtLapTime(sec) {
  if (sec === null || sec === undefined) return '-:--.-';
  const m = Math.floor(sec / 60);
  const s = sec - m * 60;
  return `${m}:${s < 10 ? '0' : ''}${s.toFixed(1)}`;
}

// Kleine zwevende "+1" teksten op het canvas (getekend in render.js).
let floatTexts = [];
function addFloatText(text, x, y) {
  floatTexts.push({ text, x, y, age: 0 });
}
