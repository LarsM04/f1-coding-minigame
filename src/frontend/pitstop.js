// =====================================================================
//  PITSTOP-CHALLENGE - een minigame voor als je in de pits staat
//
//  Zo werkt het:
//   - Sta je in de pits (= je zit in een andere app, bijv. je browser),
//     dan verschijnt er een knop "PITSTOP-CHALLENGE" in de garage.
//   - Na 3-2-1 licht er een band op. Klik hem zo snel mogelijk!
//   - Daarna de volgende... tot alle 4 de banden gewisseld zijn.
//   - Verkeerde band = +0,5 sec straftijd.
//   - Hoe sneller, hoe meer coins (zie CAREER.PITSTOP_REWARDS in career.js).
//   - Je kunt het 1x per 10 minuten doen (CAREER.PITSTOP_COOLDOWN).
// =====================================================================

let pit = null; // de pitstop die nu bezig is (null = geen)

// Koppelt de knoppen (1x bij het opstarten, vanuit app.js).
function pitSetup() {
  $('pitBtn').onclick = pitStart;
  for (const btn of document.querySelectorAll('.tyre')) {
    btn.onclick = () => pitClick(Number(btn.dataset.tyre));
  }
}

// Elke frame: knop tonen/verbergen en de timer bijwerken (vanuit app.js).
function pitTick() {
  // Knop alleen in de garage (pits) en als er geen pitstop bezig is
  const btn = $('pitBtn');
  const show = game.mode === 'pits' && garageFade > 0.9 && !pit;
  btn.classList.toggle('show', show);
  if (show) {
    const wait = pitstopWait();
    btn.disabled = wait > 0;
    setText('pitBtnText', wait > 0
      ? `PITSTOP OVER ${Math.floor(wait / 60)}:${String(wait % 60).padStart(2, '0')}`
      : '🔧 PITSTOP-CHALLENGE');
  }

  if (!pit) return;

  // Terug naar je code tijdens de pitstop? Dan stoppen we hem.
  if (game.mode !== 'pits' && !pit.finished) {
    pitClose();
    return;
  }

  // Timer laten lopen
  if (pit.start && !pit.finished) {
    const t = (performance.now() - pit.start) / 1000 + pit.penalty;
    setText('pitTime', t.toFixed(2));
  }
}

// Start de pitstop: eerst aftellen 3-2-1.
function pitStart() {
  if (pit || pitstopWait() > 0) return;
  pit = { order: shuffle([0, 1, 2, 3]), step: -1, start: 0, penalty: 0, finished: false };
  for (const t of document.querySelectorAll('.tyre')) t.className = 'tyre';
  setText('pitTime', '0.00');
  $('pitstop').classList.add('show');

  ['3', '2', '1'].forEach((n, i) => {
    setTimeout(() => {
      if (!pit) return;
      setText('pitMsg', n);
      playSound('beep');
    }, i * 500);
  });
  setTimeout(() => {
    if (!pit) return;
    setText('pitMsg', 'GO!');
    playSound('beepHigh');
    pit.start = performance.now();
    pit.step = 0;
    pitLightTyre();
  }, 1500);
}

// Laat de volgende band oplichten.
function pitLightTyre() {
  for (const t of document.querySelectorAll('.tyre')) t.classList.remove('lit');
  const next = pit.order[pit.step];
  document.querySelector(`.tyre[data-tyre="${next}"]`).classList.add('lit');
}

// Er is op band `i` geklikt.
function pitClick(i) {
  if (!pit || pit.step < 0 || pit.finished) return;
  const btn = document.querySelector(`.tyre[data-tyre="${i}"]`);

  if (i !== pit.order[pit.step]) {
    // Verkeerde band: straftijd
    pit.penalty += 0.5;
    playSound('wrong');
    btn.classList.add('bad');
    setTimeout(() => btn.classList.remove('bad'), 250);
    return;
  }

  // Goede band!
  playSound('wrench');
  btn.classList.remove('lit');
  btn.classList.add('done');
  pit.step += 1;
  if (pit.step < 4) {
    pitLightTyre();
  } else {
    pitFinish();
  }
}

// Alle 4 banden gewisseld.
function pitFinish() {
  pit.finished = true;
  const time = (performance.now() - pit.start) / 1000 + pit.penalty;
  setText('pitTime', time.toFixed(2));
  const gained = careerOnPitstop(time);
  setText('pitMsg', `+${fmtCoins(gained)} coins${pit.penalty ? ` (straf +${pit.penalty.toFixed(1)}s)` : ''}`);
  setTimeout(pitClose, 2600);
}

function pitClose() {
  pit = null;
  $('pitstop').classList.remove('show');
  setText('pitMsg', '');
}

// Husselt een lijst (Fisher-Yates).
function shuffle(list) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}
