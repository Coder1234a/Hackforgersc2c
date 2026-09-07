// levels.js - the arenas. plain data, zero logic.
//
// grid is 1280x600, one for one w/ the artwork. every ledge below was
// measured off the picture, so what you can see is what you collide with.
//
// house rule: hazards belong to the LEVEL and they're visible. the hidden
// rule is separate. keep them apart or you can't tell "the rock did that"
// from "the rule did that", and the whole thing falls over.

// world is exactly the size of the pictures. anything needing to know how
// wide the cave is asks these instead of guessing.
const WORLD_W = 1280, WORLD_H = 600;

// parMoves = avg MOVES a clean run takes in normal physics. not a guess,
// not hops x 2 - tools/par.js plays each arena 7x counting presses exactly
// like the keydown handler does. re-run it if you reshape an arena.

// ===================== ARENA 1 + 4 : DRIPSTONE =========================
//
// arena 1 = the control. nothing hidden, it just teaches you the cave.
// arena 4 = same stone, something changed underneath. that contrast is the
// game - you can't spot a difference you were never shown.
const CAVE_PLATFORMS = [
    // roof. one slab, so REVERSE_GRAVITY has somewhere to put you rather
    // than flinging you clean out of the world.
    { x:   0, y:   0, w:1280, h: 120, fixed: true },

    { x: 335, y: 184, w: 510, h:  10 },              // long upper shelf
    { x: 180, y: 228, w: 118, h:   9 },              // small left shelf
    { x:  24, y: 290, w: 118, h:   9 },              // far left, off the route
    { x: 181, y: 317, w: 240, h:   9 },              // mid shelf

    // tower parapet. masonry, not a shelf - never moves, you spawn on it.
    { x: 428, y: 307, w: 296, h:  12, fixed: true },

    // gate ledge. also pinned - a gate hovering w/ its step 100px away
    // just looks broken.
    { x:1001, y: 307, w:  98, h:   8, fixed: true }
];

// 11 of them across the roof. sizes + periods deliberately uneven; a tidy
// rhythm is learnable in one pass and this shouldn't be.
const CAVE_STALS = [
    { x:  90, y: 66, size: 1, period: 250, offset:   0 },
    { x: 190, y: 66, size: 0, period: 290, offset:  95 },
    { x: 300, y: 66, size: 2, period: 330, offset: 190 },
    { x: 400, y: 66, size: 0, period: 265, offset:  40 },
    { x: 500, y: 66, size: 3, period: 355, offset: 140 },
    { x: 600, y: 66, size: 1, period: 275, offset: 235 },
    { x: 700, y: 66, size: 2, period: 310, offset:  60 },
    { x: 800, y: 66, size: 0, period: 240, offset: 165 },
    { x: 900, y: 66, size: 3, period: 345, offset:  20 },
    { x:1010, y: 66, size: 1, period: 285, offset: 210 },
    { x:1110, y: 66, size: 2, period: 320, offset:  70 }
];

// the stub right of the light shaft. already painted into the cave - we
// rubbed it out of the picture so it could come alive. dead still til you
// land on it, then it runs you at the gate. stare all you like, it only
// betrays you once you commit.
const CAVE_MOVER = [
    { x: 905, y: 185, w: 58, h: 8, vx: 1.6, minX: 880, maxX: 1090, trigger: true }
];

// ===================== ARENA 2 : CHEESY CHASE ==========================
//
// every ledge sits inside a hole that's genuinely painted in the cheese,
// and they all look alike. 7 are the way out, the other 18 cheese you and
// bin you back to the start. that's the level.
//
// safe:true is the path. nothing on screen may shout which is which or
// there's no level left. hh = height of the hole it sits in; we don't paint
// the ledge at all now, so hh is how the trap tint knows what to shade.
const CHEESE_LEDGES = [
    { x:  60, y: 540, w: 140, h: 12, hh: 75, safe: true  },   // the start
    { x: 206, y: 461, w: 120, h: 12, hh: 70, safe: true  },
    { x: 401, y: 446, w:  96, h: 12, hh: 67, safe: true  },
    { x: 479, y: 333, w: 126, h: 12, hh: 63, safe: true  },
    { x: 606, y: 233, w: 141, h: 12, hh: 87, safe: true  },
    { x: 847, y: 267, w:  74, h: 12, hh: 39, safe: true  },
    { x:1004, y: 215, w: 167, h: 12, hh: 80, safe: true  },   // under the door

    { x:  44, y: 445, w: 100, h: 12, hh: 55 },                // ...and the cheese
    { x: 130, y: 337, w: 130, h: 12, hh: 80 },
    { x:  52, y: 250, w:  86, h: 12, hh: 40 },
    { x: 237, y: 233, w: 152, h: 12, hh: 65 },
    { x: 331, y: 535, w:  50, h: 12, hh: 30 },
    { x: 343, y: 328, w:  60, h: 12, hh: 49 },
    { x: 456, y: 243, w:  54, h: 12, hh: 27 },
    { x: 462, y: 540, w: 182, h: 12, hh: 70 },
    { x: 537, y: 413, w:  72, h: 12, hh: 47 },
    { x: 623, y: 469, w:  50, h: 12, hh: 39 },
    { x: 661, y: 390, w: 177, h: 12, hh: 95 },
    { x: 749, y: 296, w:  52, h: 12, hh: 38 },
    { x: 764, y: 535, w: 162, h: 12, hh: 70 },
    { x: 943, y: 325, w: 178, h: 12, hh:100 },
    { x: 941, y: 404, w:  48, h: 12, hh: 31 },
    { x:1004, y: 425, w: 172, h: 12, hh: 70 },
    { x:1000, y: 537, w:  37, h: 12, hh: 28 },
    { x:1154, y: 538, w:  82, h: 12, hh: 30 }
];

