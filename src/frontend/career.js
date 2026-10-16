// =====================================================================
//  CARRIÈRE: Grand Prix, inhalen, achievements en VS Code-acties
//
//  - Elke dag is er een nieuwe GRAND PRIX. Je start op P10.
//  - Je haalt tegenstanders in door te committen, te pushen en rondes te rijden.
//  - Haal je P1? Dan WIN je de GP: trofee + coins + confetti!
//  - Git-acties en sneltoetsen (van de backend) doen iets in de game:
//       commit   -> team radio met je commit-bericht + 1 inhaalactie
//       push     -> confetti + veel coins + 2 inhaalacties
//       checkout -> team radio "nieuwe strategie"
//       pull     -> team radio "updates van het team"
//       Ctrl+S   -> "SAVED" + ERS-batterij bijladen
//       F5       -> DRS gaat open (tijdelijke boost)
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
  SAVE_ERS: 15,           // % ERS erbij bij Ctrl+S
  SAVE_COOLDOWN: 5,       // seconden voordat Ctrl+S weer ERS geeft
  DRS_TIME: 12,           // seconden DRS na F5
  DRS_COOLDOWN: 30,       // seconden voordat F5 weer DRS geeft
};

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
  { id: 'first_commit', name: 'Eerste commit',      desc: 'Maak je eerste commit',        coins: 25,  check: () => save.commits >= 1 },
  { id: 'commits_50',   name: 'Commit-machine',     desc: 'Maak 50 commits',              coins: 150, check: () => save.commits >= 50 },
  { id: 'first_push',   name: 'Ship it!',           desc: 'Push voor het eerst',          coins: 25,  check: () => save.pushes >= 1 },
  { id: 'pushes_25',    name: 'Continuous delivery', desc: 'Push 25 keer',                coins: 150, check: () => save.pushes >= 25 },
  { id: 'first_win',    name: 'Eerste overwinning', desc: 'Win een Grand Prix',           coins: 50,  check: () => save.gpWins >= 1 },
  { id: 'wins_10',      name: 'Wereldkampioen',     desc: 'Win 10 Grands Prix',           coins: 500, check: () => save.gpWins >= 10 },
  { id: 'laps_100',     name: 'Marathon',           desc: 'Rijd 100 rondes',              coins: 100, check: () => save.laps >= 100 },
  { id: 'streak_max',   name: 'In de zone',         desc: 'Haal een streak van ×2.0',     coins: 100, check: () => save.bestStreak >= CONFIG.STREAK_MAX },
  { id: 'night_owl',    name: 'Nachtuil',           desc: 'Codeer na middernacht',        coins: 50,  check: () => isDriving() && new Date().getHours() < 5 },
  { id: 'saver',        name: 'Ctrl+S-verslaafd',   desc: 'Sla 100 keer op',              coins: 50,  check: () => save.saves >= 100 },
  { id: 'debugger',     name: 'Debugger',           desc: 'Druk 25 keer op F5',           coins: 50,  check: () => save.runs >= 25 },
  { id: 'full_garage',  name: 'Volle garage',       desc: 'Koop alle autokleuren',        coins: 200, check: () => Object.keys(LIVERIES).every((id) => save.liveries.includes(id)) },
];

// =====================================================================
//  GRAND PRIX
// =====================================================================

// Datum van vandaag als tekst, bijv. "2026-10-16".
function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Zorgt dat er een GP voor vandaag is. Nieuwe dag = nieuwe GP.
function ensureGrandPrix() {
  const today = todayKey();
  if (save.gp && save.gp.date === today) return;
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

// Vraag om `n` posities omhoog te gaan.
// Als de auto rijdt zie je de inhaalactie echt gebeuren (zie game.js -> rivals).
function careerOvertake(n) {
  if (save.gp.won) return;
  const possible = Math.min(n, save.gp.position - 1 - game.overtakeQueue);
  if (possible > 0) queueOvertake(possible);
}

// Wordt door game.js aangeroepen als je een tegenstander voorbij bent.
function careerOnOvertake() {
  if (save.gp.won || save.gp.position <= 1) return;
  save.gp.position -= 1;
  saveDirty = true;
  if (save.gp.position === 1) {
    winGrandPrix();
  } else {
    showBanner('INHAALACTIE', `P${save.gp.position}`, '', 'green');
  }
}

// Je hebt de Grand Prix gewonnen!
function winGrandPrix() {
  save.gp.won = true;
  save.gpWins += 1;
  save.trophies.push({ date: save.gp.date, name: save.gp.name });
  const gained = addCoins(CAREER.WIN_COINS);
  spawnConfetti(120);
  showBanner('WINNAAR', `GP VAN ${save.gp.name.toUpperCase()}`, `+${fmtCoins(gained)}`, 'gold');
  queueRadio('Race engineer', `"GET IN THERE! Je hebt de GP van ${save.gp.name} gewonnen!"`, 'P1 · TROFEE VERDIEND');
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

  if (name === 'run') {
    save.runs += 1;
    if (game.time - lastDrs > CAREER.DRS_COOLDOWN) {
      lastDrs = game.time;
      game.drsTime = CAREER.DRS_TIME;
      addFloatText('DRS OPEN!', TRACK.CAR_X + 50, TRACK.GROUND_Y - 40);
    }
  }

  saveDirty = true;
  checkAchievements();
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
