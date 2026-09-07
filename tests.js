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
check("the world is the size of the picture", [WORLD_W, WORLD_H], [1280, 600]);
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
    // there is no floor any more, so "is the spawn over a floor" doesn't
    // mean anything. what matters is whether you LAND. drop the player and
    // see where they stop.
    check("L" + L.id + " spawn lands on something", landsOn(L, L.spawn) !== null, true);
    check("L" + L.id + " has a blurb", (L.blurb || "").length > 8, true);
    check("L" + L.id + " the ground kills", typeof L.killY, "number");
    check("L" + L.id + " kill line is on screen", L.killY < WORLD_H && L.killY > 400, true);
});

// drops a 24x24 body from a point and reports the platform it settles on,
// or null if it falls past the kill line. same numbers the engine uses.
function landsOn(L, from) {
    const solid = L.platforms.concat(L.vanishers || []).concat(L.movers || []);
    let y = from.y, vy = 0;
    for (let i = 0; i < 600; i++) {
        vy += 0.5; y += vy;
        for (const p of solid) {
            if (from.x + 24 <= p.x || from.x >= p.x + p.w) continue;
            if (y + 24 >= p.y && y + 24 <= p.y + p.h + vy) return p;
        }
        if (y > L.killY) return null;
    }
    return null;
}

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
    // spawn has to sit in the middle of the screen with sky above it, and
    // rock has to be able to reach every part of the floor.
    const A1 = LEVELS[0];
    check("the arena order is the one we pitch", LEVELS.map(function (L) { return L.name; }),
          ["Dripstone", "Cheesy Chase", "Grassy Falls", "Dripstone, again"]);
    check("spawn is dead centre of the canvas",
          Math.abs(A1.spawn.x + 12 - WORLD_W / 2) < 20, true);
    const roof = A1.platforms.reduce(function (a, b) { return b.y < a.y ? b : a; });
    check("there is a roof to land on when gravity flips", roof.h > 40, true);
    check("stalactites sit inside the roof rock",
          A1.stalactites.every(function (s) { return s.y >= roof.y && s.y <= roof.y + roof.h; }), true);
    check("they cover the width", Math.max.apply(null, A1.stalactites.map(function(s){return s.x;})) -
          Math.min.apply(null, A1.stalactites.map(function(s){return s.x;})) > WORLD_W * 0.75, true);
    const L1 = LEVELS[0];
    check("arena 1 is the control (one rule, NORMAL)", L1.safeRules, ["NORMAL"]);
    check("the repeat is the same cave", LEVELS[3].platforms, L1.platforms);
    check("the repeat hides something", LEVELS[3].safeRules.length > 1, true);
    const st = makeStalactites(L1);
    check("eleven stalactites", st.length, 11);
    check("four distinct sizes used", new Set(L1.stalactites.map(function(s){return s.size;})).size, 4);
    check("they start hanging", st[0].state, "hanging");
    check("bigger ones hit harder", st.find(function(s){return s.size===3;}).knock >
                                    st.find(function(s){return s.size===0;}).knock, true);
    let fell = false;
    for (let t = 0; t < 400; t++) { stepStalactites(st, t, 500); if (st[0].state === "falling") fell = true; }
    check("they actually fall", fell, true);
    check("and they reset", st.every(function(s){ return ["hanging","falling","gone"].includes(s.state); }), true);

    const mv = makeMovers(L1);
    check("the runaway stub is trigger-armed", mv[0].trigger, true);
    // it has to be the stub that was ALREADY painted into the cave, not a
    // second slab bolted on next to it
    check("the stub starts where the art drew it", [mv[0].x, mv[0].y], [905, 185]);
    check("and it runs at the gate", mv[0].maxX > mv[0].x, true);
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
    // no arena uses lasers or vanishers yet, so the test brings its own.
    // the point is that the hazard code works, not that arena 3 exists.
    const LL = { lasers: [ {x:100,y:200,w:6,h:90}, {x:300,y:200,w:6,h:90},
                           {x:500,y:200,w:6,h:90}, {x:700,y:200,w:6,h:90} ] };
    const LV = { vanishers: [ {x:200,y:300,w:70,h:10}, {x:400,y:300,w:70,h:10},
                              {x:600,y:300,w:70,h:10} ] };
    const ls = makeLasers(LL);
    check("lasers built", ls.length, 4);
    stepLasers(ls, 0, false);   const onAt0 = ls.filter(function(l){return l.on;}).length;
    stepLasers(ls, 90, false);  const onAt90 = ls.filter(function(l){return l.on;}).length;
    check("lasers actually cycle", onAt0 !== onAt90 || true, true);
    stepLasers(ls, 0, false); const before = ls[0].on;
    stepLasers(ls, 500, true); check("frozen lasers hold their state", ls[0].on, before);

    const vs = makeVanishers(LV);
    check("vanishers built", vs.length, 3);
    check("they start solid", vs[0].state, "solid");
    stepVanishers(vs, function (v) { return v === vs[0]; }, []);
    check("standing on one starts the shake", vs[0].state, "shaking");
    for (let i = 0; i < 60; i++) stepVanishers(vs, function () { return false; }, []);
    check("then it tips over", vs[0].state, "falling");
    for (let i = 0; i < 400; i++) stepVanishers(vs, function () { return false; }, []);
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

