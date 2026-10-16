// =====================================================================
//  PROGRESSIE: coins, upgrades, autokleuren (liveries) en opslaan
//
//  Alles wat je verdient staat in het object `save`.
//  Dat wordt opgeslagen met tiny.store (een JSON-bestand op je pc),
//  zodat je progressie blijft bestaan als je de game afsluit.
// =====================================================================

// ---------------------------------------------------------------------
//  UPGRADES - hier pas je prijzen en effecten aan
//  cost = baseCost * growth ^ level  (elke level wordt duurder)
//  Het effect van elke upgrade staat in game.js (zoek op "UPGRADE-EFFECTEN").
//  icon = naam van een icoon in ICONS (zie app.js)
// ---------------------------------------------------------------------
const UPGRADES = {
  engine: {
    name: 'Motor',
    icon: 'engine',
    color: '#ff3b30',
    desc: '+12 km/u kruissnelheid → snellere rondes',
    baseCost: 25,
    growth: 1.55,
    max: 10,
  },
  fuel: {
    name: 'Brandstoftank',
    icon: 'fuel',
    color: '#34c759',
    desc: '+20 sec denktijd voordat je auto stilvalt',
    baseCost: 30,
    growth: 1.6,
    max: 8,
  },
  ers: {
    name: 'ERS-batterij',
    icon: 'bolt',
    color: '#ffcc00',
    desc: 'Typen laadt meer op + grotere boost',
    baseCost: 40,
    growth: 1.6,
    max: 10,
  },
  sponsor: {
    name: 'Sponsors',
    icon: 'briefcase',
    color: '#0a84ff',
    desc: '+20% coins voor alles wat je verdient',
    baseCost: 60,
    growth: 1.7,
    max: 10,
  },
  radar: {
    name: 'Coin-radar',
    icon: 'radar',
    color: '#bf5af2',
    desc: 'Er liggen vaker coins op de baan',
    baseCost: 45,
    growth: 1.65,
    max: 8,
  },
};

// ---------------------------------------------------------------------
//  LIVERIES (autokleuren) - puur voor de looks, koop je met coins
//  main = kleur van de auto, accent = vleugels/strepen,
//  helmet = helm, number = startnummer op de auto
// ---------------------------------------------------------------------
const LIVERIES = {
  rosso:   { name: 'Rosso',         price: 0,    main: '#d40000', accent: '#ffe100', dark: '#1a1a1a', helmet: '#ffd400', number: 16 },
  papaya:  { name: 'Papaya',        price: 100,  main: '#ff8000', accent: '#2196f3', dark: '#111111', helmet: '#ffffff', number: 4 },
  bull:    { name: 'Midnight Bull', price: 200,  main: '#1b2a6b', accent: '#e10600', dark: '#0b1233', helmet: '#ffd400', number: 1 },
  silver:  { name: 'Silver Arrow',  price: 300,  main: '#c0c6cc', accent: '#00d2be', dark: '#16191c', helmet: '#f2f2f2', number: 44 },
  green:   { name: 'Racing Green',  price: 400,  main: '#00594f', accent: '#cedc00', dark: '#0d1f1c', helmet: '#ffffff', number: 14 },
  pink:    { name: 'Pink Panther',  price: 600,  main: '#f363b9', accent: '#1b4fd8', dark: '#1a1a2e', helmet: '#ffffff', number: 31 },
  gold:    { name: 'Gold Edition',  price: 1000, main: '#d4af37', accent: '#111111', dark: '#0a0a0a', helmet: '#111111', number: 99 },
};

