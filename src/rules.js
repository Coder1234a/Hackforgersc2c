// rules.js — the one place a rule changes the physics.

// Which rule is secretly active this attempt. The player never sees this.
let activeRule = null;

// Picks one rule at random from the ones this level can survive.
function rollRule(safeRules) {
    if (safeRules.length === 0) {
        throw new Error("Level has no safe rules");
    }
    const index = Math.floor(Math.random() * safeRules.length);
    return safeRules[index];
}

// Returns +1 for normal gravity (pulls down) or -1 for reversed (pulls up).
// Every other part of the engine asks this instead of assuming.
function gravityDirection() {
    if (activeRule === "REVERSE_GRAVITY") {
        return -1;
    }
    return 1;
}
