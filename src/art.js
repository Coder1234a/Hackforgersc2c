// art.js - every pixel the game paints lives in here.
//
// these take coords and draw. that's it. none of them read or write game
// state, which is the reason the arena data, the rules and the look can
// each change without the other two even noticing. swapping the whole art
// style is this one file and nothing else.
//
// palette lifted straight off the arena mockup. it's a warm dusty rose
// cave - almost no green or blue anywhere except the gate, which is why
// the gate reads as "not from here" the second you see it.

const PAL = {
    farRock:   "#E8C0B2",   // palest wall, furthest back
    midRock:   "#B87C6C",
    nearRock:  "#8A5140",
    darkRock:  "#5E3428",
    deepRock:  "#2A0509",   // the almost-black silhouettes
    shaft:     "#FFF6F0",   // the light beam
    slab:      "#B1937C",   // platform body
    slabLip:   "#D9C4B4",   // the lighter top edge
    slabEdge:  "#755F4D",
    amber:     "#AB673A",   // glowing drips
    amberLit:  "#D98B3C",
    gold:      "#9A7B4C",
    stalBody:  "#DAD4C6",   // the FALLING ones are pale, not rose - they
    stalShade: "#B5AD96",   // have to read as different from the scenery
    stalDark:  "#8A8474",
    gate:      "#4B1E3D",
    gateLit:   "#8E4BA0",
    player:    "#F5C542"
};

function themeOf() { return PAL; }

let tickNow = 0;
function setTick(t) { tickNow = t; }

// cheap deterministic noise. same x always gives the same wobble, so the
// cave doesn't shimmer every frame.
function hash(n) {
    const s = Math.sin(n * 12.9898) * 43758.5453;
    return s - Math.floor(s);
}

function roundRect(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);         g.arcTo(x, y, x + w, y, r);
    g.closePath();
}

// pulls the shape of the arena out of the level data so the backdrop can
// sit behind it without the level having to describe itself twice.
function readArena(level) {
    let top = Infinity, bot = -Infinity;
    for (const p of level.platforms) { top = Math.min(top, p.y); bot = Math.max(bot, p.y + p.h); }
    return { top: top, bot: bot, horizon: top + (bot - top) * 0.35 };
}

// what's directly under this point - used to plant things on the floor
function surfaceUnder(level, x, fromY) {
    let best = 10000;
    for (const p of level.platforms) {
        if (x < p.x || x > p.x + p.w) continue;
        if (p.y >= fromY && p.y < best) best = p.y;
    }
    return best;
}

// one lumpy rock silhouette. drawn as a run of arcs along the top edge so
// it reads as stone rather than a rectangle with a wobble.
function rockBand(g, y, h, w, seed, colour, lumps) {
    g.fillStyle = colour;
    g.beginPath();
    g.moveTo(0, y + h);
    g.lineTo(0, y);
    const step = w / lumps;
    for (let i = 0; i <= lumps; i++) {
        const x = i * step;
        const dip = (hash(seed + i) - 0.5) * h * 0.9;
        g.lineTo(x, y + dip);
    }
    g.lineTo(w, y + h);
    g.closePath();
    g.fill();
}

// a hanging drip. the background is full of these; they're scenery and
// they never fall. the ones that fall are pale and flat-capped instead.
function drip(g, x, y, w, len, colour, lit) {
    g.fillStyle = colour;
    g.beginPath();
    g.moveTo(x - w / 2, y);
    g.quadraticCurveTo(x - w * 0.22, y + len * 0.62, x, y + len);
    g.quadraticCurveTo(x + w * 0.22, y + len * 0.62, x + w / 2, y);
    g.closePath();
    g.fill();
    if (lit) {
        g.fillStyle = PAL.amberLit;
        g.beginPath();
        g.moveTo(x - w * 0.16, y);
        g.quadraticCurveTo(x - w * 0.05, y + len * 0.55, x, y + len * 0.92);
        g.quadraticCurveTo(x + w * 0.05, y + len * 0.55, x + w * 0.16, y);
        g.closePath();
        g.fill();
    }
}

function paintBackdrop(g, w, h, horizon) {
    g.fillStyle = PAL.farRock;
    g.fillRect(0, 0, w, h);

    // the shaft of light. it's the brightest thing on screen and it sits
    // slightly right of centre, same as the mockup.
    const sx = w * 0.63;
    const beam = g.createLinearGradient(sx - 42, 0, sx + 42, 0);
    beam.addColorStop(0,    "rgba(255,250,246,0)");
    beam.addColorStop(0.42, "rgba(255,250,246,0.62)");
    beam.addColorStop(0.5,  "rgba(255,252,250,0.92)");
    beam.addColorStop(0.58, "rgba(255,250,246,0.62)");
    beam.addColorStop(1,    "rgba(255,250,246,0)");
    g.fillStyle = beam;
    g.fillRect(sx - 46, 0, 92, h);

    rockBand(g, horizon * 0.55, h * 0.30, w, 11, PAL.midRock, 9);   // depth layers
    rockBand(g, horizon * 0.95, h * 0.34, w, 23, PAL.nearRock, 7);

    // background drips off the top. purely scenery.
    for (let i = 0; i < 22; i++) {
        const x = hash(i * 3.1) * w;
        const len = 18 + hash(i * 7.7) * 70;
        const wid = 9 + hash(i * 5.3) * 22;
        const lit = hash(i * 2.9) > 0.78;
        drip(g, x, 0, wid, len, lit ? PAL.amber : PAL.darkRock, lit);
    }
}

