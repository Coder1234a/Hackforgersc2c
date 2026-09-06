// rules.js — the only file that knows what a rule actually DOES.
//
// The engine never assumes anything. It asks in here, every frame.
// That's the whole trick: change the answer and the world changes,
// without touching a line of drawing or collision code.

let activeRule = null;   // the secret. player never sees this.

// Pick one at random from what this arena can survive. "NORMAL" is in
// there on purpose - sometimes nothing is wrong at all, and working
// THAT out is its own puzzle.
function rollRule(safeRules) {
    if (safeRules.length === 0) throw new Error("Level has no safe rules");
    return safeRules[Math.floor(Math.random() * safeRules.length)];
}

// +1 = pulls down like normal. -1 = pulls up instead.
function gravityDirection() {
    return activeRule === "REVERSE_GRAVITY" ? -1 : 1;
}

// The direction they pressed vs the direction they actually get.
// Usually the same. Sometimes... not.
function inputDirection(pressed) {
    return activeRule === "INVERTED_CONTROLS" ? -pressed : pressed;
}

// Under NO_JUMP they still crouch, they just never leave the floor.
function canJump() {
    return activeRule !== "NO_JUMP";
}

// How quickly you get up to speed. Momentum makes it a slog.
function acceleration() {
    return activeRule === "MOMENTUM" ? 0.30 : 99;   // 99 = basically instant
}

// And whether you actually stop when you let go. 0.86 is a short skid -
// obvious enough to notice, short enough not to be annoying.
function friction() {
    return activeRule === "MOMENTUM" ? 0.86 : 0.4;
}

// Momentum also caps you slower, so the skid can't fling you across the map.
function maxSpeed() {
    return activeRule === "MOMENTUM" ? 3 : 4;
}
