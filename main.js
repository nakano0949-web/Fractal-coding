//------------------------------------------------------------
// Canvas helpers
//------------------------------------------------------------
function initCanvas(id) {
    const canvas = document.getElementById(id);
    const ctx = canvas.getContext("2d");
    return { canvas, ctx };
}

function clearCanvas(c) {
    c.ctx.fillStyle = "black";
    c.ctx.fillRect(0, 0, c.canvas.width, c.canvas.height);
}

function drawPoint(c, x, y, color, size) {
    c.ctx.fillStyle = color;
    c.ctx.fillRect(x, y, size, size);
}

//------------------------------------------------------------
// Image loading
//------------------------------------------------------------
function loadImage(file) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement("canvas");
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0);
            resolve(ctx.getImageData(0, 0, img.width, img.height));
        };
        img.src = URL.createObjectURL(file);
    });
}

//------------------------------------------------------------
// UI getters
//------------------------------------------------------------
function getPatchSize() {
    return parseInt(document.getElementById("patchSize").value);
}
function getLmax() {
    return parseInt(document.getElementById("lmax").value);
}
function getThreshold() {
    return parseFloat(document.getElementById("threshold").value);
}

//------------------------------------------------------------
// HSV → RGB
//------------------------------------------------------------
function HSV_to_RGB(h, s, v) {
    let i = Math.floor(h * 6);
    let f = h * 6 - i;
    let p = v * (1 - s);
    let q = v * (1 - f * s);
    let t = v * (1 - (1 - f) * s);

    let r, g, b;
    switch (i % 6) {
        case 0: r = v; g = t; b = p; break;
        case 1: r = q; g = v; b = p; break;
        case 2: r = p; g = v; b = t; break;
        case 3: r = p; g = q; b = v; break;
        case 4: r = t; g = p; b = v; break;
        case 5: r = v; g = p; b = q; break;
    }
    return `rgb(${r*255},${g*255},${b*255})`;
}

//------------------------------------------------------------
// σ → Color
//------------------------------------------------------------
function SigmaColor(sigma, Lmax, E, Emax) {
    // Hue
    let bin = 0;
    for (let k = 0; k < sigma.length; k++) {
        bin = bin * 2 + (sigma[k] === +1 ? 1 : 0);
    }
    const H = bin / Math.pow(2, sigma.length);

    // Saturation
    const S = sigma.length / Lmax;

    // Value
    const V = 1 - (E / Emax);

    return HSV_to_RGB(H, S, V);
}

//------------------------------------------------------------
// Möbius IFS
//------------------------------------------------------------
function M_plus(x)  { return (x + 2) / (x + 1); }
function M_minus(x) { return x / (x - 1); }

function ApplySigmaToX0(sigma, x0) {
    let x = x0;
    for (let s of sigma) {
        x = (s === +1) ? M_plus(x) : M_minus(x);
    }
    return x;
}

//------------------------------------------------------------
// Limit set generation
//------------------------------------------------------------
function GenerateLimitSetPoints_Enumerate(Lmax, x0) {
    const points = [];

    function dfs(prefix) {
        if (prefix.length > Lmax) return;

        if (prefix.length > 0) {
            const xσ = ApplySigmaToX0(prefix, x0);
            points.push({ xσ, sigma: prefix.slice() });
        }

        dfs(prefix.concat(+1));
        dfs(prefix.concat(-1));
    }

    dfs([]);
    return points;
}

function normalize(x, xmin, xmax) {
    return (x - xmin) / (xmax - xmin);
}

//------------------------------------------------------------
// Draw limit set panel
//------------------------------------------------------------
function drawLimitSet(c, Lmax) {
    clearCanvas(c);

    const pts = GenerateLimitSetPoints_Enumerate(Lmax, 0.0);
    const xs = pts.map(p => p.xσ);
    const xmin = Math.min(...xs);
    const xmax = Math.max(...xs);

    for (let p of pts) {
        const u = normalize(p.xσ, xmin, xmax);
        const x = u * c.canvas.width;
        const y = c.canvas.height / 2;

        const color = SigmaColor(p.sigma, Lmax, 0, 1);
        const size = Math.max(1, p.sigma.length / Lmax * 4);

        drawPoint(c, x, y, color, size);
    }
}

//------------------------------------------------------------
// Minimal fractal encoder (dummy version)
//------------------------------------------------------------
function FractalEncode2D(image, W, Lmax, thr) {
    // For now: return a single patch covering the whole image
    // (You can replace this with the full quad-tree + sigma search later)
    return [{
        position: { x: 0, y: 0, w: image.width, h: image.height },
        sigma: [+1, -1, +1], // dummy
        alpha: 1.0,
        error: 0.1
    }];
}

//------------------------------------------------------------
// Draw panels (minimal placeholders)
//------------------------------------------------------------
function drawOriginal(c, image) {
    clearCanvas(c);
    c.ctx.putImageData(image, 0, 0);
}

function drawPartition(c, encoded) {
    clearCanvas(c);
    c.ctx.strokeStyle = "white";
    for (let p of encoded) {
        c.ctx.strokeRect(p.position.x, p.position.y, p.position.w, p.position.h);
    }
}

function drawSigmaMap(c, encoded, Lmax) {
    clearCanvas(c);
    const Emax = Math.max(...encoded.map(e => e.error));

    for (let p of encoded) {
        const color = SigmaColor(p.sigma, Lmax, p.error, Emax);
        c.ctx.fillStyle = color;
        c.ctx.fillRect(p.position.x, p.position.y, p.position.w, p.position.h);
    }
}

function drawReconstruction(c, encoded, size) {
    clearCanvas(c);
    // Placeholder: fill with gray
    c.ctx.fillStyle = "#444";
    c.ctx.fillRect(0, 0, size.width, size.height);
}

//------------------------------------------------------------
// Main
//------------------------------------------------------------
window.onload = () => {

    const canvasOriginal   = initCanvas("panel-original");
    const canvasPartition  = initCanvas("panel-partition");
    const canvasSigma      = initCanvas("panel-sigma");
    const canvasRecon      = initCanvas("panel-recon");
    const canvasLimit      = initCanvas("panel-limitset");

    let image = null;

    document.getElementById("imageLoader").onchange = async (e) => {
        image = await loadImage(e.target.files[0]);
        updateAll();
    };

    document.getElementById("patchSize").oninput = updateAll;
    document.getElementById("lmax").oninput = updateAll;
    document.getElementById("threshold").oninput = updateAll;
    document.getElementById("sigmaMode").onchange = updateAll;

    function updateAll() {
        if (!image) return;

        const W     = getPatchSize();
        const Lmax  = getLmax();
        const thr   = getThreshold();

        const encoded = FractalEncode2D(image, W, Lmax, thr);

        drawOriginal(canvasOriginal, image);
        drawPartition(canvasPartition, encoded);
        drawSigmaMap(canvasSigma, encoded, Lmax);
        drawReconstruction(canvasRecon, encoded, image);
        drawLimitSet(canvasLimit, Lmax);
    }
};
