// =====================================================================
//  F1 CODING MINIGAME - VS Code-extensie
//
//  Deze extensie draait IN VS Code (VS Code heeft zijn eigen JavaScript-
//  runtime ingebouwd, je hoeft dus niks te installeren).
//
//  Wat doet hij?
//   1. Kijkt wat er in VS Code gebeurt en schrijft dat als "events" naar
//      een bestand:  ~/.f1-coding-minigame/events.jsonl
//         - errors in je code          -> { type: 'errors', count: 3 }
//         - terminal-commando klaar    -> { type: 'command', command: 'npm test', ok: true, test: true }
//         - task klaar (build/test)    -> { type: 'command', ... }
//         - debuggen gestart (F5)      -> { type: 'debug' }
//      De game (src/backend/vscode-bridge.js) leest dat bestand.
//   2. Leest ~/.f1-coding-minigame/status.json (geschreven door de game)
//      en laat je positie + coins zien in de statusbalk onderin VS Code.
// =====================================================================

const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const os = require('os');

// De map waarmee de extensie en de game met elkaar "praten".
const BRIDGE = path.join(os.homedir(), '.f1-coding-minigame');
const EVENTS = path.join(BRIDGE, 'events.jsonl');
const STATUS = path.join(BRIDGE, 'status.json');

// Commando's die we als "test" of "build" zien (groene vlag als ze slagen).
const TEST_RE = /\b(test|tests|pytest|jest|vitest|mocha|build|tsc|cargo|make|gradle|mvn|dotnet|lint)\b/i;

// Elk VS Code-venster heeft zijn eigen id (zodat de game errors per venster kan optellen).
const WINDOW_ID = Math.random().toString(36).slice(2, 10);

// Schrijft één event naar het events-bestand (één JSON-object per regel).
function send(ev) {
  try {
    fs.mkdirSync(BRIDGE, { recursive: true });
    fs.appendFileSync(EVENTS, JSON.stringify({ ...ev, window: WINDOW_ID, t: Date.now() }) + '\n');
  } catch (err) {
    console.error('[F1] kon event niet schrijven:', err);
  }
}

// Telt alle errors (rode kronkels) in alle geopende bestanden.
function countErrors() {
  let n = 0;
  for (const [, diagnostics] of vscode.languages.getDiagnostics()) {
    for (const d of diagnostics) {
      if (d.severity === vscode.DiagnosticSeverity.Error) n++;
    }
  }
  return n;
}

function activate(context) {
  // --- 1. Errors: sturen als het aantal verandert (max 1x per seconde) ---
  let lastErrors = -1;
  let errorTimer = null;
  const reportErrors = () => {
    const n = countErrors();
    if (n !== lastErrors) {
      lastErrors = n;
      send({ type: 'errors', count: n });
    }
  };
  context.subscriptions.push(
    vscode.languages.onDidChangeDiagnostics(() => {
      clearTimeout(errorTimer);
      errorTimer = setTimeout(reportErrors, 1000);
    }),
  );
  setTimeout(reportErrors, 3000);

  // --- 2. Terminal-commando's (bijv. "npm test", "python main.py") ---
  if (vscode.window.onDidEndTerminalShellExecution) {
    context.subscriptions.push(
      vscode.window.onDidEndTerminalShellExecution((e) => {
        if (e.exitCode === undefined) return; // onbekend resultaat
        const command = ((e.execution.commandLine && e.execution.commandLine.value) || '').trim();
        if (!command) return;
        send({ type: 'command', command: command.slice(0, 80), ok: e.exitCode === 0, test: TEST_RE.test(command) });
      }),
    );
  }

  // --- 3. Tasks (Terminal > Run Task, bijv. build of test) ---
  context.subscriptions.push(
    vscode.tasks.onDidEndTaskProcess((e) => {
      if (e.exitCode === undefined) return;
      send({ type: 'command', command: e.execution.task.name, ok: e.exitCode === 0, test: true });
    }),
  );

  // --- 4. Debuggen gestart (F5 / Run and Debug) ---
  context.subscriptions.push(
    vscode.debug.onDidStartDebugSession((s) => send({ type: 'debug', name: s.name })),
  );

  // --- 5. Statusbalk: positie + coins uit de game laten zien ---
  const item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  item.tooltip = 'F1 Coding Minigame';
  const updateStatus = () => {
    try {
      const s = JSON.parse(fs.readFileSync(STATUS, 'utf8'));
      if (Date.now() - s.t > 30000) return item.hide(); // game draait niet (meer)
      const pos = s.won ? 'P1 🏆' : `P${s.position}`;
      item.text = `🏎️ ${pos} · 🪙 ${s.coins}${s.rain ? ' · 🌧️' : ''}`;
      item.tooltip = `F1 Coding Minigame — GP van ${s.gp}${s.rain ? '\nHet regent: fix je errors!' : ''}`;
      item.show();
    } catch {
      item.hide(); // nog geen status (game nog nooit gestart)
    }
  };
  updateStatus();
  const interval = setInterval(updateStatus, 3000);
  context.subscriptions.push(item, { dispose: () => clearInterval(interval) });
}

// Venster dicht: laat de game weten dat dit venster geen errors meer heeft.
function deactivate() {
  send({ type: 'errors', count: 0 });
}

module.exports = { activate, deactivate };
