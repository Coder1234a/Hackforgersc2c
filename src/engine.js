// engine.js - canvas, loop, player, collision, evidence, screens.
//
// y grows DOWNWARD on a canvas. smaller y = higher up. it says so in
// detect.js too, but it's caught all of us at least once.

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const GRAVITY = 0.5, JUMP = 11;

// two faces, pulled from google fonts with a real fallback stack behind
// them so the game still looks like itself with the wifi off.
const F_UI    = '"Space Grotesk", "Segoe UI", system-ui, sans-serif';
const F_TITLE = 'Cinzel, "Times New Roman", Georgia, serif';
function uiFont(spec) { return spec + " " + F_UI; }
function titleFont(spec) { return spec + " " + F_TITLE; }

// TITLE -> PLAY -> (DEAD | CHEESED | RESET | WON) -> panel -> REVEAL
//       -> next arena ... -> END -> (replay | TITLE)
let screen = "TITLE";
let wipe = 0;                  // 1 = black, eases away. every screen change fades.

let levelIndex = 0;
let level = LEVELS[levelIndex];

// knockVx is the shove from falling rock, kept apart from vx on purpose:
// walking has a speed cap, being thrown does not.
const player = { x:0, y:0, w:24, h:24, vx:0, vy:0, knockVx:0, onGround:false };

let moves = 0;                 // deliberate actions. this is the currency.
let liveSet = [];
let called = false, wasRight = false, score = 0, callMove = 0;
let framesSinceRelease = 0, wasMoving = false, peakVx = 0;
let bullets = [], lasers = [], vanishers = [], movers = [], ghosts = [], stals = [], dust = [];
let elapsed = 0, walked = 0, realSecs = 0;
let deaths = 0, deathCause = "";
let movePulse = 0, tick = 0, shove = 0;
let tutorialStep = -1, introTimer = 0;
let cheeseBest = 0;      // deepest safe hole reached this attempt

// a RUN is all four arenas back to back. the name is typed on the title
// screen and lives for the session only - no leaderboard yet, it's just so
// the end screen can say who did it.
let playerName = "";
let runTotal = 0, runLog = [];

let revealAt = -999;                  // tick the score card went up

// every screen change fades, and every screen change puts the DOM overlays
// away - except the one that IS a DOM overlay. the end screen used to come
// up UNDERNEATH the score card, which is why nobody could see it.
function goScreen(next) {
    screen = next; wipe = 1;
    if (next === "REVEAL") { revealAt = tick; return; }
    hideReveal();
    closePanel();
}

