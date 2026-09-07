// hazards.js - the stuff in the level that's out to get you.
//
// important: none of this is a hidden rule. hazards belong to the ARENA and
// they're visible, so the player always knows a laser is a laser. the
// cruelty lives in the terrain, the mystery lives in the physics. mix the
// two and you can't tell "the rule did that" from "the level did that",
// and the whole deduction falls apart.

// one slow projectile, looping. slow on purpose so you can choose to walk
// into it rather than getting jumped.
function makeBullets(level) {
    if (!level.hasProjectile) return [];
    // start it well away from the spawn and keep it away. it used to appear
    // right on top of the player and kill them before they'd pressed
    // anything, which is about the worst first impression a game can make.
    // height matters more than it looks. spawn.y is where the player is
    // DROPPED, not where they end up - they fall to floor-height. put the
    // bullet at spawn.y and it hovers over their head forever and two
    // rules become impossible to tell apart. sit it in the body instead.
    const floorTop = level.platforms.reduce(function (a, b) { return b.y > a.y ? b : a; }).y;
    const minX = level.spawn.x + 150;
    const maxX = 768;
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

// lasers blink on and off on a fixed cycle. fixed, not random - you're
// meant to learn the pattern, not gamble on it.
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

// platforms that fall away a moment after you stand on them. the delay is
// what makes it fair - you get told, you just don't get long.
function makeVanishers(level) {
    return (level.vanishers || []).map(function (v) {
        return { x:v.x, y:v.y, w:v.w, h:v.h, state:"solid", timer:0, respawn:0 };
    });
}

function stepVanishers(vs, playerOnTop) {
    for (const v of vs) {
        if (v.state === "solid" && playerOnTop(v)) { v.state = "shaking"; v.timer = 34; }
        else if (v.state === "shaking") { if (--v.timer <= 0) { v.state = "gone"; v.respawn = 150; } }
        else if (v.state === "gone")    { if (--v.respawn <= 0) v.state = "solid"; }
    }
}

// platforms on a patrol. the player rides them, so we hand back how far it
// moved this frame and the engine carries the player along.
function makeMovers(level) {
    return (level.movers || []).map(function (m) {
        return { x:m.x, y:m.y, w:m.w, h:m.h, vx:m.vx || 0, vy:m.vy || 0,
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

// invisible until you brush against one, then it stays faintly lit for a
// bit. cruel, but findable, which is the line we're walking.
function makeGhosts(level) {
    return (level.ghosts || []).map(function (g) {
        return { x:g.x, y:g.y, w:g.w, h:g.h, seen:0 };
    });
}

// SHIFTING_PLATFORMS moves the ledges each time you land. floors and
// ceilings never move - if the ground vanished you'd have a troll game and
// no way to tell rule from level.
function shiftLedges(level) {
    for (const p of level.platforms) {
        if (p.h > 16) continue;
        if (p.homeX === undefined) p.homeX = p.x;
        p.x = Math.max(20, Math.min(760 - p.w, p.homeX + Math.round((Math.random() * 2 - 1) * 120)));
    }
}

function resetLedges(level) {
    for (const p of level.platforms) if (p.homeX !== undefined) p.x = p.homeX;
}


// stalactites. four sizes, dripping from the ceiling on their own timers.
// a hit doesn't kill - it shoves you. that's worse, because near a ledge
// the shove is what kills you, and the shove is your own fault for being
// stood there.
const STAL_SIZES = [
    { w: 10, h: 16, knock: 4,  fall: 0.30 },
    { w: 14, h: 24, knock: 6,  fall: 0.34 },
    { w: 18, h: 34, knock: 9,  fall: 0.40 },
    { w: 24, h: 46, knock: 13, fall: 0.46 }
];

function makeStalactites(level) {
    return (level.stalactites || []).map(function (s, i) {
        const kind = STAL_SIZES[s.size || 0];
        return {
            x: s.x, ceilY: s.y, y: s.y, w: kind.w, h: kind.h,
            knock: kind.knock, fall: kind.fall, size: s.size || 0,
            period: s.period || 190, offset: s.offset !== undefined ? s.offset : i * 47,
            state: "hanging", vy: 0, shake: 0, gone: 0
        };
    });
}

// hanging -> shaking (a warning you can act on) -> falling -> gone -> back
function stepStalactites(list, tick, floorY) {
    for (const s of list) {
        const phase = (tick + s.offset) % s.period;
        if (s.state === "hanging") {
            s.shake = phase > s.period - 40 ? 1 : 0;      // rattles before it drops
            if (phase === 0) { s.state = "falling"; s.vy = 0; s.shake = 0; }
        } else if (s.state === "falling") {
            s.vy += s.fall;
            s.y += s.vy;
            if (s.y > floorY) { s.state = "gone"; s.gone = 45; }
        } else {
            if (--s.gone <= 0) { s.state = "hanging"; s.y = s.ceilY; s.vy = 0; }
        }
    }
}

// a platform that sits still until you step on it, then runs. the level
// designer's idea and a good one: you can look at it all day, it only
// betrays you once you commit.
function armTrigger(m, standing) {
    if (m.trigger && !m.armed && standing) m.armed = true;
}
