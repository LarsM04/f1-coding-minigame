// =====================================================================
//  APP: start de game op en koppelt alles aan elkaar
//   - venster instellen (altijd op de voorgrond, rechtsonder)
//   - berichten van de backend ontvangen (toetsen + actieve app)
//   - de game-loop (elke frame updaten en tekenen)
//   - de UI: coins, HUD, garage-knoppen
// =====================================================================

const $ = (id) => document.getElementById(id);

// Fouten in de frontend tonen in de terminal waar `tinyjs dev` draait.
window.addEventListener('error', (e) => tiny.log('FOUT: ' + e.message + ' (' + e.filename + ':' + e.lineno + ')'));
window.addEventListener('unhandledrejection', (e) => tiny.log('FOUT (promise): ' + e.reason));

// ---------------------------------------------------------------------
//  OPSTARTEN
// ---------------------------------------------------------------------
async function boot() {
  await loadSave();

  // Venster altijd boven alle andere programma's houden.
  tiny.win.setAlwaysOnTop(true);

  // Venster terugzetten waar het de vorige keer stond,
  // of de eerste keer rechtsonder in beeld zetten.
  if (save.winPos) {
    tiny.win.setPosition(save.winPos.x, save.winPos.y);
    tiny.win.ensureOnScreen(); // voor als je scherm intussen veranderd is
  } else {
    await placeBottomRight();
  }
  setInterval(rememberWindowPosition, 2000);

  // Canvas klaarmaken en de knoppen koppelen.
  gameInitCanvas($('track'));
  setupButtons();
  applyCompact();

  // Callbacks van de game -> UI bijwerken.
  game.onCoin = () => bumpCoins();
  game.onLap = () => bumpCoins();

  // Berichten van de backend (src/backend/main.js):
  tiny.api.on('keys', ({ n }) => gameOnKeys(n));
  tiny.api.on('app', (info) => setApp(info));

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
  $('modeText').textContent = racing ? '🏁 RACE' : '🔧 PITS';
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
  if (!save.compact) gameDraw();
  updateHud();

  requestAnimationFrame(loop);
}

// Werkt de cijfers onderin en de coins bovenin bij.
function updateHud() {
  $('coinCount').textContent = Math.floor(save.coins);
  $('speed').textContent = Math.round(game.speed);
  $('lapNum').textContent = save.laps + 1;
  $('lapBar').style.width = (save.distance / CONFIG.LAP_LENGTH) * 100 + '%';
  $('drs').classList.toggle('on', drsActive());
  if (!$('garage').classList.contains('hidden')) refreshGarageButtons();
}

// Laat de coin-teller even "poppen".
function bumpCoins() {
  const el = $('coins');
  el.classList.add('bump');
  setTimeout(() => el.classList.remove('bump'), 120);
}

// ---------------------------------------------------------------------
//  KNOPPEN in de bovenbalk
// ---------------------------------------------------------------------
function setupButtons() {
  // 🔧 Garage open/dicht
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

  // ▾ Klein/groot venster
  $('btnCompact').onclick = () => toggleCompact();

  // ✕ Opslaan en afsluiten
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
  $('btnCompact').textContent = save.compact ? '▴' : '▾';
  const before = keepBottom ? await tiny.win.getState() : null;
  requestAnimationFrame(() => {
    const rect = $('widget').getBoundingClientRect();
    const w = Math.ceil(rect.width);
    const h = Math.ceil(rect.height);
    tiny.win.setSize(w, h);
    if (before) tiny.win.setPosition(before.x, before.y + before.height - h);
  });
}

// ---------------------------------------------------------------------
//  GARAGE - upgrades en autokleuren
// ---------------------------------------------------------------------

// Bouwt de hele garage opnieuw op.
function renderGarage() {
  // --- Upgrades ---
  const list = $('upgradeList');
  list.textContent = '';
  for (const [id, u] of Object.entries(UPGRADES)) {
    const row = el('div', 'upg');
    row.append(el('div', 'icon', u.icon));
    const info = el('div', 'info');
    const name = el('div', 'name', u.name);
    name.append(el('span', 'lvl', `Lv ${save.upgrades[id]}/${u.max}`));
    info.append(name, el('div', 'desc', u.desc));
    const btn = el('button', 'buy');
    btn.dataset.upgrade = id;
    btn.onclick = () => {
      if (buyUpgrade(id)) renderGarage();
    };
    row.append(info, btn);
    list.append(row);
  }

  // --- Autokleuren ---
  const liv = $('liveryList');
  liv.textContent = '';
  for (const [id, l] of Object.entries(LIVERIES)) {
    const owned = save.liveries.includes(id);
    const btn = el('button', 'livery');
    btn.classList.toggle('selected', save.livery === id);
    btn.classList.toggle('locked', !owned);
    const sw = el('span', 'swatch');
    sw.style.background = `linear-gradient(135deg, ${l.main} 60%, ${l.accent} 60%)`;
    btn.append(sw, el('span', '', owned ? l.name : `${l.name} · 🪙${l.price}`));
    btn.onclick = () => {
      if (buyOrSelectLivery(id)) renderGarage();
    };
    liv.append(btn);
  }

  // --- Statistieken ---
  const stats = $('stats');
  stats.textContent = '';
  const rows = [
    ['Rondes gereden', save.laps],
    ['Totale afstand', (save.totalDistance / 1000).toFixed(1) + ' km'],
    ['Toetsaanslagen', save.totalKeys],
    ['Topsnelheid ooit', save.bestSpeed + ' km/u'],
    ['Coins ooit verdiend', Math.floor(save.totalCoins)],
  ];
  for (const [label, value] of rows) stats.append(el('span', '', label), el('b', '', String(value)));

  refreshGarageButtons();
}

// Werkt alleen de koop-knoppen bij (prijs + of je het kunt betalen).
function refreshGarageButtons() {
  for (const btn of document.querySelectorAll('.buy')) {
    const id = btn.dataset.upgrade;
    const maxed = save.upgrades[id] >= UPGRADES[id].max;
    const cost = upgradeCost(id);
    btn.textContent = maxed ? 'MAX' : `🪙 ${cost}`;
    btn.disabled = maxed || save.coins < cost;
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
