// art.js - every pixel the game paints lives in here.
//
// these take coords and draw. that's it. none of them read or write game
// state, which is the reason the arena data, the rules and the look can
// each change without the other two even noticing.
//
// two themes off the design file: a bright meadow and a lava cavern. they
// share one bit of grammar - anything you can stand on gets a bright
// yellow-green lip. that one rule is why a ledge reads instantly in a green
// field or a black cave without the player relearning anything.

const THEMES = {
    meadow: {
        skyTop:"#3d84c6", skyMid:"#7cb8e7", skyLow:"#d3e9f5",
        ridge:"#93b7cf", hillFar:"#8ab868", hillNear:"#5f9a3c",
        fieldTop:"#7cc247", fieldLow:"#3d7822", fieldBand:"rgba(28,66,18,.13)",
        lip:"#c9e75c", cap:"#63bd37", capMid:"#54a72e", capDark:"#3f8526",
        body:"#a86f3c", bodyDark:"#7f5225", bodyLight:"#c48a4f",
        apron:"#d2a05c", apronLine:"#8a5a2b",
        stone:"#9aa3a8", stoneDark:"#6d757a",
        door:"#c4623a", doorLit:"#e08a57", doorDark:"#7a3520",
        cave:false
    },
    cavern: {
        skyTop:"#0c0605", skyMid:"#110807", skyLow:"#1b0c09",
        ridge:"#3c1613", hillFar:"#2b100e", hillNear:"#1c0a09",
        fieldTop:"#3a1512", fieldLow:"#120606", fieldBand:"rgba(255,92,30,.07)",
        rockFar:"#6b3325", rockNear:"#4a2118", rockRim:"#c8501f",
        lip:"#c9e75c", cap:"#7a3125", capMid:"#5c2119", capDark:"#3d130e",
        body:"#2f1512", bodyDark:"#180a08", bodyLight:"#48201a",
        apron:"#4a201a", apronLine:"#220d0b",
        stone:"#6d5a55", stoneDark:"#463832",
        door:"#c4623a", doorLit:"#e8a05c", doorDark:"#5a2415",
        cave:true
    }
};

function themeOf(level) { return THEMES[level.theme] || THEMES.meadow; }

// frame counter, parked here so flames + clouds can move without every
// paint fn taking a time arg it mostly ignores
let ART_TICK = 0;
function setTick(t) { ART_TICK = t; }

// Deterministic stand-in for Math.random. Speckles and rubble have to land
// in the same place every frame or the whole arena crawls with static.
function hash(n) {
    const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return s - Math.floor(s);
}

function roundRect(g, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);         g.arcTo(x, y, x + w, y, r);
    g.closePath();
}

// Sorts an arena's platforms into the three things they can be on screen.
// Thin ones float. Thick ones are terrain, and which side of the chamber
// they sit on decides whether they are ground underfoot or a ceiling.
function readArena(level) {
    let top = Infinity, bottom = -Infinity, minX = Infinity, maxX = -Infinity;
    for (const p of level.platforms) {
        top = Math.min(top, p.y);
        bottom = Math.max(bottom, p.y + p.h);
        minX = Math.min(minX, p.x);
        maxX = Math.max(maxX, p.x + p.w);
    }
    const mid = (top + bottom) / 2;
    const floors = [], ceilings = [], ledges = [];
    for (const p of level.platforms) {
        if (p.h < 20)       ledges.push(p);
        else if (p.y < mid) ceilings.push(p);
        else                floors.push(p);
    }
    // The horizon sits just under the ceiling, so the chamber you actually
    // play in is open ground with hills behind it rather than a strip of
    // sky. That is how the design file reads, and it is what makes an
    // 80px-high corridor look like somewhere instead of a slot.
    let horizon = null;
    for (const p of ceilings) horizon = Math.max(horizon === null ? -Infinity : horizon, p.y + p.h);
    if (horizon === null) for (const p of floors) horizon = Math.min(horizon === null ? Infinity : horizon, p.y);
    if (horizon === null) horizon = bottom;
    return { top, bottom, minX, maxX, mid, floors, ceilings, ledges, horizon };
}

