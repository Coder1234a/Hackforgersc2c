// simulator.js — Aarish. Plays the game against itself, thousands of
// times, so we can say how many moves identification ACTUALLY takes
// instead of guessing. Pure logic, no engine needed.

// What each probe shows you, for each rule. Read a column: under
// MOMENTUM everything looks normal until you let go of the key.
const OUTCOME = {
    NORMAL:              { MOVE:"MOVED_SAME_DIRECTION",     RELEASE:"STOPPED_PROMPTLY", JUMP:"JUMP_ROSE",    LAND:"LANDED_STABLE",     BULLET:"BULLET_HURT",   TIMER:"TIMER_WALL_CLOCK" },
    REVERSE_GRAVITY:     { MOVE:"MOVED_SAME_DIRECTION",     RELEASE:"STOPPED_PROMPTLY", JUMP:"JUMP_FELL",    LAND:"LANDED_STABLE",     BULLET:"BULLET_HURT",   TIMER:"TIMER_WALL_CLOCK" },
    INVERTED_CONTROLS:   { MOVE:"MOVED_OPPOSITE_DIRECTION", RELEASE:"STOPPED_PROMPTLY", JUMP:"JUMP_ROSE",    LAND:"LANDED_STABLE",     BULLET:"BULLET_HURT",   TIMER:"TIMER_WALL_CLOCK" },
    NO_JUMP:             { MOVE:"MOVED_SAME_DIRECTION",     RELEASE:"STOPPED_PROMPTLY", JUMP:"JUMP_NOTHING", LAND:"LANDED_STABLE",     BULLET:"BULLET_HURT",   TIMER:"TIMER_WALL_CLOCK" },
    MOMENTUM:            { MOVE:"MOVED_SAME_DIRECTION",     RELEASE:"KEPT_SLIDING",     JUMP:"JUMP_ROSE",    LAND:"LANDED_STABLE",     BULLET:"BULLET_HURT",   TIMER:"TIMER_WALL_CLOCK" },
    BULLETS_PUSH:        { MOVE:"MOVED_SAME_DIRECTION",     RELEASE:"STOPPED_PROMPTLY", JUMP:"JUMP_ROSE",    LAND:"LANDED_STABLE",     BULLET:"BULLET_SHOVED", TIMER:"TIMER_WALL_CLOCK" },
    SHIFTING_PLATFORMS:  { MOVE:"MOVED_SAME_DIRECTION",     RELEASE:"STOPPED_PROMPTLY", JUMP:"JUMP_ROSE",    LAND:"LANDED_REARRANGED", BULLET:"BULLET_HURT",   TIMER:"TIMER_WALL_CLOCK" },
    MOVEMENT_COSTS_TIME: { MOVE:"MOVED_SAME_DIRECTION",     RELEASE:"STOPPED_PROMPTLY", JUMP:"JUMP_ROSE",    LAND:"LANDED_STABLE",     BULLET:"BULLET_HURT",   TIMER:"TIMER_PER_STEP" }
};

const PROBES = ["MOVE", "RELEASE", "JUMP", "LAND", "BULLET", "TIMER"];

// Fisher-Yates. Every ordering equally likely - that's the point, we're
// modelling lots of different players, not one tidy one.
function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
}

// One player, one attempt. They try probes in their own order until
// only one rule is left standing. Returns how many that took.
function simulateAttempt(trueRule) {
    if (!OUTCOME[trueRule]) throw new Error("No outcome map for rule: " + trueRule);

    const order = shuffle(PROBES);
    let live = ALL_RULES.slice();
    let moves = 0;
    let jumped = false;

    for (const probe of order) {
        // You can't observe a landing without jumping first.
        if (probe === "LAND" && !jumped) continue;
        if (probe === "JUMP") jumped = true;

        moves++;
        live = updateLiveSet(live, OUTCOME[trueRule][probe]);
        if (isSufficient(live)) return moves;
    }

    // Second pass, in case LAND got skipped the first time round.
    for (const probe of order) {
        if (probe !== "LAND") continue;
        moves++;
        live = updateLiveSet(live, OUTCOME[trueRule][probe]);
        if (isSufficient(live)) return moves;
    }
    return null;
}

function simulateRule(trueRule, attempts) {
    const runs = [];
    for (let i = 0; i < attempts; i++) {
        const n = simulateAttempt(trueRule);
        if (n !== null) runs.push(n);
    }
    if (runs.length === 0) return { rule: trueRule, converged: 0 };

    runs.sort(function (a, b) { return a - b; });
    const total = runs.reduce(function (s, n) { return s + n; }, 0);
    return {
        rule: trueRule,
        converged: runs.length,
        average: total / runs.length,
        median: runs[Math.floor(runs.length / 2)],
        best: runs[0],
        worst: runs[runs.length - 1]
    };
}

// The whole thing. Prints a table you can paste straight into the pitch.
function runSimulation(attemptsPerRule) {
    const n = attemptsPerRule || 1000;
    const rows = [];
    console.log("rule".padEnd(21) + "avg   median  best  worst   failed");
    for (const rule of ALL_RULES) {
        const s = simulateRule(rule, n);
        rows.push(s);
        if (!s.average) { console.log(rule.padEnd(21) + "NEVER CONVERGED"); continue; }
        console.log(rule.padEnd(21) +
            s.average.toFixed(2).padEnd(6) +
            String(s.median).padEnd(8) +
            String(s.best).padEnd(6) +
            String(s.worst).padEnd(8) +
            (n - s.converged));
    }
    const all = rows.filter(function (r) { return r.average; });
    const overall = all.reduce(function (s, r) { return s + r.average; }, 0) / all.length;
    console.log("\n" + (n * ALL_RULES.length) + " simulated attempts. Overall average: " + overall.toFixed(2) + " moves.");
    return rows;
}
