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

### 🏆 Elke dag een Grand Prix

Elke dag is er een nieuwe GP (Monaco, Monza, Zandvoort...). Je start op **P10** en haalt tegenstanders
in door te coderen. Haal je **P1**, dan win je de GP: trofee, 100 coins en confetti!

Je rijdt tegen 9 tegenstanders: Max Merge, Lewis Linter, Charles Compiler, Lando Loop, Oscar Overflow,
Fernando Function, George Git, Carlos Cache en Yuki Yarn. Aan het eind van de dag krijg je **punten**
(25, 18, 15, 12...) voor het **wekelijkse kampioenschap (WK)**. Sta je zondagnacht bovenaan? Dan ben je
**wereldkampioen** (+250 coins). De stand zie je in de garage onder **WK**.

### 💻 Acties in VS Code (of de terminal) doen iets in de game

| Actie | Wat gebeurt er? |
|---|---|
| `git commit` | **Team radio** met je commit-bericht, +8 coins, **1 auto inhalen** |
| `git push` | Confetti, +20 coins, **2 auto's inhalen** |
| Branch wisselen (`git checkout`) | Team radio: "Box box, nieuwe strategie: *branch*" |
| `git pull` / merge | Team radio: "Nieuwe updates van het team binnengehaald" |
| `Ctrl+S` (opslaan) | "SAVED ✓" + ERS-batterij bijladen |
| `F5` (code runnen/debuggen) | **DRS** gaat open: 12 sec extra snelheid |
| Elke 15 rondes | 1 auto inhalen |

**Met de VS Code-extensie** (zie hieronder hoe je die installeert) gebeurt er nog meer:

| In VS Code | Wat gebeurt er? |
|---|---|
| Errors in je code (rode kronkels), langer dan 20 sec | 🌧️ **Het gaat regenen**: regenbanden, 15% langzamer |
| Alle errors gefixt | ☀️ Baan droogt op: **"ERRORS GEFIXT!"** +5 coins |
| Test of build geslaagd (`npm test`, `pytest`, `build`...) | 🟢 **Groene vlag** +5 coins |
| Commando in de terminal gefaald | 🟡 **Gele vlag**: team radio "Probleem met de auto" |
| Debuggen gestart | **DRS** gaat open |
| Statusbalk onderin VS Code | Laat je positie en coins zien: `🏎️ P7 · 🪙 51` |

### 🔧 Pitstop-challenge

Sta je in de pits (je zit in je browser of een andere app)? Dan verschijnt er in de garage een knop
**PITSTOP-CHALLENGE**. Na 3-2-1 licht er een band op: klik hem zo snel mogelijk, dan de volgende... tot
alle 4 de banden gewisseld zijn. Verkeerde band = +0,5 sec straf. Onder de 2 seconden = 25 coins!
Je kunt hem 1x per 10 minuten doen.

### 🔊 Geluid

Korte geluidjes bij coins, rondes, team radio, inhalen, winst en de start-lampen. Ze worden gemaakt met
Web Audio (geen geluidsbestanden). Zet het geluid uit met de **luidspreker-knop** bovenin.

Daarnaast zijn er **16 achievements** (bijv. "Eerste commit", "Ship it!", "Nachtuil", "Pitcrew",
"Regenmeester") die extra coins geven. Je vindt ze in de garage onder **Trofeeën**.

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

4. **De VS Code-extensie installeren** (optioneel, voor regen/vlaggen/statusbalk):
   ```powershell
   .\vscode-extension\install.ps1
   ```
   Daarna in VS Code: `Ctrl+Shift+P` → **Developer: Reload Window**.
   Het script maakt zelf een `.vsix`-bestand (een zip), dus je hebt geen Node.js of `vsce` nodig.

> ⚠️ Je hebt **geen Node.js of npm** nodig. De backend draait op **txiki.js**, dat bij TinyJS zit.
> `require(...)` en Node-modules zoals `fs` werken daarom niet. Gebruik `tjs.*` (zie de TinyJS-docs).
> (Alleen de VS Code-extensie gebruikt `require`, maar die draait ín VS Code, dat zijn eigen runtime heeft.)

