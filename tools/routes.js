// routes.js - proves every arena can be finished, under grip AND under
// momentum, before anyone plays it.
const fs = require('fs');
const { solve, PHYS } = require('./pathfind.js');
// levels.js uses const, so eval it inside a function and hand the two bits
// we need back out.
const { LEVELS, WORLD_W } = (new Function(
    fs.readFileSync('game/src/levels.js', 'utf8') + '\nreturn { LEVELS, WORLD_W };'))();

function asGraph(L) {
    // movers count from where they start, vanishers count til you touch
    // them - both are standable when you first meet them.
    //
    // the cave roof HAS to be in here. solid rock, caps every jump under
    // it. leave it out and the planner flies through the ceiling and hands
    // you a route the engine will never reproduce.
    const plats = L.platforms
        .concat(L.movers || [])
        .concat(L.vanishers || [])
        .map(function (p, i) { return { x:p.x, y:p.y, w:p.w, h:p.h, name:'p'+i, safe:p.safe }; });
    return { w: WORLD_W, killY: L.killY, spawn: L.spawn, exit: L.exit, platforms: plats };
}

let bad = 0;
const plans = {};
for (const L of LEVELS) {
    const G = asGraph(L);
    for (const ph of ['normal', 'momentum']) {
        const r = solve(G, PHYS[ph]);
        const tag = (L.name + ' [' + ph + ']').padEnd(34);
        if (!r || !r.path) { console.log('  ' + tag + 'NO ROUTE'); bad++; continue; }
        console.log('  ' + tag + r.path.length + ' moves, from ' + G.platforms[r.start].name);
        for (const st of r.path) {
            const to = st.node === 'EXIT' ? 'THE DOOR' : G.platforms[st.node].name;
            console.log('       ' + G.platforms[st.from].name.padEnd(4) + ' -> ' + to.padEnd(9) +
                        '  ' + (st.how.jump ? 'jump' : 'walk') + ' ' +
                        (st.how.dir < 0 ? 'left ' : 'right') + ' from x' + st.how.x);
        }
        if (ph === 'normal') plans[L.name] = r.path.map(function (st) { return st.how; });

        // cheese is different. the shortest route may cut through traps,
        // cos landing on a trap ends the run - that IS the level. what has
        // to hold is that the SAFE ledges alone reach the door.
        if (L.cheesed) {
            // traps stay in the world - you fly past them, you just must
            // not come down on one. planning w/out them gives a route the
            // real arena will never let you walk.
            const sr = solve(G, PHYS[ph], function (i) { return !!G.platforms[i].safe; });
            console.log('       safe ledges alone: ' +
                (sr && sr.path ? 'reach the door in ' + sr.path.length + ' moves' : 'DEAD END'));
            if (!sr || !sr.path) bad++;
            if (ph === 'normal' && sr && sr.path) plans[L.name] = sr.path.map(function (st) { return st.how; });
        }
    }
}
require('fs').writeFileSync('routes.json', JSON.stringify(plans, null, 1));
console.log(bad ? '\n' + bad + ' PROBLEM(S)' : '\nevery arena is finishable');