// Some arenas are narrower than the frame. Rather than let the ground stop
// dead in open air, fade the world out past the last platform - it reads as
// an edge you were never meant to reach, which is exactly what it is.
function paintWorldEdge(g, geo, w, h) {
    const fade = 110;
    if (geo.maxX < w) {
        const r = g.createLinearGradient(geo.maxX - fade, 0, geo.maxX + 30, 0);
        r.addColorStop(0, "rgba(6,8,11,0)"); r.addColorStop(1, "rgba(6,8,11,.88)");
        g.fillStyle = r; g.fillRect(geo.maxX - fade, 0, w - geo.maxX + fade, h);
    }
    if (geo.minX > 0) {
        const l = g.createLinearGradient(geo.minX + fade, 0, geo.minX - 30, 0);
        l.addColorStop(0, "rgba(6,8,11,0)"); l.addColorStop(1, "rgba(6,8,11,.88)");
        g.fillStyle = l; g.fillRect(0, 0, geo.minX + fade, h);
    }
}

// Which surface is directly under this point? Used to stand the spawn pipe
// on the floor rather than guessing where the floor is.
function surfaceUnder(level, x, y) {
    let best = null;
    for (const p of level.platforms) {
        if (p.y < y) continue;
        if (x < p.x || x > p.x + p.w) continue;
        if (best === null || p.y < best) best = p.y;
    }
    return best === null ? y + 40 : best;
}

/* ------------------------------------------------------------------ *
 * backdrop
 * ------------------------------------------------------------------ */

// The design file's background is a low-res photo blown up until you can
// count the pixels. Painting it small and scaling it back up with
// smoothing off gets the same chunk for free, at a third of the fill rate.
const BACKDROP_DIV = 3;
let backdropTile = null;

function backdropCanvas(w, h) {
    if (!backdropTile) backdropTile = document.createElement("canvas");
    const bw = Math.ceil(w / BACKDROP_DIV), bh = Math.ceil(h / BACKDROP_DIV);
    if (backdropTile.width !== bw || backdropTile.height !== bh) {
        backdropTile.width = bw; backdropTile.height = bh;
    }
    return backdropTile;
}

const CLOUDS = [
    { x:  40, y:  74, s: 1.15, v: 0.050 },
    { x: 250, y:  46, s: 0.75, v: 0.085 },
    { x: 400, y: 112, s: 1.00, v: 0.032 },
    { x: 560, y:  62, s: 0.85, v: 0.066 },
    { x: 700, y: 132, s: 0.65, v: 0.098 },
    { x: 175, y: 152, s: 0.55, v: 0.120 }
];

function paintCloud(g, x, y, s) {
    const puff = [[0, 0, 16], [20, -9, 21], [45, -3, 17], [63, 5, 11]];
    g.fillStyle = "#ffffff";
    for (const p of puff) {
        g.beginPath();
        g.arc(x + p[0] * s, y + p[1] * s, p[2] * s, 0, Math.PI * 2);
        g.fill();
    }
    g.fillRect(x - 16 * s, y - 2 * s, 90 * s, 15 * s);
    g.fillStyle = "rgba(176,203,226,.5)";                 // shaded underside
    g.fillRect(x - 16 * s, y + 9 * s, 90 * s, 4 * s);
}

// One filled ridge line. Two or three of these stacked read as depth.
function paintRidge(g, w, baseY, amp, freq, phase, colour) {
    g.fillStyle = colour;
    g.beginPath();
    g.moveTo(0, baseY + 400);
    for (let x = 0; x <= w; x += 4) {
        const t = x / w;
        g.lineTo(x, baseY - amp * (0.55 + 0.45 * Math.sin(t * freq * Math.PI * 2 + phase)));
    }
    g.lineTo(w, baseY + 400);
    g.closePath();
    g.fill();
}