---

## 🎮 Bediening

| Knop | Wat doet het? |
|---|---|
| Bovenbalk slepen | Venster verplaatsen (de positie wordt onthouden) |
| Luidspreker | Geluid aan/uit |
| Moersleutel | Garage openen/sluiten (tabbladen: Upgrades, Lak, WK, Trofeeën, Stats) |
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
│   │   ├── keyboard.js          ← telt toetsaanslagen + sneltoetsen Ctrl+S / F5 (via user32.dll / FFI)
│   │   ├── git-watcher.js       ← ⭐ ziet commits, pushes, checkouts (GIT_FOLDERS = waar hij zoekt)
│   │   ├── vscode-bridge.js     ← praat met de VS Code-extensie (via ~/.f1-coding-minigame/)
│   │   └── coding-apps.js       ← ⭐ LIJST MET CODING-APPS (hier voeg je apps toe)
│   └── frontend/                ← het venster zelf (gewone HTML/CSS/JS)
│       ├── index.html           ← opbouw van het widget (knoppen, baan, HUD, garage)
│       ├── style.css            ← kleuren en opmaak (kleuren staan bovenaan in :root)
│       ├── progress.js          ← ⭐ coins, UPGRADES, LIVERIES (autokleuren), opslaan
│       ├── game.js              ← ⭐ CONFIG (balans), race-logica: brandstof, ERS, streak, rondes
│       ├── render.js            ← ⭐ alle graphics: baan, tribunes, auto, garage, dag/nacht
│       ├── career.js            ← ⭐ GP, WK, tegenstanders, regen, achievements, git/VS Code-acties
│       ├── pitstop.js           ← de pitstop-minigame
│       ├── sound.js             ← ⭐ alle geluiden (SOUNDS) + volume
│       ├── app.js               ← opstarten, game-loop, HUD, banners, garage-scherm
│       └── fonts/               ← lettertype Titillium Web (gratis, OFL-licentie)
├── vscode-extension/            ← de VS Code-extensie
│   ├── extension.js             ← ⭐ wat de extensie in VS Code bekijkt (errors, terminal, debuggen)
│   ├── package.json             ← naam/versie van de extensie
│   └── install.ps1              ← maakt de .vsix en installeert hem in VS Code
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
| **sneltoetsen** toevoegen (bijv. Ctrl+Z) | `src/backend/keyboard.js` → `SHORTCUTS` + `src/frontend/career.js` → `careerOnShortcut()` |
| in **andere mappen** naar git-repo's zoeken | `src/backend/git-watcher.js` → `GIT_FOLDERS` |
| wat er gebeurt bij **commit/push** | `src/frontend/career.js` → `careerOnGit()` en `CAREER` |
| **beloningen** (coins per commit/push/winst) | `src/frontend/career.js` → `CAREER` |
| een **achievement** toevoegen | `src/frontend/career.js` → lijst `ACHIEVEMENTS` |
| de **lijst met Grands Prix** | `src/frontend/career.js` → `GRANDS_PRIX` |
| **tegenstanders** (namen, kleuren) | `src/frontend/career.js` → `RIVALS` |
| **punten** van het WK | `src/frontend/career.js` → `POINTS` |
| wanneer het gaat **regenen** | `src/frontend/game.js` → `CONFIG.RAIN_DELAY` en `RAIN_SPEED_FACTOR` |
| hoe de **regen eruitziet** | `src/frontend/render.js` → functies `drawRain()` en `drawSpray()` |
| de **pitstop** (tijden, beloning, wachttijd) | `src/frontend/career.js` → `CAREER.PITSTOP_*` |
| een **geluid** veranderen of het **volume** | `src/frontend/sound.js` → `SOUNDS` en `MASTER_VOLUME` |
| welke commando's een **groene vlag** geven | `vscode-extension/extension.js` → `TEST_RE` (daarna `install.ps1` opnieuw) |

