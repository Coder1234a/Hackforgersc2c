// engine.js - canvas, loop, player, collision, evidence, win check.
//
// y grows DOWNWARD on a canvas. smaller y = higher up the screen. says it
// in detect.js too but it's caught all of us at least once.

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const GRAVITY = 0.5, JUMP = 11;
const CLOCK_MAX = 30;          // seconds-ish. drains differently per rule.

let levelIndex = 0;
let level = LEVELS[levelIndex];

const player = { x:0, y:0, w:24, h:24, vx:0, vy:0, onGround:false };

let moves = 0;                 // deliberate actions. this is the currency.
let liveSet = [];
let won = false, called = false, wasRight = false, score = 0, callMove = 0;
let framesSinceRelease = 0, wasMoving = false;
let bullets = [], clock = CLOCK_MAX, hitFlash = 0, movePulse = 0;
let stepsTaken = 0, secsElapsed = 0, clockStart = CLOCK_MAX;
let tick = 0;

// something worth reporting happened. narrow the list, and note the exact
// moment it became knowable - that's what the score is built on.
function logEvent(eventId) {
    if (!eventId || called) return;
    const before = liveSet.length;
    liveSet = updateLiveSet(liveSet, eventId);
    if (liveSet.length !== before && isSufficient(liveSet)) recordSufficiency(moves);
    renderPanel(liveSet);
}

function respawn() {
    player.x = level.spawn.x; player.y = level.spawn.y;
    player.vx = 0; player.vy = 0;
    clock = CLOCK_MAX; clockStart = CLOCK_MAX;
    stepsTaken = 0; secsElapsed = 0;
    won = false;
}

// fresh go, new secret rule, everything back to square one
function newAttempt() {
    level = LEVELS[levelIndex];
    resetLedges(level);
    activeRule = rollRule(level.safeRules);
    rollWash();
    liveSet = level.safeRules.slice();   // only what this arena can roll
    bullets = makeBullets(level);
    moves = 0; won = false; called = false; score = 0;
    framesSinceRelease = 0; wasMoving = false; hitFlash = 0;
    resetAttempt();
    closePanel(); hideReveal(); renderPanel(liveSet);
    respawn();
}

function nextLevel() {
    levelIndex = (levelIndex + 1) % LEVELS.length;
    newAttempt();
}

// only these 3 count as a move. pressing D or shift isn't an action.
const GAME_KEYS = ["ArrowLeft", "ArrowRight", "ArrowUp"];

const keys = {};
document.addEventListener("keydown", function (e) {
    if (e.key === "n" || e.key === "N") { newAttempt(); return; }
    if (e.key === "r" || e.key === "R") { respawn(); return; }
    if (e.key === "l" || e.key === "L") { nextLevel(); return; }
    if (e.key === "c" || e.key === "C") { if (!called) togglePanel(); return; }
    if (e.key === "Escape") { closePanel(); return; }
    if (panelOpen()) return;
    if (!keys[e.key] && GAME_KEYS.includes(e.key) && !won && !called) { moves++; movePulse = 12; }
    keys[e.key] = true;
});
document.addEventListener("keyup", function (e) { keys[e.key] = false; });