// something worth reporting happened. narrow the list, and note the exact
// moment it became knowable - that's what the score is built on.
function logEvent(eventId) {
    if (!eventId || called) return;
    const before = liveSet.slice();
    const next = updateLiveSet(liveSet, eventId);
    if (next.length === 0) {
        // contradiction. never supposed to happen - if it does a detector is
        // lying and we'd rather know than quietly show an empty list.
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
    if (cause) {
        deaths++; deathCause = cause; goScreen("DEAD");
        // put the arena back how it was drawn. a bad SHIFTING_PLATFORMS
        // shuffle, or every grass step already gone, can leave you stood
        // somewhere with nothing in reach - and "stuck forever" isn't a
        // puzzle. dying costs you the clock and the moves, not the arena.
        resetLedges(level);
        resetVanishers(vanishers);
        resetMovers(movers);
        resetStalactites(stals);
    }
    player.x = level.spawn.x; player.y = level.spawn.y;
    player.vx = 0; player.vy = 0; player.knockVx = 0;
    // a respawn sets your speed to zero. if the release test is still armed
    // from before you died it reads that as STOPPED_PROMPTLY, which kills
    // MOMENTUM while MOMENTUM is the rule. disarm it.
    framesSinceRelease = 0; wasMoving = false; peakVx = 0;
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
    stals = makeStalactites(level);
    dust = [];
    tutorialStep = level.tutorial ? 0 : -1;
    introTimer = 150;                       // the arena's name card
    moves = 0; called = false; score = 0; deaths = 0; cheeseBest = 0;
    elapsed = 0; walked = 0; realSecs = 0;
    framesSinceRelease = 0; wasMoving = false;
    resetAttempt();
    closePanel(); hideReveal(); renderPanel(liveSet);
    respawn();
    goScreen("PLAY");
}

function gotoLevel(i) {
    levelIndex = (i + LEVELS.length) % LEVELS.length;
    newAttempt();
}

// past the last arena there's nowhere to go but the end screen.
function nextLevel() {
    if (levelIndex + 1 >= LEVELS.length) { goScreen("END"); return; }
    gotoLevel(levelIndex + 1);
}

// a fresh run: totals cleared, back to arena one.
function startRun() {
    runTotal = 0; runLog = [];
    levelIndex = 0;
    newAttempt();
}

// arena 1 has nothing hidden - it's the control. so finishing it doesn't
// ask you to name anything, it just walks you into the next cave. you can
// only notice a difference if you were shown the original first.
function isControlLevel() {
    return level.safeRules.length === 1 && level.safeRules[0] === "NORMAL";
}

// ---------- input ----------
//
// ← / A and → / D move. SPACE, W or ↑ jump. C opens the fundamentals. Q
// rolls a new rule. R puts you back at the spawn. ENTER is "yes, continue"
// on every screen and "lock in my answer" in the panel.
//
// that's the whole keyboard. the old C / L / N spread three unrelated jobs
// across three random letters and nobody could remember any of them.
const GAME_KEYS = ["ArrowLeft", "ArrowRight", "ArrowUp", "a", "d", "w", " ",
                   "A", "D", "W"];
const NAME_OK = /^[A-Za-z0-9 _.\-]$/;

function isContinue(e) { return e.key === " " || e.key === "Enter"; }

const keys = {};
document.addEventListener("keydown", function (e) {
    // stop the page scrolling out from under the canvas
    if (e.key === " " || e.key === "Enter" || e.key === "Escape" ||
        e.key === "ArrowUp" || e.key === "ArrowDown") e.preventDefault();

    // title: type a name, ENTER to go
    if (screen === "TITLE") {
        if (e.key === "Enter") { startRun(); return; }
        if (e.key === "Backspace") { playerName = playerName.slice(0, -1); return; }
        if (e.key.length === 1 && playerName.length < 14 && NAME_OK.test(e.key)) playerName += e.key;
        return;
    }
    if (screen === "END") {
        if (e.key === "r" || e.key === "R" || isContinue(e)) { startRun(); return; }
        if (e.key === "t" || e.key === "T" || e.key === "Escape") { goScreen("TITLE"); return; }
        return;
    }
    if (screen === "DEAD" || screen === "CHEESED" || screen === "RESET") {
        if (isContinue(e) || e.key === "r" || e.key === "R") goScreen("PLAY");
        return;
    }
    if (screen === "REVEAL") {
        // the ENTER that locked your answer in must not also skip the card
        // telling you whether you were right. it did, and the whole reveal
        // flashed past in one frame.
        if (tick - revealAt < 14) return;
        if (isContinue(e)) nextLevel();
        else if (e.key === "q" || e.key === "Q" || e.key === "r" || e.key === "R") newAttempt();
        return;
    }
    if (tutorialStep >= 0 && screen === "PLAY") { nextTutorial(); return; }

    if (e.shiftKey) {                                  // quiet dev shortcuts
        if (e.key === "ArrowRight") { gotoLevel(levelIndex + 1); return; }
        if (e.key === "ArrowLeft")  { gotoLevel(levelIndex - 1); return; }
    }
    if (e.key === "Escape") { closePanel(); return; }
    if (panelOpen()) return;                           // ui.js drives the panel
    if (e.key === "c" || e.key === "C") { if (!called) openPanel(); return; }
    if (e.key === "Enter")              { if (!called) openPanel(); return; }
    if (e.key === "q" || e.key === "Q") { newAttempt(); return; }   // new rule
    if (e.key === "r" || e.key === "R") { respawn(); return; }      // back to spawn
    if (e.key === "f" || e.key === "F") { toggleFullscreen(); return; }

    if (!keys[e.key] && GAME_KEYS.includes(e.key) && screen === "PLAY") {
        moves++; movePulse = 12;
    }
    keys[e.key] = true;
});
document.addEventListener("keyup", function (e) { keys[e.key] = false; });
canvas.addEventListener("mousedown", function () {
    if (screen === "TITLE") startRun();
    else if (screen === "END") startRun();
    else if (screen === "DEAD" || screen === "CHEESED" || screen === "RESET") goScreen("PLAY");
    else if (tutorialStep >= 0) nextTutorial();
});

function held(a, b, c) { return keys[a] || keys[b] || keys[c]; }

// stood on top of this thing right now?
function ridingMover(m) {
    return player.onGround &&
           player.x + player.w > m.x && player.x < m.x + m.w &&
           Math.abs((player.y + player.h) - m.y) < 4;
}

// the frame goes fullscreen, not the canvas - the CSS letterboxes it inside
// so an ultrawide monitor doesn't stretch the game.
function toggleFullscreen() {
    const frame = canvas.parentElement;
    if (document.fullscreenElement) document.exitFullscreen();
    else if (frame.requestFullscreen) frame.requestFullscreen();
}

function overlaps(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

// a LEDGE is anything thin - shelves, grass steps, cheese rinds, the stub
// that runs. you land on top of one and you pass straight through it from
// underneath or from the side, which is how every platformer has worked
// since about 1985.
//
// this isn't decoration. before it, the small shelf in the cave sat
// directly over the mid shelf and the only jump that reached it had a
// three pixel launch window. nobody can play that.
//
// anything thick - the cave roof, the balcony - is solid rock on all six
// sides, so REVERSE_GRAVITY still has a ceiling to stand on.
function isLedge(p) { return p.h <= 16; }

// were we clear of this ledge when the frame started? without it, rising
// through a ledge and topping out inside it snaps you onto it mid-flight.
function wasClear(p, yBefore, g) {
    return g > 0 ? (yBefore + player.h <= p.y + 2)
                 : (yBefore >= p.y + p.h - 2);
}

// everything the player can stand on this frame. ghosts count even while
// they're invisible, which is the joke.
function solids() {
    const out = level.platforms.slice();
    for (const v of vanishers) if (v.state === "solid" || v.state === "shaking") out.push(v);
    for (const m of movers) out.push(m);
    for (const s of stals) if (s.state === "hanging") out.push({x:s.x, y:s.ceilY-2, w:s.w, h:2});
    for (const g of ghosts) out.push(g);
    return out;
}

// ---------- one frame of the world ----------

function update() {
    tick++;
    if (movePulse > 0) movePulse--;
    if (shove > 0) shove--;
    if (introTimer > 0) introTimer--;
    if (wipe > 0) { wipe *= 0.86; if (wipe < 0.02) wipe = 0; }
    stepDust(dust);
    if (screen !== "PLAY" || called || panelOpen()) return;

    const frozen = false;
    stepLasers(lasers, tick, frozen);
    stepMovers(movers, frozen);
    stepBullets(bullets);
    stepVanishers(vanishers, function (v) {
        return player.onGround && overlaps({x:player.x, y:player.y+2, w:player.w, h:player.h}, v);
    }, dust);

    const g = gravityDirection();
    const xBefore = player.x, yBefore = player.y, vxBefore = player.vx;
    const ground = solids();

    // ---- sideways ----
    let raw = 0;
    if (held("ArrowLeft", "a", "A"))  raw = -1;
    if (held("ArrowRight", "d", "D")) raw = 1;
    const dir = inputDirection(raw);

    player.vx += dir * acceleration();
    if (dir === 0) player.vx *= friction();
    if (Math.abs(player.vx) < 0.08) player.vx = 0;
    const cap = maxSpeed();
    player.vx = Math.max(-cap, Math.min(cap, player.vx));

    // the shove from a rock is not walking, so the walk cap never sees it.
    // it rides on top and bleeds off at 0.88 a frame, which is what turns a
    // knock of 22 into an actual 180px flight instead of a nudge.
    const knocked = Math.abs(player.knockVx) > 0.15;
    const step = player.vx + player.knockVx;
    player.knockVx *= 0.88;
    if (Math.abs(player.knockVx) < 0.15) player.knockVx = 0;

    let hitWall = false;
    player.x += step;
    for (const p of ground) {                      // snap flush, don't rewind
        if (isLedge(p)) continue;                  // ledges have no sides
        if (!overlaps(player, p)) continue;
        if (ghosts.includes(p)) p.seen = 90;
        player.x = step > 0 ? p.x - player.w : p.x + p.w;
        player.vx = 0; player.knockVx = 0; hitWall = true;
    }
    if (player.x < 0) { player.x = 0; player.vx = 0; player.knockVx = 0; hitWall = true; }
    if (player.x + player.w > canvas.width) {
        player.x = canvas.width - player.w; player.vx = 0; player.knockVx = 0; hitWall = true;
    }

    // three things make the direction reading a lie, so we say nothing:
    //  - a moving ledge carries you whether you asked or not
    //  - a shove sends you the other way while you hold the key, which looks
    //    exactly like inverted controls and isn't
    //  - leftover speed under MOMENTUM does the same, so only read it from a
    //    standstill, where nothing but the controls can be moving you
    //  - and rock: you can end a frame slightly inside a ledge's side, and
    //    pressing that way snaps you flush, which is a step BACKWARDS
    const onMover = movers.some(function (m) { return ridingMover(m); });
    const fromStandstill = vxBefore === 0;
    if (raw !== 0 && player.x !== xBefore && !onMover && !knocked && !hitWall && fromStandstill)
        logEvent(detectHorizontal(raw, xBefore, player.x));

    // let go of the key - did we stop, or keep sliding? a wall counts as
    // neither; running into rock zeroes your speed whatever the rule is.
    const noRead = knocked || hitWall;
    if (noRead) { framesSinceRelease = 0; wasMoving = false; peakVx = 0; }
    else if (raw === 0 && wasMoving) framesSinceRelease++;
    else if (raw !== 0) { framesSinceRelease = 0; wasMoving = true; }
    if (raw !== 0) peakVx = Math.max(peakVx, Math.abs(player.vx));

    // you have to have actually got going for "did you stop?" to mean
    // anything. tap left then right under MOMENTUM and your speed passes
    // clean through zero - let go on that frame and it reads as
    // STOPPED_PROMPTLY, which knocks out MOMENTUM while MOMENTUM is on.
    const reallyMoved = peakVx >= 1.5;
    if (!noRead && wasMoving && reallyMoved && raw === 0) {
        if (framesSinceRelease <= 6 && player.vx === 0) {
            logEvent("STOPPED_PROMPTLY"); wasMoving = false; peakVx = 0;
        } else if (framesSinceRelease > 6 && Math.abs(player.vx) > 0) {
            logEvent("KEPT_SLIDING"); wasMoving = false; peakVx = 0;
        }
    }
    if (raw === 0 && !wasMoving) peakVx = 0;

    // ---- up and down ----
    const wasOnGround = player.onGround;
    let jumped = false, pushed = false;
    if (held("ArrowUp", "w", "W") || keys[" "]) {
        if (player.onGround) {
            if (canJump()) { player.vy = -JUMP * g; player.onGround = false; pushed = true; }
            jumped = true;
        }
    }

    player.vy += GRAVITY * g;
    player.y += player.vy;

    const wasAir = !player.onGround;
    player.onGround = false;
    let landedPlat = null;
    for (const p of ground) {
        if (!overlaps(player, p)) continue;
        if (ghosts.includes(p)) p.seen = 90;

        // did we come down ONTO this, or bonk our head on it? "down" is
        // whichever way gravity points today. this used to set onGround
        // either way, so a jump into a shelf glued you to its underside and
        // you could jump again off thin air.
        const landed = (player.vy > 0) === (g > 0);
        if (!landed) {
            if (isLedge(p)) continue;              // ledges: pass straight up through
            player.y = player.vy > 0 ? p.y - player.h : p.y + p.h;
            player.vy = 0;
            continue;                              // solid rock: bonk, don't stand
        }
        // and you only land on a ledge you were ABOVE when the frame began,
        // or rising through one would snap you onto it halfway up.
        if (isLedge(p) && !wasClear(p, yBefore, g)) continue;

        player.y = player.vy > 0 ? p.y - player.h : p.y + p.h;
        player.vy = 0;
        player.onGround = true;
        landedPlat = p;
        armTrigger(p, true);
        if (p.dx) player.x += p.dx;                // ride the moving ledge
        if (p.dy) player.y += p.dy;
    }

    // a jump stopped dead by a ceiling looks identical to a jump that never
    // happened, and reporting that names NO_JUMP - which contradicts
    // whatever the real rule was. blocked evidence is no evidence.
    if (jumped && wasOnGround) {
        const reading = detectJump(true, yBefore, player.y);
        if (!(pushed && reading === "JUMP_NOTHING")) logEvent(reading);
    }

    if (player.onGround && wasAir && Math.abs(player.x - xBefore) > 0.5) {
        const shifted = platformsShift();
        if (shifted) shiftLedges(level);
        logEvent(shifted ? "LANDED_REARRANGED" : "LANDED_STABLE");
    }

    // ---- cheesy chase ----
    // stand on a hole that isn't part of the path and that's the run. no
    // warning, no second chance, straight back to the start.
    if (level.cheesed && landedPlat && landedPlat.safe) {
        // how far along the path you got. it never says WHICH hole, only how
        // many - enough to learn from, not enough to skip the learning.
        const step = level.platforms.filter(function (p) { return p.safe; }).indexOf(landedPlat) + 1;
        if (step > cheeseBest) cheeseBest = step;
    }
    if (level.cheesed && landedPlat && !landedPlat.safe) {
        deaths++;
        puffDust(dust, player.x + 12, player.y + 24, 14, "#FFDA5E", 3);
        goScreen("CHEESED");
        player.x = level.spawn.x; player.y = level.spawn.y;
        player.vx = 0; player.vy = 0; player.knockVx = 0;
        framesSinceRelease = 0; wasMoving = false;
        return;
    }

    // bullets. slow enough that you can choose to walk into one.
    for (const b of bullets) {
        if (!overlaps(player, b)) continue;
        if (bulletHurts()) { logEvent("BULLET_HURT"); respawn("a bullet"); }
        else { logEvent("BULLET_SHOVED"); player.knockVx = (b.vx > 0 ? 1 : -1) * 12; }
        break;
    }

    // falling rock. a hit never kills outright, it throws you. near an edge
    // that IS the kill, and standing near an edge was your idea.
    stepStalactites(stals, tick, canvas.height + 60, dust);
    for (const s of stals) {
        if (s.state !== "falling" || !overlaps(player, s)) continue;
        const away = (player.x + player.w/2) < (s.x + s.w/2) ? -1 : 1;
        player.knockVx = away * s.knock;
        player.vy = -5;
        player.onGround = false;                   // you get lifted, not planted
        s.state = "gone"; s.gone = 60;
        puffDust(dust, s.x + s.w/2, s.y + s.h/2, 14, "#C99A63", 3.4);
        shove = 14;
    }

    // lasers just kill. no rule touches them, so they're never evidence.
    for (const l of lasers) {
        if (l.on && overlaps(player, l)) { respawn("a laser"); return; }
    }

    // ---- the clock ----
    const moved = Math.abs(player.x - xBefore);
    walked += moved; realSecs += 1 / 60;
    elapsed += clockAdvance(1 / 60, moved);
    if (realSecs > 2.5) logEvent(detectTimer(elapsed, walked / 240, realSecs));

    // ---- doors and the drop ----
    if (level.trapDoor && overlaps(player, level.trapDoor)) {
        respawn("a door with nothing behind it"); return;
    }
    if (level.resetDoor && overlaps(player, level.resetDoor)) {
        deaths++; deathCause = "the wrong door";
        resetVanishers(vanishers); resetLedges(level); resetMovers(movers);
        player.x = level.spawn.x; player.y = level.spawn.y;
        player.vx = 0; player.vy = 0; player.knockVx = 0;
        framesSinceRelease = 0; wasMoving = false;
        goScreen("RESET");
        return;
    }

    // there's no floor in these arenas. killY sits at the top of the dark so
    // you die where you can see it happen, not silently off the bottom.
    const killLine = level.killY || canvas.height;
    if (player.y > killLine) { respawn("the drop"); return; }
    if (player.y + player.h < 0) { respawn("the dark above"); return; }

    if (overlaps(player, level.exit)) {
        if (isControlLevel()) { levelIndex++; newAttempt(); }   // straight on
        else goScreen("WON");
    }
}

// the two buttons on the score card. same jobs as the keys, but visible -
// "press enter" is not a thing a judge reads before pressing something.
function revealNext()  { if (screen === "REVEAL") nextLevel(); }
function revealAgain() { if (screen === "REVEAL") newAttempt(); }

// ui.js calls this when they pick a rule off the list
function submitCall(ruleId) {
    called = true;
    callMove = moves;
    wasRight = (ruleId === activeRule);
    const secs = Math.round(realSecs * 10) / 10;
    score = gapScore(getSufficiency(), callMove, wasRight, secs);
    recordRun({ player: playerName || "you",
                levelId: level.id, rule: activeRule, guess: ruleId, correct: wasRight,
                moves: callMove, sufficiency: getSufficiency(), score: score,
                seconds: secs, deaths: deaths });
    runTotal += score;
    runLog.push({ arena: level.name, rule: activeRule, correct: wasRight,
                  score: score, moves: callMove, secs: secs, par: level.parMoves || 0 });
    goScreen("REVEAL");
    showReveal(ruleId, activeRule, wasRight, score, getSufficiency(), callMove,
               bestFor(activeRule), secs,
               scoreBreakdown(getSufficiency(), callMove, wasRight, secs),
               level.parMoves || 0, runTotal, levelIndex + 1 >= LEVELS.length);
}

// six washes that mean nothing, on purpose. one per attempt, over whatever
// the arena looks like. you SEE the world shift the moment a new rule
// rolls, you just can't read WHICH rule from it.
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

// draw decides nothing. it reads the arena and the player and hands both to
// art.js. no camera transform either, so the coords in levels.js are screen
// coords - what you see is exactly what you collide with.
function draw() {
    const w = canvas.width, h = canvas.height;
    setTick(tick);
    if (screen === "TITLE") { drawTitle(w, h); paintWipe(w, h); return; }
    if (screen === "END")   { drawEnd(w, h);   paintWipe(w, h); return; }

    paintBackdrop(ctx, w, h, level);

    // a ledge only gets drawn if the rule picked it up and put it somewhere
    // else - and we cover the hole it came out of, or there'd be a ledge in
    // the picture you fall straight through.
    for (const p of level.platforms) {
        if (p.homeX === undefined || p.x === p.homeX) continue;
        paintShelfScar(ctx, p);
        paintCaveSlab(ctx, p);
    }

    // nothing is drawn for a safe hole. the traps get a whisper of shade.
    if (level.cheesed) {
        for (const p of level.platforms) if (!p.safe) paintCheeseTrap(ctx, p);
    }
    for (const v of vanishers) if (v.state !== "gone") paintGrassStep(ctx, v);
    for (const m of movers) paintCaveSlab(ctx, m);

    if (level.resetDoor) paintDoorGlow(ctx, level.resetDoor);
    if (level.trapDoor)  paintDoorGlow(ctx, level.trapDoor);
    paintDoorGlow(ctx, level.exit);

    drawHazards();
    paintPlayer(ctx, player, surfaceUnder(level, player.x + player.w / 2, player.y));
    paintDust(ctx, dust);
    if (level.killY) paintDeathLine(ctx, w, h, level.killY);

    // the attempt wash. "color" only touches hue and saturation and leaves
    // brightness alone, so the frame changes mood without a single ledge
    // edge getting harder to read.
    ctx.save();
    ctx.globalAlpha = 0.16; ctx.globalCompositeOperation = "color";
    ctx.fillStyle = attemptWash; ctx.fillRect(0, 0, w, h);
    ctx.restore();

    if (shove > 0) {
        ctx.fillStyle = "rgba(255,170,90," + (shove / 55).toFixed(3) + ")";
        ctx.fillRect(0, 0, w, h);
    }

    drawHud(w);
    if (introTimer > 0) drawArenaCard(w, h);
    if (tutorialStep >= 0 && screen === "PLAY") drawTutorial(w, h);

    if (screen === "DEAD")    drawBanner(w, h, "YOU DIED", deathCause + " got you", "#e8705a");
    if (screen === "CHEESED") {
        const total = level.platforms.filter(function (p) { return p.safe; }).length;
        drawBanner(w, h, "CHEESED",
                   "that hole was not the way  ·  you had " + cheeseBest + " of " + total,
                   "#f0b429");
    }
    if (screen === "RESET")   drawBanner(w, h, "WRONG DOOR", "back to the balcony with you", "#8E4BA0");
    if (screen === "WON" && !called) drawWin(w, h);
    paintWipe(w, h);
}

// every screen change fades in. cheap, and it stops the game feeling like
// it's snapping between slides.
function paintWipe(w, h) {
    if (wipe <= 0) return;
    ctx.fillStyle = "rgba(6,8,12," + wipe.toFixed(3) + ")";
    ctx.fillRect(0, 0, w, h);
}

function drawHazards() {
    for (const g of ghosts) {                       // only there once you've hit it
        if (g.seen <= 0) continue;
        g.seen--;
        ctx.globalAlpha = Math.min(0.5, g.seen / 90);
        ctx.fillStyle = "#9fd8ff"; rrect(g.x, g.y, g.w, g.h, 3);
        ctx.globalAlpha = 1;
    }
    for (const s of stals) {
        if (s.state !== "gone" || s.fade > 0) paintStalactite(ctx, s);
    }
    for (const l of lasers) {
        if (l.on) {
            ctx.fillStyle = "rgba(255,60,60,.22)"; ctx.fillRect(l.x - 5, l.y, l.w + 10, l.h);
            ctx.fillStyle = "#ff4d4d"; ctx.fillRect(l.x, l.y, l.w, l.h);
        } else {
            ctx.fillStyle = "rgba(255,80,80,.16)"; ctx.fillRect(l.x + l.w/2 - 1, l.y, 2, l.h);
        }
    }
    for (const b of bullets) {                      // red-white, never yellow
        const cx = b.x + b.w/2, cy = b.y + b.h/2;
        ctx.fillStyle = "rgba(230,60,50,.28)"; ctx.beginPath(); ctx.arc(cx, cy, b.w, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = "#e63c32"; ctx.beginPath(); ctx.arc(cx, cy, b.w/2 + 1, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = "#ffe9e6"; ctx.beginPath(); ctx.arc(cx-1.5, cy-1.5, 2.4, 0, Math.PI*2); ctx.fill();
    }
}

// an actual clock face. counts UP, because a leaderboard wants "solved in
// 8.4s" and a countdown can't give you that. under the timer rule the hand
// only moves when you do, and a hand that freezes while you stand still is
// far easier to notice than a bar draining slightly slower.
function drawClock(cx, cy, r, seconds) {
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2);
    ctx.fillStyle = "#0e1116"; ctx.fill();
    ctx.strokeStyle = "#3a4250"; ctx.lineWidth = 1.5; ctx.stroke();
    for (let i = 0; i < 12; i++) {
        const a = i * Math.PI / 6;
        ctx.strokeStyle = i % 3 === 0 ? "#8b93a3" : "#3a4250";
        ctx.lineWidth = i % 3 === 0 ? 1.6 : 1;
        ctx.beginPath();
        ctx.moveTo(cx + Math.sin(a)*(r-2), cy - Math.cos(a)*(r-2));
        ctx.lineTo(cx + Math.sin(a)*(r-5), cy - Math.cos(a)*(r-5));
        ctx.stroke();
    }
    const a = (seconds % 60) / 60 * Math.PI * 2;
    ctx.strokeStyle = "#f5c542"; ctx.lineWidth = 2; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.sin(a)*(r-6), cy - Math.cos(a)*(r-6)); ctx.stroke();
    const am = (seconds / 3600) * Math.PI * 2;
    ctx.strokeStyle = "#9aa3b2"; ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.sin(am)*(r-11), cy - Math.cos(am)*(r-11)); ctx.stroke();
    ctx.fillStyle = "#f5c542"; ctx.beginPath(); ctx.arc(cx, cy, 2, 0, Math.PI*2); ctx.fill();
    ctx.lineCap = "butt";
}

// HUD strip up top so text never sits on the play area.
//
// note what is NOT here: your best for the current rule. it used to be, and
// it handed the answer over - see the same number twice and you know you're
// on the same rule. it lives on the reveal screen now.
function drawHud(w) {
    // 34px, not 46. grassy falls has a door painted right up in the top
    // left corner and a fat bar swallowed it whole.
    const H = 34;

    // the bar parts around any door painted at the very top of the frame.
    // stamping the door back over the bar left a visible square seam; a
    // notch reads as deliberate and shows the whole door.
    const notches = [];
    for (const d of [level.exit, level.trapDoor, level.resetDoor]) {
        if (d && d.y < H + 6) notches.push([d.x - 10, d.x + d.w + 10]);
    }
    notches.sort(function (a, b) { return a[0] - b[0]; });

    const grd = ctx.createLinearGradient(0, 0, 0, H);
    grd.addColorStop(0, "rgba(9,11,16,0.92)");
    grd.addColorStop(1, "rgba(9,11,16,0.62)");
    function barPiece(x, wide) {
        if (wide <= 0) return;
        ctx.fillStyle = grd; ctx.fillRect(x, 0, wide, H);
        ctx.fillStyle = "rgba(245,197,66,0.3)"; ctx.fillRect(x, H - 1, wide, 1);
    }
    let cut = 0;
    for (const n of notches) { barPiece(cut, n[0] - cut); cut = Math.max(cut, n[1]); }
    barPiece(cut, w - cut);

    drawClock(24, 17, 12, elapsed);
    ctx.fillStyle = "#eef1f6"; ctx.font = uiFont("700 13px");
    ctx.fillText(elapsed.toFixed(1) + "s", 42, 22);

    ctx.fillStyle = movePulse > 0 ? "#ffffff" : "#f5c542";
    ctx.font = uiFont("700 15px");
    ctx.fillText(String(moves), 104, 22);
    ctx.fillStyle = "#8d96a6"; ctx.font = uiFont("500 12px");
    ctx.fillText("moves", 104 + ctx.measureText(String(moves)).width + 12, 22);
    if (level.parMoves) {
        ctx.fillStyle = "#5f6878"; ctx.font = uiFont("500 11px");
        ctx.fillText("par " + level.parMoves,
                     104 + ctx.measureText(String(moves)).width + 60, 22);
    }

    // the arena name starts past x350 on purpose - see the door punch below
    ctx.fillStyle = "#6c7688"; ctx.font = uiFont("600 11px");
    ctx.fillText((levelIndex + 1) + " / " + LEVELS.length, 352, 22);
    ctx.fillStyle = "#eef1f6"; ctx.font = titleFont("600 15px");
    ctx.fillText(level.name, 384, 22);
    if (deaths > 0) {
        ctx.fillStyle = "#e8705a"; ctx.font = uiFont("500 12px");
        ctx.fillText(deaths + (deaths === 1 ? " death" : " deaths"),
                     394 + ctx.measureText(level.name).width, 22);
    }

    // pinned to the right edge so it lands sensibly whatever the canvas is
    ctx.fillStyle = "#6c7688"; ctx.font = uiFont("500 12px");
    const hint = "← → / A D move   SPACE jump   C fundamentals   Q new rule   R reset";
    ctx.fillText(hint, w - ctx.measureText(hint).width - 22, 22);

    // and the shimmer goes on last, so a door in a notch still breathes
    for (const d of [level.exit, level.trapDoor, level.resetDoor]) {
        if (d && d.y < H + 6) paintDoorGlow(ctx, d);
    }
}

// the arena's name, for a couple of seconds, on the way in. it's the thing
// that makes moving between arenas feel like moving between arenas.
function drawArenaCard(w, h) {
    const a = introTimer > 110 ? (150 - introTimer) / 40 : Math.min(1, introTimer / 45);
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, a));
    ctx.textAlign = "center";
    const band = ctx.createLinearGradient(0, h * 0.34, 0, h * 0.34 + 118);
    band.addColorStop(0,   "rgba(8,10,15,0.15)");
    band.addColorStop(0.5, "rgba(8,10,15,0.78)");
    band.addColorStop(1,   "rgba(8,10,15,0.15)");
    ctx.fillStyle = band;
    ctx.fillRect(0, h * 0.34, w, 118);
    ctx.fillStyle = "#f5c542"; ctx.font = uiFont("600 12px");
    ctx.fillText("ARENA " + (levelIndex + 1), w / 2, h * 0.34 + 34);
    ctx.fillStyle = "#ffffff"; ctx.font = titleFont("700 40px");
    ctx.fillText(level.name, w / 2, h * 0.34 + 78);
    ctx.fillStyle = "#b9c1cf"; ctx.font = uiFont("400 14px");
    ctx.fillText(level.blurb || "", w / 2, h * 0.34 + 104);
    if (level.parMoves) {
        ctx.fillStyle = "#7c869a"; ctx.font = uiFont("500 12px");
        ctx.fillText("a clean run takes about " + level.parMoves + " moves",
                     w / 2, h * 0.34 + 126);
    }
    ctx.textAlign = "left";
    ctx.restore();
}

