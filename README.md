# 🏎️ F1 Coding Minigame

Een klein F1-spelletje dat **altijd bovenop je scherm** staat en meespeelt terwijl je codeert.

- Zit je in een **coding-app** (VS Code, Visual Studio, een terminal...)? Dan staat je auto op de baan: **🏁 RACE**.
- Zit je in een **andere app** (Brave, Discord, Spotify...)? Dan staat je auto in **🔧 DE GARAGE** en verdien je niks.
- Het gaat om **hoe lang je codeert**, niet hoe snel je typt:
  - **FUEL (denktijd)**: elke toets vult je tank. Zolang er brandstof is rijdt je auto op kruissnelheid,
    ook als je even nadenkt. Typ je een minuut niks, dan valt hij stil.
  - **ERS**: typen laadt je batterij op → extra snelheid (een bonus, niet verplicht).
  - **STREAK**: elke minuut achter elkaar coderen = +0.1× coins (max ×2). Een minuut stilstaan of in de pits = streak weg.
- Rijden levert **coins** op: 5 per ronde (±30 sec) + coins die op de baan liggen.
- Elke ronde heeft een **rondetijd**; een nieuw record geeft een paarse **BESTE RONDE**.
- Met coins koop je in de **garage (moersleutel-knop)** upgrades en autokleuren. Je progressie wordt opgeslagen.
- De baan verandert mee met de **echte tijd**: overdag, zonsondergang of een nachtrace met lichtmasten.