// The same ridge trick hanging the other way up, for rock overhead. One
// slow wave gives the cavern its arch; the two fast ones on top are what
// stop the edge reading as torn paper instead of stone.
function caveEdge(g, w, depth, freq, phase, drop) {
    g.beginPath();
    g.moveTo(0, -400);
    for (let x = 0; x <= w; x += 3) {
        const t = x / w;
        g.lineTo(x, drop + depth * (.46
            + .34 * Math.sin(t * freq * Math.PI * 2 + phase)
            + .12 * Math.sin(t * freq * 5.3 * Math.PI * 2 + phase * 2)
            + .05 * Math.sin(t * freq * 8.3 * Math.PI * 2 + phase)));
    }
    g.lineTo(w, -400);
    g.closePath();
    g.fill();
}

// Painted twice: once in the hot rim colour, then again a couple of pixels
// shallower in rock. What is left showing is a lit edge along the underside.
function paintCeilingRock(g, w, depth, freq, phase, rock, rim) {
    g.fillStyle = rim;  caveEdge(g, w, depth, freq, phase, 0);
    g.fillStyle = rock; caveEdge(g, w, depth, freq, phase, -2);
}

function paintBackdrop(g, w, h, horizonY, t) {
    const bc = backdropCanvas(w, h), b = bc.getContext("2d");
    const d = BACKDROP_DIV, bw = bc.width, bh = bc.height, hz = horizonY / d;

    const sky = b.createLinearGradient(0, 0, 0, Math.max(1, hz));
    sky.addColorStop(0, t.skyTop);
    sky.addColorStop(.6, t.skyMid);
    sky.addColorStop(1, t.skyLow);
    b.fillStyle = sky;
    b.fillRect(0, 0, bw, bh);

    if (t.cave) {
        // A cavern has no sky. The light at the horizon is magma, and what
        // hangs overhead is rock, not weather.
        const glow = b.createRadialGradient(bw / 2, hz, 0, bw / 2, hz, bw * .55);
        glow.addColorStop(0, "rgba(255,106,42,.20)");
        glow.addColorStop(1, "rgba(255,106,42,0)");
        b.fillStyle = glow;
        b.fillRect(0, 0, bw, bh);

        paintCeilingRock(b, bw, hz * .62, 1.1, 2.6, t.rockFar,  t.rockRim);
        paintCeilingRock(b, bw, hz * .40, 1.7, 0.4, t.rockNear, t.rockRim);
        paintRidge(b, bw, hz + 1, 16 / d, 1.4, 1.1, t.hillFar);   // rubble
    } else {
        for (const c of CLOUDS) {
            const x = ((c.x + ART_TICK * c.v) % (w + 200)) - 100;
            paintCloud(b, x / d, c.y / d, c.s / d);
        }
        // Hills rise out of the horizon into the sky; the field then covers
        // everything from the horizon down, so the joins never show.
        // Furthest first, and furthest is also tallest - that is the only
        // depth cue here, so the order matters more than the colours do.
        paintRidge(b, bw, hz + 1, 54 / d, 0.9, 2.1, t.ridge);
        paintRidge(b, bw, hz + 1, 34 / d, 0.7, 4.4, t.hillFar);
        paintRidge(b, bw, hz + 1, 19 / d, 1.6, 0.6, t.hillNear);
    }

    const top = Math.floor(hz);
    const field = b.createLinearGradient(0, top, 0, bh);
    field.addColorStop(0, t.fieldTop);
    field.addColorStop(1, t.fieldLow);
    b.fillStyle = field;
    b.fillRect(0, top, bw, bh - top);

    b.fillStyle = t.fieldBand;                    // mown bands, receding
    for (let i = 0, y = top + 2; y < bh; i++, y += 2 + i * .55) b.fillRect(0, Math.floor(y), bw, 1);

    g.imageSmoothingEnabled = false;
    g.drawImage(bc, 0, 0, w, h);
    g.imageSmoothingEnabled = true;
}

/* ------------------------------------------------------------------ *
 * terrain
 * ------------------------------------------------------------------ */

// The bright lip. Every standable surface in both themes gets this, and
// nothing else does - it is the one thing a player can always trust.
// flip = true when the surface faces downward, i.e. a ceiling.
function paintLip(g, x, y, w, t, flip) {
    const dir = flip ? -1 : 1;
    g.fillStyle = t.lip;
    g.fillRect(x, flip ? y - 2 : y, w, 3);
    for (let i = 0; i < w; i += 8) {          // blunt teeth, so it is not a ruled line
        if (hash(x + i) > .55) g.fillRect(x + i, y - dir * 2, 5, 2);
    }
}