// one banner for died / cheesed / wrong door. same shape every time, so
// after the first one you know what you're looking at without reading it.
function drawBanner(w, h, title, sub, colour) {
    ctx.fillStyle = "rgba(10,7,10,0.86)"; ctx.fillRect(0, 0, w, h);
    ctx.textAlign = "center";
    const cy = h * 0.42;
    const pulse = 0.78 + Math.sin(tick * 0.08) * 0.22;
    ctx.globalAlpha = pulse;
    ctx.fillStyle = colour; ctx.font = titleFont("700 62px");
    ctx.fillText(title, w/2, cy);
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#c9b6b2"; ctx.font = uiFont("400 16px");
    ctx.fillText(sub, w/2, cy + 34);

    ctx.fillStyle = "#333b48"; ctx.fillRect(w/2 - 160, cy + 60, 320, 1);
    ctx.fillStyle = "#8d96a6"; ctx.font = uiFont("500 13px");
    ctx.fillText(deaths + " so far  ·  " + moves + " moves  ·  " + elapsed.toFixed(1) + "s", w/2, cy + 84);
    ctx.fillStyle = "#7fd39a"; ctx.font = uiFont("600 14px");
    ctx.fillText("The rule hasn't changed. Everything you worked out still counts.", w/2, cy + 112);
    ctx.fillStyle = "#eef1f6"; ctx.font = uiFont("600 15px");
    ctx.fillText("SPACE to go again", w/2, cy + 150);
    ctx.textAlign = "left";
}

