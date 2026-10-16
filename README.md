# 🏎️ F1 Coding Minigame

Een klein F1-spelletje dat **altijd bovenop je scherm** staat en meespeelt terwijl je codeert.

- Zit je in een **coding-app** (VS Code, Visual Studio, een terminal...)? Dan staat je auto op de baan: **🏁 RACE**.
  Elke toets die je typt geeft gas.
- Zit je in een **andere app** (Brave, Discord, Spotify...)? Dan sta je in **🔧 DE PITS** en verdien je niks.
- Rijden levert **coins** op:
  - elke volle ronde = 10 coins
  - onderweg liggen coins op de baan die je auto automatisch oppakt
- Met coins koop je in de **garage (🔧-knop)** upgrades en nieuwe autokleuren. Je progressie wordt opgeslagen.

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
| 🔧 | Garage openen/sluiten (upgrades + autokleuren + statistieken) |
| ▾ / ▴ | Klein venster (alleen snelheid en ronde) / groot venster |
| ✕ | Opslaan en afsluiten |

### Upgrades

| Upgrade | Effect |
|---|---|
| 🔥 Motor | Hogere topsnelheid + meer boost per toets |
| 🪽 Aerodynamica | Je auto remt minder af als je stopt met typen |
| 💼 Sponsors | +20% coins per level |
| 📡 Coin-radar | Er liggen vaker coins op de baan |

**DRS**: rij je boven 85% van je topsnelheid, dan gaat DRS aan en rij je 20% sneller vooruit.

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
│       ├── game.js              ← ⭐ CONFIG (snelheid/balans), race-logica, auto tekenen
│       └── app.js               ← opstarten, game-loop, knoppen, garage-scherm
├── assets/icon.png              ← icoon van de app
├── types/                       ← type-informatie voor je editor (autocomplete)
└── .claude/ en .agents/         ← TinyJS-uitleg voor AI-assistenten (niet nodig voor de game)
```

### "Ik wil ... aanpassen"

| Ik wil... | Ga naar |
|---|---|
| een **coding-app toevoegen** | `src/backend/coding-apps.js` → lijst `CODING_APPS` |
| een app **negeren** (blijft vorige app) | `src/backend/coding-apps.js` → lijst `IGNORED_APPS` |
| de auto **sneller/langzamer** maken | `src/frontend/game.js` → `CONFIG` (bovenaan) |
| meer/minder **coins per ronde** | `src/frontend/game.js` → `CONFIG.LAP_COINS` |
| een ronde **langer/korter** maken | `src/frontend/game.js` → `CONFIG.LAP_LENGTH` |
| **prijzen van upgrades** veranderen | `src/frontend/progress.js` → `UPGRADES` |
| een **nieuwe autokleur** toevoegen | `src/frontend/progress.js` → `LIVERIES` |
| het **uiterlijk van de auto** veranderen | `src/frontend/game.js` → functie `drawCar()` |
| het **uiterlijk van de baan** veranderen | `src/frontend/game.js` → functie `gameDraw()` |
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
 │ main.js      → elke 400 ms: actieve app?    │ ─────► │ game.js     → snelheid, afstand, coins  │
 │ coding-apps  → is het een coding-app?       │        │ progress.js → upgrades, opslaan         │
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
