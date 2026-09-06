// detect.js — Aarish. Turns what just happened into an event ID,
// or null when the evidence honestly doesn't tell us anything.
// Reminder: canvas y grows downward, so smaller y = went UP.

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
