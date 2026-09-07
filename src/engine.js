// engine.js - canvas, loop, player, collision, evidence, screens.
//
// y grows DOWNWARD on a canvas. smaller y = higher up the screen. says it
// in detect.js too but it's caught all of us at least once.

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const GRAVITY = 0.5, JUMP = 11;

// TITLE -> PLAY -> (DEAD | WON) -> CALL -> REVEAL -> PLAY
let screen = "TITLE";

let levelIndex = 0;
let level = LEVELS[levelIndex];

const player = { x:0, y:0, w:24, h:24, vx:0, vy:0, onGround:false };

let moves = 0;                 // deliberate actions. this is the currency.
let liveSet = [];
let called = false, wasRight = false, score = 0, callMove = 0;
let framesSinceRelease = 0, wasMoving = false;
let bullets = [], lasers = [], vanishers = [], movers = [], ghosts = [];
let elapsed = 0, walked = 0, realSecs = 0;
let deaths = 0, deathCause = "";
let movePulse = 0, tick = 0;

// something worth reporting happened. narrow the list, and note the exact
// moment it became knowable - that's what the score is built on.
function logEvent(eventId) {
    if (!eventId || called) return;
    const before = liveSet.slice();
    const next = updateLiveSet(liveSet, eventId);
    if (next.length === 0) {
        // contradiction. never supposed to happen - if it does, a detector
        // is lying and we'd rather know than quietly show an empty list.
        console.warn("contradiction: " + eventId + " emptied the set", before, activeRule);
        return;
    }
    liveSet = next;
    if (liveSet.length !== before.length && isSufficient(liveSet)) recordSufficiency(moves);
    renderPanel(liveSet);
}

// back to the spawn. same rule, same clock - dying shouldn't wipe out what
// you already worked out, and it shouldn't refund your time either.
function respawn(cause) {
    if (cause) { deaths++; deathCause = cause; screen = "DEAD"; }
    player.x = level.spawn.x; player.y = level.spawn.y;
    player.vx = 0; player.vy = 0;
}

function newAttempt() {
    level = LEVELS[levelIndex];
    resetLedges(level);
    activeRule = rollRule(level.safeRules);
    rollWash();
    liveSet = level.safeRules.slice();      // only what this arena can roll
    bullets = makeBullets(level);
    lasers = makeLasers(level);
    vanishers = makeVanishers(level);
    movers = makeMovers(level);
    ghosts = makeGhosts(level);
    moves = 0; called = false; score = 0; deaths = 0;
    elapsed = 0; walked = 0; realSecs = 0;
    framesSinceRelease = 0; wasMoving = false;
    resetAttempt();
    closePanel(); hideReveal(); renderPanel(liveSet);
    respawn();
    screen = "PLAY";
}

function nextLevel() {
    levelIndex = (levelIndex + 1) % LEVELS.length;
    newAttempt();
}

// only these 3 count as a move. pressing D or shift isn't an action.
const GAME_KEYS = ["ArrowLeft", "ArrowRight", "ArrowUp"];

const keys = {};
document.addEventListener("keydown", function (e) {
    if (screen === "TITLE") { if (e.key === "Enter" || e.key === " ") newAttempt(); return; }
    if (screen === "DEAD")  { if (e.key === "Enter" || e.key === " " || e.key === "r" || e.key === "R") screen = "PLAY"; return; }
    if (e.key === "n" || e.key === "N") { newAttempt(); return; }
    if (e.key === "r" || e.key === "R") { respawn(); return; }
    if (e.key === "l" || e.key === "L") { nextLevel(); return; }
    if (e.key === "c" || e.key === "C") { if (!called) togglePanel(); return; }
    if (e.key === "Escape") { closePanel(); return; }
    if (panelOpen()) return;
    if (!keys[e.key] && GAME_KEYS.includes(e.key) && screen === "PLAY") { moves++; movePulse = 12; }
    keys[e.key] = true;
});
document.addEventListener("keyup", function (e) { keys[e.key] = false; });
canvas.addEventListener("mousedown", function () {
    if (screen === "TITLE") newAttempt();
    else if (screen === "DEAD") screen = "PLAY";
});

// stood on top of this thing right now?
function ridingMover(m) {
    return player.onGround &&
           player.x + player.w > m.x && player.x < m.x + m.w &&
           Math.abs((player.y + player.h) - m.y) < 4;
}