// ===================== ARENA 3 : GRASSY FALLS ==========================
//
// 26 grass steps, all of which give way under you. 3 doors, 1 way out. the
// other two are the joke:
//   top right    - the exit, you're through
//   bottom right - painted door, nothing behind it, you fall
//   top left     - kill switch. back to the balcony. top tier ragebait;
//                  costs you everything except the rule.
const GRASS_STEPS = [
    [ 357, 95], [ 489,127], [1038,134], [ 921,173], [ 357,176], [1038,195],
    [ 480,222], [ 342,234], [ 906,234], [ 218,253], [ 105,280], [1038,290],
    [ 921,321], [  87,350], [ 211,350], [ 332,350], [ 793,360], [ 463,379],
    [ 932,398], [ 342,418], [ 218,447], [ 793,457], [  98,483], [ 906,502],
    [ 211,514], [ 357,528]
];

// the 3 steps w/ a door on them never fall. a door you can't reach isn't a
// choice, it's a bug.
const GRASS_SOLID = [
    { x: 458, y: 536, w: 340, h: 20, fixed: true },   // the balcony roof
    { x: 537, y: 443, w: 250, h: 14, fixed: true },   // the ornate rail
    { x: 236, y:  59, w:  90, h: 14, fixed: true },   // under the kill switch
    { x:1158, y: 108, w:  90, h: 14, fixed: true },   // under the exit
    { x:1105, y: 437, w:  90, h: 14, fixed: true }    // under the trap
];

const LEVELS = [
    {
        id: 1, name: "Dripstone", art: "dripstone",
        blurb: "Rock falls. It rattles first. There is no floor.",
        tutorial: true,
        safeRules: ["NORMAL"],               // control run, nothing hidden
        spawn: { x: 628, y: 250 },           // dead centre, on the tower
        exit:  { x: 1028, y: 256, w: 46, h: 62 },
        platforms: CAVE_PLATFORMS,
        stalactites: CAVE_STALS,
        movers: CAVE_MOVER,
        killY: 545,                          // the dark ground. touch it, done.
        parMoves: 17,                        // measured by tools/par.js
        hasCeiling: true, hasProjectile: false
    },
    {
        id: 2, name: "Cheesy Chase", art: "cheese",
        blurb: "Seven of these hold. The rest are cheese.",
        safeRules: ["NORMAL","INVERTED_CONTROLS","MOMENTUM","MOVEMENT_COSTS_TIME"],
        spawn: { x: 120, y: 470 },
        exit:  { x: 1140, y: 118, w: 70, h: 100 },
        platforms: CHEESE_LEDGES,
        cheesed: true,                       // wrong ledge = back to the start
        killY: 585, parMoves: 19,
        hasCeiling: false, hasProjectile: false
    },
    {
        id: 3, name: "Grassy Falls", art: "grassy",
        blurb: "Three doors. One way out. Nothing holds.",
        safeRules: ["NORMAL","INVERTED_CONTROLS","MOMENTUM","MOVEMENT_COSTS_TIME"],
        spawn: { x: 620, y: 380 },
        exit:  { x: 1178, y: 59, w: 42, h: 56 },
        trapDoor:  { x: 1125, y: 387, w: 42, h: 54 },
        resetDoor: { x:  250, y:   6, w: 42, h: 54 },
        platforms: GRASS_SOLID,
        vanishers: GRASS_STEPS.map(function (s) {
            return { x: s[0], y: s[1], w: 90, h: 14 };
        }),
        killY: 585, parMoves: 14,
        hasCeiling: false, hasProjectile: false
    },
    {
        // same stone, same route, one thing underneath is different.
        id: 4, name: "Dripstone, again", art: "dripstone",
        blurb: "Same cave. Something is different. Which one?",
        safeRules: ["NORMAL","REVERSE_GRAVITY","INVERTED_CONTROLS","MOMENTUM",
                    "SHIFTING_PLATFORMS","MOVEMENT_COSTS_TIME"],
        spawn: { x: 628, y: 250 },
        // trigger runs a bit past the painted gate deliberately. gravity
        // flipped, you're on the roof dropping in from above, and 12px is
        // the difference between a move and a coin toss.
        exit:  { x: 1028, y: 256, w: 46, h: 62 },
        platforms: CAVE_PLATFORMS,
        stalactites: CAVE_STALS,
        movers: CAVE_MOVER,
        killY: 545, parMoves: 20,
        hasCeiling: true, hasProjectile: false
    }
];
