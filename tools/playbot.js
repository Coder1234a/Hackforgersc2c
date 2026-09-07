// playbot.js - takes the route pathfind worked out and plays it in the
// actual game, under every rule the arena can roll.
//
// calls update() straight out instead of waiting on rAF, so a run that
// takes a minute to watch takes about a second to check. if the plan and
// the engine ever disagree, this is where it shows.
const { chromium } = require('playwright');
const plans = require('./routes.json');
const NAMES = ['Dripstone', 'Cheesy Chase', 'Grassy Falls', 'Dripstone, again'];

async function play(page, arenaIndex, rule) {
  return await page.evaluate(([arenaIndex, rule, plans]) => {
    levelIndex = arenaIndex; newAttempt(); tutorialStep = -1; introTimer = 0;
    if (rule) activeRule = rule;
    const startLevel = levelIndex;
    const plan = plans[level.name];
    const flip = () => (inputDirection(1) < 0 ? -1 : 1);
    const clear = () => { keys['ArrowLeft'] = keys['ArrowRight'] = keys['ArrowUp'] = false; };
    const alive = () => screen === 'PLAY';
    const finished = () => screen === 'WON' || levelIndex !== startLevel;

    let restarts = 0, frames = 0;
    const notes = [];
    const tick1 = () => { update(); frames++; };

    for (let s = 0; s < plan.length; s++) {
      const step = plan[s];

      // back off first, then run AT the launch spot in the direction we're
      // about to jump. under momentum a standing jump goes nowhere, so the
      // run-up isn't polish, it's the only way the move works at all.
      // walk to the launch spot, then build speed along the ledge in the
      // jump direction. backing off first just walked the bot straight off
      // the narrow cheese ledges.
      const runFrom = step.x;
      for (let i = 0; i < 400; i++) {
        if (finished()) { clear(); return done(); }
        if (!alive()) { screen = 'PLAY'; restarts++; s = -1; clear(); break; }
        // wait out a rock that's about to land on our head
        const danger = stals.some(function (t) {
          if (t.state === 'gone') return false;
          if (t.state === 'hanging' && !t.shake) return false;
          return Math.abs((t.x + t.w / 2) - (player.x + 12)) < 46 && t.y < player.y;
        });
        if (danger && player.onGround) { clear(); tick1(); continue; }
        const dx = runFrom - player.x;
        const want = Math.abs(dx) < 4 ? 0 : (dx > 0 ? 1 : -1);
        keys['ArrowRight'] = want * flip() > 0;
        keys['ArrowLeft']  = want * flip() < 0;
        keys['ArrowUp'] = false;
        tick1();
        if (want === 0 && player.onGround) break;
      }
      if (finished()) { clear(); return done(); }
      if (restarts > 25) break;
      if (s === -1) continue;

      // now run at it and jump as we cross the launch spot
      clear();
      let jumped = false;
      for (let i = 0; i < 260; i++) {
        if (finished()) { clear(); return done(); }
        if (!alive()) { screen = 'PLAY'; restarts++; s = -1; break; }
        // jump once we're across the launch spot AND up to speed. under
        // momentum a standing jump barely leaves the ledge.
        const past = step.dir > 0 ? player.x >= step.x - 4 : player.x <= step.x + 4;
        const fast = Math.abs(player.vx) >= maxSpeed() * 0.88;
        const go = past && (fast || i > 70);
        keys['ArrowRight'] = step.dir * flip() > 0;
        keys['ArrowLeft']  = step.dir * flip() < 0;
        keys['ArrowUp'] = (step.jump && !jumped && go);
        if (step.jump && !jumped && go && player.onGround) jumped = true;
        tick1();
        if (step.jump && !jumped) continue;
        if (jumped && player.onGround && i > 4) break;
        if (!step.jump && player.onGround && i > 40) break;
      }
      notes.push('s' + s + ' -> x' + Math.round(player.x) + ' y' + Math.round(player.y) +
                 ' ' + screen + (deathCause ? ' (' + deathCause + ')' : ''));
      clear();
    }

    // plan ends on the last ledge. walking the final few steps into the
    // door is the bit a person does w/out thinking. also covers arenas
    // whose last ledge is the one that RUNS - planner sees it parked, the
    // game already carried you elsewhere.
    for (let i = 0; i < 900 && !finished(); i++) {
      if (!alive()) { screen = 'PLAY'; restarts++; }
      const cx = level.exit.x + level.exit.w / 2;
      const dx = cx - (player.x + 12);
      const want = Math.abs(dx) < 4 ? 0 : (dx > 0 ? 1 : -1);
      const needUp = (player.y > level.exit.y + level.exit.h) && player.onGround;
      keys['ArrowRight'] = want * flip() > 0;
      keys['ArrowLeft']  = want * flip() < 0;
      keys['ArrowUp'] = needUp;
      tick1();
    }
    clear();
    notes.push('finish -> x' + Math.round(player.x) + ' y' + Math.round(player.y) + ' ' + screen);
    function done() {
      return { finished: finished(), restarts: restarts, deaths: deaths, moves: moves,
               frames: frames, rule: activeRule, live: liveSet.slice(), notes: notes.slice(-6),
               where: { x: Math.round(player.x), y: Math.round(player.y) }, screen: screen };
    }
    return done();
  }, [arenaIndex, rule, plans]);
}

(async () => {
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 1280, height: 620 } });
  const errs = [];
  page.on('pageerror', e => errs.push('ERR ' + e.message));
  page.on('console', m => { if (m.text().includes('contradiction')) errs.push('CONTRADICTION ' + m.text()); });
  await page.goto('file://' + __dirname + '/game/index.html');
  await page.waitForTimeout(900);

  let fails = 0;
  for (let i = 0; i < 4; i++) {
    const rules = await page.evaluate(n => LEVELS[n].safeRules, i);
    for (const r of rules) {
      const before = errs.length;
      const res = await play(page, i, r);
      const tag = (NAMES[i] + '  ' + r).padEnd(42);
      const bad = errs.length > before;
      console.log('  ' + tag + (res.finished ? 'FINISHED' : 'STUCK   ') +
                  '  restarts ' + String(res.restarts).padStart(2) +
                  '  deaths ' + String(res.deaths).padStart(2) +
                  '  moves ' + String(res.moves).padStart(3) +
                  '  rules left ' + res.live.length +
                  (bad ? '   <-- ' + errs[before] : ''));
      if (!res.finished) console.log('        ' + (res.notes || []).join(' | '));
      if (!res.finished || bad) fails++;
    }
  }
  console.log(fails ? '\n' + fails + ' PROBLEM(S)' : '\nevery arena finished under every rule it can roll');
  await b.close();
})();