function paintTerrain(g, geo, w, h, level) {
    // spikes growing up off the cave floor, behind everything
    g.fillStyle = PAL.darkRock;
    for (let i = 0; i < 16; i++) {
        const x = hash(i * 4.4) * w;
        const len = 30 + hash(i * 9.1) * 80;
        g.beginPath();
        g.moveTo(x - 16, h); g.lineTo(x, h - len); g.lineTo(x + 16, h);
        g.closePath(); g.fill();
    }
}

// the world edge - dark rock crowding in from every side, which is what
// makes the mockup feel like a cave rather than a diagram.
function paintWorldEdge(g, geo, w, h) {
    g.fillStyle = PAL.deepRock;
    for (const side of [0, 1]) {
        g.beginPath();
        const ex = side ? w : 0, dir = side ? -1 : 1;
        g.moveTo(ex, 0);
        for (let i = 0; i <= 7; i++) {
            const t = i / 7;
            g.lineTo(ex + dir * (26 + hash(i + side * 40) * 46), t * h);
        }
        g.lineTo(ex, h);
        g.closePath(); g.fill();
    }
    const vig = g.createRadialGradient(w/2, h/2, h*0.35, w/2, h/2, h*0.95);
    vig.addColorStop(0, "rgba(0,0,0,0)");
    vig.addColorStop(1, "rgba(20,2,6,0.55)");
    g.fillStyle = vig;
    g.fillRect(0, 0, w, h);
}

// thin pale slabs with a bright top lip and rounded ends, straight off the
// mockup. the lip is the important bit - it's how you tell at a glance
// what you can stand on.
function paintPlatform(g, p) {
    if (p.h > 20) return;              // the roof and floor are rock, not shelves
    g.fillStyle = PAL.slabEdge;
    roundRect(g, p.x, p.y + 3, p.w, p.h, Math.min(5, p.h / 2)); g.fill();
    g.fillStyle = PAL.slab;
    roundRect(g, p.x, p.y + 1, p.w, p.h - 1, Math.min(5, p.h / 2)); g.fill();
    g.fillStyle = PAL.slabLip;
    roundRect(g, p.x + 2, p.y, p.w - 4, 3.5, 1.75); g.fill();
}

// the clock tower. it's the centrepiece of the mockup and it earns its
// place - this is a game about time and moves, so the thing in the middle
// of the room may as well be a clock.
function paintTower(g, x, floorY) {
    const tw = 118, th = 168, tx = x - tw / 2, ty = floorY - th;

    g.fillStyle = PAL.deepRock;                       // body
    g.fillRect(tx + 14, ty + 34, tw - 28, th - 34);
    g.fillStyle = PAL.darkRock;
    g.fillRect(tx + 18, ty + 38, tw - 36, th - 38);

    g.fillStyle = PAL.deepRock;                       // cornice
    g.fillRect(tx, ty + 20, tw, 16);
    g.fillRect(tx + 6, ty + 12, tw - 12, 8);

    for (let i = 0; i < 6; i++) {                     // little pillars on top
        g.fillStyle = PAL.darkRock;
        g.fillRect(tx + 10 + i * 17, ty, 9, 13);
    }

    const cx = x, cy = ty + 68, r = 26;               // the face
    g.fillStyle = PAL.deepRock;
    g.beginPath(); g.arc(cx, cy, r + 5, 0, Math.PI * 2); g.fill();
    g.fillStyle = PAL.gold;
    g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
    g.strokeStyle = PAL.deepRock; g.lineWidth = 1.4;
    for (let i = 0; i < 12; i++) {
        const a = i * Math.PI / 6;
        g.beginPath();
        g.moveTo(cx + Math.sin(a) * (r - 3), cy - Math.cos(a) * (r - 3));
        g.lineTo(cx + Math.sin(a) * (r - 7), cy - Math.cos(a) * (r - 7));
        g.stroke();
    }
    const t = tickNow / 60;                           // hands actually move
    g.lineWidth = 2.4; g.lineCap = "round";
    g.beginPath(); g.moveTo(cx, cy);
    g.lineTo(cx + Math.sin(t) * (r - 9), cy - Math.cos(t) * (r - 9)); g.stroke();
    g.lineWidth = 1.6;
    g.beginPath(); g.moveTo(cx, cy);
    g.lineTo(cx + Math.sin(t / 12) * (r - 14), cy - Math.cos(t / 12) * (r - 14)); g.stroke();
    g.lineCap = "butt";

    for (let row = 0; row < 3; row++) {               // arch detail down the shaft
        for (let col = 0; col < 3; col++) {
            g.fillStyle = PAL.deepRock;
            g.beginPath();
            g.arc(tx + 32 + col * 27, ty + 112 + row * 22, 8, Math.PI, 0);
            g.fill();
        }
    }
}

