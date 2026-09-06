// detect.js - Aarish
// takes what just happened and gives back an event id, or null when the
// evidence honestly doesn't say anything either way.
//
// fair warning: canvas y grows DOWNWARD. smaller y = higher up. got me
// twice before it stuck.

function detectHorizontal(inputDir, xBefore, xAfter) {
    if (xAfter === xBefore) return null;
    const actual = xAfter < xBefore ? -1 : 1;
    return actual === inputDir ? "MOVED_SAME_DIRECTION" : "MOVED_OPPOSITE_DIRECTION";
}

function detectJump(jumpPressed, yBefore, yAfter) {
    if (!jumpPressed) return null;
    if (yAfter < yBefore) return "JUMP_ROSE";
    if (yAfter > yBefore) return "JUMP_FELL";
    return "JUMP_NOTHING";
}
