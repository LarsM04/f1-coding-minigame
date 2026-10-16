// =====================================================================
//  CARRIÈRE: Grand Prix, kampioenschap, inhalen, weer, achievements
//            en alles wat er gebeurt bij acties in VS Code
//
//  - Elke dag is er een nieuwe GRAND PRIX. Je start op P10.
//  - Je haalt tegenstanders in door te committen, te pushen en rondes te rijden.
//  - Haal je P1? Dan WIN je de GP: trofee + coins + confetti!
//  - Aan het eind van de dag krijg je PUNTEN (25, 18, 15...) voor het
//    KAMPIOENSCHAP van deze week. Wie op zondag bovenaan staat is kampioen.
//  - Git-acties en sneltoetsen (van de backend):
//       commit   -> team radio met je commit-bericht + 1 inhaalactie
//       push     -> confetti + veel coins + 2 inhaalacties
//       checkout -> team radio "nieuwe strategie"
//       pull     -> team radio "updates van het team"
//       Ctrl+S   -> "SAVED" + ERS-batterij bijladen
//       F5       -> DRS gaat open (tijdelijke boost)
//  - VS Code-extensie (map vscode-extension/):
//       errors in je code   -> na 20 sec gaat het REGENEN (auto langzamer)
//       errors gefixt       -> baan droogt op + bonus
//       test/build geslaagd -> GROENE VLAG + coins
//       commando gefaald    -> GELE VLAG (team radio)
//       debuggen gestart    -> DRS
//  - ACHIEVEMENTS: speciale prestaties die extra coins opleveren.
// =====================================================================

// ---------------------------------------------------------------------
//  INSTELLINGEN - beloningen en regels
// ---------------------------------------------------------------------
const CAREER = {
  GRID_SIZE: 10,          // met hoeveel auto's je race begint (je start achteraan)
  COMMIT_COINS: 8,        // coins per commit
  COMMIT_OVERTAKES: 1,    // posities omhoog per commit
  PUSH_COINS: 20,         // coins per push
  PUSH_OVERTAKES: 2,      // posities omhoog per push
  LAPS_PER_OVERTAKE: 15,  // elke zoveel rondes ook 1 positie omhoog
  WIN_COINS: 100,         // coins als je een GP wint
  CHAMPION_COINS: 250,    // coins als je het weekkampioenschap wint
  SAVE_ERS: 15,           // % ERS erbij bij Ctrl+S
  SAVE_COOLDOWN: 5,       // seconden voordat Ctrl+S weer ERS geeft
  DRS_TIME: 12,           // seconden DRS na F5 / debuggen
  DRS_COOLDOWN: 30,       // seconden voordat DRS weer kan
  GREEN_FLAG_COINS: 5,    // coins voor een geslaagde test/build
  GREEN_FLAG_COOLDOWN: 60, // seconden voordat een groene vlag weer coins geeft
  DRY_COINS: 5,           // coins als je alle errors gefixt hebt na regen
  PITSTOP_COOLDOWN: 600,  // seconden tussen pitstop-challenges (10 minuten)
  PITSTOP_REWARDS: [      // [maximale tijd in sec, coins]
    [2.0, 25],
    [3.0, 15],
    [Infinity, 8],
  ],
};

// Punten per finishpositie (P1 = 25, P2 = 18, ...), net als in de echte F1.
const POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];

// Je tegenstanders. code = afkorting van 3 letters (zoals op F1 TV).
const RIVALS = [
  { id: 'merge',    name: 'Max Merge',         code: 'MER', livery: 'bull',   number: 1 },
  { id: 'linter',   name: 'Lewis Linter',      code: 'LIN', livery: 'silver', number: 44 },
  { id: 'compiler', name: 'Charles Compiler',  code: 'COM', livery: 'rosso',  number: 27 },
  { id: 'loop',     name: 'Lando Loop',        code: 'LOO', livery: 'papaya', number: 4 },
  { id: 'overflow', name: 'Oscar Overflow',    code: 'OVE', livery: 'papaya', number: 81 },
  { id: 'function', name: 'Fernando Function', code: 'FUN', livery: 'green',  number: 14 },
  { id: 'git',      name: 'George Git',        code: 'GIT', livery: 'silver', number: 63 },
  { id: 'cache',    name: 'Carlos Cache',      code: 'CAC', livery: 'pink',   number: 55 },
  { id: 'yarn',     name: 'Yuki Yarn',         code: 'YAR', livery: 'bull',   number: 22 },
];

