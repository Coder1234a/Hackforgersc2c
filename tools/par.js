// par.js - how many moves does a clean run actually take?
//
// a "move" here = a fresh press of a movement key, exactly how the keydown
// handler counts it. so the bot counts the same way: drives the key table,
// every false->true on a game key is one move. no guessing, no multiplying
// hops by some fudge factor.
//
// runs each arena a few times under NORMAL (rock timing differs every go)
// and reports the average.
const { chromium } = require('playwright');
const plans = require('./routes.json');
const NAMES = ['Dripstone', 'Cheesy Chase', 'Grassy Falls', 'Dripstone, again'];

async function oneRun(page, arenaIndex) {
  return await page.evaluate(([arenaIndex, plans]) => {
    levelIndex = arenaIndex; newAttempt(); tutorialStep = -1; introTimer = 0;
    activeRule = 'NORMAL';
    const startLevel = levelIndex;
    const plan = plans[level.name];
    const finished = () => screen === 'WON' || levelIndex !== startLevel;

    // count presses the same way the real keydown handler does
    let counted = 0;
    const set = (k, v) => { if (v && !keys[k]) counted++; keys[k] = v; };
    const clear = () => { set('ArrowLeft', false); set('ArrowRight', false); set('ArrowUp', false); };

    let restarts = 0;
    for (let s = 0; s < plan.length; s++) {
      const step = plan[s];
      for (let i = 0; i < 400; i++) {
        if (finished()) { clear(); return { moves: counted, restarts: restarts, done: true }; }
        if (screen !== 'PLAY') { screen = 'PLAY'; restarts++; s = -1; clear(); break; }
        const danger = stals.some(function (t) {
          if (t.state === 'gone') return false;
          if (t.state === 'hanging' && !t.shake) return false;
          return Math.abs((t.x + t.w / 2) - (player.x + 12)) < 46 && t.y < player.y;
        });
        if (danger && player.onGround) { clear(); update(); continue; }
        const dx = step.x - player.x;
        const want = Math.abs(dx) < 4 ? 0 : (dx > 0 ? 1 : -1);
        set('ArrowRight', want > 0); set('ArrowLeft', want < 0); set('ArrowUp', false);
        update();
        if (want === 0 && player.onGround) break;
      }
      if (finished()) { clear(); return { moves: counted, restarts: restarts, done: true }; }
      if (restarts > 20) break;
      if (s === -1) continue;

      clear();
      let jumped = false;
      for (let i = 0; i < 260; i++) {
        if (finished()) { clear(); return { moves: counted, restarts: restarts, done: true }; }
        if (screen !== 'PLAY') { screen = 'PLAY'; restarts++; s = -1; break; }
        const past = step.dir > 0 ? player.x >= step.x - 4 : player.x <= step.x + 4;
        // par is measured in NORMAL, full speed on frame one, so jump the
        // moment you're across the mark. waiting to build speed is a
        // momentum technique - on the grass it just gives the step time to
        // crumble under you.
        const go = past;
        set('ArrowRight', step.dir > 0); set('ArrowLeft', step.dir < 0);
        set('ArrowUp', step.jump && !jumped && go);
        if (step.jump && !jumped && go && player.onGround) jumped = true;
        update();
        if (step.jump && !jumped) continue;
        if (jumped && player.onGround && i > 4) break;
        if (!step.jump && player.onGround && i > 40) break;
      }
      clear();
    }
    // walk the last few steps into the door
    for (let i = 0; i < 900 && !finished(); i++) {
      if (screen !== 'PLAY') { screen = 'PLAY'; restarts++; }
      const cx = level.exit.x + level.exit.w / 2;
      const dx = cx - (player.x + 12);
      const want = Math.abs(dx) < 4 ? 0 : (dx > 0 ? 1 : -1);
      set('ArrowRight', want > 0); set('ArrowLeft', want < 0);
      set('ArrowUp', (player.y > level.exit.y + level.exit.h) && player.onGround);
      update();
    }
    clear();
    return { moves: counted, restarts: restarts, done: finished() };
  }, [arenaIndex, plans]);
}

(async () => {
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 1280, height: 620 } });
  page.on('pageerror', e => console.log('ERR', e.message));
  await page.goto('file://' + __dirname + '/game/index.html');
  await page.waitForTimeout(900);

  const out = {};
  for (let i = 0; i < 4; i++) {
    const good = [];
    for (let t = 0; t < 7; t++) {
      const r = await oneRun(page, i);
      if (r.done) good.push(r.moves);
    }
    const avg = good.length ? Math.round(good.reduce((a, c) => a + c, 0) / good.length) : 0;
    out[i] = avg;
    console.log('  ' + NAMES[i].padEnd(20) + (good.length + '/7 clean').padEnd(12) +
                'moves: ' + good.join(', ') + '   -> par ' + avg);
  }
  require('fs').writeFileSync('par.json', JSON.stringify(out));
  await b.close();
})();
