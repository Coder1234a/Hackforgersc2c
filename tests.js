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
check("called the moment you knew", gapScore(4,4,true), 100);
check("three moves late", gapScore(4,7,true), 55);
check("correct but early is a guess", gapScore(4,2,true), 10);
check("wrong", gapScore(4,9,false), 0);
check("never became knowable", gapScore(null,4,true), 10);
check("floor holds at 10", gapScore(0,20,true), 10);
recordSufficiency(3); check("sufficiency stored", getSufficiency(), 3);
resetAttempt();      check("reset actually clears it", getSufficiency(), null);
check("empty pool throws", (function(){ try { rollRule([]); return "no throw"; } catch(e){ return e.message; } })(), "Level has no safe rules");

group("levels");
check("six arenas", LEVELS.length, 6);
LEVELS.forEach(function (L) {
    check("L" + L.id + " has a name", typeof L.name, "string");
    check("L" + L.id + " has 3+ safe rules", L.safeRules.length >= 3, true);
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
check("clock ignores the seconds", clockDrain(1, 0), 0);
check("clock burns on the pixels", clockDrain(0, 240) > 0.9, true);
activeRule = "NORMAL";
check("normal clock ignores the pixels", clockDrain(0, 240), 0);
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

console.log("\n" + (failures === 0
    ? "ALL " + total + " TESTS PASS"
    : failures + " of " + total + " FAILED"));
