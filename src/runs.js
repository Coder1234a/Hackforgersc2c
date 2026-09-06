// runs.js
// every finished attempt lands here. right now it just feeds the "your
// best" line in the HUD, but it's already the shape a leaderboard would
// read from, so adding one later isn't a rewrite.

const RUNS_KEY = "misrule.runs.v1";

// try/catch cos a private-mode browser throws the second you touch
// localStorage. don't remove it.
function loadRuns() {
    try { return JSON.parse(localStorage.getItem(RUNS_KEY)) || []; }
    catch (e) { return []; }
}

function saveRuns(runs) {
    try { localStorage.setItem(RUNS_KEY, JSON.stringify(runs)); } catch (e) {}
}

// one finished attempt. saving every field a leaderboard might want even
// though nothing reads half of them yet - backfilling old runs is grim.
function recordRun(entry) {
    const runs = loadRuns();
    runs.push({
        player:      entry.player || "you",
        levelId:     entry.levelId,
        rule:        entry.rule,
        guess:       entry.guess,
        correct:     entry.correct,
        moves:       entry.moves,
        sufficiency: entry.sufficiency,
        score:       entry.score,
        at:          Date.now()
    });
    saveRuns(runs);
    return runs.length;
}

// fewest moves anyone's got this rule in
function bestFor(ruleId) {
    const wins = loadRuns().filter(function (r) { return r.correct && r.rule === ruleId; });
    if (wins.length === 0) return null;
    return Math.min.apply(null, wins.map(function (r) { return r.moves; }));
}

// top scores, highest first. this IS the leaderboard, it's just got one
// player in it so far.
function leaderboard(limit) {
    return loadRuns()
        .filter(function (r) { return r.correct; })
        .sort(function (a, b) { return b.score - a.score || a.moves - b.moves; })
        .slice(0, limit || 10);
}

function runStats() {
    const runs = loadRuns();
    const right = runs.filter(function (r) { return r.correct; });
    return {
        attempts: runs.length,
        correct:  right.length,
        avgScore: right.length ? Math.round(right.reduce(function (s, r) { return s + r.score; }, 0) / right.length) : 0
    };
}

function clearRuns() { saveRuns([]); }
