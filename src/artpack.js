// artpack.js - the pictures, and nothing else.
//
// each arena's backdrop is the artwork itself, baked in as a data URL. that
// keeps the whole game one folder of text files: no fetch, no loading bar,
// no broken image if the wifi drops halfway through the demo.
//
// anything that MOVES has been painted out of these images on purpose - the
// dripstone stub, every grass step - because a thing that moves can't be
// stuck to the background. the engine draws those.
const ARENA_ART = {};

function loadArt(name, dataUrl) {
    const img = new Image();
    img.src = dataUrl;
    ARENA_ART[name] = img;
    return img;
}