// De Grands Prix (elke dag een andere, op volgorde van de kalender).
const GRANDS_PRIX = [
  'Bahrein', 'Saoedi-Arabië', 'Australië', 'Japan', 'China', 'Miami', 'Imola', 'Monaco',
  'Canada', 'Spanje', 'Oostenrijk', 'Silverstone', 'Hongarije', 'Spa', 'Zandvoort', 'Monza',
  'Bakoe', 'Singapore', 'Austin', 'Mexico', 'Brazilië', 'Las Vegas', 'Qatar', 'Abu Dhabi',
];

// ---------------------------------------------------------------------
//  ACHIEVEMENTS - check() geeft true als je hem gehaald hebt
// ---------------------------------------------------------------------
const ACHIEVEMENTS = [
  { id: 'first_commit', name: 'Eerste commit',       desc: 'Maak je eerste commit',              coins: 25,  check: () => save.commits >= 1 },
  { id: 'commits_50',   name: 'Commit-machine',      desc: 'Maak 50 commits',                    coins: 150, check: () => save.commits >= 50 },
  { id: 'first_push',   name: 'Ship it!',            desc: 'Push voor het eerst',                coins: 25,  check: () => save.pushes >= 1 },
  { id: 'pushes_25',    name: 'Continuous delivery', desc: 'Push 25 keer',                       coins: 150, check: () => save.pushes >= 25 },
  { id: 'first_win',    name: 'Eerste overwinning',  desc: 'Win een Grand Prix',                 coins: 50,  check: () => save.gpWins >= 1 },
  { id: 'wins_10',      name: 'Racelegende',         desc: 'Win 10 Grands Prix',                 coins: 500, check: () => save.gpWins >= 10 },
  { id: 'champion',     name: 'Wereldkampioen',      desc: 'Win een weekkampioenschap',          coins: 300, check: () => save.championships >= 1 },
  { id: 'laps_100',     name: 'Marathon',            desc: 'Rijd 100 rondes',                    coins: 100, check: () => save.laps >= 100 },
  { id: 'streak_max',   name: 'In de zone',          desc: 'Haal een streak van ×2.0',           coins: 100, check: () => save.bestStreak >= CONFIG.STREAK_MAX },
  { id: 'night_owl',    name: 'Nachtuil',            desc: 'Codeer na middernacht',              coins: 50,  check: () => isDriving() && new Date().getHours() < 5 },
  { id: 'saver',        name: 'Ctrl+S-verslaafd',    desc: 'Sla 100 keer op',                    coins: 50,  check: () => save.saves >= 100 },
  { id: 'debugger',     name: 'Debugger',            desc: 'Open 25 keer DRS (F5 / debuggen)',   coins: 50,  check: () => save.runs >= 25 },
  { id: 'pit_master',   name: 'Pitcrew',             desc: 'Pitstop onder de 2,0 seconden',      coins: 75,  check: () => save.bestPitstop !== null && save.bestPitstop < 2 },
  { id: 'rain_master',  name: 'Regenmeester',        desc: 'Laat de baan 10x opdrogen (errors fixen)', coins: 75, check: () => save.drySpells >= 10 },
  { id: 'green_flag',   name: 'Groen licht',         desc: '10 geslaagde tests of builds',       coins: 50,  check: () => save.greenFlags >= 10 },
  { id: 'full_garage',  name: 'Volle garage',        desc: 'Koop alle autokleuren',              coins: 200, check: () => Object.keys(LIVERIES).every((id) => save.liveries.includes(id)) },
];

// =====================================================================
//  DATUMS
// =====================================================================

