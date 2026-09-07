# Misrule

**Every attempt hides a different law of physics. Work out which one.**

Built at Code2Create 7.0 by **Hackforgers** — Anikeit Agarwal, Anvita, Vidhu,
Aarish and Shruti.

Play it: open `index.html`. That's the whole install. No build, no npm, no
server, no backend. It runs with the wifi off.

---

## The idea

It looks like a platformer. It isn't — it's a deduction game wearing a
platformer's coat.

Every time you enter an arena, the game secretly picks one of eight
**fundamentals** and rewrites the physics with it. Gravity might be upside
down. Your controls might be mirrored. You might slide like you're on ice.
Time might only pass when you move.

Nothing tells you which. You find out by *doing things and watching what
happens* — press right and see which way you go, jump and see where you land,
stand perfectly still and see whether the clock keeps ticking. Then you press
**C**, name the fundamental, and the score is what your certainty cost you.

Call it late and you've wasted moves. Call it early and you were guessing — a
correct guess made before the evidence could possibly have told you is worth a
quarter. The game tracks the exact move at which the answer became *knowable*,
and scores you against that.

## The eight fundamentals

| | |
|---|---|
| Nothing | normal physics. Working *that* out is its own puzzle. |
| Reverse Gravity | you fall up |
| Inverted Controls | left is right |
| No Jumping | you never leave the floor |
| Momentum Matters | you accelerate slowly and skid to a stop |
| Bullets Push You | they shove instead of killing |
| Shifting Platforms | the ledges rearrange every time you land |
| Movement Costs Time | the clock only advances when you do |

Each arena only rolls the ones it can physically survive. The call panel shows
all eight anyway, with the rest greyed out — you should be able to see the
whole rule book from your first level, but you shouldn't be able to waste a
call on a rule that was never in play.

## The arenas

1. **Dripstone** — the control run. Nothing is hidden. It teaches you the cave,
   the falling rock and the fact that there is no floor. You can only notice a
   difference you were shown first.
2. **Cheesy Chase** — the holes in the cheese are the platforms. Seven hold.
   The rest cheese you and send you back to the start. The traps are shaded
   about ΔE 1.8 darker than the safe ones: enough to spot if you look straight
   at one, not enough to read the level from across the room.
3. **Grassy Falls** — every grass step gives way three quarters of a second
   after you touch it. Three identical doors: top right is out, bottom right is
   painted onto nothing, top left throws you back to the balcony.
4. **Dripstone, again** — the same cave as arena one, with one law of physics
   changed. That contrast is the whole game.

## Controls

| | |
|---|---|
| ← → or A D | move |
| SPACE, W or ↑ | jump |
| **C** | open the fundamentals and make your call |
| **Q** | roll a new rule on this arena |
| **R** | back to the spawn |
| ENTER | continue / lock your answer in |
| F | fullscreen |

## How it's put together

Four layers that don't know about each other:

- `src/levels.js` — **where** things are. Pure data, no logic. Every ledge was
  measured off the artwork pixel by pixel.
- `src/rules.js` — **how physics behaves**. The only file that knows what a
  fundamental does. The engine never assumes; it asks in here every frame.
- `src/art.js` + `src/art-*.js` — **what it looks like**. The arenas are the
  original paintings, baked in as data URLs. Anything that MOVES was rubbed
  out of the picture so the engine can own it.
- `src/engine.js` — asks all three. Never decides anything itself.

`src/evidence.js` holds the table that maps 13 observable events to the rules
they eliminate. `src/detect.js` turns frames into those events. Keeping those
apart is why a new arena needs no new deduction code.

## Checking it

```
node tools/routes.js      # is every arena finishable? under grip AND momentum?
node tools/par.js         # how many moves does a clean run take? (measured)
node tools/playbot.js     # replay those routes under every rule the arena rolls
node tools/flowcheck.js   # win -> call -> score card -> next arena -> end screen
```
and open `tests.html` in a browser for 175 unit tests.

`tools/routes.js` runs the engine's real collision rules and BFS's a path, so
an arena can't ship unreachable. It also proves the cheese's seven safe holes
reach the door with all eighteen traps still in the world.
