// engine.js — canvas, loop, player, collision, evidence, win check.
// Heads up: on a canvas y grows DOWNWARD. Smaller y = higher up.
// Everyone gets caught by that once, so it's worth repeating.

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const GRAVITY = 0.5, JUMP = 11;
let levelIndex = 0;
let level = LEVELS[levelIndex];

const player = { x:0, y:0, w:24, h:24, vx:0, vy:0, onGround:false };

let moves = 0;            // deliberate actions. this is the currency.
let liveSet = [];         // rules still possible
let won = false, called = false, wasRight = false, score = 0, callMove = 0;
let framesSinceRelease = 0, wasMoving = false;

// Something happened worth reporting - narrow the list, and note the
// moment it became knowable.
function logEvent(eventId) {
    if (!eventId || called) return;
    const before = liveSet.length;
    liveSet = updateLiveSet(liveSet, eventId);
    if (liveSet.length !== before && isSufficient(liveSet)) recordSufficiency(moves);
    renderPanel(liveSet);
}

function respawn() {
    player.x = level.spawn.x; player.y = level.spawn.y;
    player.vx = 0; player.vy = 0; won = false;
}

// Fresh go, brand new secret rule, everything back to square one.
function nextLevel() {
    levelIndex = (levelIndex + 1) % LEVELS.length;
    level = LEVELS[levelIndex];
    newAttempt();
}

function newAttempt() {
    level = LEVELS[levelIndex];
    activeRule = rollRule(level.safeRules);
    liveSet = ALL_RULES.slice();
    moves = 0; won = false; called = false; score = 0;
    framesSinceRelease = 0; wasMoving = false;
    resetAttempt();
    closePanel();
    hideReveal();
    renderPanel(liveSet);
    respawn();
}

// Only these three count as a move. Pressing D or shift isn't an action.
const GAME_KEYS = ["ArrowLeft", "ArrowRight", "ArrowUp"];

const keys = {};
document.addEventListener("keydown", function (e) {
    if (e.key === "n" || e.key === "N") { newAttempt(); return; }
    if (e.key === "l" || e.key === "L") { nextLevel(); return; }
    if (e.key === "r" || e.key === "R") { respawn(); return; }
    if (e.key === "c" || e.key === "C") { if (!called) togglePanel(); return; }
    if (e.key === "Escape") { closePanel(); return; }
    if (panelOpen()) return;                       // panel handles its own keys
    if (!keys[e.key] && GAME_KEYS.includes(e.key) && !won && !called) moves++;
    keys[e.key] = true;
});
document.addEventListener("keyup", function (e) { keys[e.key] = false; });

function overlaps(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function update() {
    if (won || called || panelOpen()) return;

    const g = gravityDirection();
    const xBefore = player.x, yBefore = player.y;

    // --- sideways ---
    let raw = 0;
    if (keys["ArrowLeft"])  raw = -1;
    if (keys["ArrowRight"]) raw = 1;
    const dir = inputDirection(raw);               // may come back flipped

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

    // --- letting go: did we stop, or keep sliding? ---
    if (raw === 0 && wasMoving) framesSinceRelease++;
    else if (raw !== 0) { framesSinceRelease = 0; wasMoving = true; }
    if (wasMoving && raw === 0) {
        if (framesSinceRelease <= 6 && player.vx === 0) { logEvent("STOPPED_PROMPTLY"); wasMoving = false; }
        else if (framesSinceRelease > 6 && Math.abs(player.vx) > 0) { logEvent("KEPT_SLIDING"); wasMoving = false; }
    }

    // --- up and down ---
    const wasOnGround = player.onGround;
    let jumped = false;
    if (keys["ArrowUp"] && player.onGround) {
        if (canJump()) { player.vy = -JUMP * g; player.onGround = false; }
        jumped = true;
    }

    player.vy += GRAVITY * g;
    player.y += player.vy;

    player.onGround = false;
    for (const p of level.platforms) {
        if (!overlaps(player, p)) continue;
        player.y = player.vy > 0 ? p.y - player.h : p.y + p.h;
        player.vy = 0;
        player.onGround = true;
    }

    if (jumped && wasOnGround) logEvent(detectJump(true, yBefore, player.y));

    if (player.y > canvas.height || player.y + player.h < 0) respawn();
    if (overlaps(player, level.exit)) won = true;
}

// Called by ui.js when the player picks a rule off the list.
function submitCall(ruleId) {
    called = true;
    callMove = moves;
    wasRight = (ruleId === activeRule);
    score = gapScore(getSufficiency(), callMove, wasRight);
    recordRun({ levelId: level.id, rule: activeRule, guess: ruleId, correct: wasRight,
                moves: callMove, sufficiency: getSufficiency(), score: score });
    showReveal(ruleId, activeRule, wasRight, score, getSufficiency(), callMove);
}

function rounded(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);         ctx.arcTo(x, y, x + w, y, r);
    ctx.fill();
}

