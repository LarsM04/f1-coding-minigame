// =====================================================================
//  VS CODE-BRUG
//  Praat met de VS Code-extensie (map vscode-extension/) via bestanden
//  in ~/.f1-coding-minigame/ (geen server of poorten nodig):
//
//    events.jsonl  <- de extensie schrijft hier events in (1 JSON per regel)
//                     bijv. {"type":"errors","count":3,"window":"ab12"}
//    status.json   -> de game schrijft hier je positie/coins in,
//                     de extensie laat dat zien in de statusbalk van VS Code
// =====================================================================

const BRIDGE = tjs.homeDir + '/.f1-coding-minigame';
const EVENTS = BRIDGE + '/events.jsonl';
const STATUS = BRIDGE + '/status.json';
const MAX_SIZE = 256 * 1024; // events-bestand leegmaken als het groter wordt dan dit

const dec = new TextDecoder();
const enc = new TextEncoder();

// onEvent krijgt elk event uit VS Code.
export function createVscodeBridge(onEvent) {
  let known = null; // tot waar (in bytes) we het bestand al gelezen hebben

  async function poll() {
    let size;
    try {
      size = (await tjs.stat(EVENTS)).size;
    } catch {
      return; // extensie nog nooit gebruikt
    }

    // Eerste keer: oude events overslaan, behalve de LAATSTE error-telling
    // per VS Code-venster (zodat het meteen regent als je al errors hebt).
    if (known === null) {
      const lines = dec.decode(await tjs.readFile(EVENTS)).split('\n');
      const lastErrors = {};
      for (const ev of lines.map(parseJson)) {
        if (ev && ev.type === 'errors') lastErrors[ev.window] = ev;
      }
      for (const ev of Object.values(lastErrors)) onEvent(ev);
      known = size;
      if (size > MAX_SIZE) await truncate();
      return;
    }

    if (size < known) known = 0; // bestand is leeggemaakt
    if (size === known) return;

    const text = dec.decode((await tjs.readFile(EVENTS)).subarray(known));
    const end = text.lastIndexOf('\n'); // alleen complete regels
    if (end === -1) return;
    known += enc.encode(text.slice(0, end + 1)).length;
    for (const ev of text.slice(0, end).split('\n').map(parseJson)) {
      if (ev) onEvent(ev);
    }
    if (known > MAX_SIZE) await truncate();
  }

  async function truncate() {
    await tjs.writeFile(EVENTS, enc.encode(''));
    known = 0;
  }

  setInterval(() => poll().catch((e) => console.log('[vscode] fout:', e.message)), 500);

  return {
    // Schrijft de status van de game (voor de statusbalk in VS Code).
    async writeStatus(status) {
      await tjs.makeDir(BRIDGE, { recursive: true });
      await tjs.writeFile(STATUS, enc.encode(JSON.stringify({ ...status, t: Date.now() })));
    },
  };
}

function parseJson(line) {
  try {
    return line.trim() ? JSON.parse(line) : null;
  } catch {
    return null;
  }
}
