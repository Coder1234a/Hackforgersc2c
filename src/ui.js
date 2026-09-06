// ui.js — the call panel and the reveal, driven from the DOM so they
// look like proper screens instead of text painted on a canvas.

const RULES = [
    { id:"REVERSE_GRAVITY",     label:"Reverse Gravity",     colour:"#2D5276" },
    { id:"INVERTED_CONTROLS",   label:"Inverted Controls",   colour:"#BD4B29" },
    { id:"NO_JUMP",             label:"No Jumping",          colour:"#2E603D" },
    { id:"MOMENTUM",            label:"Momentum Matters",    colour:"#C9A227" },
    { id:"BULLETS_PUSH",        label:"Bullets Push You",    colour:"#C9829B" },
    { id:"SHIFTING_PLATFORMS",  label:"Shifting Platforms",  colour:"#45C7D6" },
    { id:"MOVEMENT_COSTS_TIME", label:"Movement Costs Time", colour:"#A495C6" }
];

let picked = null;

const $panel = document.getElementById("panel");
const $rows  = document.getElementById("rows");
const $count = document.getElementById("count");
const $reveal = document.getElementById("reveal");

function panelOpen() { return !$panel.hidden; }
function closePanel() { $panel.hidden = true; picked = null; }
function togglePanel() { $panel.hidden ? openPanel() : closePanel(); }
function openPanel() { $panel.hidden = false; picked = null; renderPanel(liveSet); }

// Redraws the seven rows. Greyed-out ones are dimmed AND struck through,
// never just recoloured - plenty of people can't tell the colours apart.
function renderPanel(live) {
    if (!$rows) return;
    $count.textContent = live.length;
    $rows.innerHTML = "";
    RULES.forEach(function (rule, i) {
        const alive = live.includes(rule.id);
        const row = document.createElement("li");
        row.className = "row " + (alive ? "live" : "out") + (picked === rule.id ? " picked" : "");
        row.innerHTML = '<span class="key">' + (i+1) + '</span>' +
                        '<span class="chip" style="background:' + rule.colour + '"></span>' +
                        '<span class="name">' + rule.label + '</span>';
        if (alive) row.onclick = function () { picked = rule.id; renderPanel(live); };
        $rows.appendChild(row);
    });
}

// 1-7 to pick, Enter to commit. Only while the panel is up.
document.addEventListener("keydown", function (e) {
    if (!panelOpen()) return;
    const n = parseInt(e.key, 10);
    if (n >= 1 && n <= 7 && liveSet.includes(RULES[n-1].id)) { picked = RULES[n-1].id; renderPanel(liveSet); }
    if (e.key === "Enter" && picked) { closePanel(); submitCall(picked); }
});

// The payoff screen. First time the player sees the rule's own colour.
function showReveal(guess, truth, right, score, sufficiency, callMove) {
    const rule = RULES.find(function (r) { return r.id === truth; });
    let msg;
    if (sufficiency === null) msg = "The evidence never narrowed to one. That was a guess.";
    else if (callMove < sufficiency) msg = "You called with rules still on the table. Right, but a guess.";
    else if (callMove === sufficiency) msg = "You called the moment you knew. Perfect.";
    else msg = "You had enough to know at move " + sufficiency + ". You called at move " + callMove + ".";

    $reveal.innerHTML =
        '<div class="card" style="border-color:' + rule.colour + '">' +
        '<div class="verdict ' + (right ? "yes" : "no") + '">' + (right ? "CORRECT" : "WRONG") + '</div>' +
        '<div class="rulename" style="background:' + rule.colour + '">' + rule.label + '</div>' +
        '<div class="score">' + score + '</div><div class="slabel">points</div>' +
        '<p class="msg">' + msg + '</p>' +
        '<p class="hint">Press N for a new rule</p></div>';
    $reveal.hidden = false;
}
