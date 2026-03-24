//------------------------------------------------------------
// Complex arithmetic (for 2D Möbius IFS)
//------------------------------------------------------------
function C_add(a, b) { return { re: a.re + b.re, im: a.im + b.im }; }
function C_sub(a, b) { return { re: a.re - b.re, im: a.im - b.im }; }
function C_mul(a, b) {
    return {
        re: a.re * b.re - a.im * b.im,
        im: a.re * b.im + a.im * b.re
    };
}
function C_div(a, b) {
    const d = b.re * b.re + b.im * b.im;
    return {
        re: (a.re * b.re + a.im * b.im) / d,
        im: (a.im * b.re - a.re * b.im) / d
    };
}

//------------------------------------------------------------
// 2D Möbius IFS
//------------------------------------------------------------
function T_plus(z) {
    return C_div(
        C_add(z, { re: 2, im: 0 }),
        C_add(z, { re: 1, im: 0 })
    );
}
function T_minus(z) {
    return C_div(
        z,
        C_sub(z, { re: 1, im: 0 })
    );
}

function ApplySigma2D(sigma, z0) {
    let z = z0;
    for (let s of sigma) {
        z = (s === +1) ? T_plus(z) : T_minus(z);
    }
    return z;
}

//------------------------------------------------------------
// Sample pixel with boundary = 0 (方式A)
//------------------------------------------------------------
function sample(image, x, y) {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    if (ix < 0 || iy < 0 || ix >= image.width || iy >= image.height) return 0;
    const idx = (iy * image.width + ix) * 4;
    return image.data[idx];
}

//------------------------------------------------------------
// Compute φσ (domain patch transformed by 2D Möbius IFS)
//------------------------------------------------------------
function computePhiSigma(image, patch, sigma) {
    const { x, y, w, h } = patch;
    const phi = new Float32Array(w * h);

    for (let j = 0; j < h; j++) {
        for (let i = 0; i < w; i++) {

            const xr = x + i;
            const yr = y + j;

            const z = { re: xr, im: yr };
            const z2 = ApplySigma2D(sigma, z);

            phi[j * w + i] = sample(image, z2.re, z2.im);
        }
    }
    return phi;
}

//------------------------------------------------------------
// Compute α (least squares)
//------------------------------------------------------------
function computeAlpha(P, phi) {
    let num = 0, den = 0;
    for (let i = 0; i < P.length; i++) {
        num += P[i] * phi[i];
        den += phi[i] * phi[i];
    }
    return den === 0 ? 0 : num / den;
}

//------------------------------------------------------------
// Compute error
//------------------------------------------------------------
function computeError(P, phi, alpha) {
    let err = 0;
    for (let i = 0; i < P.length; i++) {
        const d = P[i] - alpha * phi[i];
        err += d * d;
    }
    return err / P.length;
}

//------------------------------------------------------------
// Extract patch pixels
//------------------------------------------------------------
function extractPatch(image, patch) {
    const { x, y, w, h } = patch;
    const P = new Float32Array(w * h);
    for (let j = 0; j < h; j++) {
        for (let i = 0; i < w; i++) {
            P[j * w + i] = sample(image, x + i, y + j);
        }
    }
    return P;
}

//------------------------------------------------------------
// Enumerate all σ up to Lmax
//------------------------------------------------------------
function enumerateSigma(Lmax) {
    const list = [];
    function dfs(prefix) {
        if (prefix.length > 0) list.push(prefix.slice());
        if (prefix.length === Lmax) return;
        dfs(prefix.concat(+1));
        dfs(prefix.concat(-1));
    }
    dfs([]);
    return list;
}