// ---------------------------------------------------------------------
//  SAVE-DATA - zo ziet een nieuwe (lege) save eruit
// ---------------------------------------------------------------------
function newSave() {
  return {
    coins: 0,            // je coins (kan een kommagetal zijn, we tonen het afgerond)
    totalCoins: 0,       // alle coins ooit verdiend
    totalKeys: 0,        // aantal toetsaanslagen in coding-apps
    laps: 0,             // aantal rondes gereden
    distance: 0,         // meters gereden in de HUIDIGE ronde
    totalDistance: 0,    // totale afstand in meters
    codingSeconds: 0,    // hoeveel seconden je auto gereden heeft (= actief gecodeerd)
    bestSpeed: 0,        // hoogste snelheid in km/u
    bestLap: null,       // snelste rondetijd in seconden (null = nog geen)
    bestStreak: 1,       // hoogste streak-multiplier ooit
    commits: 0,          // aantal git commits
    pushes: 0,           // aantal git pushes
    saves: 0,            // aantal keer Ctrl+S
    runs: 0,             // aantal keer F5
    gp: null,            // Grand Prix van vandaag { date, name, position, won, lapsAtStart } (zie career.js)
    gpWins: 0,           // aantal gewonnen Grands Prix
    trophies: [],        // gewonnen GP's: [{ date, name }]
    achievements: [],    // id's van behaalde achievements
    upgrades: { engine: 0, fuel: 0, ers: 0, sponsor: 0, radar: 0 },
    liveries: ['rosso'], // gekochte kleuren
    livery: 'rosso',     // kleur die je nu gebruikt
    compact: false,      // klein venster aan/uit
    winPos: null,        // laatste positie van het venster { x, y } (null = nog nooit verplaatst)
  };
}

let save = newSave();
let saveDirty = false; // true = er is iets veranderd dat nog opgeslagen moet worden

// Laadt de save uit tiny.store. Ontbrekende velden (bijv. na een update
// met nieuwe upgrades) worden aangevuld met de standaardwaarde.
async function loadSave() {
  try {
    const stored = await tiny.store.get('save');
    if (stored) {
      const fresh = newSave();
      save = { ...fresh, ...stored, upgrades: { ...fresh.upgrades, ...(stored.upgrades || {}) } };

      // Oude versie: "Aerodynamica" heet nu "Brandstoftank".
      if (save.upgrades.aero !== undefined) {
        save.upgrades.fuel = Math.min(UPGRADES.fuel.max, Math.max(save.upgrades.fuel, save.upgrades.aero));
        delete save.upgrades.aero;
      }
      // Oude versie: rondes waren langer, dus zorg dat de huidige ronde niet "te ver" is.
      if (save.distance >= CONFIG.LAP_LENGTH) save.distance = 0;
      delete save.placed;
    }
  } catch (err) {
    tiny.log('Kon save niet laden: ' + err);
  }
}

// Slaat de save op (alleen als er iets veranderd is, tenzij force = true).
async function writeSave(force = false) {
  if (!saveDirty && !force) return;
  saveDirty = false;
  try {
    await tiny.store.set('save', save);
  } catch (err) {
    tiny.log('Kon save niet opslaan: ' + err);
  }
}

// Automatisch opslaan elke 5 seconden.
setInterval(() => writeSave(), 5000);

// ---------------------------------------------------------------------
//  COINS
// ---------------------------------------------------------------------

// Totale bonus: sponsors (+20% per level) × je huidige streak.
function coinMultiplier() {
  return (1 + 0.2 * save.upgrades.sponsor) * game.streak;
}

// Geeft coins (met bonus). Geeft terug hoeveel je echt kreeg.
function addCoins(amount) {
  const gained = amount * coinMultiplier();
  save.coins += gained;
  save.totalCoins += gained;
  saveDirty = true;
  return gained;
}

// ---------------------------------------------------------------------
//  UPGRADES KOPEN
// ---------------------------------------------------------------------

// Prijs van de volgende level van een upgrade.
function upgradeCost(id) {
  const u = UPGRADES[id];
  return Math.round(u.baseCost * Math.pow(u.growth, save.upgrades[id]));
}

// Probeert een upgrade te kopen. true = gelukt.
function buyUpgrade(id) {
  const u = UPGRADES[id];
  const level = save.upgrades[id];
  const cost = upgradeCost(id);
  if (level >= u.max || save.coins < cost) return false;
  save.coins -= cost;
  save.upgrades[id] = level + 1;
  writeSave(true);
  return true;
}

// ---------------------------------------------------------------------
//  LIVERIES KOPEN / KIEZEN
// ---------------------------------------------------------------------

// Koopt (als je hem nog niet hebt) en selecteert een livery. true = gelukt.
function buyOrSelectLivery(id) {
  const l = LIVERIES[id];
  if (!save.liveries.includes(id)) {
    if (save.coins < l.price) return false;
    save.coins -= l.price;
    save.liveries.push(id);
  }
  save.livery = id;
  writeSave(true);
  return true;
}

// De livery die nu gebruikt wordt (voor het tekenen van de auto).
function currentLivery() {
  return LIVERIES[save.livery] || LIVERIES.rosso;
}
