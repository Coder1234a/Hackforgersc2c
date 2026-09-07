// art.js - everything we paint, nothing we decide.
//
// arenas are paintings. blit the picture once a frame, then draw only what
// MOVES on top: falling rock, grass steps giving way, the runaway stub, the
// player, dust.
//
// one rule keeps it honest. never moves -> it's in the picture, don't touch
// it. moves -> it got rubbed out of the picture and it lives in here. which
// is why arena, physics and look can each change w/out the other two
// noticing.

const PAL = {
    // dripstone, picked off the cave art
    wall:      "#C99184",
    slab:      "#8E7259",
    slabLip:   "#C7AC8E",
    slabEdge:  "#4A2E24",
    scar:      "#3A211C",
    stalBody:  "#E3B87A",
    stalLit:   "#F7D79A",
    stalDark:  "#7A4526",
    dust:      "#C99A63",
    // cheese
    rind:      "#D98E12",
    rindLip:   "#FFDA5E",
    rindEdge:  "#8A5606",
    // shared
    player:    "#F5C542",
    playerLo:  "#D9A521",
    ink:       "#2b2410"
};

function themeOf() { return PAL; }

let tickNow = 0;
function setTick(t) { tickNow = t; }

// cheap repeatable noise. same input = same wobble, so nothing shimmers.
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

// what's directly below this point. shadow uses it.
function surfaceUnder(level, x, fromY) {
    let best = 10000;
    for (const p of level.platforms) {
        if (x < p.x || x > p.x + p.w) continue;
        if (p.y >= fromY && p.y < best) best = p.y;
    }
    return best;
}

// the arena's painting, stretched to the canvas. both are 1280x600 so it's
// a straight 1:1 blit and costs basically nothing.
function paintBackdrop(g, w, h, level) {
    const img = ARENA_ART[level && level.art ? level.art : "dripstone"];
    if (img && img.complete && img.naturalWidth) g.drawImage(img, 0, 0, w, h);
    else { g.fillStyle = PAL.wall; g.fillRect(0, 0, w, h); }
}

// ---------- dripstone ----------

// a cave shelf, drawn not painted. only for the runaway stub + any ledge
// SHIFTING_PLATFORMS has picked up and moved.
function paintCaveSlab(g, p) {
    g.fillStyle = PAL.slabEdge;
    roundRect(g, p.x, p.y + 3, p.w, p.h, Math.min(5, p.h / 2)); g.fill();
    g.fillStyle = PAL.slab;
    roundRect(g, p.x, p.y + 1, p.w, p.h - 1, Math.min(5, p.h / 2)); g.fill();
    g.fillStyle = PAL.slabLip;
    roundRect(g, p.x + 2, p.y, p.w - 4, 3.5, 1.75); g.fill();
}

// the hole a shelf leaves when the rule moves it. the shelf is painted into
// the backdrop, so w/out this there's a ledge on screen you fall straight
// through. a dark socket reads as "the stone came away" - which it did.
function paintShelfScar(g, p) {
    g.fillStyle = PAL.scar;
    roundRect(g, p.homeX - 2, p.y - 1, p.w + 4, p.h + 5, 3); g.fill();
    g.fillStyle = "rgba(0,0,0,0.35)";
    roundRect(g, p.homeX + 2, p.y + 1, p.w - 4, 3, 1.5); g.fill();
}

// falling rock. it was ceiling a second ago so it's the same amber - but it
// rattles, spins and kicks up dust, and nothing else in the cave does.
function paintStalactite(g, s) {
    const shaking = s.shake > 0;
    const jx = shaking ? (hash(tickNow * 3 + s.x) - 0.5) * 4 : 0;
    const w = s.w, h = s.h, mid = w / 2;

    g.save();
    g.translate(s.x + mid + jx, s.y);
    if (s.spin) g.rotate(s.spin);               // tumbles once loose
    g.globalAlpha = s.fade === undefined ? 1 : s.fade;

    if (shaking) {                              // warning glow, kept tight
        g.save();
        g.globalCompositeOperation = "lighter";
        const r = g.createRadialGradient(0, h * 0.4, 2, 0, h * 0.4, w * 1.2);
        r.addColorStop(0, "rgba(255,206,120,0.45)");
        r.addColorStop(1, "rgba(255,206,120,0)");
        g.fillStyle = r;
        g.beginPath(); g.arc(0, h * 0.4, w * 1.2, 0, Math.PI * 2); g.fill();
        g.restore();
    }

    const cap = Math.max(4, h * 0.2);
    g.fillStyle = PAL.stalDark;                 // shadow side + rim
    g.beginPath();
    g.moveTo(-mid - 1, cap); g.lineTo(mid + 1, cap); g.lineTo(0, h + 1);
    g.closePath(); g.fill();

    g.fillStyle = shaking ? PAL.stalLit : PAL.stalBody;    // lit face
    g.beginPath();
    g.moveTo(-mid + 1.5, cap); g.lineTo(w * 0.12, cap); g.lineTo(-w * 0.06, h * 0.86);
    g.closePath(); g.fill();

    g.fillStyle = shaking ? PAL.stalLit : PAL.stalBody;    // broken-off cap
    g.fillRect(-mid - 1, 0, w + 2, cap);
    g.fillStyle = "rgba(255,255,255,0.28)";
    g.fillRect(-mid, 1, w * 0.5, cap * 0.45);
    g.fillStyle = PAL.stalDark;
    g.fillRect(-mid - 1, cap - 1.5, w + 2, 1.5);
    g.restore();
}

