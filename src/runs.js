// runs.js — every finished attempt gets saved here. Right now it powers
// the "your best" line on screen; it's also the shape a leaderboard
// would read from later, so nothing has to be rewritten to add one.

const RUNS_KEY = "misrule.runs.v1";

// Reads the saved history. Wrapped in try/catch because a browser in
// private mode will happily throw when you touch localStorage.
function loadRuns() {
    try { return JSON.parse(localStorage.getItem(RUNS_KEY)) || []; }
    catch (e) { return []; }
}

function saveRuns(runs) {
    try { localStorage.setItem(RUNS_KEY, JSON.stringify(runs)); } catch (e) {}
}

// One finished attempt. Keep every field a leaderboard would want,
// even the ones nothing reads yet - backfilling old runs is painful.
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

// Fewest moves anyone's ever taken to correctly name this rule.
function bestFor(ruleId) {
    const wins = loadRuns().filter(function (r) { return r.correct && r.rule === ruleId; });
    if (wins.length === 0) return null;
    return Math.min.apply(null, wins.map(function (r) { return r.moves; }));
}

// Top scores, highest first. This is the leaderboard, it just happens
// to only have one player in it so far.
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
