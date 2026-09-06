// engine.js — chunk 1: a box that falls and lands.

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const GRAVITY = 0.5;   // added to vertical speed every frame
const FLOOR_Y = 380;   // top edge of the floor

// Everything about the player lives here. Rules will change these numbers.
const player = { x: 100, y: 50, w: 24, h: 24, vy: 0 };

// Moves the world forward one frame. Rules only ever touch this function.
function update() {
    player.vy = player.vy + GRAVITY;
    player.y = player.y + player.vy;

    // On a canvas y grows downward, so "below the floor" is a BIGGER y.
    if (player.y + player.h > FLOOR_Y) {
        player.y = FLOOR_Y - player.h;
        player.vy = 0;
    }
}

// Paints the current state. Knows nothing about rules or physics.
function draw() {
    ctx.fillStyle = "#14161c";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#333845";
    ctx.fillRect(0, FLOOR_Y, canvas.width, 70);
    ctx.fillStyle = "#f5c542";
    ctx.fillRect(player.x, player.y, player.w, player.h);
}

// Runs update then draw about 60 times a second, forever.
function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
}

loop();