function drawWin(w, h) {
    ctx.fillStyle = "rgba(10,12,18,0.88)"; ctx.fillRect(0, 0, w, h);
    ctx.textAlign = "center";
    const cy = h * 0.42;
    ctx.fillStyle = "#7fd39a"; ctx.font = uiFont("600 14px");
    ctx.fillText("YOU REACHED THE DOOR", w/2, cy - 58);
    ctx.fillStyle = "#f5c542"; ctx.font = titleFont("700 44px");
    ctx.fillText("So what was the rule?", w/2, cy);
    ctx.fillStyle = "#8d96a6"; ctx.font = uiFont("400 14px");
    ctx.fillText(moves + " moves  ·  " + elapsed.toFixed(1) + "s  ·  " + deaths + " deaths", w/2, cy + 36);
    ctx.fillStyle = "#eef1f6"; ctx.font = uiFont("600 15px");
    ctx.fillText("Press ENTER to call it", w/2, cy + 80);
    ctx.textAlign = "left";
}

// title screen, drawn in code so it can't fail to load
function drawTitle(w, h) {
    const grd = ctx.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, "#1B1F26"); grd.addColorStop(1, "#0d1015");
    ctx.fillStyle = grd; ctx.fillRect(0, 0, w, h);

    const cols = ["#2D5276","#BD4B29","#2E603D","#C9A227","#C9829B","#45C7D6","#A495C6"];
    const word = "MISRULE";
    ctx.textAlign = "center"; ctx.font = titleFont("700 82px");
    let total = 0;
    for (const ch of word) total += ctx.measureText(ch).width + 8;
    let x = w/2 - total/2;
    for (let i = 0; i < word.length; i++) {
        const cw = ctx.measureText(word[i]).width;
        const bob = Math.sin(tick * 0.04 + i * 0.7) * 4;
        ctx.fillStyle = cols[i];
        ctx.fillText(word[i], x + cw/2, h * 0.30 + bob);
        x += cw + 8;
    }
    ctx.fillStyle = "#9aa3b2"; ctx.font = uiFont("400 16px");
    ctx.fillText("Every attempt hides a different law of physics.", w/2, h * 0.40);
    ctx.fillText("Work out which one.", w/2, h * 0.44);

    // the name box. nothing is stored anywhere - it's here so the end
    // screen has someone to congratulate.
    ctx.fillStyle = "#6c7688"; ctx.font = uiFont("600 11px");
    ctx.fillText("WHO'S PLAYING?", w/2, h * 0.55);
    const bw = 320, bx = w/2 - bw/2, by = h * 0.575;
    ctx.fillStyle = "#161a23"; rrect(bx, by, bw, 44, 10);
    ctx.strokeStyle = "#3a4250"; ctx.lineWidth = 1.5; ctx.strokeRect(bx, by, bw, 44);
    const shown = playerName || "";
    ctx.fillStyle = playerName ? "#eef1f6" : "#4d5666";
    ctx.font = uiFont("600 18px");
    const caret = Math.floor(tick / 30) % 2 ? "|" : " ";
    ctx.fillText(shown ? shown + caret : "type your name" + caret, w/2, by + 29);

    ctx.fillStyle = "#2FCAD0"; ctx.font = uiFont("700 15px");
    ctx.fillText("PRESS ENTER TO START", w/2, h * 0.72);
    ctx.fillStyle = "#5c6675"; ctx.font = uiFont("500 12px");
    ctx.fillText("← → / A D move    SPACE jump    C fundamentals    Q new rule    R reset",
                 w/2, h * 0.78);
    ctx.textAlign = "left";
}

