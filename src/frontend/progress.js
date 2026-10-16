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
//  Het effect van elke upgrade staat in game.js (zoek op "upgrade").
// ---------------------------------------------------------------------
const UPGRADES = {
  engine: {
    name: 'Motor',
    icon: '🔥',
    desc: 'Hogere topsnelheid + meer boost per toets',
    baseCost: 30,
    growth: 1.6,
    max: 10,
  },
  aero: {
    name: 'Aerodynamica',
    icon: '🪽',
    desc: 'Auto verliest minder snelheid als je stopt met typen',
    baseCost: 40,
    growth: 1.6,
    max: 10,
  },
  sponsor: {
    name: 'Sponsors',
    icon: '💼',
    desc: '+20% coins voor alles wat je verdient',
    baseCost: 60,
    growth: 1.7,
    max: 10,
  },
  radar: {
    name: 'Coin-radar',
    icon: '📡',
    desc: 'Er liggen vaker coins op de baan',
    baseCost: 50,
    growth: 1.65,
    max: 8,
  },
};

// ---------------------------------------------------------------------
//  LIVERIES (autokleuren) - puur voor de looks, koop je met coins
//  main = kleur van de auto, accent = vleugels/strepen, helmet = helm
// ---------------------------------------------------------------------
const LIVERIES = {
  rosso:   { name: 'Rosso',         price: 0,    main: '#d40000', accent: '#ffffff', helmet: '#ffd400' },
  papaya:  { name: 'Papaya',        price: 100,  main: '#ff8000', accent: '#1e88e5', helmet: '#ffffff' },
  bull:    { name: 'Midnight Bull', price: 200,  main: '#1b2a6b', accent: '#e10600', helmet: '#ffd400' },
  silver:  { name: 'Silver Arrow',  price: 300,  main: '#c0c6cc', accent: '#00d2be', helmet: '#202020' },
  green:   { name: 'Racing Green',  price: 400,  main: '#006f62', accent: '#cedc00', helmet: '#ffffff' },
  gold:    { name: 'Gold Edition',  price: 1000, main: '#d4af37', accent: '#111111', helmet: '#111111' },
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
    distance: 0,         // afstand in meters (binnen de huidige ronde gebruikt door game.js)
    totalDistance: 0,    // totale afstand in meters
    bestSpeed: 0,        // hoogste snelheid in km/u
    upgrades: { engine: 0, aero: 0, sponsor: 0, radar: 0 },
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

// Sponsor-bonus: elke level geeft +20% coins.
function coinMultiplier() {
  return 1 + 0.2 * save.upgrades.sponsor;
}

// Geeft coins (met sponsor-bonus). Geeft terug hoeveel je echt kreeg.
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
