// scoring.js - Vidhu
// turns "when did you call it" into a number.

let sufficiencyMove = null;   // move no. where it became knowable

function recordSufficiency(moveCount) {
    if (sufficiencyMove === null) sufficiencyMove = moveCount;
}
function resetAttempt() { sufficiencyMove = null; }
function getSufficiency() { return sufficiencyMove; }

// the whole idea, one function. call early and it's a guess even if you
// got lucky, so it pays 10 instead of 100.
function gapScore(sufficiency, callMove, wasCorrect) {
    if (sufficiency === null || sufficiency === undefined) return wasCorrect ? 10 : 0;
    if (callMove < sufficiency) return wasCorrect ? 10 : 0;
    if (!wasCorrect) return 0;
    return Math.max(10, 100 - 15 * (callMove - sufficiency));
}