// the end of a run. two columns: what you just did on the left, the best
// runs anyone's had on this machine on the right.
//
// the leaderboard was invisible before, and not because it was small - the
// score card was still sitting on top of it. goScreen() puts the overlays
// away now.
function drawEnd(w, h) {
    const grd = ctx.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, "#171b22"); grd.addColorStop(1, "#0b0e13");
    ctx.fillStyle = grd; ctx.fillRect(0, 0, w, h);
    ctx.textAlign = "center";

    ctx.fillStyle = "#6c7688"; ctx.font = uiFont("600 12px");
    ctx.fillText("RUN COMPLETE", w/2, 52);
    ctx.fillStyle = "#eef1f6"; ctx.font = titleFont("700 34px");
    ctx.fillText(playerName || "Nameless", w/2, 92);
    ctx.fillStyle = "#f5c542"; ctx.font = uiFont("700 52px");
    ctx.fillText(String(runTotal), w/2, 148);
    ctx.fillStyle = "#8d96a6"; ctx.font = uiFont("500 11px");
    ctx.fillText("POINTS THIS RUN", w/2, 168);

    const midX = w / 2;
    ctx.fillStyle = "#2b3240"; ctx.fillRect(midX, 200, 1, 300);

    // ---- left: this run, arena by arena ----
    const lx = midX - 460, top = 226, rowH = 32;
    ctx.textAlign = "left";
    ctx.fillStyle = "#6c7688"; ctx.font = uiFont("600 11px");
    ctx.fillText("THIS RUN", lx, top - 18);
    if (!runLog.length) {
        ctx.fillStyle = "#8d96a6"; ctx.font = uiFont("400 13px");
        ctx.fillText("You never called a rule. That's a zero.", lx, top + 6);
    }
    for (let i = 0; i < runLog.length; i++) {
        const r = runLog[i], y = top + i * rowH;
        ctx.fillStyle = r.correct ? "#7fd39a" : "#e8705a";
        ctx.font = uiFont("600 14px");
        ctx.fillText(r.correct ? "✓" : "✗", lx, y);
        ctx.fillStyle = "#eef1f6"; ctx.font = uiFont("500 14px");
        ctx.fillText(r.arena, lx + 22, y);
        ctx.fillStyle = "#7c869a"; ctx.font = uiFont("400 12px");
        ctx.fillText(r.moves + " moves" + (r.par ? " / par " + r.par : "") + "   " + r.secs + "s",
                     lx + 22, y + 15);
        ctx.textAlign = "right";
        ctx.fillStyle = r.correct ? "#f5c542" : "#5f6878"; ctx.font = uiFont("600 15px");
        ctx.fillText(String(r.score), midX - 40, y + 4);
        ctx.textAlign = "left";
    }

    // ---- right: the leaderboard, straight out of runs.js ----
    const rx = midX + 44;
    ctx.fillStyle = "#6c7688"; ctx.font = uiFont("600 11px");
    ctx.fillText("BEST CALLS ON THIS MACHINE", rx, top - 18);
    const board = (typeof leaderboard === "function") ? leaderboard(6) : [];
    if (!board.length) {
        ctx.fillStyle = "#8d96a6"; ctx.font = uiFont("400 13px");
        ctx.fillText("Nothing yet. Get one right.", rx, top + 6);
    }
    for (let i = 0; i < board.length; i++) {
        const r = board[i], y = top + i * rowH;
        const mine = r.player === (playerName || "you");
        ctx.fillStyle = "#5f6878"; ctx.font = uiFont("600 12px");
        ctx.fillText(String(i + 1), rx, y);
        ctx.fillStyle = mine ? "#f5c542" : "#eef1f6"; ctx.font = uiFont("500 14px");
        ctx.fillText(r.player || "you", rx + 24, y);
        ctx.fillStyle = "#7c869a"; ctx.font = uiFont("400 12px");
        const nm = (LEVELS.find(function (L) { return L.id === r.levelId; }) || {}).name || "";
        ctx.fillText(nm + "   " + r.moves + " moves", rx + 24, y + 15);
        ctx.textAlign = "right";
        ctx.fillStyle = "#f5c542"; ctx.font = uiFont("600 15px");
        ctx.fillText(String(r.score), midX + 460, y + 4);
        ctx.textAlign = "left";
    }

    // ---- the two ways out ----
    ctx.textAlign = "center";
    const by = h - 54;
    ctx.fillStyle = "#333b48"; ctx.fillRect(w/2 - 420, by - 30, 840, 1);
    ctx.fillStyle = "#2FCAD0"; ctx.font = uiFont("700 15px");
    ctx.fillText("R   play the whole thing again", w/2 - 150, by);
    ctx.fillStyle = "#9aa3b2";
    ctx.fillText("T   back to the title", w/2 + 170, by);
    ctx.textAlign = "left";
}

