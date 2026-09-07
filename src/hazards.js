// hazards.js - projectiles and the shifting floor.
//
// both of these exist so two of the rules have something to act ON. a
// bullet that always kills you tells you nothing; it's only evidence when
// it does something it shouldn't.

// one slow projectile per arena, looping across the level. slow on purpose
// so you can walk into it deliberately instead of getting ambushed.
function makeBullets(level) {
    if (!level.hasProjectile) return [];
    const floor = level.platforms.reduce((a, b) => (b.y > a.y ? b : a));
    return [{
        x: floor.x + 40, y: floor.y - 26,
        w: 12, h: 12, vx: 1.6,
        minX: floor.x + 20, maxX: floor.x + floor.w - 32
    }];
}

function stepBullets(bullets) {
    for (const b of bullets) {
        b.x += b.vx;
        if (b.x < b.minX || b.x + b.w > b.maxX) b.vx = -b.vx;
    }
}

// SHIFTING_PLATFORMS moves the ledges every time you land. floors and
// ceilings stay put - if the ground itself vanished you'd have a troll
// game, not a puzzle, and you could never tell rule from level.
function shiftLedges(level) {
    const floorY = level.platforms.reduce((a, b) => (b.y > a.y ? b : a)).y;
    for (const p of level.platforms) {
        if (p.h > 16) continue;                      // thick = floor or ceiling
        if (p.homeX === undefined) p.homeX = p.x;    // remember where it started
        const swing = 120;
        p.x = p.homeX + Math.round((Math.random() * 2 - 1) * swing);
        p.x = Math.max(20, Math.min(760 - p.w, p.x));
    }
}

// puts every ledge back. called on a new attempt so arena 1 always looks
// like arena 1 when you first see it.
function resetLedges(level) {
    for (const p of level.platforms) {
        if (p.homeX !== undefined) p.x = p.homeX;
    }
}
