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

// ALL EIGHT fundamentals are listed, every time. that's the whole rule
// book, so a player can see the shape of the game on their first arena
// instead of discovering rules four levels in.
//
// the ones this arena can't roll are greyed out and can't be picked. that
// isn't hiding anything - it's the difference between a puzzle and a trap.
// asking someone to rule out a bullet rule on a level with no bullets is
// just cruelty with extra steps.
//
// nothing is ever crossed off for you among the LIVE ones, though. if the
// game ruled out the wrong answers you literally couldn't be wrong, and a
// score you can't lose is worth nothing.
function renderPanel(live) {
    if (!$rows) return;
    const pool = (typeof level !== "undefined" && level.safeRules) ? level.safeRules : ALL_RULES;
    $count.textContent = pool.length;
    $total.textContent = RULES.length;
    $rows.innerHTML = "";
    RULES.forEach(function (rule, i) {
        const inPlay = pool.includes(rule.id);
        const row = document.createElement("li");
        row.className = "row" + (inPlay ? " live" : " off") + (picked === rule.id ? " picked" : "");
        row.innerHTML = '<span class="key">' + (i + 1) + '</span>' +
                        '<span class="chip" style="background:' + rule.colour + '"></span>' +
                        '<span class="name">' + rule.label + '</span>' +
                        (inPlay ? '' : '<span class="off-tag">not in this arena</span>');
        if (inPlay) row.onclick = function () { pick(rule.id); };
        $rows.appendChild(row);
    });
    const foot = document.querySelector("#panel .foot");
    if (foot) foot.innerHTML =
        '<kbd>1</kbd>&ndash;<kbd>' + RULES.length + '</kbd> to pick &middot; ' +
        '<kbd>Enter</kbd> to lock it in &middot; <kbd>Esc</kbd> to back out';
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
    const pool = (typeof level !== "undefined" && level.safeRules) ? level.safeRules : ALL_RULES;
    const n = parseInt(e.key, 10);
    // the number matches the row you can see. a greyed-out row does nothing.
    if (n >= 1 && n <= RULES.length && pool.includes(RULES[n-1].id)) pick(RULES[n-1].id);
    if (e.key === "Enter") commit();
});

// the payoff. first time they see the rule's own colour.
function showReveal(guess, truth, right, score, sufficiency, callMove, best, secs, breakdown, par, runTotal, isLast) {
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

    // show the working. a total on its own reads as arbitrary; the same
    // total with "-90 for 6 moves" under it teaches you how to do better.
    let sums = "";
    if (breakdown) {
        sums = '<div class="sums">' + breakdown.lines.map(function (l) {
            return '<div><span>' + l[0] + '</span><b>' + l[1] + '</b></div>';
        }).join("") + '</div>';
    }

    $reveal.innerHTML =
        '<div class="card" style="border-color:' + (right ? truthRule.colour : "#e8705a") + '">' +
        body +
        '<div class="score">' + score + '</div><div class="slabel">points</div>' +
        sums +
        '<p class="msg">' + msg + '</p>' +
        '<div class="stats">' +
          '<span><b>' + callMove + '</b> moves</span>' +
          (par ? '<span><b>' + par + '</b> par</span>' : '') +
          '<span><b>' + (secs === undefined ? "-" : secs) + 's</b> taken</span>' +
          (best !== null && best !== undefined ? '<span><b>' + best + '</b> your best</span>' : '') +
        '</div>' +
        (runTotal !== undefined ? '<div class="runtotal">run total <b>' + runTotal + '</b></div>' : '') +
        '<div class="acts">' +
          '<button class="btn ghost" id="btnAgain">Play again</button>' +
          '<button class="btn go" id="btnNext">' + (isLast ? "See your score" : "Next arena") + '</button>' +
        '</div>' +
        '<p class="hint"><kbd>Enter</kbd> ' + (isLast ? "your score" : "next arena") +
        '  ·  <kbd>Q</kbd> same arena, new rule</p></div>';
    $reveal.hidden = false;

    // wired here rather than inline onclick, so the card stays plain HTML
    const again = document.getElementById("btnAgain");
    const next  = document.getElementById("btnNext");
    if (again) again.onclick = function () { revealAgain(); };
    if (next)  next.onclick  = function () { revealNext(); };
}

function hideReveal() { $reveal.hidden = true; }
