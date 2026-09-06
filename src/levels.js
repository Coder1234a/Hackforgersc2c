// levels.js — the arenas, as plain data. No logic in here at all.
// Grid is 20px a square. safeRules is the list this arena can survive:
// the roll only ever draws from it, so a rule can't make a level
// impossible to finish.

const LEVELS = [
    {
        id: 1, name: "First Light", theme: "meadow",
        safeRules: ["NORMAL","REVERSE_GRAVITY","INVERTED_CONTROLS","NO_JUMP","MOMENTUM"],
        spawn: { x: 100, y: 340 },
        exit:  { x: 720, y: 340, w: 30, h: 40 },
        platforms: [
            { x: 0,   y: 380, w: 800, h: 20 },   // floor
            { x: 0,   y: 280, w: 800, h: 20 },   // ceiling, 80px headroom
            { x: 480, y: 320, w: 100, h: 14 }    // ledge
        ],
        hasCeiling: true, hasProjectile: false
    },
    {
        id: 2, name: "Tighter", theme: "cavern",
        safeRules: ["NORMAL","REVERSE_GRAVITY","INVERTED_CONTROLS","NO_JUMP","MOMENTUM"],
        spawn: { x: 100, y: 340 },
        exit:  { x: 480, y: 340, w: 30, h: 40 },
        platforms: [
            { x: 0,   y: 380, w: 528, h: 20 },
            { x: 0,   y: 280, w: 528, h: 20 },
            { x: 288, y: 330, w: 96,  h: 14 }
        ],
        hasCeiling: true, hasProjectile: false
    },
    {
        id: 3, name: "First Projectile", theme: "meadow",
        safeRules: ["NORMAL","REVERSE_GRAVITY","INVERTED_CONTROLS","NO_JUMP","MOMENTUM"],
        spawn: { x: 100, y: 340 },
        exit:  { x: 440, y: 340, w: 30, h: 40 },
        platforms: [
            { x: 0,   y: 380, w: 480, h: 20 },
            { x: 0,   y: 280, w: 480, h: 20 },
            { x: 192, y: 320, w: 144, h: 14 }
        ],
        hasCeiling: true, hasProjectile: true
    },
    {
        id: 4, name: "Head-height Projectile", theme: "cavern",
        safeRules: ["NORMAL","REVERSE_GRAVITY","INVERTED_CONTROLS","NO_JUMP","MOMENTUM"],
        spawn: { x: 100, y: 340 },
        exit:  { x: 520, y: 340, w: 30, h: 40 },
        platforms: [
            { x: 0,   y: 380, w: 576, h: 20 },
            { x: 0,   y: 280, w: 576, h: 20 },
            { x: 384, y: 320, w: 144, h: 14 }
        ],
        hasCeiling: true, hasProjectile: true
    },
    {
        // No NO_JUMP here - the pit needs a jump. No MOMENTUM either,
        // you'd skid straight into it with no way to stop.
        id: 5, name: "Split Floor", theme: "meadow",
        safeRules: ["NORMAL","REVERSE_GRAVITY","INVERTED_CONTROLS"],
        spawn: { x: 100, y: 340 },
        exit:  { x: 620, y: 340, w: 30, h: 40 },
        platforms: [
            { x: 0,   y: 380, w: 288, h: 20 },
            { x: 384, y: 380, w: 288, h: 20 },
            { x: 0,   y: 280, w: 672, h: 20 },
            { x: 288, y: 340, w: 96,  h: 14 }    // stepping stone over the pit
        ],
        hasCeiling: true, hasProjectile: true
    },
    {
        // The step up to the raised floor needs a jump, so NO_JUMP is out.
        id: 6, name: "Two Levels", theme: "cavern",
        safeRules: ["NORMAL","REVERSE_GRAVITY","INVERTED_CONTROLS","MOMENTUM"],
        spawn: { x: 100, y: 340 },
        exit:  { x: 680, y: 280, w: 30, h: 40 },
        platforms: [
            { x: 0,   y: 380, w: 432, h: 20 },   // lower floor
            { x: 432, y: 320, w: 288, h: 20 },   // raised floor
            { x: 0,   y: 280, w: 432, h: 20 },   // ceiling over the lower half
            { x: 432, y: 240, w: 288, h: 20 },   // ceiling over the raised half
            { x: 96,  y: 300, w: 144, h: 14 }
        ],
        hasCeiling: true, hasProjectile: true
    }
];
