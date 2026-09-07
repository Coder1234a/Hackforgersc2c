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

// the clock. normally it burns 1 unit a second and ignores your feet.
// under MOVEMENT_COSTS_TIME it ignores the clock and burns per step.
//
// the two rates are tuned to look almost identical while you're moving
// about normally, on purpose. the only way to separate them is to do the
// one thing the game never asks you to do: stand completely still and
// watch. that's the hardest probe in the pool and it should be.
const CLOCK_PER_SEC  = 1.0;
const CLOCK_PER_STEP = 0.0042;  // matches 1.00/sec at a normal walking pace

function clockDrain(dtSeconds, pixelsMoved) {
    if (activeRule === "MOVEMENT_COSTS_TIME") return pixelsMoved * CLOCK_PER_STEP;
    return dtSeconds * CLOCK_PER_SEC;
}