// the gate. the only cool colour in the whole cave, which is the point -
// you spot it instantly and you know it's the way out.
function paintExit(g, e, open) {
    g.fillStyle = PAL.deepRock;
    roundRect(g, e.x - 4, e.y - 4, e.w + 8, e.h + 8, 6); g.fill();
    g.fillStyle = open ? PAL.gateLit : PAL.gate;
    roundRect(g, e.x, e.y, e.w, e.h, 4); g.fill();

    const glow = 0.45 + Math.sin(tickNow * 0.05) * 0.2;
    g.fillStyle = "rgba(142,75,160," + glow.toFixed(2) + ")";
    roundRect(g, e.x + 5, e.y + 6, e.w - 10, e.h - 14, 3); g.fill();
    g.fillStyle = PAL.gold;
    g.fillRect(e.x + e.w / 2 - 1.5, e.y + 8, 3, e.h - 18);
}

// the falling ones. pale and flat-capped so they never get confused with
// the rose-coloured scenery hanging in the background.
function paintStalactite(g, s, shaking) {
    const jx = shaking ? (hash(tickNow * 3 + s.x) - 0.5) * 3 : 0;
    const x = s.x + jx, capH = Math.max(4, s.h * 0.18);

    g.fillStyle = PAL.stalDark;
    g.beginPath();
    g.moveTo(x, s.y + capH);
    g.lineTo(x + s.w, s.y + capH);
    g.lineTo(x + s.w / 2, s.y + s.h);
    g.closePath(); g.fill();

    g.fillStyle = PAL.stalBody;
    g.beginPath();
    g.moveTo(x, s.y + capH);
    g.lineTo(x + s.w * 0.62, s.y + capH);
    g.lineTo(x + s.w * 0.46, s.y + s.h * 0.92);
    g.closePath(); g.fill();

    g.fillStyle = shaking ? PAL.amberLit : PAL.stalShade;
    g.fillRect(x - 1, s.y, s.w + 2, capH);
    g.fillStyle = PAL.stalBody;
    g.fillRect(x, s.y, s.w * 0.55, capH * 0.6);
}

// dark outline, then the body, then a highlight. the outline is what keeps
// it readable against a busy backdrop - without it the player disappears
// into the rock.
function paintPlayer(g, p, groundY) {
    if (groundY !== null && groundY > p.y + p.h) {
        const d = Math.max(0, 1 - (groundY - (p.y + p.h)) / 90);
        if (d > 0) {
            g.fillStyle = "rgba(20,2,6," + (0.34 * d).toFixed(3) + ")";
            g.beginPath();
            g.ellipse(p.x + p.w / 2, groundY - 1, p.w * 0.5 * d, 3.5 * d, 0, 0, Math.PI * 2);
            g.fill();
        }
    }
    g.fillStyle = "#2b2410";
    roundRect(g, p.x - 2, p.y - 2, p.w + 4, p.h + 4, 7); g.fill();
    g.fillStyle = PAL.player;
    roundRect(g, p.x, p.y, p.w, p.h, 5); g.fill();
    g.fillStyle = "#d9a521";
    roundRect(g, p.x + 2, p.y + p.h * 0.58, p.w - 4, p.h * 0.42 - 2, 3); g.fill();
    g.fillStyle = "rgba(255,255,255,.55)";
    roundRect(g, p.x + 3.5, p.y + 3, p.w * 0.38, 3.5, 1.75); g.fill();
}

// faint horizontal banding. barely there, but it stops the big flat areas
// looking like flat areas.
function paintScanlines(g, w, h) {
    g.fillStyle = "rgba(41,2,7,0.05)";
    for (let y = 0; y < h; y += 3) g.fillRect(0, y, w, 1);
}

// the roof and the floor. these aren't shelves you land on and think about,
// they're the edges of the cave, so they get a lumpy rock face rather than
// the clean lip a platform gets.
function paintCaveSlab(g, p) {
    const up = p.y < 200;                     // roof drips down, floor spikes up
    g.fillStyle = PAL.deepRock;
    g.fillRect(p.x, p.y, p.w, p.h);
    g.fillStyle = PAL.darkRock;
    g.beginPath();
    g.moveTo(p.x, up ? p.y : p.y + p.h);
    for (let i = 0; i <= 26; i++) {
        const x = p.x + (p.w / 26) * i;
        const bump = hash(i + p.y) * 11;
        g.lineTo(x, up ? p.y + p.h + bump : p.y - bump);
    }
    g.lineTo(p.x + p.w, up ? p.y : p.y + p.h);
    g.closePath(); g.fill();
}