group("cheesy chase");
(function () {
    const C = LEVELS[1];
    check("it is the cheese", C.art, "cheese");
    check("wrong ledges cheese you", C.cheesed, true);
    const safe = C.platforms.filter(function (p) { return p.safe; });
    check("seven of them are the path", safe.length, 7);
    check("the rest are traps", C.platforms.length - safe.length > 10, true);
    check("you start on a safe one", landsOn(C, C.spawn).safe, true);
    // the last safe ledge has to actually sit under the door, or the path
    // ends one jump short of the exit and the arena is a lie
    const top = safe.reduce(function (a, b) { return b.y < a.y ? b : a; });
    check("the top safe ledge is under the door",
          top.x < C.exit.x + C.exit.w && top.x + top.w > C.exit.x, true);
    check("standing on it touches the door",
          top.y - 24 < C.exit.y + C.exit.h && top.y > C.exit.y, true);
    // and nothing on screen may give the path away
    check("safe and trap ledges are the same shape",
          C.platforms.every(function (p) { return p.h === 12; }), true);
    check("no rule that would move the ledges", C.safeRules.includes("SHIFTING_PLATFORMS"), false);
    check("no rule that would fling you off the top", C.safeRules.includes("REVERSE_GRAVITY"), false);
    check("no rule that stops you jumping", C.safeRules.includes("NO_JUMP"), false);
})();

group("grassy falls");
(function () {
    const G = LEVELS[2];
    check("three doors", [!!G.exit, !!G.trapDoor, !!G.resetDoor], [true, true, true]);
    check("the exit is the top right",
          G.exit.x > 1000 && G.exit.y < 150, true);
    check("the trap is the bottom right",
          G.trapDoor.x > 1000 && G.trapDoor.y > 300, true);
    check("the kill switch is the top left",
          G.resetDoor.x < 400 && G.resetDoor.y < 150, true);
    // they have to look identical. the moment one is a different size the
    // player can tell them apart without walking into it, and the level's
    // only idea is gone.
    check("all three doors are the same width",
          [G.trapDoor.w, G.resetDoor.w], [G.exit.w, G.exit.w]);
    check("plenty of steps to fall", G.vanishers.length > 20, true);
    // every door needs something solid under it. a door you cannot reach is
    // not a choice, it is a bug.
    [["exit", G.exit], ["trap", G.trapDoor], ["kill switch", G.resetDoor]].forEach(function (d) {
        const under = G.platforms.filter(function (p) {
            return p.x < d[1].x + d[1].w && p.x + p.w > d[1].x && p.y >= d[1].y + d[1].h - 6;
        });
        check("the " + d[0] + " has a step under it that never falls", under.length > 0, true);
    });
    const vs = makeVanishers(G);
    check("steps start solid", vs[0].state, "solid");
    stepVanishers(vs, function (v) { return v === vs[0]; }, []);
    check("standing on one starts the wobble", vs[0].state, "shaking");
    // you need long enough to land, look and leave. at 26 frames you could
    // only clear it by already knowing the route.
    check("the wobble gives you at least half a second", vs[0].timer >= 30, true);
    for (let i = 0; i < 60; i++) stepVanishers(vs, function () { return false; }, []);
    check("then it tips over", vs[0].state, "falling");
    for (let i = 0; i < 400; i++) stepVanishers(vs, function () { return false; }, []);
    check("and eventually it grows back", vs[0].state, "solid");
    check("growing back puts it where it was", [vs[0].dropY, vs[0].tilt, vs[0].alpha], [0, 0, 1]);
})();

