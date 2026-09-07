// scoring.js - Vidhu
// turns a run into a number.

let sufficiencyMove = null;   // move no. where it became knowable

function recordSufficiency(moveCount) {
    if (sufficiencyMove === null) sufficiencyMove = moveCount;
}
function resetAttempt() { sufficiencyMove = null; }
function getSufficiency() { return sufficiencyMove; }

// wrong answer, no points. not "fewer points" - none. naming the rule is
// the whole game, so getting it wrong isn't a worse run, it's a failed one.
//
// get it right and the score is what it cost you: every move and every
// second comes off a flat 1000.
//
// then the guess clause. call it correctly BEFORE the evidence could
// possibly have told you, and you keep a quarter. you weren't wrong, you
// just weren't right for a reason, and a game about deduction can't pay
// the same for both.
function gapScore(sufficiency, callMove, wasCorrect, seconds) {
    if (!wasCorrect) return 0;

    const secs = seconds || 0;
    let points = 1000 - callMove * 15 - Math.round(secs) * 8;

    const guessed = sufficiency === null || callMove < sufficiency;
    if (guessed) points = points * 0.25;

    return Math.max(50, Math.round(points));
}

// how the number was arrived at, so the reveal screen can show its working
// instead of just asserting a total.
function scoreBreakdown(sufficiency, callMove, wasCorrect, seconds) {
    if (!wasCorrect) return { total: 0, lines: [["Wrong rule", "0"]] };
    const secs = Math.round(seconds || 0);
    const guessed = sufficiency === null || callMove < sufficiency;
    const raw = 1000 - callMove * 15 - secs * 8;
    const lines = [
        ["Base", "1000"],
        [callMove + " moves", "-" + callMove * 15],
        [secs + " seconds", "-" + secs * 8]
    ];
    if (guessed) lines.push(["Called before you could know", "x0.25"]);
    return { total: Math.max(50, Math.round(guessed ? raw * 0.25 : raw)), lines: lines };
}
