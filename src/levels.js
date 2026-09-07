// levels.js - the arenas, plain data, zero logic.
//
// grid is 20px a square. safeRules = what this arena can survive; the roll
// only ever draws from that list, so a rule can't hand you a level you
// physically can't finish.
//
// hazards (lasers, vanishers, movers, ghosts) belong to the LEVEL and are
// visible. the hidden rule is separate. keeping those apart is the whole
// reason the deduction works.

const ALL8 = ["NORMAL","REVERSE_GRAVITY","INVERTED_CONTROLS","NO_JUMP","MOMENTUM",
              "BULLETS_PUSH","SHIFTING_PLATFORMS","MOVEMENT_COSTS_TIME"];

const LEVELS = [
    {
        id: 1, name: "First Light", theme: "meadow",
        blurb: "Nothing here is trying to kill you. Work out what's different.",
        safeRules: ["NORMAL","REVERSE_GRAVITY","INVERTED_CONTROLS","NO_JUMP","MOMENTUM",
                    "SHIFTING_PLATFORMS","MOVEMENT_COSTS_TIME"],
        spawn: { x: 100, y: 340 },
        exit:  { x: 720, y: 340, w: 30, h: 40 },
        platforms: [
            { x: 0,   y: 380, w: 800, h: 20 },
            { x: 0,   y: 280, w: 800, h: 20 },
            { x: 480, y: 320, w: 100, h: 14 }
        ],
        hasCeiling: true, hasProjectile: false
    },
    {
        // the floor gives way. stand still and you lose it.
        id: 2, name: "The Vanishing Act", theme: "cavern",
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
        // beams on a fixed cycle. learn the rhythm, don't gamble.
        id: 3, name: "Laser Grid", theme: "cavern",
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
    },
    {
        // two platforms on patrol over a long drop.
        id: 4, name: "The Long Way Round", theme: "meadow",
        blurb: "Nothing under you stays put for long.",
        safeRules: ["NORMAL","REVERSE_GRAVITY","INVERTED_CONTROLS","MOMENTUM",
                    "BULLETS_PUSH","MOVEMENT_COSTS_TIME"],
        spawn: { x: 60, y: 340 },
        exit:  { x: 730, y: 300, w: 30, h: 40 },
        platforms: [
            { x: 0,   y: 380, w: 200, h: 20 },
            { x: 660, y: 340, w: 140, h: 20 },
            { x: 0,   y: 260, w: 800, h: 20 }
        ],
        movers: [
            { x: 240, y: 360, w: 90, h: 14, vx: 1.4, minX: 220, maxX: 430 },
            { x: 470, y: 340, w: 90, h: 14, vy: 1.1, minY: 300, maxY: 370 }
        ],
        hasCeiling: true, hasProjectile: true
    }
];