Gemaakt met [TinyJS](https://tinyjs.app): kleine desktop-apps (~6 MB) met een JavaScript-backend op
**txiki.js** (dus **geen Node.js**) en een venster dat de ingebouwde webview van Windows gebruikt (WebView2).

---

## 🚀 Installeren & starten

1. **TinyJS installeren** (eenmalig, in PowerShell):
   ```powershell
   irm https://tinyjs.app/install.ps1 | iex
   ```
   Open daarna een **nieuwe** terminal, zodat het `tinyjs`-commando werkt.

2. **De game starten** (in de map van dit project):
   ```powershell
   tinyjs dev
   ```
   Het venster verschijnt rechtsonder op je scherm. Pas je code aan terwijl hij draait,
   dan herlaadt hij vanzelf.

3. **Een losse .exe bouwen** (optioneel):
   ```powershell
   tinyjs build
   ```
   Je app staat dan in de map `dist/`.

> ⚠️ Je hebt **geen Node.js of npm** nodig. De backend draait op **txiki.js**, dat bij TinyJS zit.
> `require(...)` en Node-modules zoals `fs` werken daarom niet. Gebruik `tjs.*` (zie de TinyJS-docs).

---

## 🎮 Bediening

| Knop | Wat doet het? |
|---|---|
| Bovenbalk slepen | Venster verplaatsen (de positie wordt onthouden) |
| Moersleutel | Garage openen/sluiten (tabbladen: Upgrades, Lak, Stats) |
| Pijltje | Klein venster (alleen de HUD) / groot venster |
| Kruisje | Opslaan en afsluiten |

### Upgrades

| Upgrade | Effect |
|---|---|
| Motor | +12 km/u kruissnelheid → snellere rondes |
| Brandstoftank | +20 sec denktijd voordat je auto stilvalt |
| ERS-batterij | Typen laadt meer op + grotere boost |
| Sponsors | +20% coins per level |
| Coin-radar | Er liggen vaker coins op de baan |

---

## 🗺️ Waar vind je alles?

```
F1 coding minigame/
├── tinyjs.json                  ← instellingen van het venster (grootte, transparant, naam)
├── src/
│   ├── backend/                 ← draait op txiki.js (heeft toegang tot je systeem)
│   │   ├── main.js              ← start alles, stuurt toetsen + actieve app naar het venster
│   │   ├── keyboard.js          ← telt toetsaanslagen (via Windows user32.dll / FFI)
│   │   └── coding-apps.js       ← ⭐ LIJST MET CODING-APPS (hier voeg je apps toe)
│   └── frontend/                ← het venster zelf (gewone HTML/CSS/JS)
│       ├── index.html           ← opbouw van het widget (knoppen, baan, HUD, garage)
│       ├── style.css            ← kleuren en opmaak (kleuren staan bovenaan in :root)
│       ├── progress.js          ← ⭐ coins, UPGRADES, LIVERIES (autokleuren), opslaan
│       ├── game.js              ← ⭐ CONFIG (balans), race-logica: brandstof, ERS, streak, rondes
│       ├── render.js            ← ⭐ alle graphics: baan, tribunes, auto, garage, dag/nacht
│       ├── app.js               ← opstarten, game-loop, HUD, banners, garage-scherm
│       └── fonts/               ← lettertype Titillium Web (gratis, OFL-licentie)
├── assets/icon.png              ← icoon van de app
├── types/                       ← type-informatie voor je editor (autocomplete)
└── .claude/ en .agents/         ← TinyJS-uitleg voor AI-assistenten (niet nodig voor de game)
```

### "Ik wil ... aanpassen"

| Ik wil... | Ga naar |
|---|---|
| een **coding-app toevoegen** | `src/backend/coding-apps.js` → lijst `CODING_APPS` |
| een app **negeren** (blijft vorige app) | `src/backend/coding-apps.js` → lijst `IGNORED_APPS` |
| de auto **sneller/langzamer** maken | `src/frontend/game.js` → `CONFIG.BASE_CRUISE` |
| **langer/korter denktijd** | `src/frontend/game.js` → `CONFIG.BASE_THINK_TIME` |
| meer/minder **coins per ronde** | `src/frontend/game.js` → `CONFIG.LAP_COINS` |
| een ronde **langer/korter** maken | `src/frontend/game.js` → `CONFIG.LAP_LENGTH` |
| de **streak** aanpassen | `src/frontend/game.js` → `CONFIG.STREAK_*` |
| **prijzen van upgrades** veranderen | `src/frontend/progress.js` → `UPGRADES` |
| een **nieuwe autokleur** toevoegen | `src/frontend/progress.js` → `LIVERIES` |
| het **uiterlijk van de auto** veranderen | `src/frontend/render.js` → functie `drawCarSide()` |
| de **baan / tribunes** veranderen | `src/frontend/render.js` → `drawTrackScene()` en `draw...Layer()` |
| de **teksten op de reclameborden** | `src/frontend/render.js` → lijst `BOARDS` |
| de **kleuren van dag/nacht** | `src/frontend/render.js` → `PALETTES` en `currentPeriod()` |
| de **garage** (pits) veranderen | `src/frontend/render.js` → functie `drawGarageScene()` |
| **kleuren van het venster** veranderen | `src/frontend/style.css` → `:root` (bovenaan) |
| de **venstergrootte** veranderen | `tinyjs.json` → `size` + `src/frontend/style.css` → `#widget` |
| welke **toetsen** meetellen | `src/backend/keyboard.js` → lijst `KEYS` |

### Hoe voeg ik een coding-app toe?

1. Start de game (`tinyjs dev`) en klik op de app die je wilt toevoegen.
2. In het game-venster, naast `PITS`, staat nu de naam die Windows doorgeeft (bijv. `Code` of `brave`).
3. Zet die naam in **kleine letters** in `CODING_APPS` in `src/backend/coding-apps.js`.
4. Opslaan: de game herstart vanzelf en je racet in die app.

---

## ⚙️ Hoe werkt het (technisch)?

```
 ┌──────────── BACKEND (txiki.js) ────────────┐        ┌────────── FRONTEND (venster) ──────────┐
 │ keyboard.js  → telt toetsen elke 15 ms      │ push   │ app.js      → ontvangt 'keys' + 'app'   │
 │ main.js      → elke 400 ms: actieve app?    │ ─────► │ game.js     → brandstof, ERS, coins     │
 │ coding-apps  → is het een coding-app?       │        │ render.js   → tekent alles op canvas    │
 │                                             │        │ progress.js → upgrades, opslaan         │
 └─────────────────────────────────────────────┘        └─────────────────────────────────────────┘
```

- **Altijd bovenop**: `tiny.win.setAlwaysOnTop(true)` in `app.js`.
- **Transparant venster zonder rand**: `"chrome"` in `tinyjs.json`.
- **Welke app is actief?**: `app.frontmostApp()` in `src/backend/main.js`. Dat geeft de naam van het programma terug (bijv. `Code`).
- **Toetsen tellen**: `src/backend/keyboard.js` gebruikt **FFI** (`tjs:ffi`) om de Windows-functie
  `GetAsyncKeyState` uit `user32.dll` aan te roepen. Zo werkt het ook als de game niet gefocust is.
  Er wordt alleen geteld **hoeveel** toetsen je indrukt, nooit **welke**. Er wordt niks opgeslagen of verstuurd.
- **Opslaan**: `tiny.store` in `progress.js`. Je save staat in
  `%APPDATA%\com.lars.f1-coding-minigame\store.json`. Verwijder dat bestand om opnieuw te beginnen.

---

## 🔗 Handige links

- TinyJS: https://tinyjs.app (docs: https://tinyjs.app/docs.html)
- TinyJS-voorbeelden: https://github.com/tarwin/tinyjsapp-examples
- txiki.js (de JavaScript-runtime): https://github.com/saghul/txiki.js
