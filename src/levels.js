// levels.js — the arenas, as plain data. No logic lives here.

const LEVELS = [
    {
        id: 1,
        name: "First Light",
        safeRules: ["NORMAL", "REVERSE_GRAVITY", "INVERTED_CONTROLS", "NO_JUMP", "MOMENTUM"],
        spawn: { x: 100, y: 340 },
        exit:  { x: 720, y: 340, w: 30, h: 40 },
        platforms: [
            { x: 0,   y: 380, w: 800, h: 20 },   // floor, full width
            { x: 0,   y: 280, w: 800, h: 20 },   // ceiling, 80px of headroom
            { x: 480, y: 320, w: 100, h: 14 }    // ledge, one jump up
        ],
        hasCeiling: true,
        hasProjectile: false
    }
];
