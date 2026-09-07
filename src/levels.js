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
const CAVE_PLATFORMS = [
    { x: 0,   y: 410, w: 190, h: 20 },   // start shelf
    { x: 240, y: 370, w: 120, h: 16 },
    { x: 410, y: 330, w: 110, h: 16 },
    { x: 570, y: 300, w: 90,  h: 16 },
    { x: 0,   y: 150, w: 800, h: 22 }    // cave roof, stalactites hang here
];

const CAVE_STALS = [
    { x: 140, y: 172, size: 0, period: 170, offset: 0   },
    { x: 275, y: 172, size: 2, period: 210, offset: 60  },
    { x: 330, y: 172, size: 1, period: 150, offset: 120 },
    { x: 445, y: 172, size: 3, period: 240, offset: 30  },
    { x: 495, y: 172, size: 0, period: 130, offset: 90  },
    { x: 600, y: 172, size: 2, period: 190, offset: 150 },
    { x: 700, y: 172, size: 1, period: 160, offset: 40  }
];

// the last jump. sits dead still until you stand on it, then it runs -
// so you can study it all you like and it still betrays you once.
const CAVE_MOVER = [
    { x: 690, y: 260, w: 70, h: 14, vx: 1.5, minX: 600, maxX: 780, trigger: true }
];

const LEVELS = [
    {
        id: 1, name: "Dripstone", theme: "cavern",
        blurb: "Rock falls. Watch what shakes before it does.",
        tutorial: true,
        safeRules: ["NORMAL"],               // first run is always plain
        spawn: { x: 40, y: 370 },
        exit:  { x: 700, y: 210, w: 30, h: 40 },
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
        spawn: { x: 40, y: 370 },
        exit:  { x: 700, y: 210, w: 30, h: 40 },
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