// ---------- tutorial ----------
//
// six cards, each with a line pointing at the exact thing it's talking
// about. only ever runs on the first cave. any key or click moves it on, so
// people who know the game skip it in six taps and people who don't get
// told what the clock, the rock and the call panel are for BEFORE they need
// them.
//
// at[] is the point the line touches. from[] is where the box wants to sit;
// it gets clamped, so a card can never end up half off the edge.
const TUTORIAL = [
    { text: "This is you, stood on the clock tower. Arrows or A/D move, SPACE jumps.",
      at: [640, 296],  from: [600, 400] },
    { text: "Rock hangs off the roof. It rattles and glows before it drops - that's your only warning.",
      at: [509, 100],  from: [380, 168] },
    { text: "Getting hit doesn't kill you, it throws you. Near an edge that's the same thing.",
      at: [724, 310],  from: [880, 372] },
    { text: "There is no floor. Everything below the dark line is a death.",
      at: [640, 552],  from: [520, 430] },
    { text: "This clock counts up. Your time and your moves are both part of your score.",
      at: [28, 23],    from: [150, 74] },
    { text: "The gate is the way out. Reach it, press ENTER, and name what was different about the physics.",
      at: [1051, 281], from: [880, 186] }
];

function nextTutorial() {
    if (tutorialStep < 0) return false;
    tutorialStep++;
    if (tutorialStep >= TUTORIAL.length) tutorialStep = -1;
    return true;
}

