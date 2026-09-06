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

// how fast you get going. 99 is basically instant.
function acceleration() {
    return activeRule === "MOMENTUM" ? 0.30 : 99;   // 99 = basically instant
}

// do you actually stop when you let go. 0.86 gives ~21px of skid, which
// is enough to spot and not enough to be annoying. tweak here if it feels
// off.
function friction() {
    return activeRule === "MOMENTUM" ? 0.86 : 0.4;
}

// momentum caps you slower too, otherwise the skid flings you miles
function maxSpeed() {
    return activeRule === "MOMENTUM" ? 3 : 4;
}
