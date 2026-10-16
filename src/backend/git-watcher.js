// =====================================================================
//  GIT-WATCHER
//  Ziet wanneer je commit, pusht, van branch wisselt of pullt, en
//  stuurt dat naar de game. Werkt met VS Code, de terminal, GitHub
//  Desktop... alles wat git gebruikt.
//
//  Hoe werkt het?
//  Git houdt in elke repo een logboek bij (de "reflog") in .git/logs/:
//    .git/logs/HEAD                    -> "commit: fix bug", "checkout: moving from main to test"
//    .git/logs/refs/remotes/origin/... -> "update by push"
//  Elke 2 seconden kijken we of die bestanden groter geworden zijn.
//  Zo ja, dan lezen we de nieuwe regels en vertalen we ze naar game-events.
// =====================================================================

// ---------------------------------------------------------------------
//  INSTELLINGEN - in deze mappen zoeken we naar git-repo's
//  (ook 1 en 2 mappen diep, dus C:/Code Lars/mijn-project wordt gevonden)
//  Mappen die niet bestaan worden gewoon overgeslagen.
// ---------------------------------------------------------------------
export const GIT_FOLDERS = [
  'C:/Code Lars',
  tjs.homeDir + '/source/repos',      // standaardmap van Visual Studio
  tjs.homeDir + '/Documents/GitHub',  // standaardmap van GitHub Desktop
];
const SCAN_DEPTH = 2;          // hoe diep we in de mappen zoeken
const POLL_MS = 2000;          // hoe vaak we checken op nieuwe git-acties
const RESCAN_MS = 60 * 1000;   // hoe vaak we opnieuw naar NIEUWE repo's zoeken

const dec = new TextDecoder();

// Maakt de watcher. onEvent krijgt objecten zoals:
//   { type: 'commit',   repo: 'mijn-project', message: 'fix bug', branch: 'main' }
//   { type: 'push',     repo: 'mijn-project', branch: 'main' }
//   { type: 'checkout', repo: 'mijn-project', branch: 'nieuwe-feature' }
//   { type: 'pull',     repo: 'mijn-project' }
export function createGitWatcher(onEvent, folders = GIT_FOLDERS) {
  const repos = new Map();     // pad van de repo -> { name, ready }
  const fileSizes = new Map(); // pad van een logbestand -> laatst bekende grootte

  // --- Zoek alle repo's in de mappen ---
  async function scanRepos() {
    for (const folder of folders) await findRepos(folder, 0);
  }

  async function findRepos(dir, depth) {
    if (await exists(dir + '/.git/logs/HEAD')) {
      if (!repos.has(dir)) repos.set(dir, { name: dir.split(/[\\/]/).pop(), ready: false });
      return; // in een repo zoeken we niet verder
    }
    if (depth >= SCAN_DEPTH) return;
    let entries;
    try {
      entries = await tjs.readDir(dir);
    } catch {
      return; // map bestaat niet of mogen we niet lezen
    }
    for await (const e of entries) {
      if (!e.isDirectory) continue;
      if (e.name.startsWith('.') || e.name === 'node_modules') continue;
      await findRepos(dir + '/' + e.name, depth + 1);
    }
  }

  // --- Alle logbestanden van een repo die we in de gaten houden ---
  async function logFiles(repoPath) {
    const files = [{ path: repoPath + '/.git/logs/HEAD', kind: 'head' }];
    await collect(repoPath + '/.git/logs/refs/remotes', files);
    return files;
  }

  async function collect(dir, out) {
    let entries;
    try {
      entries = await tjs.readDir(dir);
    } catch {
      return;
    }
    for await (const e of entries) {
      const p = dir + '/' + e.name;
      if (e.isDirectory) await collect(p, out);
      else if (e.name !== 'HEAD') out.push({ path: p, kind: 'remote', branch: p.split('/refs/remotes/')[1] });
    }
  }

  // --- Check alle repo's op nieuwe regels in hun logbestanden ---
  async function poll() {
    for (const [repoPath, repo] of repos) {
      for (const file of await logFiles(repoPath)) {
        let size;
        try {
          size = (await tjs.stat(file.path)).size;
        } catch {
          continue;
        }
        const known = fileSizes.get(file.path);
        fileSizes.set(file.path, size);

        // Eerste keer dat we deze repo bekijken: oude geschiedenis overslaan.
        // (Een nieuw bestand in een repo die we al kenden is wél nieuw,
        //  bijvoorbeeld de eerste push van een nieuwe branch: lezen vanaf 0.)
        if (!repo.ready) continue;
        const from = known === undefined ? 0 : known;
        if (size <= from) continue;

        const text = dec.decode((await tjs.readFile(file.path)).subarray(from));
        for (const line of text.split('\n')) {
          const ev = parseLine(line, file, repo);
          if (ev) onEvent(ev);
        }
      }
      repo.ready = true;
    }
  }

  // --- Vertaal één regel uit de reflog naar een game-event ---
  function parseLine(line, file, repo) {
    const tab = line.indexOf('\t');
    if (tab === -1) return null;
    const msg = line.slice(tab + 1).trim(); // alles na de tab is de beschrijving

    if (file.kind === 'remote') {
      if (msg.startsWith('update by push')) {
        return { type: 'push', repo: repo.name, branch: file.branch };
      }
      return null;
    }

    // HEAD-log
    let m;
    if ((m = msg.match(/^commit(?: \((initial|merge)\))?: (.*)$/))) {
      return { type: 'commit', repo: repo.name, message: m[2] };
    }
    if ((m = msg.match(/^checkout: moving from (.+) to (.+)$/))) {
      if (m[1] === m[2]) return null;
      return { type: 'checkout', repo: repo.name, branch: m[2] };
    }
    if (/^(pull|merge)\b/.test(msg)) {
      return { type: 'pull', repo: repo.name };
    }
    return null; // amend, rebase, reset enz. negeren we
  }

  async function exists(path) {
    try {
      await tjs.stat(path);
      return true;
    } catch {
      return false;
    }
  }

  // --- Starten ---
  (async () => {
    await scanRepos();
    await poll(); // eerste poll: alleen groottes onthouden
    console.log(`[git] ${repos.size} repo's gevonden`);
    setInterval(() => poll().catch((e) => console.log('[git] fout:', e.message)), POLL_MS);
    setInterval(() => scanRepos().catch(() => {}), RESCAN_MS);
  })();

  return { repos };
}