function paintBody(g, x, y, w, h, t, seed) {
    if (h <= 0) return;
    g.fillStyle = t.body;
    g.fillRect(x, y, w, h);
    g.fillStyle = t.bodyDark;
    g.fillRect(x, y + h - 3, w, 3);
    for (let i = 0; i < w * h / 900; i++) {   // speckles and pebbles
        const n = seed + i * 3;
        const sx = x + hash(n) * (w - 6), sy = y + 4 + hash(n + 1) * Math.max(1, h - 10);
        g.fillStyle = hash(n + 2) > .5 ? t.bodyDark : t.bodyLight;
        g.fillRect(Math.floor(sx), Math.floor(sy), 4, 3);
    }
    if (t.cave) {                             // magma seams
        g.fillStyle = "rgba(255,94,32,.5)";
        for (let i = 0; i < w / 60; i++) {
            const n = seed + 400 + i * 5;
            const cx = x + hash(n) * w, cy = y + 6 + hash(n + 1) * Math.max(1, h - 14);
            g.fillRect(Math.floor(cx), Math.floor(cy), 3 + hash(n + 2) * 22, 2);
        }
    }
}

function paintTerrain(g, geo, w, h, t) {
    // A hole in the floor has to read as a hole, not as a strip of the
    // scenery behind. Shade the gaps between platforms sharing a level
    // before any ground is drawn over the top of them.
    const rows = {};
    for (const p of geo.floors) (rows[p.y] = rows[p.y] || []).push(p);
    for (const y in rows) {
        const row = rows[y].sort(function (a, b) { return a.x - b.x; });
        for (let i = 1; i < row.length; i++) {
            const gx = row[i - 1].x + row[i - 1].w, gw = row[i].x - gx;
            if (gw <= 0) continue;
            const pit = g.createLinearGradient(0, +y, 0, h);
            pit.addColorStop(0, "rgba(9,11,9,.55)");
            pit.addColorStop(1, "rgba(4,5,4,.96)");
            g.fillStyle = pit;
            g.fillRect(gx, +y, gw, h - y);
        }
    }

    // Ground: cap at the platform's real top, body poured all the way down
    // to the bottom of the frame, so a gap in the floor reads as a chasm
    // rather than a shelf with daylight under it.
    for (const p of geo.floors) {
        paintBody(g, p.x, p.y + 6, p.w, h - p.y - 6, t, p.x + p.y);
        g.fillStyle = t.capMid;  g.fillRect(p.x, p.y, p.w, 8);
        g.fillStyle = t.capDark; g.fillRect(p.x, p.y + 8, p.w, 2);
        paintLip(g, p.x, p.y, p.w, t, false);
    }

    // Ceiling: the same slab upside down. Under reverse gravity this is the
    // floor, so it earns the same lip on the side you would walk on.
    for (const p of geo.ceilings) {
        paintBody(g, p.x, p.y, p.w, p.h - 6, t, p.x + p.y + 77);
        g.fillStyle = t.capMid;  g.fillRect(p.x, p.y + p.h - 8, p.w, 8);
        g.fillStyle = t.capDark; g.fillRect(p.x, p.y + p.h - 10, p.w, 2);
        paintLip(g, p.x, p.y + p.h, p.w, t, true);
    }

    // Ledges: cap on the collision box, plank apron hanging below it. The
    // apron is decoration and hangs past the box on purpose - the bright
    // lip is the line you actually land on.
    for (const p of geo.ledges) {
        const apron = 12, ay = p.y + p.h - 2;
        g.fillStyle = t.apron;     g.fillRect(p.x, ay, p.w, apron);
        g.fillStyle = t.apronLine;
        for (let x = p.x + 3; x < p.x + p.w - 1; x += 7) g.fillRect(x, ay, 2, apron);
        g.fillRect(p.x, ay + apron - 3, p.w, 3);
        g.fillStyle = t.capMid;    g.fillRect(p.x, p.y, p.w, p.h);
        g.fillStyle = t.capDark;   g.fillRect(p.x, p.y + p.h - 4, p.w, 3);
        paintLip(g, p.x, p.y, p.w, t, false);
    }

    if (t.cave) for (const p of geo.ceilings) paintTorches(g, p);
}