function drawTutorial(w, h) {
    const step = TUTORIAL[tutorialStep];
    if (!step) return;
    const bw = 300, bh = 104;
    let bx = Math.max(12, Math.min(w - bw - 12, step.from[0] - bw / 2));
    let by = Math.max(56, Math.min(h - bh - 12, step.from[1]));

    ctx.strokeStyle = "#f5c542"; ctx.lineWidth = 2;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(bx + bw / 2, by + bh / 2);
    ctx.lineTo(step.at[0], step.at[1]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#f5c542";
    ctx.beginPath(); ctx.arc(step.at[0], step.at[1], 7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#0f1116";
    ctx.beginPath(); ctx.arc(step.at[0], step.at[1], 3.5, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = "rgba(13,16,22,0.96)"; rrect(bx, by, bw, bh, 10);
    ctx.strokeStyle = "#f5c542"; ctx.lineWidth = 1.5; ctx.strokeRect(bx, by, bw, bh);

    ctx.fillStyle = "#f5c542"; ctx.font = uiFont("700 10px");
    ctx.fillText((tutorialStep + 1) + " / " + TUTORIAL.length, bx + 14, by + 20);
    ctx.fillStyle = "#eef1f6"; ctx.font = uiFont("400 13px");
    wrapText(step.text, bx + 14, by + 38, bw - 28, 17);
    ctx.fillStyle = "#6c7688"; ctx.font = uiFont("500 10px");
    ctx.fillText("any key to continue", bx + 14, by + bh - 10);
}

// canvas has no word wrap, so here's one. splits on spaces and measures.
function wrapText(text, x, y, maxW, lh) {
    const words = text.split(" ");
    let line = "";
    for (const word of words) {
        const test = line ? line + " " + word : word;
        if (ctx.measureText(test).width > maxW && line) {
            ctx.fillText(line, x, y); y += lh; line = word;
        } else line = test;
    }
    ctx.fillText(line, x, y);
}

// fixed step. one update, one draw, forever.
function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
}
