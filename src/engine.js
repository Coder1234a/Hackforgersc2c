// engine.js — chunk 3: the real arena, and one secret rule applying.

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const GRAVITY = 0.5;
const SPEED   = 4;
const JUMP    = 11;

const level = LEVELS[0];
activeRule = rollRule(level.safeRules);   // secretly chosen, never shown
console.log("(debug) the rule this attempt is:", activeRule);

const player = { x: level.spawn.x, y: level.spawn.y, w: 24, h: 24, vx: 0, vy: 0, onGround: false };

// Which keys are held right now. Held keys fire unevenly, so we record
// the state and read it every frame instead of acting on the event.
const keys = {};
document.addEventListener("keydown", function (e) { keys[e.key] = true;  });
document.addEventListener("keyup",   function (e) { keys[e.key] = false; });

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
    for (const p of level.platforms) {          // undo sideways moves into walls
        if (overlaps(player, p)) player.x = player.x - player.vx;
    }

    // Jump pushes you AWAY from whatever surface you're standing on.
    if (keys["ArrowUp"] && player.onGround) {
        player.vy = -JUMP * g;
        player.onGround = false;
    }

    player.vy = player.vy + GRAVITY * g;
    player.y = player.y + player.vy;

    player.onGround = false;
    for (const p of level.platforms) {
        if (!overlaps(player, p)) continue;
        if (player.vy > 0) player.y = p.y - player.h;        // moving down: land on top
        else               player.y = p.y + p.h;             // moving up: land underneath
        player.vy = 0;
        player.onGround = true;
    }
}

// Paints the current state. Knows nothing about rules or physics.
function draw() {
    ctx.fillStyle = "#5B6B68";                       // neutral attempt tint
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#2b2f38";
    for (const p of level.platforms) ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.fillStyle = "#8ad6a0";
    ctx.fillRect(level.exit.x, level.exit.y, level.exit.w, level.exit.h);
    ctx.fillStyle = "#f5c542";
    ctx.fillRect(player.x, player.y, player.w, player.h);
}

function loop() { update(); draw(); requestAnimationFrame(loop); }
loop();
