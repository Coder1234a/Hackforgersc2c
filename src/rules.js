// rules.js - the only file that knows what a rule actually DOES.
//
// engine never assumes anything, it asks in here every frame. that's the
// whole trick: change the answer, the world changes, and not one line of
// drawing or collision code has to know about it.

let activeRule = null;   // the secret. player never sees this

// pick one at random from whatever this arena can survive. "NORMAL" is in
// there deliberately: sometimes nothing's wrong, and working THAT out is
// its own puzzle.
function rollRule(safeRules) {
    if (safeRules.length === 0) throw new Error("Level has no safe rules");
    return safeRules[Math.floor(Math.random() * safeRules.length)];
}

// +1 = down like normal, -1 = up instead
function gravityDirection() {
    return activeRule === "REVERSE_GRAVITY" ? -1 : 1;
}

// direction pressed vs direction you actually get. usually the same.
function inputDirection(pressed) {
    return activeRule === "INVERTED_CONTROLS" ? -pressed : pressed;
}

// under NO_JUMP you still crouch, you just never leave the floor
function canJump() {
    return activeRule !== "NO_JUMP";
}

// how fast you get going. 99 is instant, momentum makes it a slog.
function acceleration() {
    return activeRule === "MOMENTUM" ? 0.16 : 99;
}

// do you stop when you let go. 0.945 gives ~55px of skid, near 3 squares,
// which you cannot miss. was 0.86 and nobody noticed it.
function friction() {
    return activeRule === "MOMENTUM" ? 0.945 : 0.4;
}

// momentum caps you a touch lower, otherwise the skid flings you miles
function maxSpeed() {
    return activeRule === "MOMENTUM" ? 3.4 : 4;
}

// bullets: normally they hurt. under BULLETS_PUSH they just shove you.
function bulletHurts() {
    return activeRule !== "BULLETS_PUSH";
}

// does the floor rearrange itself every time you land?
function platformsShift() {
    return activeRule === "SHIFTING_PLATFORMS";
}

// the clock. counts UP now, not down, because a leaderboard wants
// "identified in 8.4s" not "had 22 left". normally it ticks with the wall
// clock and ignores your feet.
//
// under MOVEMENT_COSTS_TIME it ignores the wall entirely and only advances
// when you move. tuned so the two run at nearly the same rate while you're
// walking about, on purpose. the only way to separate them is to stand
// dead still and watch the hand. hardest probe in the pool, and it should
// be - it's the one thing a platformer never asks you to do.
const CLOCK_PER_PIXEL = 1 / 240;   // ~1s per second at a normal walking pace

function clockAdvance(dtSeconds, pixelsMoved) {
    if (activeRule === "MOVEMENT_COSTS_TIME") return pixelsMoved * CLOCK_PER_PIXEL;
    return dtSeconds;
}
