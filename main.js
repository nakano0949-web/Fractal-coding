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
    return image.data[idx]; // R成分だけ使う（グレースケール扱い）
}

//------------------------------------------------------------
// Compute φσ (domain patch transformed by 2D Möbius IFS)
//------------------------------------------------------------
function computePhiSigma(image, patch, sigma) {
    const { x, y, w, h } = patch;
    const phi = new Float32Array(w * h);

    for (let j = 0; j < h; j++) {
        for (let i = 0; i < w; i++) {

            // range patch の座標
            const xr = x + i;
            const yr = y + j;

            // 複素数 z = (xr, yr)
            const z = { re: xr, im: yr };

            // Möbius IFS を適用
            const z2 = ApplySigma2D(sigma, z);

            // domain の座標としてサンプリング
            const val = sample(image, z2.re, z2.im);

            phi[j * w + i] = val;
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

        // 閾値以下なら葉ノード
        if (bestErr < thr || w <= W || h <= W) {
            encoded.push({
                position: patch,
                sigma: bestSigma,
                alpha: bestAlpha,
                error: bestErr
            });
            return;
        }

        // 4分割
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