// grit, thrown when rock lands or a step goes. stops things vanishing in a
// way that reads as a bug.
function paintDust(g, bits) {
    for (const d of bits) {
        g.globalAlpha = Math.max(0, d.life / d.born) * 0.8;
        g.fillStyle = d.colour;
        g.beginPath(); g.arc(d.x, d.y, d.r, 0, Math.PI * 2); g.fill();
    }
    g.globalAlpha = 1;
}

// ---------- cheese ----------

// cheese ledges are NOT drawn. the hole in the painting IS the platform -
// see a hole, you can stand in it, and that's all you get told.
//
// what IS drawn is a whisper on the ones that'll cheese you. couple of
// shades on a bright yellow field: stare straight at a hole and you can
// just about call it, glance across the level and you can't. turns the
// arena from "remember 18 deaths" into "look properly before you jump".
function paintCheeseTrap(g, p) {
    const cx = p.x + p.w / 2, cy = p.y + 2;
    const rx = (p.w + 16) / 2, ry = (p.hh || 40) / 2;
    g.save();
    g.beginPath();
    g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    const grd = g.createRadialGradient(cx, cy, ry * 0.15, cx, cy, rx);
    // measured, not eyeballed - ~deltaE 1.7 off a safe hole. enough for a
    // suspicious player leaning at the screen, not enough to read the level
    // from the back of the room. was 3.3, which did too much for you.
    grd.addColorStop(0,    "rgba(150,86,6,0.055)");
    grd.addColorStop(0.72, "rgba(150,86,6,0.04)");
    grd.addColorStop(1,    "rgba(150,86,6,0)");
    g.fillStyle = grd;
    g.fill();
    g.restore();
}

// ---------- grassy ----------

// one grass step, stamped from the sprite we lifted out of the art. stand
// on it and it shakes, tips and drops out of the world.
function paintGrassStep(g, s) {
    const img = ARENA_ART.grassStep;
    const jx = s.state === "shaking" ? (hash(tickNow * 4 + s.x) - 0.5) * 5 : 0;
    g.save();
    g.globalAlpha = s.alpha === undefined ? 1 : s.alpha;
    g.translate(s.x + s.w / 2 + jx, s.y + s.h / 2 + (s.dropY || 0));
    if (s.tilt) g.rotate(s.tilt);
    if (img && img.complete && img.naturalWidth) {
        g.drawImage(img, -s.w / 2, -s.h / 2, s.w, s.h);
    } else {
        g.fillStyle = "#5FC12A";
        roundRect(g, -s.w / 2, -s.h / 2, s.w, s.h, 3); g.fill();
    }
    g.restore();
    g.globalAlpha = 1;
}

// all three doors get the SAME shimmer, deliberately. one's the way out,
// one drops you, one sends you back - find out the hard way. much brighter
// than it was: a door you squint for isn't a choice you can make.
function paintDoorGlow(g, d) {
    const glow = 0.44 + Math.sin(tickNow * 0.045 + d.x * 0.01) * 0.15;
    g.save();
    g.globalCompositeOperation = "lighter";
    const cx = d.x + d.w / 2, cy = d.y + d.h / 2, rad = d.w * 2.2;
    const r = g.createRadialGradient(cx, cy, 2, cx, cy, rad);
    r.addColorStop(0, "rgba(196,150,225," + glow.toFixed(2) + ")");
    r.addColorStop(1, "rgba(196,150,225,0)");
    g.fillStyle = r;
    g.beginPath(); g.arc(cx, cy, rad, 0, Math.PI * 2); g.fill();
    g.restore();
}

// ---------- the player, and the edge of the world ----------

// outline, body, highlight. the outline does the real work - arenas are
// busy and w/out it you vanish into the art.
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
    g.fillStyle = PAL.ink;
    roundRect(g, p.x - 2, p.y - 2, p.w + 4, p.h + 4, 7); g.fill();
    g.fillStyle = PAL.player;
    roundRect(g, p.x, p.y, p.w, p.h, 5); g.fill();
    g.fillStyle = PAL.playerLo;
    roundRect(g, p.x + 2, p.y + p.h * 0.58, p.w - 4, p.h * 0.42 - 2, 3); g.fill();
    g.fillStyle = "rgba(255,255,255,.55)";
    roundRect(g, p.x + 3.5, p.y + 3, p.w * 0.38, 3.5, 1.75); g.fill();
}

// the line under which you die. the painting alone never says it loudly
// enough, hence the dark band + creeping dashed edge.
function paintDeathLine(g, w, h, killY) {
    const grd = g.createLinearGradient(0, killY - 48, 0, h);
    grd.addColorStop(0,    "rgba(18,2,6,0)");
    grd.addColorStop(0.42, "rgba(18,2,6,0.52)");
    grd.addColorStop(1,    "rgba(18,2,6,0.9)");
    g.fillStyle = grd;
    g.fillRect(0, killY - 48, w, h - killY + 48);

    g.save();
    g.setLineDash([9, 7]);
    g.lineDashOffset = -(tickNow * 0.35) % 16;
    g.strokeStyle = "rgba(232,112,90,0.5)";
    g.lineWidth = 2;
    g.beginPath(); g.moveTo(0, killY); g.lineTo(w, killY); g.stroke();
    g.restore();
}
