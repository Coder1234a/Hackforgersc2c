// pathfind.js - can you actually get from the spawn to the door?
//
// runs the engine's real physics (gravity 0.5, jump 11, top speed 4, solid
// on every face) off every ledge in an arena, sees where you land, and
// builds a graph out of it. then BFS. if there's no path this prints "NO
// ROUTE" and the arena is broken no matter how nice it looks.

const G = 0.5, JUMP = 11, PW = 24, PH = 24;

// the two ways the player can move. momentum jumps shorter and lands
// slidier, so an arena that only works at full grip is an arena that's
// broken half the time.
const PHYS = {
    normal:   { accel: 99,   max: 4,   grip: 0.4   },
    momentum: { accel: 0.24, max: 3.4, grip: 0.945 }
};

function overlaps(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

// one flight. returns the index of the ledge landed on, 'EXIT', or null.
function fly(level, startX, startY, dir, doJump, maxFrames, phys) {
    const M = phys || PHYS.normal;
    const p = { x: startX, y: startY, w: PW, h: PH, vx: 0, vy: 0 };
    let onGround = true, jumped = false;
    // a run-up, because a standing jump under momentum goes nowhere
    if (M.accel < 1) p.vx = dir * M.max;
    for (let f = 0; f < maxFrames; f++) {
        p.vx += dir * M.accel;
        if (dir === 0) p.vx *= M.grip;
        if (Math.abs(p.vx) < 0.08) p.vx = 0;
        p.vx = Math.max(-M.max, Math.min(M.max, p.vx));
        p.x += p.vx;
        for (const q of level.platforms) {
            if (q.h <= 16) continue;                 // ledges have no sides
            if (!overlaps(p, q)) continue;
            p.x = p.vx > 0 ? q.x - p.w : q.x + q.w;
            p.vx = 0;
        }
        if (p.x < 0) p.x = 0;
        if (p.x + p.w > level.w) p.x = level.w - p.w;

        if (doJump && !jumped && onGround) { p.vy = -JUMP; jumped = true; }
        const yBefore = p.y;
        p.vy += G;
        p.y += p.vy;
        onGround = false;
        let landedOn = -1;
        for (let i = 0; i < level.platforms.length; i++) {
            const q = level.platforms[i];
            if (!overlaps(p, q)) continue;
            const thin = q.h <= 16;
            const landed = p.vy > 0;
            if (!landed) {                            // head bonk, or pass through
                if (thin) continue;
                p.y = q.y + q.h; p.vy = 0; continue;
            }
            if (thin && yBefore + p.h > q.y + 2) continue;   // came from inside it
            p.y = q.y - p.h; p.vy = 0;
            onGround = true; landedOn = i;
        }
        if (level.exit && overlaps(p, level.exit)) return 'EXIT';
        if (p.y > level.killY) return null;
        if (onGround && f > 3) return landedOn;
    }
    return null;
}

// every ledge you can get to from this one, in one move
function neighbours(level, i, phys, allow) {
    const from = level.platforms[i];
    const out = new Map();
    for (let x = from.x - PW + 2; x <= from.x + from.w - 2; x += 6) {
        for (const dir of [-1, 1]) {
            for (const doJump of [true, false]) {
                const to = fly(level, x, from.y - PH, dir, doJump, 200, phys);
                if (to === null || to === i || to === -1) continue;
                // some arenas only let you LAND on certain ledges - the
                // cheese, where the wrong hole ends the run. the flight
                // still collides with everything, it just isn't an edge.
                if (allow && to !== 'EXIT' && !allow(to)) continue;
                if (!out.has(to)) out.set(to, { x: Math.round(x), dir: dir, jump: doJump });
            }
        }
    }
    return out;
}

function solve(level, phys, allow) {
    // which ledge does the spawn drop onto?
    let start = fly(level, level.spawn.x, level.spawn.y, 0, false, 400, phys);
    if (start === null || start === 'EXIT' || start === -1) {
        console.log('  spawn does not land on a ledge (got ' + start + ')');
        return null;
    }
    const prev = new Map([[start, null]]);
    const queue = [start];
    while (queue.length) {
        const cur = queue.shift();
        for (const [to, how] of neighbours(level, cur, phys, allow)) {
            if (prev.has(to)) continue;
            prev.set(to, { from: cur, how: how });
            if (to === 'EXIT') {
                const path = [];
                let node = 'EXIT';
                while (prev.get(node)) { path.unshift({ node: node, ...prev.get(node) }); node = prev.get(node).from; }
                return { start: start, path: path };
            }
            queue.push(to);
        }
    }
    return { start: start, path: null, reached: [...prev.keys()] };
}

module.exports = { solve, neighbours, fly, PHYS };