function overlaps(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

// everything the player can stand on this frame. ghosts count even while
// invisible, which is the joke.
function solids() {
    const out = level.platforms.slice();
    for (const v of vanishers) if (v.state !== "gone") out.push(v);
    for (const m of movers) out.push(m);
    for (const g of ghosts) out.push(g);
    return out;
}

// one frame of the world. rules only ever reach in through here.
function update() {
    tick++;
    if (movePulse > 0) movePulse--;
    if (screen !== "PLAY" || called || panelOpen()) return;

    const frozen = false;
    stepLasers(lasers, tick, frozen);
    stepMovers(movers, frozen);
    stepBullets(bullets);
    stepVanishers(vanishers, function (v) {
        return player.onGround && overlaps({x:player.x, y:player.y+2, w:player.w, h:player.h}, v);
    });

    const g = gravityDirection();
    const xBefore = player.x, yBefore = player.y;
    const ground = solids();

    // sideways
    let raw = 0;
    if (keys["ArrowLeft"] || keys["a"])  raw = -1;
    if (keys["ArrowRight"] || keys["d"]) raw = 1;
    const dir = inputDirection(raw);

    player.vx += dir * acceleration();
    if (dir === 0) player.vx *= friction();
    if (Math.abs(player.vx) < 0.08) player.vx = 0;
    const cap = maxSpeed();
    player.vx = Math.max(-cap, Math.min(cap, player.vx));

    player.x += player.vx;
    for (const p of ground) {                      // snap flush, don't rewind
        if (!overlaps(player, p)) continue;
        if (ghosts.includes(p)) p.seen = 90;
        player.x = player.vx > 0 ? p.x - player.w : p.x + p.w;
        player.vx = 0;
    }
    if (player.x < 0) { player.x = 0; player.vx = 0; }
    if (player.x + player.w > canvas.width) { player.x = canvas.width - player.w; player.vx = 0; }

    // a mover carries you sideways whether you asked or not, so while
    // you're stood on one this reading is contaminated. saying nothing is
    // the honest answer - same call detectTimer makes.
    const onMover = movers.some(function (m) { return ridingMover(m); });
    if (raw !== 0 && player.x !== xBefore && !onMover)
        logEvent(detectHorizontal(raw, xBefore, player.x));

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
    if ((keys["ArrowUp"] || keys["w"] || keys[" "]) && player.onGround) {
        if (canJump()) { player.vy = -JUMP * g; player.onGround = false; }
        jumped = true;
    }

    player.vy += GRAVITY * g;
    player.y += player.vy;

    const wasAir = !player.onGround;
    player.onGround = false;
    for (const p of ground) {
        if (!overlaps(player, p)) continue;
        if (ghosts.includes(p)) p.seen = 90;
        player.y = player.vy > 0 ? p.y - player.h : p.y + p.h;
        player.vy = 0;
        player.onGround = true;
        if (p.dx) player.x += p.dx;                // ride the moving platform
        if (p.dy) player.y += p.dy;
    }

    if (jumped && wasOnGround) logEvent(detectJump(true, yBefore, player.y));

    if (player.onGround && wasAir && Math.abs(player.x - xBefore) > 0.5) {
        const shifted = platformsShift();
        if (shifted) shiftLedges(level);
        logEvent(shifted ? "LANDED_REARRANGED" : "LANDED_STABLE");
    }

    // bullets. slow enough that you can choose to walk into one.
    for (const b of bullets) {
        if (!overlaps(player, b)) continue;
        if (bulletHurts()) { logEvent("BULLET_HURT"); respawn("a bullet"); }
        else { logEvent("BULLET_SHOVED"); player.vx = (b.vx > 0 ? 1 : -1) * 9; }
        break;
    }

    // lasers just kill. no rule touches them, so they're never evidence.
    for (const l of lasers) {
        if (l.on && overlaps(player, l)) { respawn("a laser"); return; }
    }

    // the clock. counts up, by the second or by the pixel depending.
    const moved = Math.abs(player.x - xBefore);
    walked += moved; realSecs += 1 / 60;
    elapsed += clockAdvance(1 / 60, moved);
    if (realSecs > 2.5) logEvent(detectTimer(elapsed, walked / 240, realSecs));

    if (player.y > canvas.height || player.y + player.h < 0) respawn("the void");
    if (overlaps(player, level.exit)) screen = "WON";
}

// ui.js calls this when they pick a rule off the list
function submitCall(ruleId) {
    called = true;
    callMove = moves;
    wasRight = (ruleId === activeRule);
    score = gapScore(getSufficiency(), callMove, wasRight);
    recordRun({ levelId: level.id, rule: activeRule, guess: ruleId, correct: wasRight,
                moves: callMove, sufficiency: getSufficiency(), score: score,
                seconds: Math.round(realSecs * 10) / 10, deaths: deaths });
    screen = "REVEAL";
    showReveal(ruleId, activeRule, wasRight, score, getSufficiency(), callMove,
               bestFor(activeRule), Math.round(realSecs * 10) / 10);
}

// six washes that mean nothing, on purpose. one per attempt, laid over
// whatever theme the arena's using. you SEE the world shift the moment a
// new rule rolls, you just can't read WHICH rule from it.
const ATTEMPT_WASHES = ["#4E6764","#56626C","#626B58","#6F6073","#7C6870","#8A7A6C"];
let attemptWash = ATTEMPT_WASHES[0];
function rollWash() { attemptWash = ATTEMPT_WASHES[Math.floor(Math.random() * ATTEMPT_WASHES.length)]; }

// ---------- painting ----------

function rrect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x+w, y, x+w, y+h, r); ctx.arcTo(x+w, y+h, x, y+h, r);
    ctx.arcTo(x, y+h, x, y, r);     ctx.arcTo(x, y, x+w, y, r);
    ctx.fill();
}

