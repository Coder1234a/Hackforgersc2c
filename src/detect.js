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

// "stopped promptly" doesn't mean "is stopped" - it means stopped inside
// the window. past that window everything stops eventually, so being still
// tells you nothing and we say nothing.
function detectRelease(framesSinceRelease, speedNow) {
    if (framesSinceRelease <= 6) return speedNow === 0 ? "STOPPED_PROMPTLY" : null;
    return speedNow > 0 ? "KEPT_SLIDING" : null;
}

// only worth reporting if you actually moved sideways while airborne. a
// straight-up hop lands you where you took off no matter what the floor did.
function detectLanding(xTakeoff, xLand, layoutChanged) {
    if (xTakeoff === xLand) return null;
    return layoutChanged ? "LANDED_REARRANGED" : "LANDED_STABLE";
}

// needs the speed from BEFORE too, otherwise someone already sprinting when
// a harmless bullet passes through looks exactly like a shove.
function detectBullet(hpBefore, hpAfter, speedBefore, speedAfter) {
    if (hpAfter < hpBefore) return "BULLET_HURT";
    if (hpAfter === hpBefore && (speedAfter - speedBefore) > 2) return "BULLET_SHOVED";
    return null;
}

// the nasty one. while you're walking about normally the two clocks drain
// at almost the same rate, so there's nothing to see. they only separate
// when steps and seconds disagree, which basically means standing still.
// until then we return null, because saying anything would be a guess.
function detectTimer(drained, stepUnits, secsElapsed) {
    if (Math.abs(stepUnits - secsElapsed) < 1.2) return null;
    const byStep = Math.abs(drained - stepUnits);
    const bySec  = Math.abs(drained - secsElapsed);
    if (byStep < bySec * 0.5) return "TIMER_PER_STEP";
    if (bySec < byStep * 0.5) return "TIMER_WALL_CLOCK";
    return null;
}