// Wall torches hung from the cavern ceiling. The flame wobbles off the
// frame counter, so it holds no state and survives a respawn unbroken.
function paintTorches(g, p) {
    const y = p.y + p.h + 4;
    for (let x = p.x + 64; x < p.x + p.w - 34; x += 130) {
        g.fillStyle = "#4a3128"; g.fillRect(x - 3, y, 6, 15);
        g.fillStyle = "#2a1a14"; g.fillRect(x - 5, y + 13, 10, 4);
        const f = 1 + .18 * Math.sin((ART_TICK + x) / 7), fy = y + 26;
        g.fillStyle = "rgba(255,120,30,.28)";
        g.beginPath(); g.arc(x, fy - 4, 27 * f, 0, Math.PI * 2); g.fill();
        g.fillStyle = "#ff6a1e";
        g.beginPath(); g.ellipse(x, fy, 6 * f, 10 * f, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = "#ffc93c";
        g.beginPath(); g.ellipse(x, fy + 1, 3.2 * f, 6 * f, 0, 0, Math.PI * 2); g.fill();
    }
}

/* ------------------------------------------------------------------ *
 * props
 * ------------------------------------------------------------------ */

// The spawn pipe. Scenery only, nothing collides with it. It marks where
// you came into the world, which is the one thing worth knowing after a
// respawn drops you somewhere you were not looking.
function paintPipe(g, cx, baseY, t) {
    const w = 34, h = 46, x = cx - w / 2, y = baseY - h;
    const dark = t.cave ? "#3a2622" : "#1e5e12";
    const mid  = t.cave ? "#6d4a3f" : "#3ea019";
    const lit  = t.cave ? "#a3766a" : "#7ed957";

    g.fillStyle = mid;  g.fillRect(x + 3, y + 12, w - 6, h - 12);
    g.fillStyle = lit;  g.fillRect(x + 6, y + 12, 6, h - 12);
    g.fillStyle = dark; g.fillRect(x + w - 9, y + 12, 5, h - 12);

    g.fillStyle = mid;  g.fillRect(x, y, w, 13);            // rim
    g.fillStyle = lit;  g.fillRect(x + 3, y + 2, 6, 9);
    g.fillStyle = dark; g.fillRect(x + w - 7, y + 2, 4, 9);
    g.fillRect(x, y + 11, w, 3);
    g.fillStyle = "rgba(0,0,0,.45)"; g.fillRect(x + 4, y + 1, w - 8, 4);   // the mouth
}

// The way out. A door with a sign over it, so it reads as an exit before
// you have worked out anything else about the arena.
function paintExit(g, r, won, t) {
    const x = r.x, y = r.y, w = r.w, h = r.h;

    g.fillStyle = t.stoneDark; g.fillRect(x - 4, y - 3, w + 8, h + 3);
    g.fillStyle = t.stone;     g.fillRect(x - 3, y - 2, w + 6, h + 2);

    const face = won ? "#2a1b12" : t.door;
    g.fillStyle = face;
    g.fillRect(x, y + w / 2, w, h - w / 2);
    g.beginPath(); g.arc(x + w / 2, y + w / 2, w / 2, Math.PI, 0); g.fill();

    if (!won) {
        g.fillStyle = t.doorLit;  g.fillRect(x + 2, y + 8, 4, h - 10);
        g.fillStyle = t.doorDark;
        for (let i = x + 9; i < x + w - 2; i += 7) g.fillRect(i, y + 6, 2, h - 8);
        g.fillStyle = "#f0d264"; g.fillRect(x + w - 8, y + h / 2 + 2, 4, 4);   // knob
    } else {
        const spill = g.createLinearGradient(x, y, x, y + h);
        spill.addColorStop(0, "rgba(255,246,196,.85)");
        spill.addColorStop(1, "rgba(255,246,196,.12)");
        g.fillStyle = spill; g.fillRect(x + 3, y + 4, w - 6, h - 4);
    }

    const sw = 30, sx = x + w / 2 - sw / 2, sy = y - 18;     // EXIT sign
    g.fillStyle = t.stoneDark; g.fillRect(x + w / 2 - 1, sy + 9, 2, 8);
    g.fillStyle = "#2e7d32";   g.fillRect(sx - 1, sy - 1, sw + 2, 12);
    g.fillStyle = "#4caf50";   g.fillRect(sx, sy, sw, 10);
    g.save();
    g.fillStyle = "#ffffff";
    g.font = "bold 8px ui-monospace, Consolas, monospace";
    g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText("EXIT", sx + sw / 2, sy + 5.5);
    g.restore();
}

// A tuft of scenery. Cheap, but it stops the ground reading as a bare bar.
function paintTuft(g, x, baseY, t) {
    if (t.cave) {
        g.fillStyle = "#2a1210";
        g.beginPath(); g.ellipse(x, baseY - 3, 11, 6, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = "rgba(255,94,32,.45)"; g.fillRect(x - 6, baseY - 5, 8, 2);
        return;
    }
    g.fillStyle = "#2f6b1c";                       // three lobes, not a pill
    for (const b of [[-6, -3, 5], [0, -6, 6], [6, -3, 5]]) {
        g.beginPath(); g.arc(x + b[0], baseY + b[1], b[2], 0, Math.PI * 2); g.fill();
    }
    g.fillRect(x - 11, baseY - 3, 22, 3);
    g.fillStyle = "#4c9a2c";
    for (const b of [[-5, -4, 3], [1, -7, 3.5]]) {
        g.beginPath(); g.arc(x + b[0], baseY + b[1], b[2], 0, Math.PI * 2); g.fill();
    }
    g.fillStyle = "#fff6c4";
    g.fillRect(x + 4, baseY - 6, 2, 2);
    g.fillRect(x - 7, baseY - 5, 2, 2);
}

/* ------------------------------------------------------------------ *
 * the player
 * ------------------------------------------------------------------ */

// A small square with slightly rounded corners. Deliberately the plainest
// thing on screen: the arena is the puzzle, the block is just you.
function paintPlayer(g, p, groundY) {
    if (groundY !== null && groundY > p.y + p.h) {           // contact shadow
        const d = Math.max(0, 1 - (groundY - (p.y + p.h)) / 90);
        if (d > 0) {
            g.fillStyle = "rgba(0,0,0," + (.3 * d).toFixed(3) + ")";
            g.beginPath();
            g.ellipse(p.x + p.w / 2, groundY - 1, p.w * .5 * d, 3.5 * d, 0, 0, Math.PI * 2);
            g.fill();
        }
    }
    g.fillStyle = "#2b2410";
    roundRect(g, p.x - 1.5, p.y - 1.5, p.w + 3, p.h + 3, 6.5); g.fill();
    g.fillStyle = "#f5c542";
    roundRect(g, p.x, p.y, p.w, p.h, 5); g.fill();
    g.fillStyle = "#d9a521";
    roundRect(g, p.x + 2, p.y + p.h * .58, p.w - 4, p.h * .42 - 2, 3); g.fill();
    g.fillStyle = "rgba(255,255,255,.55)";
    roundRect(g, p.x + 3.5, p.y + 3, p.w * .38, 3.5, 1.75); g.fill();
}

/* ------------------------------------------------------------------ *
 * finish
 * ------------------------------------------------------------------ */

// The frames in the design file are a photograph of a screen, scanlines
// and all. One pass of dark rules over the top and it sits together.
function paintScanlines(g, w, h) {
    g.fillStyle = "rgba(0,0,0,.07)";
    for (let y = 0; y < h; y += 3) g.fillRect(0, y, w, 1);
    const vig = g.createRadialGradient(w / 2, h / 2, h * .35, w / 2, h / 2, h * .95);
    vig.addColorStop(0, "rgba(0,0,0,0)");
    vig.addColorStop(1, "rgba(0,0,0,.30)");
    g.fillStyle = vig;
    g.fillRect(0, 0, w, h);
}
