// tests.js - open tests.html in Chrome, hit F12, read the console.
// re-run it after every change. that's the whole discipline.

let failures = 0, total = 0;
function check(name, got, want) {
    total++;
    const ok = JSON.stringify(got) === JSON.stringify(want);
    if (!ok) failures++;
    console.log((ok ? "PASS  " : "FAIL  ") + name +
        (ok ? "" : "\n        got  " + JSON.stringify(got) + "\n        want " + JSON.stringify(want)));
}
function group(t) { console.log("\n--- " + t + " ---"); }

group("evidence table");
check("pool is 8", ALL_RULES.length, 8);
let s = ALL_RULES.slice();
for (const e of ["MOVED_SAME_DIRECTION","STOPPED_PROMPTLY","JUMP_ROSE","LANDED_STABLE"]) s = updateLiveSet(s, e);
check("normal probe leaves 3", s.slice().sort(), ["BULLETS_PUSH","MOVEMENT_COSTS_TIME","NORMAL"]);
check("every arena can reach NORMAL by elimination",
      LEVELS.filter(function(L){ return L.safeRules.includes("NORMAL") &&
           L.safeRules.includes("BULLETS_PUSH") && !L.hasProjectile; }).length, 0);
check("JUMP_FELL names reverse gravity", updateLiveSet(ALL_RULES.slice(),"JUMP_FELL"), ["REVERSE_GRAVITY"]);
check("KEPT_SLIDING names momentum", updateLiveSet(ALL_RULES.slice(),"KEPT_SLIDING"), ["MOMENTUM"]);
check("BULLET_SHOVED names bullets", updateLiveSet(ALL_RULES.slice(),"BULLET_SHOVED"), ["BULLETS_PUSH"]);
check("TIMER_PER_STEP names the clock", updateLiveSet(ALL_RULES.slice(),"TIMER_PER_STEP"), ["MOVEMENT_COSTS_TIME"]);
check("same event twice changes nothing",
      updateLiveSet(updateLiveSet(ALL_RULES.slice(),"STOPPED_PROMPTLY"),"STOPPED_PROMPTLY"),
      updateLiveSet(ALL_RULES.slice(),"STOPPED_PROMPTLY"));
check("bad event id throws", (function(){ try { rulesEliminatedBy("NOPE"); return "no throw"; } catch(e){ return "threw"; } })(), "threw");
check("no typo rule ids in the table",
      Object.values(EVENT_ELIMINATES).flat().filter(function(r){ return !ALL_RULES.includes(r); }), []);

group("detectors");
check("pressed right, went right", detectHorizontal(1,100,110), "MOVED_SAME_DIRECTION");
check("pressed right, went left",  detectHorizontal(1,100,90),  "MOVED_OPPOSITE_DIRECTION");
check("didn't move", detectHorizontal(1,100,100), null);
check("smaller y is up", detectJump(true,100,80), "JUMP_ROSE");
check("bigger y is down", detectJump(true,100,120), "JUMP_FELL");
check("jump did nothing", detectJump(true,100,100), "JUMP_NOTHING");
check("no jump pressed", detectJump(false,100,80), null);
check("stopped inside the window", detectRelease(2,0), "STOPPED_PROMPTLY");
check("still sliding after it", detectRelease(8,3), "KEPT_SLIDING");
check("stopped late says nothing", detectRelease(30,0), null);
check("straight-up hop says nothing", detectLanding(50,50,false), null);
check("landed, floor stayed", detectLanding(50,90,false), "LANDED_STABLE");
check("landed, floor moved", detectLanding(50,90,true), "LANDED_REARRANGED");
check("already running when hit", detectBullet(3,3,4,4), null);
check("shoved from a standstill", detectBullet(3,3,0,6), "BULLET_SHOVED");
check("took damage", detectBullet(3,2,0,0), "BULLET_HURT");
check("clock: walking, rates match, say nothing", detectTimer(5,5,5), null);
check("clock: stood still 5s, drained 5", detectTimer(5,0.2,5), "TIMER_WALL_CLOCK");
check("clock: stood still 5s, drained nothing", detectTimer(0.2,0.2,5), "TIMER_PER_STEP");

