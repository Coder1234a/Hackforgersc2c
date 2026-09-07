// rules.js - only file that knows what a rule actually DOES.
//
// engine never assumes, it asks in here every frame. swap an answer and the
// world changes, w/out one line of drawing or collision code caring.

let activeRule = null;   // the secret. player never sees this.

// roll one from whatever this arena survives. NORMAL is in the pool on
// purpose - sometimes nothing's wrong, and spotting that is its own puzzle.
function rollRule(safeRules) {
    if (safeRules.length === 0) throw new Error("Level has no safe rules");
    return safeRules[Math.floor(Math.random() * safeRules.length)];
}

// +1 down, -1 up
function gravityDirection() {
    return activeRule === "REVERSE_GRAVITY" ? -1 : 1;
}

// what you pressed vs what you get. usually the same.
function inputDirection(pressed) {
    return activeRule === "INVERTED_CONTROLS" ? -pressed : pressed;
}

// NO_JUMP: you can still crouch, you just never leave the floor
function canJump() {
    return activeRule !== "NO_JUMP";
}

// accel. 99 = instant.
//
// was 0.16 and the cave was flat out unwinnable - couldn't build enough
// speed mid-air for the jump onto the small shelf. 0.24 still feels heavy
// off the mark. the tell is the SKID anyway, and that's friction.
function acceleration() {
    return activeRule === "MOMENTUM" ? 0.24 : 99;
}

// do you stop when you let go? 0.945 = ~55px skid, near 3 squares, can't
// miss it. was 0.86 and nobody noticed.
function friction() {
    return activeRule === "MOMENTUM" ? 0.945 : 0.4;
}

// momentum caps a touch lower or the skid flings you miles
function maxSpeed() {
    return activeRule === "MOMENTUM" ? 3.4 : 4;
}

// normally bullets hurt. under BULLETS_PUSH they just shove.
function bulletHurts() {
    return activeRule !== "BULLETS_PUSH";
}

// does the floor rearrange every time you land?
function platformsShift() {
    return activeRule === "SHIFTING_PLATFORMS";
}

// clock counts UP, not down - a leaderboard wants "got it in 8.4s", not
// "had 22 left". normally ticks w/ the wall clock and ignores your feet.
//
// under MOVEMENT_COSTS_TIME it only moves when you do. tuned so the two run
// at nearly the same rate while you're walking, deliberately. only way to
// split them is stand dead still and watch the hand. hardest probe we've
// got - fair enough, no platformer ever asks you to stand still.
const CLOCK_PER_PIXEL = 1 / 240;   // ~1s/sec at walking pace

function clockAdvance(dtSeconds, pixelsMoved) {
    if (activeRule === "MOVEMENT_COSTS_TIME") return pixelsMoved * CLOCK_PER_PIXEL;
    return dtSeconds;
}
