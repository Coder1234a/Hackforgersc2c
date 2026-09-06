// rules.js — the only file that knows what a rule actually DOES.
//
// The engine never assumes anything. It asks in here every frame.
// That's the whole trick: swap the answer, and the game changes
// without touching a single line of drawing or collision code.

let activeRule = null;   // the secret. player never sees this.

// Pick one rule at random out of the ones this arena can survive.
// Not all seven - some rules make some levels impossible to finish.
function rollRule(safeRules) {
    if (safeRules.length === 0) {
        throw new Error("Level has no safe rules");
    }
    return safeRules[Math.floor(Math.random() * safeRules.length)];
}

// +1 = gravity pulls down like normal. -1 = it pulls up instead.
function gravityDirection() {
    return activeRule === "REVERSE_GRAVITY" ? -1 : 1;
}

// Takes the direction the player pressed and hands back the direction
// they actually get. Usually the same. Sometimes... not.
function inputDirection(pressed) {
    return activeRule === "INVERTED_CONTROLS" ? -pressed : pressed;
}

// Can they jump at all? Under NO_JUMP they still crouch, nothing happens.
function canJump() {
    return activeRule !== "NO_JUMP";
}

// How fast you speed up. Under MOMENTUM you build speed slowly...
function acceleration() {
    return activeRule === "MOMENTUM" ? 0.45 : 99;   // 99 = basically instant
}

// ...and you don't stop when you let go. 0.995 is a long, sulky slide.
function friction() {
    return activeRule === "MOMENTUM" ? 0.995 : 0.5;
}