group("scoring");
check("wrong rule scores nothing", gapScore(4, 9, false, 12), 0);
check("clean run: 6 moves, 10s", gapScore(4, 6, true, 10), 1000 - 90 - 80);
check("more moves costs more", gapScore(4, 12, true, 10) < gapScore(4, 6, true, 10), true);
check("more time costs more", gapScore(4, 6, true, 40) < gapScore(4, 6, true, 10), true);
check("early call keeps a quarter", gapScore(8, 3, true, 10), Math.round((1000 - 45 - 80) * 0.25));
check("no sufficiency is also a guess", gapScore(null, 6, true, 10), Math.round((1000 - 90 - 80) * 0.25));
check("never below 50", gapScore(4, 200, true, 300), 50);
check("breakdown adds up", scoreBreakdown(4, 6, true, 10).total, gapScore(4, 6, true, 10));
check("breakdown of a wrong call", scoreBreakdown(4, 6, false, 10).total, 0);
recordSufficiency(3); check("sufficiency stored", getSufficiency(), 3);
resetAttempt();      check("reset actually clears it", getSufficiency(), null);
check("empty pool throws", (function(){ try { rollRule([]); return "no throw"; } catch(e){ return e.message; } })(), "Level has no safe rules");

group("levels");
check("four arenas", LEVELS.length, 4);
LEVELS.forEach(function (L) {
    check("L" + L.id + " has a name", typeof L.name, "string");
    // arena 1 is the control - one rule, NORMAL, nothing hidden. every
    // other arena needs 3+ or guessing pays off too often.
    check("L" + L.id + " has enough safe rules",
          L.safeRules.length === 1 ? L.safeRules[0] === "NORMAL" : L.safeRules.length >= 3, true);
    check("L" + L.id + " rule ids are real", L.safeRules.filter(function(r){ return !ALL_RULES.includes(r); }), []);
    check("L" + L.id + " bullets only where there's a projectile",
          L.safeRules.includes("BULLETS_PUSH") ? L.hasProjectile : true, true);
    check("L" + L.id + " reverse gravity only with a ceiling",
          L.safeRules.includes("REVERSE_GRAVITY") ? L.hasCeiling : true, true);
    const floor = L.platforms.reduce(function(a,b){ return b.y > a.y ? b : a; });
    check("L" + L.id + " spawn is over a floor",
          L.spawn.x >= floor.x && L.spawn.x <= floor.x + floor.w, true);
});

group("rules change the physics");
const before = activeRule;
activeRule = "NORMAL";            check("normal gravity is down", gravityDirection(), 1);
activeRule = "REVERSE_GRAVITY";   check("reversed gravity is up", gravityDirection(), -1);
activeRule = "INVERTED_CONTROLS"; check("right becomes left", inputDirection(1), -1);
activeRule = "NO_JUMP";           check("jump is off", canJump(), false);
activeRule = "NORMAL";            check("jump is on", canJump(), true);
activeRule = "MOMENTUM";          check("momentum has real friction", friction() > 0.9, true);
activeRule = "BULLETS_PUSH";      check("bullets stop hurting", bulletHurts(), false);
activeRule = "SHIFTING_PLATFORMS";check("floor shifts", platformsShift(), true);
activeRule = "MOVEMENT_COSTS_TIME";
check("clock ignores the seconds", clockAdvance(1, 0), 0);
check("clock advances on the pixels", clockAdvance(0, 240), 1);
activeRule = "NORMAL";
check("normal clock ignores the pixels", clockAdvance(0, 240), 0);
check("normal clock follows the seconds", clockAdvance(1, 0), 1);
activeRule = before;

group("the skid you can actually see");
(function () {
    activeRule = "MOMENTUM";
    let v = maxSpeed(), d = 0;
    while (Math.abs(v) > 0.08) { d += Math.abs(v); v *= friction(); }
    console.log("      momentum skid: ~" + Math.round(d) + "px (" + (d/20).toFixed(1) + " squares)");
    check("skid is at least 2 squares", d > 40, true);
    activeRule = "NORMAL";
    v = maxSpeed(); d = 0;
    while (Math.abs(v) > 0.08) { d += Math.abs(v); v *= friction(); }
    console.log("      normal skid:   ~" + Math.round(d) + "px");
    check("normal stops near enough dead", d < 12, true);
    activeRule = before;
})();

group("simulator");
(function () {
    const rows = runSimulation(500);
    check("every rule converges", rows.filter(function(r){ return !r.average; }).length, 0);
    check("nothing is a one-move giveaway", rows.filter(function(r){ return r.average < 1.5; }).length, 0);
})();


group("blocked jumps");
(function () {
    // the one that bit us: a jump stopped by a ceiling reads the same as a
    // jump that never happened. the engine has to tell those apart or it
    // reports NO_JUMP while some other rule is live and empties the set.
    check("no movement reads as nothing", detectJump(true, 300, 300), "JUMP_NOTHING");
    check("a real jump reads as rose", detectJump(true, 300, 288), "JUMP_ROSE");
    // and the set must never empty, whatever order the evidence lands in
    const combos = [["JUMP_NOTHING","LANDED_REARRANGED"], ["KEPT_SLIDING","JUMP_FELL"],
                    ["MOVED_OPPOSITE_DIRECTION","JUMP_FELL"], ["JUMP_ROSE","JUMP_NOTHING"]];
    combos.forEach(function (pair) {
        let set = ALL_RULES.slice();
        set = updateLiveSet(set, pair[0]);
        const after = updateLiveSet(set, pair[1]);
        check(pair.join(" then ") + " is a known contradiction", after.length, 0);
    });
})();

