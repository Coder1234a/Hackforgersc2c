// engine.js — chunk 3: the real arena, one secret rule, and a full attempt loop.

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const GRAVITY = 0.5;
const SPEED   = 4;
const JUMP    = 11;

const level = LEVELS[0];
const player = { x: 0, y: 0, w: 24, h: 24, vx: 0, vy: 0, onGround: false };

// Puts the player back at the spawn point. Used at the start of an
// attempt and every time they fall out of the world.
function respawn() {
    player.x = level.spawn.x;
    player.y = level.spawn.y;
    player.vx = 0;
    player.vy = 0;
}

// Starts a fresh attempt with a NEW secret rule.
function newAttempt() {
    activeRule = rollRule(level.safeRules);
    console.log("(debug) rule this attempt:", activeRule);
    respawn();
}

// Which keys are held right now. Held keys fire unevenly, so we record
// the state and read it every frame instead of acting on the event.
const keys = {};
document.addEventListener("keydown", function (e) {
    keys[e.key] = true;
    if (e.key === "r" || e.key === "R") respawn();      // retry, same rule
    if (e.key === "n" || e.key === "N") newAttempt();   // new rule
});
document.addEventListener("keyup", function (e) { keys[e.key] = false; });

// Do two rectangles overlap? Used for every collision in the game.
function overlaps(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x &&
           a.y < b.y + b.h && a.y + a.h > b.y;
}

// Moves the world forward one frame. This is the only function a rule touches.
function update() {
    const g = gravityDirection();   // +1 normal, -1 reversed

    player.vx = 0;
    if (keys["ArrowLeft"])  player.vx = -SPEED;
    if (keys["ArrowRight"]) player.vx = SPEED;
    player.x = player.x + player.vx;

    for (const p of level.platforms) {              // walked into a wall: undo it
        if (overlaps(player, p)) player.x = player.x - player.vx;
    }

    // Keep the player inside the canvas so they can't walk off the side.
    if (player.x < 0) player.x = 0;
    if (player.x + player.w > canvas.width) player.x = canvas.width - player.w;

    if (keys["ArrowUp"] && player.onGround) {       // jump pushes AWAY from the surface
        player.vy = -JUMP * g;
        player.onGround = false;
    }

    player.vy = player.vy + GRAVITY * g;
    player.y = player.y + player.vy;

    player.onGround = false;
    for (const p of level.platforms) {
        if (!overlaps(player, p)) continue;
        if (player.vy > 0) player.y = p.y - player.h;   // moving down: land on top
        else               player.y = p.y + p.h;        // moving up: land underneath
        player.vy = 0;
        player.onGround = true;
    }

    // Fell out of the world, either way up. Same rule is kept on respawn.
    if (player.y > canvas.height || player.y + player.h < 0) respawn();
}

// Paints the current state. Knows nothing about rules or physics.
function draw() {
    ctx.fillStyle = "#5B6B68";                      // neutral attempt tint
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#2b2f38";
    for (const p of level.platforms) ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.fillStyle = "#8ad6a0";
    ctx.fillRect(level.exit.x, level.exit.y, level.exit.w, level.exit.h);
    ctx.fillStyle = "#f5c542";
    ctx.fillRect(player.x, player.y, player.w, player.h);

    ctx.fillStyle = "#d8dde6";                      // on-screen controls reminder
    ctx.font = "13px system-ui, sans-serif";
    ctx.fillText("← → move    ↑ jump    R retry    N new rule", 14, 24);
}

function loop() { update(); draw(); requestAnimationFrame(loop); }

newAttempt();
loop();