// draw decides nothing. reads the arena + the player and hands both to
// art.js. no camera transform either, so the coords in levels.js are screen
// coords - what you see is exactly what you collide with.
function draw() {
    const w = canvas.width, h = canvas.height;
    if (screen === "TITLE") { drawTitle(w, h); return; }

    const t = themeOf(level);
    const geo = readArena(level);

    setTick(tick);
    paintBackdrop(ctx, w, h, geo.horizon, t);
    paintTerrain(ctx, geo, w, h, t);
    paintWorldEdge(ctx, geo, w, h);

    const pipeMid = level.spawn.x + player.w / 2 - 24;
    paintPipe(ctx, pipeMid, surfaceUnder(level, pipeMid, level.spawn.y), t);
    paintExit(ctx, level.exit, screen === "WON", t);

    drawHazards();
    paintPlayer(ctx, player, surfaceUnder(level, player.x + player.w / 2, player.y));

    // the attempt wash. "color" only touches hue + saturation and leaves
    // brightness alone, so the frame changes mood without a single platform
    // edge getting harder to see. tried overlay and soft-light, too subtle.
    ctx.save();
    ctx.globalAlpha = 0.35; ctx.globalCompositeOperation = "color";
    ctx.fillStyle = attemptWash; ctx.fillRect(0, 0, w, h);
    ctx.restore();

    paintScanlines(ctx, w, h);
    drawHud(w);

    if (screen === "DEAD") drawDeath(w, h);
    if (screen === "WON" && !called) drawWin(w, h);
}