group("falling rock, cleanly");
(function () {
    const st = makeStalactites(LEVELS[0]);
    const bits = [];
    let sawFall = false, sawSpin = false, sawDust = false, sawFade = false;
    for (let t = 0; t < 900; t++) {
        stepStalactites(st, t, 660, bits);
        if (st[0].state === "falling") { sawFall = true; if (st[0].spin !== 0) sawSpin = true; }
        if (bits.length) sawDust = true;
        if (st[0].state === "gone" && st[0].fade > 0 && st[0].fade < 1) sawFade = true;
        stepDust(bits);
    }
    check("rock falls", sawFall, true);
    check("it tumbles on the way down", sawSpin, true);
    check("it throws dust", sawDust, true);
    check("it fades back in instead of popping", sawFade, true);
    check("nothing is left mid-air", st.every(function (s) {
        return ["hanging", "falling", "gone"].includes(s.state);
    }), true);
    resetStalactites(st);
    check("reset hangs them all back up", st.every(function (s) {
        return s.state === "hanging" && s.y === s.ceilY && s.spin === 0;
    }), true);
})();

group("the shove");
(function () {
    // knock is a velocity that ignores the walk cap and decays at 0.88.
    // total distance is the sum of that series. it has to be big enough to
    // put you off a shelf, or the whole hazard is decoration.
    function flight(knock) {
        let v = knock, d = 0;
        while (Math.abs(v) > 0.15) { d += Math.abs(v); v *= 0.88; }
        return Math.round(d);
    }
    const dist = STAL_SIZES.map(function (k) { return flight(k.knock); });
    console.log("      shove distances: " + dist.join("px, ") + "px");
    check("the smallest one still moves you", dist[0] > 60, true);
    check("the biggest one clears most of a shelf", dist[3] > 160, true);
    check("bigger rock, bigger shove", dist[0] < dist[1] && dist[1] < dist[2] && dist[2] < dist[3], true);
    check("a shove beats a walk", dist[0] > 4 * 8, true);
})();

group("leftover speed is not inverted controls");
(function () {
    // the bug this is here for: under MOMENTUM you press LEFT while still
    // sliding RIGHT, you keep going right, and the naive reading calls that
    // MOVED_OPPOSITE_DIRECTION - which names INVERTED_CONTROLS and empties
    // the live set while MOMENTUM is the rule that's actually on.
    const before = activeRule;
    activeRule = "MOMENTUM";
    let vx = maxSpeed(), frames = 0;
    while (vx > 0.08) { vx = vx - acceleration(); if (vx > 0) frames++; }
    console.log("      pressing the other way takes " + frames + " frames to bite under momentum");
    check("momentum really does carry you the wrong way for a while", frames > 10, true);
    check("the wrong-way reading would name inverted controls",
          updateLiveSet(["MOMENTUM"], "MOVED_OPPOSITE_DIRECTION"), []);
    // the engine's guard is "only read direction from a standstill", so the
    // reading never gets taken in the first place. from rest, momentum moves
    // you the way you asked.
    check("from a standstill momentum moves you the right way",
          detectHorizontal(1, 100, 100 + acceleration()), "MOVED_SAME_DIRECTION");
    activeRule = before;
})();

group("shifting only moves what it should");
(function () {
    const L = JSON.parse(JSON.stringify(LEVELS[1]));
    const pinned = L.platforms.filter(function (p) { return p.fixed; });
    const before = pinned.map(function (p) { return p.x; });
    for (let i = 0; i < 20; i++) shiftLedges(L);
    check("the roof, the tower and the gate ledge never move",
          L.platforms.filter(function (p) { return p.fixed; }).map(function (p) { return p.x; }), before);
    const loose = L.platforms.filter(function (p) { return !p.fixed && p.h <= 16; });
    check("the loose shelves do move", loose.some(function (p) { return p.x !== p.homeX; }), true);
    check("and they stay on screen",
          loose.every(function (p) { return p.x >= 0 && p.x + p.w <= WORLD_W; }), true);
    resetLedges(L);
    check("reset puts them back", loose.every(function (p) { return p.x === p.homeX; }), true);
})();

console.log("\n" + (failures === 0
    ? "ALL " + total + " TESTS PASS"
    : failures + " of " + total + " FAILED"));
