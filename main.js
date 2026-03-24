//------------------------------------------------------------
// Canvas helpers
//------------------------------------------------------------
function initCanvas(canvasId) {
    const canvas = document.getElementById(canvasId);
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
// Image loading (スマホ用に縮小)
//------------------------------------------------------------
function loadImage(file) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {

            const maxSize = 800;
            const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);

            const canvas = document.createElement("canvas");
            canvas.width = img.width * scale;
            canvas.height = img.height * scale;

            const ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

            resolve(ctx.getImageData(0, 0, canvas.width, canvas.height));
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
    if (sigma.length === 0) return "rgb(128,128,128)";

    let bin = 0;
    for (let k = 0; k < sigma.length; k++) {
        bin = bin * 2 + (sigma[k] === +1 ? 1 : 0);
    }
    const H = bin / Math.pow(2, sigma.length);
    const S = sigma.length / Lmax;
    const V = 1 - (Emax > 0 ? (E / Emax) : 0);

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
    if (xmax === xmin) return 0.5;
    return (x - xmin) / (xmax - xmin);
}

//------------------------------------------------------------
// Draw limit set panel
//------------------------------------------------------------
function drawLimitSet(c, Lmax) {
    clearCanvas(c);

    const pts = GenerateLimitSetPoints_Enumerate(Lmax, 0.0);
    if (pts.length === 0) return;

    const xs = pts.map(p => p.xσ);
    const xmin = Math.min(...xs);
    const xmax = Math.max(...xs);

    for (let p of pts) {
        const u = normalize(p.xσ, xmin, xmax);
        const x = u * c.canvas.width;
        const y = c.canvas.height / 2;

        const color = SigmaColor(p.sigma, Lmax, 0, 1);
        const size = Math.max(1, p.sigma.length / Lmax * 3);

        drawPoint(c, x, y, color, size);
    }
}

//------------------------------------------------------------
// Minimal fractal encoder (placeholder)
//------------------------------------------------------------
function FractalEncode2D(image, W, Lmax, thr) {
    const patches = [];
    for (let y = 0; y < image.height; y += W) {
        for (let x = 0; x < image.width; x += W) {
            const w = Math.min(W, image.width - x);
            const h = Math.min(W, image.height - y);
            const sigma = [+1, -1, +1];
            const alpha = 1.0;
            const error = Math.random();
            patches.push({
                position: { x, y, w, h },
                sigma,
                alpha,
                error
            });
        }
    }
    return patches;
}

//------------------------------------------------------------
// Draw panels
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
    const Emax = Math.max(...encoded.map(e => e.error), 0.0001);

    for (let p of encoded) {
        const color = SigmaColor(p.sigma, Lmax, p.error, Emax);
        c.ctx.fillStyle = color;
        c.ctx.fillRect(p.position.x, p.position.y, p.position.w, p.position.h);
    }
}

function drawReconstruction(c, encoded, image) {
    clearCanvas(c);
    c.ctx.fillStyle = "#444";
    c.ctx.fillRect(0, 0, image.width, image.height);
}

//------------------------------------------------------------
// Resize canvas to image
//------------------------------------------------------------
function resizeCanvasToImage(c, image) {
    c.canvas.width  = image.width;
    c.canvas.height = image.height;
}

//------------------------------------------------------------
// Main
//------------------------------------------------------------
window.onload = () => {

    const canvasOriginal   = initCanvas("canvas-original");
    const canvasPartition  = initCanvas("canvas-partition");
    const canvasSigma      = initCanvas("canvas-sigma");
    const canvasRecon      = initCanvas("canvas-recon");
    const canvasLimit      = initCanvas("canvas-limitset");

    // limit set は固定サイズ
    canvasLimit.canvas.width  = 600;
    canvasLimit.canvas.height = 200;

    let image = null;

    document.getElementById("imageLoader").onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        image = await loadImage(file);
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

        resizeCanvasToImage(canvasOriginal, image);
        resizeCanvasToImage(canvasPartition, image);
        resizeCanvasToImage(canvasSigma, image);
        resizeCanvasToImage(canvasRecon, image);

        const encoded = FractalEncode2D(image, W, Lmax, thr);

        drawOriginal(canvasOriginal, image);
        drawPartition(canvasPartition, encoded);
        drawSigmaMap(canvasSigma, encoded, Lmax);
        drawReconstruction(canvasRecon, encoded, image);
        drawLimitSet(canvasLimit, Lmax);
    }
};
