// =====================================================================
//  TOETSENBORD-TELLER
//  Telt hoeveel toetsen je indrukt, ook als de game NIET gefocust is.
//
//  Hoe werkt het?
//  We gebruiken FFI ("Foreign Function Interface") van txiki.js om een
//  functie uit Windows zelf aan te roepen: GetAsyncKeyState uit user32.dll.
//  Die vertelt per toets of hij nu ingedrukt is.
//  Elke 15 ms kijken we alle toetsen langs en tellen we de NIEUWE drukken.
//
//  Privacy: we tellen alleen HOEVEEL toetsen je indrukt, nooit WELKE.
//  Er wordt niks opgeslagen of verstuurd.
// =====================================================================

import { dlopen } from 'tjs:ffi';

// Virtual-key codes (Windows) van toetsen die tellen als "typen".
// Shift, Ctrl, Alt en pijltjes tellen dus NIET mee.
const KEYS = [];
KEYS.push(0x08, 0x09, 0x0d, 0x20);              // Backspace, Tab, Enter, Spatie
for (let k = 0x30; k <= 0x39; k++) KEYS.push(k); // 0-9
for (let k = 0x41; k <= 0x5a; k++) KEYS.push(k); // A-Z
for (let k = 0x60; k <= 0x6f; k++) KEYS.push(k); // Numpad
for (let k = 0xba; k <= 0xc0; k++) KEYS.push(k); // ; = , - . / `
for (let k = 0xdb; k <= 0xdf; k++) KEYS.push(k); // [ \ ] '

// ---------------------------------------------------------------------
//  SNELTOETSEN die iets doen in de game
//  key = virtual-key code, ctrl = moet Ctrl ingedrukt zijn?
// ---------------------------------------------------------------------
const VK_CONTROL = 0x11;
const SHORTCUTS = [
  { name: 'save', key: 0x53, ctrl: true },  // Ctrl+S = bestand opslaan
  { name: 'run',  key: 0x74, ctrl: false }, // F5    = code runnen / debuggen (VS Code)
];

// Maakt een teller. Geeft een object terug met:
//   take() -> aantal toetsaanslagen sinds de vorige take()
// onShortcut(naam) wordt aangeroepen bij een sneltoets uit SHORTCUTS.
export function createKeyCounter(app, onShortcut = () => {}) {
  let count = 0;

  // --- Methode 1: Windows FFI (precies, telt echte toetsaanslagen) ---
  let GetAsyncKeyState = null;
  try {
    const user32 = dlopen('user32.dll', {
      GetAsyncKeyState: { args: ['i32'], returns: 'i16' },
    });
    GetAsyncKeyState = user32.symbols.GetAsyncKeyState;
  } catch (err) {
    console.log('[keyboard] FFI niet beschikbaar, val terug op idleTime:', err.message);
  }

  if (GetAsyncKeyState) {
    const wasDown = new Uint8Array(256); // onthoudt per toets of hij vorige keer al ingedrukt was
    setInterval(() => {
      for (const vk of KEYS) {
        const state = GetAsyncKeyState(vk);
        const down = (state & 0x8000) !== 0;       // hoogste bit = toets is NU ingedrukt
        const tappedSinceLast = (state & 1) !== 0; // laagste bit = kort aangetikt sinds vorige check
        if (!wasDown[vk] && (down || tappedSinceLast)) count++;
        wasDown[vk] = down ? 1 : 0;
      }

      // Sneltoetsen: alleen op het moment dat de toets NET ingedrukt wordt.
      const ctrlDown = (GetAsyncKeyState(VK_CONTROL) & 0x8000) !== 0;
      for (const sc of SHORTCUTS) {
        const down = (GetAsyncKeyState(sc.key) & 0x8000) !== 0;
        if (down && !sc.wasDown && (!sc.ctrl || ctrlDown)) onShortcut(sc.name);
        sc.wasDown = down;
      }
    }, 15);
  } else {
    // --- Methode 2: reserve (bijv. op Mac/Linux) ---
    // idleTime = seconden sinds je laatste input (toetsenbord OF muis).
    // Minder precies, maar beter dan niks.
    setInterval(async () => {
      try {
        const idle = await app.system.idleTime();
        if (idle !== null && idle < 0.25) count++;
      } catch {}
    }, 250);
  }

  return {
    take() {
      const n = count;
      count = 0;
      return n;
    },
  };
}