// Datum als tekst, bijv. "2026-10-16".
function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Weeknummer (ISO, week begint op maandag), bijv. "2026-W42".
function weekKey(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  const day = (d.getDay() + 6) % 7; // maandag = 0
  d.setDate(d.getDate() - day + 3); // donderdag van deze week
  const firstThursday = new Date(d.getFullYear(), 0, 4);
  const week = 1 + Math.round(((d - firstThursday) / 86400000 - 3 + ((firstThursday.getDay() + 6) % 7)) / 7);
  return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`;
}

// Een getal uit een tekst (altijd hetzelfde voor dezelfde tekst).
function hashString(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

// =====================================================================
//  GRAND PRIX
// =====================================================================

// Startvolgorde van de tegenstanders voor een dag (elke dag anders, maar vast).
function rivalOrder(date) {
  const rnd = seededRandom(hashString(date));
  const order = RIVALS.map((r) => r.id);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

function rivalById(id) {
  return RIVALS.find((r) => r.id === id);
}

// De tegenstander die NU vlak voor je rijdt (die haal je als volgende in).
function rivalAhead() {
  const gp = save.gp;
  if (!gp || gp.won || gp.position <= 1) return null;
  return rivalById(rivalOrder(gp.date)[gp.position - 2]);
}

// Uitslag van een GP: [{ id, pos }] voor jou ('me') en alle tegenstanders.
function classification(gp) {
  const order = rivalOrder(gp.date);
  const result = [];
  let i = 0;
  for (let pos = 1; pos <= CAREER.GRID_SIZE; pos++) {
    if (pos === gp.position) result.push({ id: 'me', pos });
    else result.push({ id: order[i++], pos });
  }
  return result;
}

// Zorgt dat er een GP voor vandaag is. Nieuwe dag = vorige GP afronden + nieuwe GP.
function ensureGrandPrix() {
  const today = todayKey();
  if (save.gp && save.gp.date === today) {
    ensureSeason(weekKey(today)); // (oudere saves hebben nog geen kampioenschap)
    return;
  }
  if (save.gp) finishGrandPrix(save.gp);
  ensureSeason(weekKey(today));

  const dayNumber = Math.floor(Date.now() / 86400000); // dagen sinds 1970
  save.gp = {
    date: today,
    name: GRANDS_PRIX[dayNumber % GRANDS_PRIX.length],
    position: CAREER.GRID_SIZE,
    won: false,
    lapsAtStart: save.laps,
  };
  saveDirty = true;
  showBanner('NIEUWE GP', `GP VAN ${save.gp.name.toUpperCase()}`, '', 'gold');
  queueRadio('Race engineer', `"Welkom in ${save.gp.name}! We starten vanaf P${CAREER.GRID_SIZE}. Tijd om in te halen."`, 'COMMIT EN PUSH OM IN TE HALEN');
}

// Een GP is voorbij (nieuwe dag): punten uitdelen voor het kampioenschap.
function finishGrandPrix(gp) {
  ensureSeason(weekKey(gp.date));
  for (const { id, pos } of classification(gp)) {
    save.season.points[id] = (save.season.points[id] || 0) + POINTS[pos - 1];
  }
  save.season.races.push({ date: gp.date, name: gp.name, position: gp.position });
  saveDirty = true;
}

// Vraag om `n` posities omhoog te gaan.
// Als de auto rijdt zie je de inhaalactie echt gebeuren (zie game.js -> rivals).
function careerOvertake(n) {
  if (save.gp.won) return;
  const possible = Math.min(n, save.gp.position - 1 - game.overtakeQueue - game.rivals.filter((r) => !r.passed).length);
  if (possible > 0) queueOvertake(possible);
}

// Wordt door game.js aangeroepen als je een tegenstander voorbij bent.
function careerOnOvertake() {
  if (save.gp.won || save.gp.position <= 1) return;
  const rival = rivalAhead();
  save.gp.position -= 1;
  saveDirty = true;
  playSound('overtake');
  if (save.gp.position === 1) {
    winGrandPrix();
  } else {
    showBanner(`P${save.gp.position}`, `VOORBIJ ${rival ? rival.name.toUpperCase() : ''}`, '', 'green');
  }
}

// Je hebt de Grand Prix gewonnen!
function winGrandPrix() {
  save.gp.won = true;
  save.gpWins += 1;
  save.trophies.push({ date: save.gp.date, name: save.gp.name });
  const gained = addCoins(CAREER.WIN_COINS);
  spawnConfetti(120);
  playSound('win');
  showBanner('WINNAAR', `GP VAN ${save.gp.name.toUpperCase()}`, `+${fmtCoins(gained)}`, 'gold');
  queueRadio('Race engineer', `"GET IN THERE! Je hebt de GP van ${save.gp.name} gewonnen!"`, 'P1 · 25 PUNTEN VOOR HET WK');
  checkAchievements();
  writeSave(true);
}

// Elke CAREER.LAPS_PER_OVERTAKE rondes in deze GP: 1 positie omhoog.
function careerOnLap() {
  const lapsInGp = save.laps - save.gp.lapsAtStart;
  if (lapsInGp > 0 && lapsInGp % CAREER.LAPS_PER_OVERTAKE === 0) careerOvertake(1);
  checkAchievements();
}

// =====================================================================
//  KAMPIOENSCHAP (per week)
// =====================================================================

// Zorgt dat er een seizoen voor deze week is. Nieuwe week = vorige afronden.
function ensureSeason(week) {
  if (save.season && save.season.week === week) return;
  if (save.season && save.season.races.length > 0) finishSeason();
  save.season = { week, points: {}, races: [] };
  saveDirty = true;
}

// Stand van het kampioenschap, hoogste eerst.
// withToday = ook de (voorlopige) punten van de GP van vandaag meetellen.
function standings(withToday = true) {
  const pts = { ...(save.season ? save.season.points : {}) };
  if (withToday && save.gp && save.season && weekKey(save.gp.date) === save.season.week) {
    for (const { id, pos } of classification(save.gp)) pts[id] = (pts[id] || 0) + POINTS[pos - 1];
  }
  const rows = [{ id: 'me', name: 'Jij', code: 'JIJ', pts: pts.me || 0 }];
  for (const r of RIVALS) rows.push({ id: r.id, name: r.name, code: r.code, livery: r.livery, pts: pts[r.id] || 0 });
  // Hoogste punten eerst; bij gelijke punten sta jij bovenaan.
  return rows.sort((a, b) => b.pts - a.pts || (a.id === 'me' ? -1 : b.id === 'me' ? 1 : 0));
}

// Week voorbij: wie is kampioen?
function finishSeason() {
  const table = standings(false);
  const myPos = table.findIndex((r) => r.id === 'me') + 1;
  save.lastSeason = { week: save.season.week, position: myPos, points: table[myPos - 1].pts };
  if (myPos === 1) {
    save.championships += 1;
    save.championshipWins.push({ week: save.season.week });
    const gained = addCoins(CAREER.CHAMPION_COINS);
    spawnConfetti(160);
    playSound('win');
    showBanner('WERELDKAMPIOEN', `WEEK ${save.season.week.split('-W')[1]}`, `+${fmtCoins(gained)}`, 'gold');
    queueRadio('Teambaas', '"Wereldkampioen! Wat een seizoen. Ongelooflijk!"', `${table[0].pts} PUNTEN`);
  } else {
    queueRadio('Teambaas', `"Het kampioenschap is voorbij. Je werd P${myPos}. Volgende week pakken we ze!"`, `KAMPIOEN: ${table[0].name.toUpperCase()}`);
  }
  checkAchievements();
}

// =====================================================================
//  GIT-ACTIES (komen van src/backend/git-watcher.js)
// =====================================================================
function careerOnGit(ev) {
  if (ev.type === 'commit') {
    save.commits += 1;
    const gained = addCoins(CAREER.COMMIT_COINS);
    bumpCoins();
    queueRadio(ev.repo, `"${ev.message}"`, `COMMIT · +${fmtCoins(gained)} COINS`);
    careerOvertake(CAREER.COMMIT_OVERTAKES);
  }

  if (ev.type === 'push') {
    save.pushes += 1;
    const gained = addCoins(CAREER.PUSH_COINS);
    bumpCoins();
    spawnConfetti(60);
    playSound('push');
    showBanner('PUSH', ev.branch.toUpperCase(), `+${fmtCoins(gained)}`, 'purple');
    queueRadio('Race engineer', '"Gepusht! Wat een pace, ga zo door!"', `PUSH NAAR ${ev.repo} · ${ev.branch}`);
    careerOvertake(CAREER.PUSH_OVERTAKES);
  }

  if (ev.type === 'checkout') {
    queueRadio('Race engineer', `"Box box. Nieuwe strategie: ${ev.branch}"`, `BRANCH · ${ev.repo}`);
  }

  if (ev.type === 'pull') {
    queueRadio('Race engineer', '"Nieuwe updates van het team binnengehaald."', `PULL · ${ev.repo}`);
  }

  saveDirty = true;
  checkAchievements();
}

// =====================================================================
//  SNELTOETSEN (komen van src/backend/keyboard.js)
// =====================================================================
let lastSaveBonus = -99;
let lastDrs = -99;
let lastGreenFlag = -999;

function careerOnShortcut(name) {
  if (game.mode !== 'race') return; // alleen in coding-apps

  if (name === 'save') {
    save.saves += 1;
    addFloatText('SAVED ✓', TRACK.CAR_X + 50, TRACK.GROUND_Y - 40);
    if (game.time - lastSaveBonus > CAREER.SAVE_COOLDOWN) {
      lastSaveBonus = game.time;
      game.ers = Math.min(100, game.ers + CAREER.SAVE_ERS);
    }
  }

  if (name === 'run') openDrs();

  saveDirty = true;
  checkAchievements();
}

// DRS openen (F5 of debuggen gestart in VS Code).
function openDrs() {
  if (game.time - lastDrs <= CAREER.DRS_COOLDOWN) return;
  lastDrs = game.time;
  save.runs += 1;
  game.drsTime = CAREER.DRS_TIME;
  addFloatText('DRS OPEN!', TRACK.CAR_X + 50, TRACK.GROUND_Y - 40);
  playSound('drs');
}

// =====================================================================
//  VS CODE-EXTENSIE (komt via src/backend/vscode-bridge.js)
// =====================================================================
const errorsByWindow = {}; // aantal errors per VS Code-venster

function careerOnVscode(ev) {
  // Errors in je code -> weer (zie game.js: gameSetErrors / regen)
  if (ev.type === 'errors') {
    errorsByWindow[ev.window] = ev.count;
    const total = Object.values(errorsByWindow).reduce((a, b) => a + b, 0);
    gameSetErrors(total);
  }

  // Terminal-commando of task klaar
  if (ev.type === 'command') {
    if (ev.ok && ev.test) {
      save.greenFlags += 1;
      playSound('green');
      if (game.time - lastGreenFlag > CAREER.GREEN_FLAG_COOLDOWN) {
        lastGreenFlag = game.time;
        const gained = addCoins(CAREER.GREEN_FLAG_COINS);
        showBanner('GROENE VLAG', ev.command.toUpperCase().slice(0, 22), `+${fmtCoins(gained)}`, 'green');
      } else {
        showBanner('GROENE VLAG', ev.command.toUpperCase().slice(0, 22), '', 'green');
      }
    } else if (!ev.ok) {
      playSound('fail');
      queueRadio('Race engineer', `"Probleem met de auto: '${ev.command}' faalde."`, 'GELE VLAG');
    }
  }

  // Debuggen gestart -> DRS
  if (ev.type === 'debug' && game.mode === 'race') openDrs();

  saveDirty = true;
  checkAchievements();
}

// Wordt door game.js aangeroepen als het gaat regenen / weer droog wordt.
function careerOnRainStart(errors) {
  playSound('thunder');
  queueRadio('Race engineer', `"Het begint te regenen! Je hebt ${errors} error${errors === 1 ? '' : 's'}. Fix ze voor droog weer."`, 'REGENBANDEN · −15% SNELHEID');
}

function careerOnRainStop() {
  save.drySpells += 1;
  const gained = addCoins(CAREER.DRY_COINS);
  playSound('green');
  showBanner('DROOG', 'ERRORS GEFIXT!', `+${fmtCoins(gained)}`, 'green');
  checkAchievements();
}

// =====================================================================
//  PITSTOP-CHALLENGE (het spelletje zelf zit in pitstop.js)
// =====================================================================

// Seconden tot je weer een pitstop mag doen (0 = nu).
function pitstopWait() {
  const left = CAREER.PITSTOP_COOLDOWN - (Date.now() - save.lastPitstop) / 1000;
  return Math.max(0, Math.ceil(left));
}

// Pitstop klaar in `time` seconden: beloning geven. Geeft de coins terug.
function careerOnPitstop(time) {
  save.lastPitstop = Date.now();
  const best = save.bestPitstop === null || time < save.bestPitstop;
  if (best) save.bestPitstop = time;
  const coins = CAREER.PITSTOP_REWARDS.find(([max]) => time <= max)[1];
  const gained = addCoins(coins);
  showBanner(best ? 'RECORD PITSTOP' : 'PITSTOP', `${time.toFixed(2)} SEC`, `+${fmtCoins(gained)}`, best ? 'purple' : 'green');
  checkAchievements();
  writeSave(true);
  return gained;
}

// =====================================================================
//  ACHIEVEMENTS
// =====================================================================
function checkAchievements() {
  for (const a of ACHIEVEMENTS) {
    if (save.achievements.includes(a.id)) continue;
    let done = false;
    try {
      done = a.check();
    } catch {}
    if (!done) continue;
    save.achievements.push(a.id);
    save.coins += a.coins; // vaste beloning (zonder multiplier)
    save.totalCoins += a.coins;
    saveDirty = true;
    playSound('achievement');
    showBanner('ACHIEVEMENT', a.name.toUpperCase(), `+${a.coins}`, 'gold');
  }
}

// Elke 5 seconden checken (voor bijv. "Nachtuil") en elke minuut kijken
// of er een nieuwe dag (= nieuwe GP) is.
setInterval(() => {
  if (save.gp) checkAchievements();
}, 5000);
setInterval(() => {
  if (save.gp) ensureGrandPrix();
}, 60000);