### Hoe voeg ik een coding-app toe?

1. Start de game (`tinyjs dev`) en klik op de app die je wilt toevoegen.
2. In het game-venster, naast `PITS`, staat nu de naam die Windows doorgeeft (bijv. `Code` of `brave`).
3. Zet die naam in **kleine letters** in `CODING_APPS` in `src/backend/coding-apps.js`.
4. Opslaan: de game herstart vanzelf en je racet in die app.

---

## ⚙️ Hoe werkt het (technisch)?

```
 ┌──────────── BACKEND (txiki.js) ────────────┐        ┌────────── FRONTEND (venster) ──────────┐
 │ keyboard.js  → toetsen + Ctrl+S/F5 (15 ms)  │ push   │ app.js      → ontvangt alle berichten   │
 │ main.js      → elke 400 ms: actieve app?    │ ─────► │ game.js     → brandstof, ERS, inhalen   │
 │ coding-apps  → is het een coding-app?       │        │ render.js   → tekent alles op canvas    │
 │ git-watcher  → elke 2 s: nieuwe git-acties? │        │ career.js   → GP, WK, regen, git        │
 │ vscode-bridge→ elke 0,5 s: events uit VS Code│        │ sound.js    → geluidjes                 │
 │                                             │        │ progress.js → upgrades, opslaan         │
 └──────────────────────▲──────────────────────┘        └─────────────────────────────────────────┘
                        │ ~/.f1-coding-minigame/events.jsonl  (errors, tests, debuggen)
                        │ ~/.f1-coding-minigame/status.json   (positie + coins voor de statusbalk)
 ┌──────────────────────┴──────────────────────┐
 │ VS CODE-EXTENSIE (vscode-extension/)        │
 └─────────────────────────────────────────────┘
```

- **Altijd bovenop**: `tiny.win.setAlwaysOnTop(true)` in `app.js`.
- **Transparant venster zonder rand**: `"chrome"` in `tinyjs.json`.
- **Welke app is actief?**: `app.frontmostApp()` in `src/backend/main.js`. Dat geeft de naam van het programma terug (bijv. `Code`).
- **Toetsen tellen**: `src/backend/keyboard.js` gebruikt **FFI** (`tjs:ffi`) om de Windows-functie
  `GetAsyncKeyState` uit `user32.dll` aan te roepen. Zo werkt het ook als de game niet gefocust is.
  Er wordt alleen geteld **hoeveel** toetsen je indrukt, nooit **welke**. Er wordt niks opgeslagen of verstuurd.
- **Git-acties zien**: `src/backend/git-watcher.js` zoekt git-repo's in `GIT_FOLDERS` en leest elke 2 seconden
  het logboek van git (de *reflog* in `.git/logs/`). Daar schrijft git bij elke commit `commit: <bericht>` en bij
  elke push `update by push` in. Daardoor werkt het met VS Code, de terminal én GitHub Desktop.
- **VS Code-extensie**: `vscode-extension/extension.js` gebruikt de VS Code-API (errors = *diagnostics*,
  `onDidEndTerminalShellExecution` voor terminal-commando's, `onDidStartDebugSession` voor debuggen) en schrijft
  dat als JSON-regels naar `~/.f1-coding-minigame/events.jsonl`. De game leest dat bestand (`vscode-bridge.js`).
  Zo hoeven ze geen server of poort te openen.
- **Opslaan**: `tiny.store` in `progress.js`. Je save staat in
  `%APPDATA%\com.lars.f1-coding-minigame\store.json`. Verwijder dat bestand om opnieuw te beginnen.

---

## 🔗 Handige links

- TinyJS: https://tinyjs.app (docs: https://tinyjs.app/docs.html)
- TinyJS-voorbeelden: https://github.com/tarwin/tinyjsapp-examples
- txiki.js (de JavaScript-runtime): https://github.com/saghul/txiki.js
