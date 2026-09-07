// levels.js - the arenas, plain data, zero logic.
//
// grid is 20px a square, canvas is 800x450. safeRules is what this arena
// can survive; the roll only draws from that list, so a rule can never
// hand you a level you physically can't finish.
//
// hazards belong to the LEVEL and are visible. the hidden rule is separate.
// keeping those two apart is the entire reason the deduction works.

// arena 1 shows up twice on purpose. first run is plain - it teaches you
// the cave, the stalactites and the moving ledge with nothing else going
// on. second run is the same rock with a rule underneath it, and that
// contrast IS the game. you already know what this place should do.
// you start in the middle of a wide shelf with open sky above you, then
// climb out to either side. no safe corner to hide in while you think.
const CAVE_PLATFORMS = [
    { x: 250, y: 300, w: 300, h: 18 },   // centre shelf, you spawn here
    { x:  20, y: 360, w: 170, h: 16 },
    { x: 610, y: 360, w: 170, h: 16 },
    { x: 120, y: 232, w: 120, h: 16 },
    { x: 560, y: 232, w: 120, h: 16 },
    { x:   0, y: 418, w: 800, h: 32 },   // cave floor
    { x:   0, y:  74, w: 800, h: 22 }    // roof, stalactites hang here
];

// eleven of them, right across the roof, so nowhere on the floor is safe
// to just stand. sizes and periods are deliberately uneven - a tidy rhythm
// would be learnable in one pass and this shouldn't be.
const CAVE_STALS = [
    { x:  60, y: 96, size: 1, period: 170, offset:   0 },
    { x: 130, y: 96, size: 0, period: 205, offset:  55 },
    { x: 205, y: 96, size: 2, period: 240, offset: 110 },
    { x: 275, y: 96, size: 0, period: 150, offset:  25 },
    { x: 345, y: 96, size: 3, period: 265, offset:  80 },
    { x: 400, y: 96, size: 1, period: 185, offset: 140 },
    { x: 470, y: 96, size: 2, period: 220, offset:  35 },
    { x: 540, y: 96, size: 0, period: 160, offset:  95 },
    { x: 610, y: 96, size: 3, period: 250, offset:  15 },
    { x: 680, y: 96, size: 1, period: 195, offset: 125 },
    { x: 740, y: 96, size: 2, period: 175, offset:  70 }
];

// the last jump. sits dead still until you stand on it, then it runs -
// so you can study it all you like and it still betrays you once.
// the last jump. sits dead still until you stand on it, then it runs - so
// you can study it all you like and it still betrays you once.
const CAVE_MOVER = [
    { x: 340, y: 180, w: 80, h: 14, vx: 1.6, minX: 250, maxX: 560, trigger: true }
];

const LEVELS = [
    {
        id: 1, name: "Dripstone", theme: "cavern",
        blurb: "Rock falls. Watch what shakes before it does.",
        tutorial: true,
        safeRules: ["NORMAL"],               // first run is always plain
        spawn: { x: 385, y: 260 },              // dead centre
        exit:  { x: 385, y:  96, w: 30, h: 40 },   // straight up, past the rocks
        platforms: CAVE_PLATFORMS,
        stalactites: CAVE_STALS,
        movers: CAVE_MOVER,
        hasCeiling: true, hasProjectile: false
    },
    {
        // same rock, same route, one thing underneath is different.
        id: 2, name: "Dripstone, again", theme: "cavern",
        blurb: "Same cave. Something is different. Which one?",
        safeRules: ["NORMAL","REVERSE_GRAVITY","INVERTED_CONTROLS","MOMENTUM",
                    "SHIFTING_PLATFORMS","MOVEMENT_COSTS_TIME"],
        spawn: { x: 385, y: 260 },              // dead centre
        exit:  { x: 385, y:  96, w: 30, h: 40 },   // straight up, past the rocks
        platforms: CAVE_PLATFORMS,
        stalactites: CAVE_STALS,
        movers: CAVE_MOVER,
        hasCeiling: true, hasProjectile: false
    },
    {
        id: 3, name: "The Vanishing Act", theme: "cavern",
        blurb: "The floor doesn't like being stood on.",
        safeRules: ["NORMAL","REVERSE_GRAVITY","INVERTED_CONTROLS","MOMENTUM",
                    "SHIFTING_PLATFORMS","MOVEMENT_COSTS_TIME"],
        spawn: { x: 60, y: 340 },
        exit:  { x: 720, y: 340, w: 30, h: 40 },
        platforms: [
            { x: 0,   y: 380, w: 180, h: 20 },
            { x: 620, y: 380, w: 180, h: 20 },
            { x: 0,   y: 280, w: 800, h: 20 }
        ],
        vanishers: [
            { x: 200, y: 380, w: 90, h: 16 },
            { x: 330, y: 380, w: 90, h: 16 },
            { x: 460, y: 380, w: 90, h: 16 }
        ],
        ghosts: [ { x: 300, y: 320, w: 80, h: 14 } ],
        hasCeiling: true, hasProjectile: false
    },
    {
        id: 4, name: "Laser Grid", theme: "cavern",
        blurb: "Four beams, one pattern. It repeats.",
        safeRules: ["NORMAL","REVERSE_GRAVITY","INVERTED_CONTROLS","NO_JUMP",
                    "BULLETS_PUSH","MOVEMENT_COSTS_TIME"],
        spawn: { x: 60, y: 340 },
        exit:  { x: 720, y: 340, w: 30, h: 40 },
        platforms: [
            { x: 0, y: 380, w: 800, h: 20 },
            { x: 0, y: 280, w: 800, h: 20 },
            { x: 340, y: 330, w: 120, h: 14 }
        ],
        lasers: [
            { x: 220, y: 300, w: 8, h: 80, period: 150, duty: 0.45, offset: 0 },
            { x: 400, y: 300, w: 8, h: 80, period: 150, duty: 0.45, offset: 50 },
            { x: 560, y: 300, w: 8, h: 80, period: 150, duty: 0.45, offset: 100 },
            { x: 660, y: 300, w: 8, h: 80, period: 210, duty: 0.35, offset: 25 }
        ],
        hasCeiling: true, hasProjectile: true
    }
];
