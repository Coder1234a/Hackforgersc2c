// ui.js - the call panel + the reveal screen.
//
// both are DOM, not canvas. means they actually look like screens, and
// Shruti can restyle them without touching a line of game code.

const RULES = [
    { id:"NORMAL",              label:"Nothing — normal physics", colour:"#7C8798" },
    { id:"REVERSE_GRAVITY",     label:"Reverse Gravity",          colour:"#2D5276" },
    { id:"INVERTED_CONTROLS",   label:"Inverted Controls",        colour:"#BD4B29" },
    { id:"NO_JUMP",             label:"No Jumping",               colour:"#2E603D" },
    { id:"MOMENTUM",            label:"Momentum Matters",         colour:"#C9A227" },
    { id:"BULLETS_PUSH",        label:"Bullets Push You",         colour:"#C9829B" },
    { id:"SHIFTING_PLATFORMS",  label:"Shifting Platforms",       colour:"#45C7D6" },
    { id:"MOVEMENT_COSTS_TIME", label:"Movement Costs Time",      colour:"#A495C6" }
];

let picked = null;

const $panel  = document.getElementById("panel");
const $rows   = document.getElementById("rows");
const $count  = document.getElementById("count");
const $total  = document.getElementById("total");
const $reveal = document.getElementById("reveal");

function panelOpen()  { return !$panel.hidden; }
function closePanel() { $panel.hidden = true; picked = null; }
function openPanel()  { $panel.hidden = false; picked = null; renderPanel(liveSet); }
function togglePanel(){ $panel.hidden ? openPanel() : closePanel(); }

// redraw the 8 rows. dimmed AND struck through, never colour on its own -
// about 1 in 12 blokes can't separate those hues.
let showHints = false;   // off by default. player does the thinking.

function toggleHints() { showHints = !showHints; renderPanel(liveSet); }

// every row stays pickable, always. deliberate - if the game crossed off
// the wrong answers you literally couldn't be wrong, and a score you can't
// lose is worth nothing. hints (H) only ever mark what your OWN moves have
// already ruled out.
function renderPanel(live) {
    if (!$rows) return;
    $count.textContent = showHints ? live.length : RULES.length;
    $total.textContent = RULES.length;
    document.getElementById("hintline").textContent =
        showHints ? "showing what your moves rule out — H to hide"
                  : "press H if you want a hand";
    $rows.innerHTML = "";
    RULES.forEach(function (rule, i) {
        const alive = live.includes(rule.id);
        const faded = showHints && !alive;
        const row = document.createElement("li");
        row.className = "row live" + (faded ? " hinted" : "") + (picked === rule.id ? " picked" : "");
        row.innerHTML = '<span class="key">' + (i+1) + '</span>' +
                        '<span class="chip" style="background:' + rule.colour + '"></span>' +
                        '<span class="name">' + rule.label + '</span>' +
                        (faded ? '<span class="tag">your moves rule this out</span>' : '');
        row.onclick = function () { pick(rule.id); };
        $rows.appendChild(row);
    });
}

function pick(id) {
    picked = id;
    renderPanel(liveSet);
}

// grab the pick BEFORE closing, closing wipes it. these two lines the
// wrong way round is what broke the button for an hour.
function commit() {
    if (!picked) return;
    const choice = picked;
    closePanel();
    submitCall(choice);
}

document.addEventListener("keydown", function (e) {
    if (!panelOpen()) return;
    const n = parseInt(e.key, 10);
    if (n >= 1 && n <= RULES.length) pick(RULES[n-1].id);
    if (e.key === "h" || e.key === "H") toggleHints();
    if (e.key === "Enter") commit();
});

// the payoff. first time they see the rule's own colour.
function showReveal(guess, truth, right, score, sufficiency, callMove) {
    const truthRule = RULES.find(function (r) { return r.id === truth; });
    const guessRule = RULES.find(function (r) { return r.id === guess; });

    let msg;
    if (!right) {
        msg = sufficiency === null
            ? "Nothing you did narrowed it down. Try a different probe."
            : "The evidence already pointed at " + truthRule.label + " by move " + sufficiency + ".";
    }
    else if (sufficiency === null)     msg = "The evidence never narrowed to one. That was a punt.";
    else if (callMove < sufficiency)   msg = "You called with rules still on the table. Right, but a guess.";
    else if (callMove === sufficiency) msg = "You called the moment you knew. Perfect.";
    else msg = "You had enough to know at move " + sufficiency + ". You called at move " + callMove + ".";

    let body;
    if (right) {
        body = '<div class="verdict yes">&#10003; CORRECT</div>' +
               '<div class="rulename" style="background:' + truthRule.colour + '">' + truthRule.label + '</div>';
    } else {
        body = '<div class="verdict no">&#10007; NOT QUITE</div>' +
               '<div class="wrongline">You said <b>' + guessRule.label + '</b></div>' +
               '<div class="truthlabel">It was actually</div>' +
               '<div class="rulename" style="background:' + truthRule.colour + '">' + truthRule.label + '</div>';
    }

    $reveal.innerHTML =
        '<div class="card" style="border-color:' + (right ? truthRule.colour : "#e8705a") + '">' +
        body +
        '<div class="score">' + score + '</div><div class="slabel">points</div>' +
        '<p class="msg">' + msg + '</p>' +
        '<p class="hint">Press N for a new rule</p></div>';
    $reveal.hidden = false;
}

function hideReveal() { $reveal.hidden = true; }