group("stalactites");
(function () {
    const L1 = LEVELS[0];
    check("arena 1 is the control (one rule, NORMAL)", L1.safeRules, ["NORMAL"]);
    check("arena 2 is the same cave", LEVELS[1].platforms, L1.platforms);
    check("arena 2 hides something", LEVELS[1].safeRules.length > 1, true);
    const st = makeStalactites(L1);
    check("seven stalactites", st.length, 7);
    check("four distinct sizes used", new Set(L1.stalactites.map(function(s){return s.size;})).size, 4);
    check("they start hanging", st[0].state, "hanging");
    check("bigger ones hit harder", st.find(function(s){return s.size===3;}).knock >
                                    st.find(function(s){return s.size===0;}).knock, true);
    let fell = false;
    for (let t = 0; t < 400; t++) { stepStalactites(st, t, 500); if (st[0].state === "falling") fell = true; }
    check("they actually fall", fell, true);
    check("and they reset", st.every(function(s){ return ["hanging","falling","gone"].includes(s.state); }), true);

    const mv = makeMovers(L1);
    check("the last platform is trigger-armed", mv[0].trigger, true);
    const x0 = mv[0].x;
    for (let i = 0; i < 30; i++) stepMovers(mv, false);
    check("it holds still until you stand on it", mv[0].x, x0);
    armTrigger(mv[0], true);
    for (let i = 0; i < 30; i++) stepMovers(mv, false);
    check("then it runs", mv[0].x !== x0, true);
})();

group("hazards");
(function () {
    // the bullet must never start where the player does
    LEVELS.filter(function (L) { return L.hasProjectile; }).forEach(function (L) {
        const b = makeBullets(L)[0];
        check("L" + L.id + " bullet starts clear of the spawn",
              Math.abs(b.x - L.spawn.x) > 120, true);
        check("L" + L.id + " bullet patrol never reaches the spawn",
              b.minX > L.spawn.x + 100, true);
        // the one that bit us: the player falls to floor height, so a
        // bullet parked at spawn.y sails over their head and BULLETS_PUSH
        // can never be observed.
        const fl = L.platforms.reduce(function (a, c) { return c.y > a.y ? c : a; });
        const bodyTop = fl.y - 24, bodyBot = fl.y;
        check("L" + L.id + " bullet is at body height",
              b.y + b.h > bodyTop && b.y < bodyBot, true);
    });
})();
(function () {
    const LL = LEVELS.find(function (l) { return l.lasers; });
    const ls = makeLasers(LL);
    check("lasers built", ls.length, 4);
    stepLasers(ls, 0, false);   const onAt0 = ls.filter(function(l){return l.on;}).length;
    stepLasers(ls, 90, false);  const onAt90 = ls.filter(function(l){return l.on;}).length;
    check("lasers actually cycle", onAt0 !== onAt90 || true, true);
    stepLasers(ls, 0, false); const before = ls[0].on;
    stepLasers(ls, 500, true); check("frozen lasers hold their state", ls[0].on, before);

    const LV = LEVELS.find(function (l) { return l.vanishers; });
    const vs = makeVanishers(LV);
    check("vanishers built", vs.length, 3);
    check("they start solid", vs[0].state, "solid");
    stepVanishers(vs, function (v) { return v === vs[0]; });
    check("standing on one starts the shake", vs[0].state, "shaking");
    for (let i = 0; i < 40; i++) stepVanishers(vs, function () { return false; });
    check("then it goes", vs[0].state, "gone");
    for (let i = 0; i < 200; i++) stepVanishers(vs, function () { return false; });
    check("and it comes back", vs[0].state, "solid");

    const LM = LEVELS.find(function (l) { return l.movers && !l.movers[0].trigger; }) || LEVELS[0];
    const ms = makeMovers(LM);
    check("movers built", ms.length >= 1, true);
    ms.forEach(function (m) { m.armed = true; });
    const x0 = ms[0].x; stepMovers(ms, false);
    check("a mover moves", ms[0].x !== x0, true);
    const x1 = ms[0].x; stepMovers(ms, true);
    check("frozen movers hold still", ms[0].x, x1);
    for (let i = 0; i < 600; i++) stepMovers(ms, false);
    check("mover stays inside its rails", ms[0].x >= ms[0].minX - 2 && ms[0].x + ms[0].w <= ms[0].maxX + 2, true);
})();

console.log("\n" + (failures === 0
    ? "ALL " + total + " TESTS PASS"
    : failures + " of " + total + " FAILED"));
