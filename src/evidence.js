// evidence.js - Aarish
// the lookup table everything else leans on.
//
// only ONE rule is live at a time. so anything weird you see names it
// outright and kills the rest. anything normal only kills the rules that
// would've shown up right then, which is the bit people get wrong.

const ALL_RULES = ["NORMAL","REVERSE_GRAVITY","INVERTED_CONTROLS","NO_JUMP","MOMENTUM",
                   "BULLETS_PUSH","SHIFTING_PLATFORMS","MOVEMENT_COSTS_TIME"];

const EVENT_ELIMINATES = {
    MOVED_SAME_DIRECTION:     ["INVERTED_CONTROLS"],
    MOVED_OPPOSITE_DIRECTION: ["NORMAL","REVERSE_GRAVITY","NO_JUMP","MOMENTUM","BULLETS_PUSH","SHIFTING_PLATFORMS","MOVEMENT_COSTS_TIME"],
    STOPPED_PROMPTLY:         ["MOMENTUM"],
    KEPT_SLIDING:             ["NORMAL","REVERSE_GRAVITY","INVERTED_CONTROLS","NO_JUMP","BULLETS_PUSH","SHIFTING_PLATFORMS","MOVEMENT_COSTS_TIME"],
    JUMP_ROSE:                ["NO_JUMP","REVERSE_GRAVITY"],
    JUMP_NOTHING:             ["NORMAL","REVERSE_GRAVITY","INVERTED_CONTROLS","MOMENTUM","BULLETS_PUSH","SHIFTING_PLATFORMS","MOVEMENT_COSTS_TIME"],
    JUMP_FELL:                ["NORMAL","INVERTED_CONTROLS","NO_JUMP","MOMENTUM","BULLETS_PUSH","SHIFTING_PLATFORMS","MOVEMENT_COSTS_TIME"],
    LANDED_STABLE:            ["SHIFTING_PLATFORMS"],
    LANDED_REARRANGED:        ["NORMAL","REVERSE_GRAVITY","INVERTED_CONTROLS","NO_JUMP","MOMENTUM","BULLETS_PUSH","MOVEMENT_COSTS_TIME"],
    BULLET_HURT:              ["BULLETS_PUSH"],
    BULLET_SHOVED:            ["NORMAL","REVERSE_GRAVITY","INVERTED_CONTROLS","NO_JUMP","MOMENTUM","SHIFTING_PLATFORMS","MOVEMENT_COSTS_TIME"],
    TIMER_WALL_CLOCK:         ["MOVEMENT_COSTS_TIME"],
    TIMER_PER_STEP:           ["NORMAL","REVERSE_GRAVITY","INVERTED_CONTROLS","NO_JUMP","MOMENTUM","BULLETS_PUSH","SHIFTING_PLATFORMS"]
};

// which rules does this obs rule out? throws if you typo an event id,
// which you will.
function rulesEliminatedBy(eventId) {
    const out = EVENT_ELIMINATES[eventId];
    if (out === undefined) throw new Error("Unknown event ID: " + eventId);
    return out;
}

// gives back a NEW shorter list, doesn't touch the one you passed in
function updateLiveSet(liveSet, eventId) {
    const dead = rulesEliminatedBy(eventId);
    return liveSet.filter(function (r) { return !dead.includes(r); });
}

// down to one = there was enough on the table to know
function isSufficient(liveSet) { return liveSet.length === 1; }
