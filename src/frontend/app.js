// =====================================================================
//  APP: start de game op en koppelt alles aan elkaar
//   - venster instellen (altijd op de voorgrond, positie onthouden)
//   - berichten van de backend ontvangen (toetsen + actieve app)
//   - de game-loop (elke frame updaten en tekenen)
//   - de UI: HUD, banners, start-lampen, garage, meldingen
// =====================================================================

const $ = (id) => document.getElementById(id);

// Fouten in de frontend tonen in de terminal waar `tinyjs dev` draait.
window.addEventListener('error', (e) => tiny.log('FOUT: ' + e.message + ' (' + e.filename + ':' + e.lineno + ')'));
window.addEventListener('unhandledrejection', (e) => tiny.log('FOUT (promise): ' + e.reason));

// ---------------------------------------------------------------------
//  ICONEN (SVG) - gebruikt in de knoppen en de garage
// ---------------------------------------------------------------------
const ICONS = {
  wrench: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z"/>',
  chevronDown: '<path d="M6 9l6 6 6-6"/>',
  chevronUp: '<path d="M6 15l6-6 6 6"/>',
  close: '<path d="M18 6L6 18M6 6l12 12"/>',
  engine: '<path d="M12 14l4-4"/><path d="M3.3 19a10 10 0 1 1 17.4 0"/>',
  fuel: '<path d="M3 22V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v17M2 22h14M15 13h2a2 2 0 0 1 2 2v3a1.5 1.5 0 0 0 3 0V9l-3-3M6 8h6"/>',
  bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
  briefcase: '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>',
  radar: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4.5"/><path d="M12 12l6.5-6.5"/>',
  volume: '<path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M19 5a10 10 0 0 1 0 14"/>',
  volumeX: '<path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M22 9l-6 6M16 9l6 6"/>',
};

