// scoring.js — Vidhu. Turns "when did you call it" into a number.

let sufficiencyMove = null;   // the move where it became knowable

function recordSufficiency(moveCount) {
    if (sufficiencyMove === null) sufficiencyMove = moveCount;
}
function resetAttempt() { sufficiencyMove = null; }
function getSufficiency() { return sufficiencyMove; }

// The whole idea in one function. Calling early is a guess even if you
// happen to be right - so it pays 10, not 100.
function gapScore(sufficiency, callMove, wasCorrect) {
    if (sufficiency === null || sufficiency === undefined) return wasCorrect ? 10 : 0;
    if (callMove < sufficiency) return wasCorrect ? 10 : 0;
    if (!wasCorrect) return 0;
    return Math.max(10, 100 - 15 * (callMove - sufficiency));
}