function drawHazards() {
    for (const v of vanishers) {                    // shaking = about to go
        if (v.state === "gone") continue;
        const jitter = v.state === "shaking" ? (Math.random() * 2 - 1) * 2 : 0;
        ctx.globalAlpha = v.state === "shaking" ? 0.55 + Math.sin(tick * 0.6) * 0.25 : 1;
        ctx.fillStyle = "#8a6f4a"; rrect(v.x + jitter, v.y, v.w, v.h, 3);
        ctx.fillStyle = "#c9e75c"; rrect(v.x + jitter, v.y, v.w, 3, 1.5);
        ctx.globalAlpha = 1;
    }
    for (const m of movers) {
        ctx.fillStyle = "#4a5568"; rrect(m.x, m.y, m.w, m.h, 3);
        ctx.fillStyle = "#c9e75c"; rrect(m.x, m.y, m.w, 3, 1.5);
    }
    for (const g of ghosts) {                       // only there once you've hit it
        if (g.seen <= 0) continue;
        g.seen--;
        ctx.globalAlpha = Math.min(0.5, g.seen / 90);
        ctx.fillStyle = "#9fd8ff"; rrect(g.x, g.y, g.w, g.h, 3);
        ctx.globalAlpha = 1;
    }
    for (const l of lasers) {
        if (l.on) {
            ctx.fillStyle = "rgba(255,60,60,.22)"; ctx.fillRect(l.x - 5, l.y, l.w + 10, l.h);
            ctx.fillStyle = "#ff4d4d"; ctx.fillRect(l.x, l.y, l.w, l.h);
            ctx.fillStyle = "#fff"; ctx.fillRect(l.x + l.w/2 - 1, l.y, 2, l.h);
        } else {
            ctx.fillStyle = "rgba(255,80,80,.16)"; ctx.fillRect(l.x + l.w/2 - 1, l.y, 2, l.h);
        }
        ctx.fillStyle = "#6b7280";                  // emitters, so you see it's armed
        ctx.fillRect(l.x - 4, l.y - 6, l.w + 8, 6);
        ctx.fillRect(l.x - 4, l.y + l.h, l.w + 8, 6);
    }
    for (const b of bullets) {                      // red-white, never yellow
        const cx = b.x + b.w/2, cy = b.y + b.h/2;
        ctx.fillStyle = "rgba(230,60,50,.28)"; ctx.beginPath(); ctx.arc(cx, cy, b.w, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = "#e63c32"; ctx.beginPath(); ctx.arc(cx, cy, b.w/2 + 1, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = "#ffe9e6"; ctx.beginPath(); ctx.arc(cx-1.5, cy-1.5, 2.4, 0, Math.PI*2); ctx.fill();
    }
}

// an actual clock face. counts UP, because a leaderboard wants "solved it
// in 8.4s" and a countdown can't give you that. also: under the timer rule
// the hand only moves when you do, and a hand that freezes while you stand
// still is far easier to notice than a bar that drains a bit slower.
function drawClock(cx, cy, r, seconds) {
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2);
    ctx.fillStyle = "#0e1116"; ctx.fill();
    ctx.strokeStyle = "#39404d"; ctx.lineWidth = 1.5; ctx.stroke();
    for (let i = 0; i < 12; i++) {                  // ticks
        const a = i * Math.PI / 6;
        ctx.strokeStyle = i % 3 === 0 ? "#7d8797" : "#39404d";
        ctx.lineWidth = i % 3 === 0 ? 1.6 : 1;
        ctx.beginPath();
        ctx.moveTo(cx + Math.sin(a)*(r-2), cy - Math.cos(a)*(r-2));
        ctx.lineTo(cx + Math.sin(a)*(r-5), cy - Math.cos(a)*(r-5));
        ctx.stroke();
    }
    const a = (seconds % 60) / 60 * Math.PI * 2;    // sweep hand, 60s a lap
    ctx.strokeStyle = "#f5c542"; ctx.lineWidth = 2; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.sin(a)*(r-6), cy - Math.cos(a)*(r-6)); ctx.stroke();
    const am = (seconds / 3600) * Math.PI * 2;      // slow hand for the minutes
    ctx.strokeStyle = "#9aa3b2"; ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.sin(am)*(r-11), cy - Math.cos(am)*(r-11)); ctx.stroke();
    ctx.fillStyle = "#f5c542"; ctx.beginPath(); ctx.arc(cx, cy, 2, 0, Math.PI*2); ctx.fill();
    ctx.lineCap = "butt";
}

// HUD strip up top so text never sits on the play area.
//
// note what is NOT here: your best for the current rule. it used to be, and
// it was handing the answer over - see the same number twice and you know
// you're on the same rule. it lives on the reveal screen now.
function drawHud(w) {
    ctx.fillStyle = "rgba(11,14,19,0.88)"; ctx.fillRect(0, 0, w, 44);
    ctx.fillStyle = "rgba(201,231,92,0.5)"; ctx.fillRect(0, 43, w, 1);

    drawClock(26, 22, 14, elapsed);
    ctx.fillStyle = "#e8eaf0"; ctx.font = "bold 13px system-ui, sans-serif";
    ctx.fillText(elapsed.toFixed(1) + "s", 46, 27);

    ctx.fillStyle = movePulse > 0 ? "#ffffff" : "#f5c542";
    ctx.font = "bold 15px system-ui, sans-serif";
    ctx.fillText(String(moves), 104, 27);
    ctx.fillStyle = "#9aa3b2"; ctx.font = "12px system-ui, sans-serif";
    ctx.fillText("moves", 104 + ctx.measureText(String(moves)).width + 12, 27);

    ctx.fillText(level.name, 190, 27);
    if (deaths > 0) { ctx.fillStyle = "#e8705a"; ctx.fillText("deaths " + deaths, 330, 27); }

    ctx.fillStyle = "#6f7889";
    ctx.fillText("← → ↑ move    C call    R retry    N new rule    L next arena", 420, 27);
}

