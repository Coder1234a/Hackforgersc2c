// hazards.js - the stuff in the level that's out to get you.
//
// none of this is a hidden rule. hazards belong to the ARENA and they're
// visible, so a rock is always a rock. the cruelty lives in the terrain,
// the mystery lives in the physics. mix the two and you can't tell "the
// rule did that" from "the level did that", and the deduction dies.

// ---------- dust ----------
//
// grit thrown when something lands or gives way. purely cosmetic, but it's
// the difference between a thing shattering and a thing being deleted.
function puffDust(bits, x, y, n, colour, spread) {
    for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI - Math.PI;      // upward-ish fan
        const s = 0.6 + Math.random() * (spread || 2.4);
        bits.push({
            x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 0.6,
            r: 1 + Math.random() * 2.6, life: 28 + Math.random() * 22,
            born: 50, colour: colour
        });
    }
    if (bits.length > 220) bits.splice(0, bits.length - 220);
}

function stepDust(bits) {
    for (let i = bits.length - 1; i >= 0; i--) {
        const d = bits[i];
        d.x += d.vx; d.y += d.vy; d.vy += 0.14; d.vx *= 0.98;
        if (--d.life <= 0) bits.splice(i, 1);
    }
}

// ---------- projectiles ----------

// one slow projectile, looping. slow on purpose so you can choose to walk
// into it rather than getting jumped.
function makeBullets(level) {
    if (!level.hasProjectile) return [];
    // height matters more than it looks. spawn.y is where the player is
    // DROPPED, not where they end up - they fall to ledge height. park the
    // bullet at spawn.y and it hovers over their head forever and two rules
    // become impossible to tell apart. put it in the body instead.
    const floorTop = level.platforms.reduce(function (a, b) { return b.y > a.y ? b : a; }).y;
    const minX = level.spawn.x + 150;
    const maxX = 1180;
    return [{
        x: minX + (maxX - minX) * 0.4, y: floorTop - 18,
        w: 12, h: 12, vx: 1.6, minX: minX, maxX: maxX
    }];
}

function stepBullets(bullets) {
    for (const b of bullets) {
        b.x += b.vx;
        if (b.x < b.minX || b.x + b.w > b.maxX) b.vx = -b.vx;
    }
}

// ---------- lasers ----------

// on and off on a fixed cycle. fixed, not random - you're meant to learn
// the pattern, not gamble on it.
function makeLasers(level) {
    return (level.lasers || []).map(function (l, i) {
        return { x:l.x, y:l.y, w:l.w, h:l.h, period:l.period || 120,
                 duty:l.duty || 0.5, offset:l.offset || i * 40, on:true };
    });
}

function stepLasers(lasers, tick, frozen) {
    for (const l of lasers) {
        if (frozen) continue;                       // time stopped, beam holds
        const phase = ((tick + l.offset) % l.period) / l.period;
        l.on = phase < l.duty;
    }
}

// ---------- steps that give way ----------
//
// grassy falls is built entirely out of these. stand on one and it wobbles,
// tips over and drops out of the world. it comes back eventually, so a bad
// run is recoverable, but not fast enough to save you mid-jump.
function makeVanishers(level) {
    return (level.vanishers || []).map(function (v) {
        return { x:v.x, y:v.y, w:v.w, h:v.h, homeY:v.y,
                 state:"solid", timer:0, respawn:0,
                 tilt:0, dropY:0, alpha:1, spinDir: Math.random() < 0.5 ? -1 : 1 };
    });
}

function stepVanishers(vs, playerOnTop, bits) {
    for (const v of vs) {
        if (v.state === "solid") {
            // 45 frames, three quarters of a second. it was 26 and that's
            // not long enough to land, look where you're going and leave -
            // you could only clear it by already knowing the route, which
            // makes it a memory test instead of a nerve test.
            if (playerOnTop(v)) { v.state = "shaking"; v.timer = 45; }
        } else if (v.state === "shaking") {
            if (--v.timer <= 0) {
                v.state = "falling"; v.vy = 0.6;
                if (bits) puffDust(bits, v.x + v.w / 2, v.y + v.h, 7, "#6d8a3a", 1.8);
            }
        } else if (v.state === "falling") {
            v.vy += 0.42;
            v.dropY += v.vy;
            v.tilt += 0.035 * v.spinDir;
            v.alpha = Math.max(0, 1 - v.dropY / 340);
            if (v.alpha <= 0) { v.state = "gone"; v.respawn = 300; }
        } else {
            // grows back where it was, fading in so it never just pops
            if (--v.respawn <= 0) {
                v.state = "solid"; v.tilt = 0; v.dropY = 0; v.alpha = 1;
            } else if (v.respawn < 26) {
                v.alpha = (26 - v.respawn) / 26;
            }
        }
    }
}

// everything a vanisher must forget when you die or restart
function resetVanishers(vs) {
    for (const v of vs) {
        v.state = "solid"; v.timer = 0; v.respawn = 0;
        v.tilt = 0; v.dropY = 0; v.alpha = 1;
    }
}

// ---------- ledges on a patrol ----------

// the player rides these, so we hand back how far it shifted this frame and
// the engine carries them along.
function makeMovers(level) {
    return (level.movers || []).map(function (m) {
        return { x:m.x, y:m.y, w:m.w, h:m.h, homeX:m.x, vx:m.vx || 0, vy:m.vy || 0,
                 minX:m.minX, maxX:m.maxX, minY:m.minY, maxY:m.maxY,
                 trigger:m.trigger || false, armed:false, dx:0, dy:0 };
    });
}