function draw() {
    // Everything outside the arena is void. Keeps the eye on the chamber
    // instead of a big empty slab of colour.
    ctx.fillStyle = "#12141a"; ctx.fillRect(0, 0, canvas.width, canvas.height);

    let top = Infinity, bot = -Infinity;
    for (const p of level.platforms) { top = Math.min(top, p.y); bot = Math.max(bot, p.y + p.h); }

    // Nudge the whole chamber to sit in the middle of the frame. Purely
    // cosmetic - collisions still use the real coordinates.
    ctx.save();
    ctx.translate(0, Math.round((canvas.height + 38 - (bot - top)) / 2 - top));

    ctx.fillStyle = "#5B6B68"; ctx.fillRect(0, top, canvas.width, bot - top);

    ctx.save(); ctx.beginPath(); ctx.rect(0, top, canvas.width, bot - top); ctx.clip();
    ctx.strokeStyle = "rgba(255,255,255,0.05)"; ctx.lineWidth = 1;   // faint grid
    for (let x = 0; x <= canvas.width; x += 20) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,canvas.height); ctx.stroke(); }
    for (let y = 0; y <= canvas.height; y += 20) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(canvas.width,y); ctx.stroke(); }
    ctx.restore();

    ctx.fillStyle = "#242830";
    for (const p of level.platforms) rounded(p.x, p.y, p.w, p.h, 4);

    ctx.fillStyle = won ? "#b6f5c8" : "#7fd39a";
    rounded(level.exit.x, level.exit.y, level.exit.w, level.exit.h, 5);

    ctx.fillStyle = "#f5c542";
    rounded(player.x, player.y, player.w, player.h, 6);

    ctx.restore();

    // HUD strip along the top, so text never sits on the play area
    ctx.fillStyle = "rgba(16,18,22,0.82)"; ctx.fillRect(0, 0, canvas.width, 38);
    ctx.fillStyle = "#f5c542"; ctx.font = "bold 15px system-ui, sans-serif";
    ctx.fillText(String(moves), 16, 25);
    ctx.fillStyle = "#9aa3b2"; ctx.font = "12px system-ui, sans-serif";
    ctx.fillText("moves", 16 + ctx.measureText(String(moves)).width + 14, 25);
    ctx.fillText(level.name, 130, 25);
    const best = bestFor(activeRule);
    if (best !== null) ctx.fillText("best for this rule: " + best, 130 + ctx.measureText(level.name).width + 24, 25);
    ctx.fillStyle = "#6f7889";
    ctx.fillText("← → ↑ move    C call    R retry    N new rule    L next arena", 400, 25);

    if (won && !called) {
        ctx.fillStyle = "rgba(12,14,18,0.86)"; ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.textAlign = "center";
        ctx.fillStyle = "#e8eaf0"; ctx.font = "600 15px system-ui, sans-serif";
        ctx.fillText("You reached the exit in " + moves + " moves", canvas.width/2, 170);
        ctx.fillStyle = "#f5c542"; ctx.font = "bold 40px system-ui, sans-serif";
        ctx.fillText("So what was the rule?", canvas.width/2, 226);
        ctx.fillStyle = "#9aa3b2"; ctx.font = "14px system-ui, sans-serif";
        ctx.fillText("Press C to call it  ·  N for a new rule", canvas.width/2, 268);
        ctx.textAlign = "left";
    }
}

function loop() { update(); draw(); requestAnimationFrame(loop); }
