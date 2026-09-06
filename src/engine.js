// engine.js — canvas, loop, player, collision, win check.
// Heads up: on a canvas y grows DOWNWARD. Smaller y = higher up the
// screen. Trips up literally everyone once, so it's worth saying twice.

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const GRAVITY  = 0.5;
const MAX_SPEED = 4;
const JUMP     = 11;

const level = LEVELS[0];
const player = { x: 0, y: 0, w: 24, h: 24, vx: 0, vy: 0, onGround: false };

let won = false;
let moves = 0;      // deliberate actions, not frames. this is the score.

// Drop the player back at the start. Same rule stays active - dying
// shouldn't wipe out what you've already figured out.
function respawn() {
    player.x = level.spawn.x;
    player.y = level.spawn.y;
    player.vx = 0;
    player.vy = 0;
    won = false;
}

// Fresh go, brand new secret rule.
function newAttempt() {
    activeRule = rollRule(level.safeRules);
    moves = 0;
    console.log("(debug) rule this attempt:", activeRule);
    respawn();
}

// Which keys are held down right now. We store the state instead of
// reacting to the event, because a held key fires once, pauses, then
// machine-guns. Reading a flag every frame keeps movement smooth.
const keys = {};
document.addEventListener("keydown", function (e) {
    if (!keys[e.key]) moves++;              // first press only, not the repeat
    keys[e.key] = true;
    if (e.key === "r" || e.key === "R") respawn();
    if (e.key === "n" || e.key === "N") newAttempt();
});
document.addEventListener("keyup", function (e) { keys[e.key] = false; });

// Bog-standard box overlap check. Every collision in the game uses this.
function overlaps(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x &&
           a.y < b.y + b.h && a.y + a.h > b.y;
}

// One frame of the world. Rules only ever reach in through this.
function update() {
    if (won) return;                        // freeze everything on the win screen

    const g = gravityDirection();

    // --- sideways ---
    let dir = 0;
    if (keys["ArrowLeft"])  dir = -1;
    if (keys["ArrowRight"]) dir = 1;
    dir = inputDirection(dir);              // might come back flipped

    player.vx += dir * acceleration();
    if (dir === 0) player.vx *= friction();               // coast or stop dead
    if (Math.abs(player.vx) < 0.05) player.vx = 0;
    player.vx = Math.max(-MAX_SPEED, Math.min(MAX_SPEED, player.vx));

    player.x += player.vx;
    for (const p of level.platforms) {
        if (overlaps(player, p)) { player.x -= player.vx; player.vx = 0; }
    }
    if (player.x < 0) { player.x = 0; player.vx = 0; }
    if (player.x + player.w > canvas.width) { player.x = canvas.width - player.w; player.vx = 0; }

    // --- up and down ---
    if (keys["ArrowUp"] && player.onGround && canJump()) {
        player.vy = -JUMP * g;              // push AWAY from whatever you're stood on
        player.onGround = false;
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

    // Off the top or bottom of the world? Back to the start.
    if (player.y > canvas.height || player.y + player.h < 0) respawn();

    // Made it to the exit.
    if (overlaps(player, level.exit)) won = true;
}

// Paints whatever's currently true. Knows nothing about rules.
function draw() {
    ctx.fillStyle = "#5B6B68";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "#2b2f38";
    for (const p of level.platforms) ctx.fillRect(p.x, p.y, p.w, p.h);

    ctx.fillStyle = won ? "#b6f5c8" : "#8ad6a0";
    ctx.fillRect(level.exit.x, level.exit.y, level.exit.w, level.exit.h);

    ctx.fillStyle = "#f5c542";
    ctx.fillRect(player.x, player.y, player.w, player.h);

    ctx.fillStyle = "#e8eaf0";
    ctx.font = "13px system-ui, sans-serif";
    ctx.fillText("← → move    ↑ jump    R retry    N new rule", 14, 24);
    ctx.fillText("moves: " + moves, 14, 44);

    if (won) {
        ctx.fillStyle = "rgba(10,12,16,0.78)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "#b6f5c8";
        ctx.font = "bold 34px system-ui, sans-serif";
        ctx.fillText("You reached the exit", 200, 200);
        ctx.fillStyle = "#e8eaf0";
        ctx.font = "16px system-ui, sans-serif";
        ctx.fillText("Took you " + moves + " moves. Now - what was the rule?", 200, 234);
        ctx.fillText("Press N for a new rule", 200, 262);
    }
}

function loop() { update(); draw(); requestAnimationFrame(loop); }

newAttempt();
loop();