function overlaps(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

// one frame of the world. rules only ever reach in through here.
function update() {
    tick++;
    if (movePulse > 0) movePulse--;
    if (hitFlash > 0) hitFlash--;
    if (won || called || panelOpen()) return;

    const g = gravityDirection();
    const xBefore = player.x, yBefore = player.y;

    // sideways
    let raw = 0;
    if (keys["ArrowLeft"])  raw = -1;
    if (keys["ArrowRight"]) raw = 1;
    const dir = inputDirection(raw);

    player.vx += dir * acceleration();
    if (dir === 0) player.vx *= friction();
    if (Math.abs(player.vx) < 0.08) player.vx = 0;
    const cap = maxSpeed();
    player.vx = Math.max(-cap, Math.min(cap, player.vx));

    player.x += player.vx;
    for (const p of level.platforms) {             // snap flush, don't rewind
        if (!overlaps(player, p)) continue;
        player.x = player.vx > 0 ? p.x - player.w : p.x + p.w;
        player.vx = 0;
    }
    if (player.x < 0) { player.x = 0; player.vx = 0; }
    if (player.x + player.w > canvas.width) { player.x = canvas.width - player.w; player.vx = 0; }

    if (raw !== 0 && player.x !== xBefore) logEvent(detectHorizontal(raw, xBefore, player.x));

    // let go of the key - did we stop, or keep sliding?
    if (raw === 0 && wasMoving) framesSinceRelease++;
    else if (raw !== 0) { framesSinceRelease = 0; wasMoving = true; }
    if (wasMoving && raw === 0) {
        if (framesSinceRelease <= 6 && player.vx === 0) { logEvent("STOPPED_PROMPTLY"); wasMoving = false; }
        else if (framesSinceRelease > 6 && Math.abs(player.vx) > 0) { logEvent("KEPT_SLIDING"); wasMoving = false; }
    }

    // up and down
    const wasOnGround = player.onGround;
    let jumped = false;
    if (keys["ArrowUp"] && player.onGround) {
        if (canJump()) { player.vy = -JUMP * g; player.onGround = false; }
        jumped = true;
    }

    player.vy += GRAVITY * g;
    player.y += player.vy;

    const wasAir = !player.onGround;
    player.onGround = false;
    for (const p of level.platforms) {
        if (!overlaps(player, p)) continue;
        player.y = player.vy > 0 ? p.y - player.h : p.y + p.h;
        player.vy = 0;
        player.onGround = true;
    }

    if (jumped && wasOnGround) logEvent(detectJump(true, yBefore, player.y));

    // landed after being in the air. does the floor stay put?
    if (player.onGround && wasAir && Math.abs(player.x - xBefore) > 0.5) {
        const shifted = platformsShift();
        if (shifted) shiftLedges(level);
        logEvent(shifted ? "LANDED_REARRANGED" : "LANDED_STABLE");
    }

    // bullets. slow enough that you can choose to walk into one.
    stepBullets(bullets);
    for (const b of bullets) {
        if (!overlaps(player, b)) continue;
        hitFlash = 14;
        if (bulletHurts()) { logEvent("BULLET_HURT"); respawn(); }
        else { logEvent("BULLET_SHOVED"); player.vx = (b.vx > 0 ? 1 : -1) * 9; }
        break;
    }

    // the clock. drains by the second, or by the pixel, depending.
    const moved = Math.abs(player.x - xBefore);
    stepsTaken += moved; secsElapsed += 1 / 60;
    clock -= clockDrain(1 / 60, moved);
    if (secsElapsed > 2.5) {
        const drained = clockStart - clock;
        logEvent(detectTimer(drained, stepsTaken / 240, secsElapsed));
    }
    if (clock <= 0) { hitFlash = 20; respawn(); }

    // off the top or bottom of the world, back to the start
    if (player.y > canvas.height || player.y + player.h < 0) respawn();
    if (overlaps(player, level.exit)) won = true;
}

// ui.js calls this when they pick a rule off the list
function submitCall(ruleId) {
    called = true;
    callMove = moves;
    wasRight = (ruleId === activeRule);
    score = gapScore(getSufficiency(), callMove, wasRight);
    recordRun({ levelId: level.id, rule: activeRule, guess: ruleId, correct: wasRight,
                moves: callMove, sufficiency: getSufficiency(), score: score });
    showReveal(ruleId, activeRule, wasRight, score, getSufficiency(), callMove, bestFor(activeRule));
}

// six washes that mean nothing, on purpose. one gets picked per attempt and
// laid over whatever theme the arena's using. you SEE the world shift the
// moment a new rule rolls, you just can't read WHICH rule from it. that's
// the point - the shift is a signal, not an answer.
const ATTEMPT_WASHES = ["#4E6764","#56626C","#626B58","#6F6073","#7C6870","#8A7A6C"];
let attemptWash = ATTEMPT_WASHES[0];

function rollWash() {
    attemptWash = ATTEMPT_WASHES[Math.floor(Math.random() * ATTEMPT_WASHES.length)];
}

// draw decides nothing. reads the arena + the player and hands both to
// art.js. no camera transform either, so the coords in levels.js are screen
// coords - what you see is exactly what you collide with.
function draw() {
    const t = themeOf(level);
    const geo = readArena(level);
    const w = canvas.width, h = canvas.height;
    const spawnMid = level.spawn.x + player.w / 2;

    setTick(tick);
    paintBackdrop(ctx, w, h, geo.horizon, t);
    paintTerrain(ctx, geo, w, h, t);
    paintWorldEdge(ctx, geo, w, h);

    // a tuft either side, planted on whatever's underneath
    const tufts = [{ x: level.exit.x + level.exit.w + 16, y: level.exit.y },
                   { x: level.spawn.x + 170,             y: level.spawn.y }];
    for (const s of tufts) {
        if (s.x < 10 || s.x > w - 10) continue;
        const sy = surfaceUnder(level, s.x, s.y);
        if (sy < h) paintTuft(ctx, s.x, sy, t);
    }

    // pipe sits just LEFT of spawn, not on it. design has them overlapping
    // but a 24px block parked inside a 34px pipe hides both. side by side
    // still reads as "you came out of there".
    const pipeMid = spawnMid - 24;
    paintPipe(ctx, pipeMid, surfaceUnder(level, pipeMid, level.spawn.y), t);
    paintExit(ctx, level.exit, won, t);

    // bullets are red-white, never yellow. the player is yellow and you
    // should never squint to work out which blob is which.
    for (const b of bullets) {
        const cx = b.x + b.w/2, cy = b.y + b.h/2;
        ctx.fillStyle = "rgba(230,60,50,.28)";
        ctx.beginPath(); ctx.arc(cx, cy, b.w, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = "#e63c32";
        ctx.beginPath(); ctx.arc(cx, cy, b.w/2 + 1, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = "#ffe9e6";
        ctx.beginPath(); ctx.arc(cx - 1.5, cy - 1.5, 2.4, 0, Math.PI*2); ctx.fill();
    }

    paintPlayer(ctx, player, surfaceUnder(level, player.x + player.w / 2, player.y));

    // the attempt wash. "color" only touches hue + saturation and leaves
    // brightness alone, so the frame changes mood without a single platform
    // edge getting harder to see. tried overlay and soft-light first, both
    // too subtle to notice.
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.globalCompositeOperation = "color";
    ctx.fillStyle = attemptWash;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();

    if (hitFlash > 0) {                             // you got hit / ran out
        ctx.fillStyle = "rgba(220,70,50," + (hitFlash / 34).toFixed(3) + ")";
        ctx.fillRect(0, 0, w, h);
    }

    paintScanlines(ctx, w, h);
    drawHud(w);

    if (won && !called) {
        ctx.fillStyle = "rgba(12,14,18,0.86)"; ctx.fillRect(0, 0, w, h);
        ctx.textAlign = "center";
        ctx.fillStyle = "#e8eaf0"; ctx.font = "600 15px system-ui, sans-serif";
        ctx.fillText("You reached the exit in " + moves + " moves", w/2, 170);
        ctx.fillStyle = "#f5c542"; ctx.font = "bold 40px system-ui, sans-serif";
        ctx.fillText("So what was the rule?", w/2, 226);
        ctx.fillStyle = "#9aa3b2"; ctx.font = "14px system-ui, sans-serif";
        ctx.fillText("Press C to call it  ·  N for a new rule", w/2, 268);
        ctx.textAlign = "left";
    }
}

// HUD strip up top so text never sits on the play area.
//
// note what is NOT here: your best for the current rule. it used to be, and
// it was handing the answer over - see the same number twice and you know
// you're on the same rule. it lives on the reveal screen now.
function drawHud(w) {
    ctx.fillStyle = "rgba(11,14,19,0.86)"; ctx.fillRect(0, 0, w, 38);
    ctx.fillStyle = "rgba(201,231,92,0.5)"; ctx.fillRect(0, 37, w, 1);

    ctx.fillStyle = movePulse > 0 ? "#ffffff" : "#f5c542";
    ctx.font = "bold 15px system-ui, sans-serif";
    ctx.fillText(String(moves), 16, 25);
    ctx.fillStyle = "#9aa3b2"; ctx.font = "12px system-ui, sans-serif";
    ctx.fillText("moves", 16 + ctx.measureText(String(moves)).width + 14, 25);

    ctx.fillText(level.name, 96, 25);

    const bx = 228, bw = 104, frac = Math.max(0, clock / CLOCK_MAX);
    ctx.fillStyle = "#2a2f39"; ctx.fillRect(bx, 14, bw, 10);
    ctx.fillStyle = frac < 0.25 ? "#e8705a" : "#7fd39a";
    ctx.fillRect(bx, 14, bw * frac, 10);
    ctx.fillStyle = "#6f7889"; ctx.fillText("time", bx + bw + 8, 25);

    ctx.fillStyle = "#6f7889";
    ctx.fillText("← → ↑ move    C call    R retry    N new rule    L next arena", 396, 25);
}

function loop() { update(); draw(); requestAnimationFrame(loop); }