function stepMovers(ms, frozen) {
    for (const m of ms) {
        if (frozen || (m.trigger && !m.armed)) { m.dx = 0; m.dy = 0; continue; }
        m.dx = m.vx; m.dy = m.vy;
        m.x += m.vx; m.y += m.vy;
        if (m.minX !== undefined && (m.x < m.minX || m.x + m.w > m.maxX)) { m.vx = -m.vx; m.x += m.vx; }
        if (m.minY !== undefined && (m.y < m.minY || m.y + m.h > m.maxY)) { m.vy = -m.vy; m.y += m.vy; }
    }
}

// it only runs once you commit to standing on it
function armTrigger(m, standing) {
    if (m.trigger && !m.armed && standing) m.armed = true;
}

function resetMovers(ms) {
    for (const m of ms) { m.x = m.homeX; m.armed = false; m.dx = 0; m.dy = 0; }
}

// ---------- invisible ledges ----------

// not there until you brush one, then faintly lit for a bit. cruel, but
// findable, which is the line we're walking.
function makeGhosts(level) {
    return (level.ghosts || []).map(function (g) {
        return { x:g.x, y:g.y, w:g.w, h:g.h, seen:0 };
    });
}

// ---------- SHIFTING_PLATFORMS ----------
//
// two things never move. the roof and the ground, obviously. and anything
// flagged fixed - the clock tower's parapet, the gate's ledge, the steps
// with doors on them: masonry, not shelves.
function shiftLedges(level) {
    for (const p of level.platforms) {
        if (p.h > 16 || p.fixed) continue;
        if (p.homeX === undefined) p.homeX = p.x;
        const room = (typeof WORLD_W === "number" ? WORLD_W : 1280) - p.w - 20;
        // 90, not 120. a ledge that wanders too far ends up somewhere you
        // physically can't reach, and then the arena has no answer.
        p.x = Math.max(20, Math.min(room, p.homeX + Math.round((Math.random() * 2 - 1) * 90)));
    }
}

function resetLedges(level) {
    for (const p of level.platforms) if (p.homeX !== undefined) p.x = p.homeX;
}

// ---------- falling rock ----------
//
// knock is NOT a speed, it's a shove, and a shove ignores the walking cap -
// see the knockback bit in engine.js. it bleeds off at 0.88 a frame, so the
// distance you actually travel is about knock x 8. the big one throws you
// 180px, which is most of a shelf. on open ground that's a scare; near an
// edge it's the drop, and standing near an edge was your idea.
const STAL_SIZES = [
    { w: 12, h: 20, knock:  9, fall: 0.42 },
    { w: 16, h: 28, knock: 12, fall: 0.46 },
    { w: 21, h: 38, knock: 16, fall: 0.52 },
    { w: 27, h: 52, knock: 22, fall: 0.58 }
];

function makeStalactites(level) {
    return (level.stalactites || []).map(function (s, i) {
        const kind = STAL_SIZES[s.size || 0];
        return {
            x: s.x, ceilY: s.y, y: s.y, w: kind.w, h: kind.h,
            knock: kind.knock, fall: kind.fall, size: s.size || 0,
            period: s.period || 260, offset: s.offset !== undefined ? s.offset : i * 47,
            state: "hanging", vy: 0, shake: 0, gone: 0, spin: 0, fade: 1
        };
    });
}

// hanging -> shaking -> falling (tumbling) -> shatters into dust -> grows
// back in. it used to blink out at the bottom and blink back in at the top,
// which looked like the game had lost track of it.
function stepStalactites(list, tick, floorY, bits) {
    for (const s of list) {
        const phase = (tick + s.offset) % s.period;
        if (s.state === "hanging") {
            // ~0.9s of rattling. it was 0.66s back when a hit was a nudge;
            // now a hit throws you off the shelf, so you get longer.
            s.shake = phase > s.period - 55 ? 1 : 0;
            s.fade = 1; s.spin = 0; s.vy = 0;
            if (phase === 0) {
                s.state = "falling"; s.shake = 0;
                s.vy = 1.2;                                  // a real snap, not a drift
                s.spinRate = (Math.random() * 2 - 1) * 0.045;
                if (bits) puffDust(bits, s.x + s.w / 2, s.ceilY + 2, 5, "#8A6A46", 1.4);
            }
        } else if (s.state === "falling") {
            s.vy += s.fall;
            s.y += s.vy;
            s.spin += s.spinRate;
            if (s.y > floorY) {
                s.state = "gone"; s.gone = 60;
                if (bits) puffDust(bits, s.x + s.w / 2, floorY, 12, "#C99A63", 3.2);
            }
        } else {
            s.gone--;
            if (s.gone <= 0) { s.state = "hanging"; s.y = s.ceilY; s.vy = 0; s.spin = 0; s.fade = 1; }
            else if (s.gone < 22) { s.y = s.ceilY; s.spin = 0; s.fade = (22 - s.gone) / 22; }
            else s.fade = 0;
        }
    }
}

function resetStalactites(list) {
    for (const s of list) {
        s.state = "hanging"; s.y = s.ceilY; s.vy = 0; s.spin = 0; s.shake = 0; s.fade = 1;
    }
}
