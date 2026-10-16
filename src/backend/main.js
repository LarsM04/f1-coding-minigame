// =====================================================================
//  BACKEND (draait op txiki.js, NIET op Node.js!)
//
//  De backend is de "sensor" van de game. Hij doet vier dingen:
//    1. Toetsaanslagen + sneltoetsen tellen   (zie keyboard.js)
//    2. Kijken welke app actief is            (zie coding-apps.js)
//    3. Git-acties zien: commit, push, ...    (zie git-watcher.js)
//    4. Praten met de VS Code-extensie        (zie vscode-bridge.js)
//  En stuurt dat door naar de frontend (het venster) met app.push().
//
//  Alle game-logica (snelheid, coins, upgrades) zit in de frontend:
//  src/frontend/game.js en src/frontend/progress.js
// =====================================================================

import { createKeyCounter } from './keyboard.js';
import { isCodingApp, isIgnored, normalizeAppName } from './coding-apps.js';
import { createGitWatcher } from './git-watcher.js';
import { createVscodeBridge } from './vscode-bridge.js';

let vscode = null; // de VS Code-brug (wordt gemaakt in init)

// Functies die de frontend kan aanroepen met tiny.api.call('naam').
export const api = {
  // Geeft de huidige actieve app terug (handig bij het opstarten).
  async currentApp(_params, app) {
    return readFrontApp(app);
  },

  // Schrijft je positie/coins voor de statusbalk in VS Code.
  async writeStatus(status) {
    if (vscode) await vscode.writeStatus(status);
  },
};

// Laatste "echte" app (dus niet deze game zelf of de taakbalk).
let lastApp = { name: '', coding: false };

// Leest welke app nu op de voorgrond staat.
async function readFrontApp(app) {
  let front = null;
  try {
    front = await app.frontmostApp(); // { name, bundleId, pid } of null
  } catch {}

  const name = front && front.name ? front.name : '';
  // Klik je op de game zelf of de taakbalk? Dan houden we de vorige app aan.
  if (name && !isIgnored(name)) {
    lastApp = { name, coding: isCodingApp(name) };
  }
  return lastApp;
}

// init() wordt 1x aangeroepen als het venster open is.
export function init(app) {
  // --- Sneltoetsen (Ctrl+S, F5) direct doorsturen ---
  const keys = createKeyCounter(app, (name) => app.push('shortcut', { name }));

  // --- Git-acties (commit, push, checkout, pull) direct doorsturen ---
  createGitWatcher((ev) => app.push('git', ev));

  // --- Events uit de VS Code-extensie (errors, tests, debuggen) doorsturen ---
  vscode = createVscodeBridge((ev) => app.push('vscode', ev));

  // --- Elke 100 ms: toetsaanslagen doorsturen naar de frontend ---
  setInterval(() => {
    const n = keys.take();
    if (n > 0) app.push('keys', { n });
  }, 100);

  // --- Elke 400 ms: checken welke app actief is ---
  let lastSent = '';
  setInterval(async () => {
    const info = await readFrontApp(app);
    const key = normalizeAppName(info.name) + '|' + info.coding;
    if (key !== lastSent) {
      lastSent = key;
      app.push('app', info); // alleen sturen als het veranderd is
    }
  }, 400);
}