//------------------------------------------------------------
// Main 2D fractal encoder (本物)
//------------------------------------------------------------
function FractalEncode2D(image, W, Lmax, thr) {

    const sigmas = enumerateSigma(Lmax);
    const encoded = [];

    function processPatch(x, y, w, h) {

        const patch = { x, y, w, h };
        const P = extractPatch(image, patch);

        let bestSigma = null;
        let bestAlpha = 0;
        let bestErr = Infinity;

        for (let sigma of sigmas) {

            const phi = computePhiSigma(image, patch, sigma);
            const alpha = computeAlpha(P, phi);
            const err = computeError(P, phi, alpha);

            if (err < bestErr) {
                bestErr = err;
                bestSigma = sigma;
                bestAlpha = alpha;
            }
        }

        if (bestErr < thr || w <= W || h <= W) {
            encoded.push({
                position: patch,
                sigma: bestSigma,
                alpha: bestAlpha,
                error: bestErr
            });
            return;
        }

        const w2 = Math.floor(w / 2);
        const h2 = Math.floor(h / 2);

        processPatch(x,      y,      w2, h2);
        processPatch(x+w2,   y,      w-w2, h2);
        processPatch(x,      y+h2,   w2, h-h2);
        processPatch(x+w2,   y+h2,   w-w2, h-h2);
    }

    processPatch(0, 0, image.width, image.height);
    return encoded;
}

//------------------------------------------------------------
// Reconstruction（本物）
//------------------------------------------------------------
function drawReconstruction(c, encoded, image) {
    const w = image.width;
    const h = image.height;

    const out = c.ctx.createImageData(w, h);
    const data = out.data;

    for (let block of encoded) {
        const { x, y, w: bw, h: bh } = block.position;
        const sigma = block.sigma;
        const alpha = block.alpha;

        const phi = computePhiSigma(image, block.position, sigma);

        for (let j = 0; j < bh; j++) {
            for (let i = 0; i < bw; i++) {

                const idx = ( (y+j) * w + (x+i) ) * 4;
                const v = Math.max(0, Math.min(255, alpha * phi[j*bw + i]));

                data[idx]   = v;
                data[idx+1] = v;
                data[idx+2] = v;
                data[idx+3] = 255;
            }
        }
    }

    c.canvas.width  = w;
    c.canvas.height = h;
    c.ctx.putImageData(out, 0, 0);
}

//------------------------------------------------------------
// σ-map（誤差正規化）
//------------------------------------------------------------
function drawSigmaMap(c, encoded, Lmax) {
    clearCanvas(c);

    const Emax = Math.max(...encoded.map(e => e.error));
    const Emin = Math.min(...encoded.map(e => e.error));

    for (let p of encoded) {
        const E = (p.error - Emin) / (Emax - Emin + 1e-9);
        const color = SigmaColor(p.sigma, Lmax, E, 1);

        c.ctx.fillStyle = color;
        c.ctx.fillRect(p.position.x, p.position.y, p.position.w, p.position.h);
    }
}

//------------------------------------------------------------
// Partition（そのまま）
//------------------------------------------------------------
function drawPartition(c, encoded) {
    clearCanvas(c);
    c.ctx.strokeStyle = "white";
    for (let p of encoded) {
        c.ctx.strokeRect(p.position.x, p.position.y, p.position.w, p.position.h);
    }
}

//------------------------------------------------------------
// Original
//------------------------------------------------------------
function drawOriginal(c, image) {
    clearCanvas(c);
    c.ctx.putImageData(image, 0, 0);
}

//------------------------------------------------------------
// Limit set（σ と同期）
//------------------------------------------------------------
function drawLimitSet(c, Lmax) {
    clearCanvas(c);

    const pts = GenerateLimitSetPoints_Enumerate(Lmax, 0.0);
    if (pts.length === 0) return;

    const xs = pts.map(p => p.xσ);
    const xmin = Math.min(...xs);
    const xmax = Math.max(...xs);

    for (let p of pts) {
        const u = (p.xσ - xmin) / (xmax - xmin + 1e-9);
        const x = u * c.canvas.width;
        const y = c.canvas.height / 2;

        const color = SigmaColor(p.sigma, Lmax, 0, 1);
        const size = Math.max(1, p.sigma.length / Lmax * 3);

        c.ctx.fillStyle = color;
        c.ctx.fillRect(x, y, size, size);
    }
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
        let thr     = getThreshold();

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