function drawWin(w, h) {
    ctx.fillStyle = "rgba(12,14,18,0.88)"; ctx.fillRect(0, 0, w, h);
    ctx.textAlign = "center";
    ctx.fillStyle = "#7fd39a"; ctx.font = "600 14px system-ui, sans-serif";
    ctx.fillText("YOU REACHED THE GATE", w/2, 158);
    ctx.fillStyle = "#f5c542"; ctx.font = "bold 40px system-ui, sans-serif";
    ctx.fillText("So what was the rule?", w/2, 214);
    ctx.fillStyle = "#9aa3b2"; ctx.font = "14px system-ui, sans-serif";
    ctx.fillText(moves + " moves  ·  " + elapsed.toFixed(1) + "s  ·  " + deaths + " deaths", w/2, 250);
    ctx.fillStyle = "#e8eaf0"; ctx.font = "600 15px system-ui, sans-serif";
    ctx.fillText("Press C to call it", w/2, 292);
    ctx.textAlign = "left";
}

// the death screen. no red strobe - it made people flinch and told them
// nothing. this says what got you and gets out of the way.
function drawDeath(w, h) {
    ctx.fillStyle = "rgba(14,8,10,0.90)"; ctx.fillRect(0, 0, w, h);
    ctx.textAlign = "center";
    const pulse = 0.75 + Math.sin(tick * 0.08) * 0.25;
    ctx.globalAlpha = pulse;
    ctx.fillStyle = "#e8705a"; ctx.font = "bold 52px system-ui, sans-serif";
    ctx.fillText("YOU DIED", w/2, 190);
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#c9a9a2"; ctx.font = "16px system-ui, sans-serif";
    ctx.fillText(deathCause + " got you", w/2, 224);

    ctx.fillStyle = "#39404d"; ctx.fillRect(w/2 - 150, 250, 300, 1);
    ctx.fillStyle = "#9aa3b2"; ctx.font = "13px system-ui, sans-serif";
    ctx.fillText("death " + deaths + "  ·  " + moves + " moves so far  ·  " + elapsed.toFixed(1) + "s", w/2, 274);
    ctx.fillStyle = "#7fd39a"; ctx.font = "600 14px system-ui, sans-serif";
    ctx.fillText("The rule hasn't changed. Everything you worked out still counts.", w/2, 302);
    ctx.fillStyle = "#e8eaf0"; ctx.font = "600 15px system-ui, sans-serif";
    ctx.fillText("Press SPACE to go again", w/2, 340);
    ctx.textAlign = "left";
}

// title screen, drawn in code so it can't fail to load a font
function drawTitle(w, h) {
    const grd = ctx.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, "#1B1F26"); grd.addColorStop(1, "#101319");
    ctx.fillStyle = grd; ctx.fillRect(0, 0, w, h);

    const cols = ["#2D5276","#BD4B29","#2E603D","#C9A227","#C9829B","#45C7D6","#A495C6"];
    const word = "MISRULE";
    ctx.textAlign = "center"; ctx.font = "bold 74px system-ui, sans-serif";
    let total = 0;
    for (const ch of word) total += ctx.measureText(ch).width + 6;
    let x = w/2 - total/2;
    for (let i = 0; i < word.length; i++) {
        const cw = ctx.measureText(word[i]).width;
        const bob = Math.sin(tick * 0.04 + i * 0.7) * 4;
        ctx.fillStyle = cols[i];
        ctx.fillText(word[i], x + cw/2, 170 + bob);
        x += cw + 6;
    }
    ctx.fillStyle = "#9aa3b2"; ctx.font = "16px system-ui, sans-serif";
    ctx.fillText("Every attempt hides a different law of physics.", w/2, 226);
    ctx.fillText("Work out which one.", w/2, 250);

    const bw = 200, bx = w/2 - bw/2, by = 296;      // play button
    ctx.fillStyle = "#2FCAD0"; rrect(bx, by, bw, 52, 10);
    ctx.fillStyle = "#08202a"; ctx.font = "bold 20px system-ui, sans-serif";
    ctx.fillText("PLAY", w/2, by + 34);
    ctx.fillStyle = "#5c6675"; ctx.font = "13px system-ui, sans-serif";
    ctx.fillText("click, or press ENTER", w/2, by + 82);
    ctx.textAlign = "left";
}

function loop() { update(); draw(); requestAnimationFrame(loop); }
