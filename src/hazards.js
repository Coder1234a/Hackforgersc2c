// hazards.js - stuff in the level that's out to get you.
//
// none of it is a hidden rule. hazards belong to the ARENA and they're
// visible, so a rock is always a rock. cruelty in the terrain, mystery in
// the physics. mix them and you can't tell "the rule did that" from "the
// level did that" - and then the deduction is dead.

// ---------- dust ----------
//
// grit thrown when something lands or gives way. pure cosmetics, but w/out
// it a thing doesn't shatter, it just gets deleted.
function puffDust(bits, x, y, n, colour, spread) {
    for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI - Math.PI;      // fan, upward-ish
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

// one slow projectile on a loop. slow deliberately, so walking into it is
// a choice and not an ambush.
function makeBullets(level) {
    if (!level.hasProjectile) return [];
    // nb: height matters way more than it looks. spawn.y is where you get
    // DROPPED, not where you end up - you fall to ledge height. park the
    // bullet at spawn.y and it floats over your head forever, and then two
    // rules can't be told apart. put it at body height.
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

// on/off on a fixed cycle. fixed, not random - learn the pattern, don't
// gamble on it.
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
// grassy falls is nothing but these. stand on one, it wobbles, tips over and
// drops out of the world. comes back eventually so a bad run isn't fatal -
// nowhere near fast enough to save you mid-jump though.
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
            // 45 frames, ~0.75s. was 26 and that's not enough to land,
            // look where you're off to, and leave. you could only clear it
            // by already knowing the route - memory test, not a nerve test.
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
            // grows back where it was, fades in so it never just pops
            if (--v.respawn <= 0) {
                v.state = "solid"; v.tilt = 0; v.dropY = 0; v.alpha = 1;
            } else if (v.respawn < 26) {
                v.alpha = (26 - v.respawn) / 26;
            }
        }
    }
}

// wipe everything a step should forget on death/restart
function resetVanishers(vs) {
    for (const v of vs) {
        v.state = "solid"; v.timer = 0; v.respawn = 0;
        v.tilt = 0; v.dropY = 0; v.alpha = 1;
    }
}

// ---------- ledges on a patrol ----------

// you ride these, so we hand back how far it shifted this frame and the
// engine carries you along.
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

// only runs once you commit to standing on it
function armTrigger(m, standing) {
    if (m.trigger && !m.armed && standing) m.armed = true;
}

function resetMovers(ms) {
    for (const m of ms) { m.x = m.homeX; m.armed = false; m.dx = 0; m.dy = 0; }
}

// ---------- invisible ledges ----------

// not there til you brush one, then faintly lit for a bit. cruel but
// findable - that's the line we're walking.
function makeGhosts(level) {
    return (level.ghosts || []).map(function (g) {
        return { x:g.x, y:g.y, w:g.w, h:g.h, seen:0 };
    });
}

// ---------- SHIFTING_PLATFORMS ----------
//
// two things never move. roof and ground obviously. and anything flagged
// fixed - tower parapet, gate ledge, the steps w/ doors on them. that's
// masonry, not shelving.
function shiftLedges(level) {
    for (const p of level.platforms) {
        if (p.h > 16 || p.fixed) continue;
        if (p.homeX === undefined) p.homeX = p.x;
        const room = (typeof WORLD_W === "number" ? WORLD_W : 1280) - p.w - 20;
        // 90, not 120. wander too far and a ledge ends up somewhere you
        // physically can't reach, and then the arena has no answer.
        p.x = Math.max(20, Math.min(room, p.homeX + Math.round((Math.random() * 2 - 1) * 90)));
    }
}

function resetLedges(level) {
    for (const p of level.platforms) if (p.homeX !== undefined) p.x = p.homeX;
}

// ---------- falling rock ----------
//
// knock is NOT a speed, it's a shove, and a shove ignores the walk cap -
// see the knockback bit in engine.js. bleeds off at 0.88/frame, so distance
// travelled is roughly knock x 8. the big one chucks you ~180px, most of a
// shelf. open ground = a scare. near an edge = the drop, and standing near
// an edge was your idea.
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

// hanging -> shaking -> falling (tumbling) -> shatters -> grows back.
// used to blink out at the bottom and blink back in at the top, which just
// looked like the game had lost track of it.
function stepStalactites(list, tick, floorY, bits) {
    for (const s of list) {
        const phase = (tick + s.offset) % s.period;
        if (s.state === "hanging") {
            // ~0.9s of rattle. was 0.66s back when a hit was a nudge -
            // now it chucks you off the shelf, so you get longer.
            s.shake = phase > s.period - 55 ? 1 : 0;
            s.fade = 1; s.spin = 0; s.vy = 0;
            if (phase === 0) {
                s.state = "falling"; s.shake = 0;
                s.vy = 1.2;                                  // snaps, doesn't drift
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