// Maakt een <svg>-icoon als HTML-tekst.
function icon(name) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]}</svg>`;
}

// ---------------------------------------------------------------------
//  OPSTARTEN
// ---------------------------------------------------------------------
async function boot() {
  // Lettertype laden voordat we iets tekenen (anders tekent canvas met een ander font).
  try {
    await Promise.all([
      document.fonts.load('900 10px "Titillium Web"'),
      document.fonts.load('italic 700 10px "Titillium Web"'),
      document.fonts.load('600 10px "Titillium Web"'),
    ]);
  } catch {}

  // CONFIG wordt gebruikt bij het laden van de save, dus pas nu laden.
  await loadSave();

  // Venster altijd boven alle andere programma's houden.
  tiny.win.setAlwaysOnTop(true);

  // Iconen in de knoppen zetten.
  for (const btn of document.querySelectorAll('[data-icon]')) btn.innerHTML = icon(btn.dataset.icon);

  // Canvas klaarmaken, knoppen koppelen, venstergrootte goedzetten.
  renderInit($('track'));
  setupButtons();
  setupTabs();
  pitSetup();
  $('btnSound').innerHTML = icon(save.muted ? 'volumeX' : 'volume');
  await applyCompact();

  // Venster terugzetten waar het de vorige keer stond,
  // of de eerste keer rechtsonder in beeld zetten.
  if (save.winPos) {
    tiny.win.setPosition(save.winPos.x, save.winPos.y);
    tiny.win.ensureOnScreen(); // voor als je scherm intussen veranderd is
  } else {
    await placeBottomRight();
  }
  setInterval(rememberWindowPosition, 2000);

  // Na opstarten telt de eerste ronde niet als "beste ronde" (je begon halverwege).
  game.lapTimeValid = save.distance === 0;

  // Callbacks van de game -> UI bijwerken.
  game.onCoin = () => {
    bumpCoins();
    playSound('coin');
  };
  game.onLap = onLap;
  game.onStreak = onStreak;
  game.onLightsOut = lightsOut;

  // Berichten van de backend (src/backend/main.js):
  tiny.api.on('keys', ({ n }) => gameOnKeys(n));
  tiny.api.on('app', (info) => setApp(info));
  tiny.api.on('git', (ev) => careerOnGit(ev));                  // commit, push, ... (career.js)
  tiny.api.on('shortcut', ({ name }) => careerOnShortcut(name)); // Ctrl+S, F5 (career.js)
  tiny.api.on('vscode', (ev) => careerOnVscode(ev));            // VS Code-extensie (career.js)

  // Grand Prix van vandaag klaarzetten (nieuwe dag = nieuwe GP).
  ensureGrandPrix();

  // Elke 5 sec je positie/coins doorgeven aan de VS Code-extensie (statusbalk).
  const writeStatus = () =>
    tiny.api.call('writeStatus', {
      position: save.gp.position,
      won: save.gp.won,
      gp: save.gp.name,
      coins: Math.floor(save.coins),
      rain: game.raining,
    }).catch(() => {});
  writeStatus();
  setInterval(writeStatus, 5000);

  // Huidige app meteen opvragen (anders wachten we op de eerste wissel).
  setApp(await tiny.api.call('currentApp'));

  requestAnimationFrame(loop);
}

// Zet het venster rechtsonder op het hoofdscherm.
async function placeBottomRight() {
  try {
    const screens = await tiny.app.screens();
    const screen = screens.find((s) => s.primary) || screens[0];
    const area = screen.visible || screen; // "visible" = zonder taakbalk
    const rect = $('widget').getBoundingClientRect();
    tiny.win.setPosition(
      Math.round(area.x + area.width - rect.width - 16),
      Math.round(area.y + area.height - rect.height - 16),
    );
  } catch (err) {
    tiny.log('Kon venster niet plaatsen: ' + err);
  }
}

// Onthoudt waar je het venster naartoe gesleept hebt (elke 2 sec gecheckt).
async function rememberWindowPosition() {
  try {
    const { x, y } = await tiny.win.getState();
    if (!save.winPos || save.winPos.x !== x || save.winPos.y !== y) {
      save.winPos = { x, y };
      saveDirty = true;
    }
  } catch {}
}

// Nieuwe actieve app binnen van de backend.
function setApp(info) {
  if (!info || !info.name) return;
  gameSetApp(info.name, info.coding);
  const racing = info.coding;
  $('status').className = 'status ' + (racing ? 'race' : 'pits');
  $('modeText').textContent = racing ? 'RACE' : 'PITS';
  $('appText').textContent = info.name; // textContent = veilig, geen HTML
}

// ---------------------------------------------------------------------
//  GAME-LOOP - draait elke frame (±60x per seconde)
// ---------------------------------------------------------------------
let lastFrame = performance.now();
function loop(now) {
  const dt = Math.min(0.1, (now - lastFrame) / 1000); // max 0.1s, voorkomt grote sprongen
  lastFrame = now;

  gameUpdate(dt);
  if (!save.compact) gameDraw(dt);
  updateHud();

  requestAnimationFrame(loop);
}

// Werkt alle cijfers en balkjes bij.
function updateHud() {
  setText('coinCount', Math.floor(save.coins));
  setText('speed', Math.round(game.speed));
  setText('lapNum', save.laps + 1);
  setText('lapTime', fmtLapTime(game.lapTime));
  $('lapBar').style.width = (save.distance / CONFIG.LAP_LENGTH) * 100 + '%';

  // Brandstof (denktijd)
  const fuelPct = game.fuel / thinkTime();
  $('fuelBar').style.width = fuelPct * 100 + '%';
  const fuelGauge = $('fuelBar').closest('.gauge');
  fuelGauge.classList.toggle('low', fuelPct < 0.4 && fuelPct >= 0.15);
  fuelGauge.classList.toggle('empty', fuelPct < 0.15);
  const secs = Math.ceil(game.fuel);
  setText('fuelText', `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`);

  // ERS
  $('ersBar').style.width = game.ers + '%';
  setText('ersText', Math.round(game.ers) + '%');

  // Streak
  setText('streak', '×' + game.streak.toFixed(1));
  $('streak').classList.toggle('on', game.streak > 1);

  // Positie in de Grand Prix + DRS
  if (save.gp) {
    setText('pos', save.gp.won ? 'P1 🏆' : 'P' + save.gp.position);
    $('pos').classList.toggle('top3', !save.gp.won && save.gp.position <= 3);
    $('pos').classList.toggle('win', save.gp.won);
  }
  $('drs').classList.toggle('on', drsActive());

  // Pitstop-knop en -timer (pitstop.js)
  pitTick();

  // Hint op de baan (in de pits staat de uitleg op het scherm in de garage)
  let hint = '';
  if (game.mode === 'pits') hint = '';
  else if (!isDriving() && game.speed < 1) hint = '⌨  Typ iets om te starten';
  else if (!isDriving()) hint = 'Brandstof op! Typ om door te rijden';
  setText('hint', hint);
  $('hint').classList.toggle('show', !!hint);
  $('hint').classList.toggle('pulse', game.mode === 'race');

  if (!$('garage').classList.contains('hidden')) refreshGarageButtons();
}

// Zet tekst alleen als hij veranderd is (scheelt werk voor de browser).
function setText(id, value) {
  const el = $(id);
  const s = String(value);
  if (el.textContent !== s) el.textContent = s;
}

// ---------------------------------------------------------------------
//  EFFECTEN: coins, rondes, streak, start-lampen, meldingen
// ---------------------------------------------------------------------

// Laat de coin-teller even "poppen".
function bumpCoins() {
  const el = $('coins');
  el.classList.add('bump');
  setTimeout(() => el.classList.remove('bump'), 140);
}

// Ronde voltooid.
function onLap({ lap, gained, lapTime, best }) {
  bumpCoins();
  playSound(best ? 'achievement' : 'lap');
  if (best) {
    showBanner('BESTE RONDE', fmtLapTime(lapTime), `+${fmtCoins(gained)}`, 'purple');
  } else {
    showBanner(`LAP ${lap}`, lapTime === null ? 'VOLTOOID' : fmtLapTime(lapTime), `+${fmtCoins(gained)}`);
  }
  careerOnLap(); // misschien een inhaalactie (career.js)
}

// Streak omhoog.
function onStreak(streak) {
  const el = $('streak');
  el.classList.add('pop');
  setTimeout(() => el.classList.remove('pop'), 250);
  if (streak >= 1.1) showBanner('STREAK', `×${streak.toFixed(1)} COINS`, '', 'green');
}

// F1-banner die van links het beeld in schuift.
// Komen er meerdere tegelijk (bijv. push + inhaalactie)? Dan na elkaar.
const bannerQueue = [];
let bannerBusy = false;
function showBanner(tag, main, extra, variant = '') {
  if (bannerQueue.length >= 5) bannerQueue.shift(); // niet eindeloos opstapelen
  bannerQueue.push({ tag, main, extra, variant });
  if (!bannerBusy) nextBanner();
}

function nextBanner() {
  const item = bannerQueue.shift();
  if (!item) {
    bannerBusy = false;
    return;
  }
  bannerBusy = true;
  const b = $('banner');
  b.className = 'banner ' + item.variant;
  b.textContent = '';
  const m = el('div', 'main');
  m.append(el('b', '', item.main));
  if (item.extra) {
    const s = el('span', '', item.extra + ' ');
    s.append(el('i', 'coin'));
    m.append(s);
  }
  b.append(el('div', 'tag', item.tag), m);
  requestAnimationFrame(() => requestAnimationFrame(() => b.classList.add('show')));
  setTimeout(() => {
    b.classList.remove('show');
    setTimeout(nextBanner, 400); // wachten tot hij weg geschoven is
  }, 2400);
}

// Team radio linksonder (commit-berichten enzo). Ook met een wachtrij.
const radioQueue = [];
let radioBusy = false;
function queueRadio(who, message, sub = '') {
  if (radioQueue.length >= 4) radioQueue.shift();
  radioQueue.push({ who, message, sub });
  if (!radioBusy) nextRadio();
}

function nextRadio() {
  const item = radioQueue.shift();
  if (!item) {
    radioBusy = false;
    return;
  }
  radioBusy = true;
  setText('radioWho', item.who);
  setText('radioMsg', item.message);
  setText('radioSub', item.sub);
  $('radio').classList.add('show');
  playSound('radio');
  setTimeout(() => {
    $('radio').classList.remove('show');
    setTimeout(nextRadio, 450);
  }, 4500);
}

// "Lights out and away we go!" - als je auto (weer) vertrekt.
let lightsTimer = null;
function lightsOut() {
  const l = $('lights');
  playSound('lights');
  clearTimeout(lightsTimer);
  l.className = 'lights show';
  lightsTimer = setTimeout(() => {
    l.classList.add('out');
    lightsTimer = setTimeout(() => (l.className = 'lights'), 500);
  }, 450);
}

// Korte melding onderin.
let toastTimer = null;
function toast(text, bad = false) {
  const t = $('toast');
  t.textContent = text;
  t.className = 'toast show' + (bad ? ' bad' : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.className = 'toast'), 1600);
}

// ---------------------------------------------------------------------
//  KNOPPEN in de bovenbalk
// ---------------------------------------------------------------------
function setupButtons() {
  // Garage open/dicht
  $('btnGarage').onclick = () => {
    const garage = $('garage');
    const open = garage.classList.toggle('hidden') === false;
    $('btnGarage').classList.toggle('active', open);
    if (open) {
      // In compact-modus is het venster te klein voor de garage
      if (save.compact) toggleCompact();
      renderGarage();
    }
  };

  // Klein/groot venster
  $('btnCompact').onclick = () => toggleCompact();

  // Geluid aan/uit
  $('btnSound').onclick = () => {
    save.muted = !save.muted;
    saveDirty = true;
    $('btnSound').innerHTML = icon(save.muted ? 'volumeX' : 'volume');
    if (!save.muted) playSound('coin'); // even laten horen dat het aan staat
  };

  // Opslaan en afsluiten
  $('btnClose').onclick = async () => {
    await writeSave(true);
    tiny.quit();
  };
}

function toggleCompact() {
  save.compact = !save.compact;
  saveDirty = true;
  if (save.compact) {
    $('garage').classList.add('hidden');
    $('btnGarage').classList.remove('active');
  }
  applyCompact(true);
}

// Past de compact-modus toe en maakt het venster precies zo groot als het widget.
// keepBottom = true: de onderkant blijft op dezelfde plek (handig als het
// venster rechtsonder staat), anders schuift het widget omhoog weg.
async function applyCompact(keepBottom = false) {
  $('widget').classList.toggle('compact', save.compact);
  $('btnCompact').innerHTML = icon(save.compact ? 'chevronUp' : 'chevronDown');
  const before = keepBottom ? await tiny.win.getState() : null;
  await new Promise((r) => requestAnimationFrame(r));
  const rect = $('widget').getBoundingClientRect();
  const h = Math.ceil(rect.height);
  tiny.win.setSize(Math.ceil(rect.width), h);
  if (before) tiny.win.setPosition(before.x, before.y + before.height - h);
}

// ---------------------------------------------------------------------
//  GARAGE - tabbladen: upgrades, autokleuren, statistieken
// ---------------------------------------------------------------------
let currentTab = 'upgrades';

function setupTabs() {
  for (const btn of document.querySelectorAll('.tabs button')) {
    btn.onclick = () => {
      currentTab = btn.dataset.tab;
      for (const b of document.querySelectorAll('.tabs button')) b.classList.toggle('active', b === btn);
      for (const t of document.querySelectorAll('.tab')) t.classList.toggle('hidden', t.id !== 'tab-' + currentTab);
      renderGarage();
    };
  }
}

// Bouwt het open tabblad (opnieuw) op.
function renderGarage() {
  if (currentTab === 'upgrades') renderUpgrades();
  if (currentTab === 'liveries') renderLiveries();
  if (currentTab === 'wk') renderChampionship();
  if (currentTab === 'trophies') renderTrophies();
  if (currentTab === 'stats') renderStats();
}

// --- Tabblad: WK (kampioenschap van deze week) ---
function renderChampionship() {
  const box = $('tab-wk');
  box.textContent = '';
  const week = save.season.week.split('-W')[1];
  const races = save.season.races.length + 1; // + de GP van vandaag

  const head = el('div', 'wkhead');
  head.append(el('b', '', `KAMPIOENSCHAP · WEEK ${Number(week)}`), el('span', '', `${races} race${races === 1 ? '' : 's'}`));
  box.append(head);

  standings().forEach((row, i) => {
    const r = el('div', 'wkrow' + (row.id === 'me' ? ' me' : '') + (i === 0 ? ' first' : ''));
    const bar = el('span', 'bar');
    bar.style.background = row.id === 'me' ? currentLivery().main : LIVERIES[row.livery].main;
    r.append(el('span', 'p', String(i + 1)), bar, el('span', 'code', row.code), el('span', 'name', row.name), el('span', 'pts', `${row.pts} PT`));
    box.append(r);
  });

  const myPoints = POINTS[save.gp.position - 1];
  let note = `De GP van vandaag telt voorlopig mee (P${save.gp.position} = ${myPoints} punten). ` +
    'Aan het eind van de dag staan je punten vast. Wie zondagnacht bovenaan staat, is wereldkampioen!';
  if (save.lastSeason) note += ` Vorige week werd je P${save.lastSeason.position}.`;
  box.append(el('div', 'wknote', note));
}

// --- Tabblad: Trofeeën (Grand Prix + achievements) ---
function renderTrophies() {
  const box = $('tab-trophies');
  box.textContent = '';
  const gp = save.gp;

  // Kaart met de GP van vandaag
  const card = el('div', 'gpcard');
  const title = el('div', 'gptitle');
  title.append(el('b', '', `GP van ${gp.name}`), el('span', '', gp.won ? 'GEWONNEN 🏆' : `P${gp.position} van ${CAREER.GRID_SIZE}`));
  const grid = el('div', 'grid');
  for (let p = CAREER.GRID_SIZE; p >= 1; p--) {
    const cell = el('i', '', 'P' + p);
    if (p === gp.position) cell.classList.add('me');
    else if (p > gp.position) cell.classList.add('done');
    grid.append(cell);
  }
  card.append(
    title,
    grid,
    el('div', 'how', `Inhalen: commit (+${CAREER.COMMIT_OVERTAKES}), push (+${CAREER.PUSH_OVERTAKES}), elke ${CAREER.LAPS_PER_OVERTAKE} rondes (+1). Elke dag een nieuwe GP.`),
  );
  box.append(card);

  // Gewonnen kampioenschappen + Grands Prix
  box.append(el('div', 'section', `Overwinningen (${save.championships} WK · ${save.gpWins} GP)`));
  const wins = el('div', 'wins');
  if (save.trophies.length === 0 && save.championshipWins.length === 0) wins.append(el('span', '', 'Nog geen... haal P1!'));
  for (const c of save.championshipWins.slice().reverse()) wins.append(el('span', '', `👑 WK week ${Number(c.week.split('-W')[1])}`));
  for (const t of save.trophies.slice(-12).reverse()) wins.append(el('span', '', `🏆 ${t.name}`));
  box.append(wins);

  // Achievements
  box.append(el('div', 'section', `Achievements (${save.achievements.length}/${ACHIEVEMENTS.length})`));
  for (const a of ACHIEVEMENTS) {
    const done = save.achievements.includes(a.id);
    const row = el('div', 'ach' + (done ? ' done' : ''));
    const info = el('div', 'info');
    info.append(el('div', 'name', a.name), el('div', 'desc', a.desc));
    const reward = el('div', 'reward');
    reward.append(el('i', 'coin'), done ? '✓' : String(a.coins));
    row.append(el('span', 'cup', '🏆'), info, reward);
    box.append(row);
  }
}

// --- Tabblad: Upgrades ---
function renderUpgrades() {
  const list = $('tab-upgrades');
  list.textContent = '';
  for (const [id, u] of Object.entries(UPGRADES)) {
    const row = el('div', 'upg');

    const ic = el('div', 'icon');
    ic.innerHTML = icon(u.icon);
    ic.style.background = `linear-gradient(135deg, ${u.color}, ${u.color}99)`;

    const info = el('div', 'info');
    info.append(el('div', 'name', u.name), el('div', 'desc', u.desc));
    const pips = el('div', 'pips');
    for (let i = 0; i < u.max; i++) {
      const pip = el('i');
      if (i < save.upgrades[id]) pip.style.background = u.color;
      pips.append(pip);
    }
    info.append(pips);

    const btn = el('button', 'buy');
    btn.dataset.upgrade = id;
    btn.onclick = () => {
      if (buyUpgrade(id)) {
        toast(`${u.name.toUpperCase()} → LEVEL ${save.upgrades[id]}`);
        renderGarage();
      }
    };
    row.append(ic, info, btn);
    list.append(row);
  }
  refreshGarageButtons();
}

// Werkt alleen de koop-knoppen bij (prijs + of je het kunt betalen).
function refreshGarageButtons() {
  for (const btn of document.querySelectorAll('.buy')) {
    const id = btn.dataset.upgrade;
    const maxed = save.upgrades[id] >= UPGRADES[id].max;
    const cost = upgradeCost(id);
    const label = maxed ? 'MAX' : String(cost);
    if (btn.dataset.label !== label) {
      btn.dataset.label = label;
      btn.textContent = '';
      if (!maxed) btn.append(el('i', 'coin'));
      btn.append(label);
    }
    btn.classList.toggle('max', maxed);
    btn.disabled = maxed || save.coins < cost;
  }
}

// --- Tabblad: Autokleuren ---
function renderLiveries() {
  const grid = $('tab-liveries');
  grid.textContent = '';
  grid.className = 'tab liveries';
  for (const [id, l] of Object.entries(LIVERIES)) {
    const owned = save.liveries.includes(id);
    const card = el('button', 'livery');
    card.classList.toggle('selected', save.livery === id);
    card.classList.toggle('locked', !owned);
    card.classList.toggle('cant', !owned && save.coins < l.price);

    // Mini-preview van de auto
    const c = document.createElement('canvas');
    const dpr = window.devicePixelRatio || 1;
    c.width = 120 * dpr;
    c.height = 40 * dpr;
    c.style.width = '120px';
    c.style.height = '40px';
    const g = c.getContext('2d');
    g.scale(dpr, dpr);
    drawCarSide(g, 9, 37, l, { wheelAngle: 0.4 });

    const row = el('div', 'row');
    row.append(el('span', 'lname', l.name));
    const price = el('span', 'price');
    if (save.livery === id) price.textContent = '✓ GEKOZEN';
    else if (owned) { price.textContent = 'KIES'; price.classList.add('owned'); }
    else { price.append(el('i', 'coin'), String(l.price)); }
    row.append(price);

    card.append(c, row);
    card.onclick = () => {
      const wasOwned = owned;
      if (buyOrSelectLivery(id)) {
        if (!wasOwned) toast(`${l.name.toUpperCase()} GEKOCHT!`);
        renderGarage();
      } else {
        toast('NIET GENOEG COINS', true);
      }
    };
    grid.append(card);
  }
}

// --- Tabblad: Statistieken ---
function renderStats() {
  const box = $('tab-stats');
  box.textContent = '';
  box.className = 'tab stats';
  const mins = Math.floor(save.codingSeconds / 60);
  const rows = [
    ['Beste ronde', fmtLapTime(save.bestLap), 'purple'],
    ['Rondes gereden', save.laps],
    ['Tijd gecodeerd', `${Math.floor(mins / 60)}u ${mins % 60}m`],
    ['Totale afstand', (save.totalDistance / 1000).toFixed(1) + ' km'],
    ['Toetsaanslagen', save.totalKeys.toLocaleString('nl-NL')],
    ['Commits', save.commits],
    ['Pushes', save.pushes],
    ['Grands Prix gewonnen', save.gpWins, 'gold'],
    ['Kampioenschappen', save.championships, 'gold'],
    ['Snelste pitstop', save.bestPitstop === null ? '-' : save.bestPitstop.toFixed(2) + ' s', 'purple'],
    ['Geslaagde tests/builds', save.greenFlags],
    ['Errors gefixt na regen', save.drySpells],
    ['Hoogste streak', '×' + save.bestStreak.toFixed(1)],
    ['Topsnelheid', save.bestSpeed + ' km/h'],
    ['Coins ooit verdiend', Math.floor(save.totalCoins).toLocaleString('nl-NL'), 'gold'],
  ];
  for (const [label, value, variant] of rows) {
    const r = el('div', 'stat' + (variant ? ' ' + variant : ''));
    r.append(el('span', '', label), el('b', '', String(value)));
    box.append(r);
  }
}

// Hulpfunctie: maakt een HTML-element met class en tekst.
function el(tag, className, text) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

boot();
