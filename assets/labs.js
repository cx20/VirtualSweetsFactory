/* =======================================================================
   おかしのつくりかた — インタラクティブ部

   ライブラリ不使用。Canvas 2D の上に、サンプルのコードと同じ手順で
   ミニチュアのレンダラを組んである。
   各実験は「その要素が無いページでは何もしない」形で書いてあるので、
   全ページから同じ1本を読み込んでいる。

   構成:
     0. 小道具（clamp / mix / $）
     1. Rng          … サンプルと同じ mulberry32
     2. Noise        … 値ノイズ / 周期版 / fBm
     3. 形           … 断面 → 回転体 / 格子メッシュ
     4. ミニレンダラ  … 画家のアルゴリズム + 簡易PBR
     5. キャンバスの下ごしらえ
     6. 料理のプリセット（断面と材質）
     HERO / 02〜17 の実験 / 図鑑 / ソースビューア / 用語集の絞り込み
   ======================================================================= */
(function () {
"use strict";

var TAU = Math.PI * 2;
var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
function mix(a, b, t) { return a + (b - a) * t; }
function smooth(a, b, x) { var t = clamp((x - a) / (b - a || 1e-6), 0, 1); return t * t * (3 - 2 * t); }
function mix3(a, b, t) { return [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)]; }
function $(s) { return document.querySelector(s); }
function $$(s) { return Array.prototype.slice.call(document.querySelectorAll(s)); }

/* --------------------------------------------------------------
   1. Rng — サンプルの Rng をそのまま移植（mulberry32）
   -------------------------------------------------------------- */
function Rng(seed) { this.s = seed >>> 0; }
Rng.prototype.next = function () {
    this.s = (this.s + 0x6D2B79F5) | 0;
    var t = Math.imul(this.s ^ (this.s >>> 15), 1 | this.s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
Rng.prototype.range = function (a, b) { return a + (b - a) * this.next(); };
Rng.prototype.gauss = function (m, sd) {
    var u = Math.max(1e-9, this.next()), v = this.next();
    return m + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v);
};

/* --------------------------------------------------------------
   2. Noise — 2D値ノイズ / u方向に折り返す周期版 / fBm
   -------------------------------------------------------------- */
var Noise = {
    h2: function (x, y, seed) {
        var h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(seed | 0, 1274126177);
        h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
        return (h >>> 0) / 4294967295;
    },
    v2: function (x, y, seed) {
        var xi = Math.floor(x), yi = Math.floor(y);
        var xf = x - xi, yf = y - yi;
        var u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
        var a = this.h2(xi, yi, seed), b = this.h2(xi + 1, yi, seed);
        var c = this.h2(xi, yi + 1, seed), d = this.h2(xi + 1, yi + 1, seed);
        return mix(mix(a, b, u), mix(c, d, u), v);
    },
    // u 方向だけ折り返す（一周してつながる）。筒に模様を巻くときに使う
    v2u: function (x, y, px, seed) {
        var xi = Math.floor(x), yi = Math.floor(y);
        var xf = x - xi, yf = y - yi;
        var u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
        var p = Math.max(1, px | 0);
        var x0 = xi % p; if (x0 < 0) x0 += p;
        var x1 = (xi + 1) % p; if (x1 < 0) x1 += p;
        var a = this.h2(x0, yi, seed), b = this.h2(x1, yi, seed);
        var c = this.h2(x0, yi + 1, seed), d = this.h2(x1, yi + 1, seed);
        return mix(mix(a, b, u), mix(c, d, u), v);
    },
    fbm: function (x, y, seed, oct, gain) {
        var g = gain == null ? 0.5 : gain;
        var s = 0, a = 0.5, f = 1, n = 0;
        for (var o = 0; o < oct; o++) { s += a * this.v2(x * f, y * f, seed + o * 131); n += a; f *= 2; a *= g; }
        return s / n;
    },
    fbmu: function (x, y, period, seed, oct) {
        var s = 0, a = 0.5, f = 1, n = 0;
        for (var o = 0; o < oct; o++) {
            s += a * this.v2u(x * f, y * f, (period * f) | 0, seed + o * 131);
            n += a; f *= 2; a *= 0.5;
        }
        return s / n;
    }
};

/* --------------------------------------------------------------
   3. 断面 → 回転体
   -------------------------------------------------------------- */
function sampleProfile(ctrl, t) {
    var n = ctrl.length;
    if (t <= ctrl[0].t) return ctrl[0].r;
    if (t >= ctrl[n - 1].t) return ctrl[n - 1].r;
    var i = 0;
    while (i < n - 2 && ctrl[i + 1].t < t) i++;
    var p0 = ctrl[Math.max(0, i - 1)], p1 = ctrl[i], p2 = ctrl[i + 1], p3 = ctrl[Math.min(n - 1, i + 2)];
    var u = (t - p1.t) / ((p2.t - p1.t) || 1e-6);
    // Catmull-Rom。4点を見て、真ん中の2点のあいだをなめらかに通す
    var r = 0.5 * ((2 * p1.r) + (-p0.r + p2.r) * u
        + (2 * p0.r - 5 * p1.r + 4 * p2.r - p3.r) * u * u
        + (-p0.r + 3 * p1.r - 3 * p2.r + p3.r) * u * u * u);
    return Math.max(0.001, r);
}

function makeShape(ctrl, o) {
    o = o || {};
    var bump = o.bump || 0, ridge = o.ridge || 0, ridgeAmp = o.ridgeAmp == null ? 0.07 : o.ridgeAmp;
    var seed = o.seed || 7, height = o.height || 1.7, rs = o.rscale || 1;
    function radius(t, a) {
        var r = sampleProfile(ctrl, t) * rs;
        if (ridge > 0) r *= 1 + ridgeAmp * Math.cos(ridge * a);
        if (bump > 0) r *= 1 + bump * (Noise.fbmu(a / TAU * 8, t * 9, 8, seed, 3) - 0.5) * 2.4;
        return r;
    }
    function yAt(t) { return (t - 0.5) * height; }
    return {
        radius: radius, yAt: yAt, height: height,
        pos: function (t, a, out) {
            var r = radius(t, a);
            out[0] = r * Math.cos(a); out[1] = yAt(t); out[2] = r * Math.sin(a);
            return out;
        }
    };
}

// N段 × M分割。継ぎ目のため列は M+1（u=0 と u=1 の頂点を別に持つ）
function buildMesh(shape, N, M) {
    var cols = M + 1, cnt = N * cols;
    var P = new Float32Array(cnt * 3), Nn = new Float32Array(cnt * 3), UV = new Float32Array(cnt * 2);
    var tmpA = [0, 0, 0], tmpB = [0, 0, 0], tmpC = [0, 0, 0];
    var dt = 0.5 / N, da = 0.5 / M;
    for (var i = 0; i < N; i++) {
        var t = i / (N - 1);
        for (var j = 0; j < cols; j++) {
            var u = j / M, a = u * TAU, k = i * cols + j;
            shape.pos(t, a, tmpA);
            P[k * 3] = tmpA[0]; P[k * 3 + 1] = tmpA[1]; P[k * 3 + 2] = tmpA[2];
            UV[k * 2] = u; UV[k * 2 + 1] = t;
            // 法線は数値微分。周方向と軸方向の接ベクトルの外積
            shape.pos(clamp(t + dt, 0, 1), a, tmpB);
            shape.pos(clamp(t - dt, 0, 1), a, tmpC);
            var ax = tmpB[0] - tmpC[0], ay = tmpB[1] - tmpC[1], az = tmpB[2] - tmpC[2];
            shape.pos(t, a + da, tmpB); shape.pos(t, a - da, tmpC);
            var bx = tmpB[0] - tmpC[0], by = tmpB[1] - tmpC[1], bz = tmpB[2] - tmpC[2];
            var nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
            var L = Math.hypot(nx, ny, nz) || 1;
            Nn[k * 3] = nx / L; Nn[k * 3 + 1] = ny / L; Nn[k * 3 + 2] = nz / L;
        }
    }
    return { N: N, M: M, cols: cols, P: P, Nn: Nn, UV: UV, count: cnt };
}

// 回転体でないもの（掃引した筒など）用。fn(s, w, out) が座標を返す
function buildGrid(NS, MW, fn) {
    var cols = MW + 1, cnt = (NS + 1) * cols;
    var P = new Float32Array(cnt * 3), Nn = new Float32Array(cnt * 3), UV = new Float32Array(cnt * 2);
    var A = [0, 0, 0], B = [0, 0, 0], C = [0, 0, 0], D = [0, 0, 0], E = [0, 0, 0];
    var ds = 0.5 / NS, dw = 0.5 / MW;
    for (var i = 0; i <= NS; i++) {
        var s = i / NS;
        for (var j = 0; j < cols; j++) {
            var w = j / MW, k = i * cols + j;
            fn(s, w, A);
            P[k * 3] = A[0]; P[k * 3 + 1] = A[1]; P[k * 3 + 2] = A[2];
            UV[k * 2] = w; UV[k * 2 + 1] = s;
            fn(clamp(s + ds, 0, 1), w, B); fn(clamp(s - ds, 0, 1), w, C);
            fn(s, w + dw, D); fn(s, w - dw, E);
            var ax = B[0] - C[0], ay = B[1] - C[1], az = B[2] - C[2];
            var bx = D[0] - E[0], by = D[1] - E[1], bz = D[2] - E[2];
            var nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
            var L = Math.hypot(nx, ny, nz) || 1;
            Nn[k * 3] = nx / L; Nn[k * 3 + 1] = ny / L; Nn[k * 3 + 2] = nz / L;
        }
    }
    return { N: NS + 1, M: MW, cols: cols, P: P, Nn: Nn, UV: UV, count: cnt };
}

/* --------------------------------------------------------------
   4. ミニレンダラ（画家のアルゴリズム）
   -------------------------------------------------------------- */
var CAM = { dist: 3.5, f: 1.65 };

function srgbToLin(c) { return c * c; }
function tone(x) { return Math.pow(clamp(x / (1 + x) * 1.45, 0, 1), 0.4545); }
function encode(x, tm) { return tm ? tone(x) : Math.pow(clamp(x, 0, 1), 0.4545); }

// exCap＝この面が拾えるハイライトの「細さの上限」。renderMesh が面ごとに渡す。
function shadePixel(nx, ny, nz, px, py, pz, alb, m, L, exCap) {
    var vx = -px, vy = -py, vz = -CAM.dist - pz;
    var vl = Math.hypot(vx, vy, vz) || 1; vx /= vl; vy /= vl; vz /= vl;
    var ndl = nx * L[0] + ny * L[1] + nz * L[2]; if (ndl < 0) ndl = 0;
    var ndv = nx * vx + ny * vy + nz * vz; if (ndv < 0) ndv = 0;
    var f = -nx * L[0] * 0.8 + ny * 0.35 - nz * L[2] * 0.8; if (f < 0) f = 0;
    var hx = L[0] + vx, hy = L[1] + vy, hz = L[2] + vz;
    var hl = Math.hypot(hx, hy, hz) || 1; hx /= hl; hy /= hl; hz /= hl;
    var ndh = nx * hx + ny * hy + nz * hz; if (ndh < 0) ndh = 0;

    var rough = m.rough;
    var ex = mix(5, 800, (1 - rough) * (1 - rough));
    // 陰影は面の中心1点でしか測っていない。だから面1枚より細いハイライトは
    // どのサンプル点にも当たらず、指定した艶がまるごと消える（＝素焼きに見える）。
    // 面の中で法線が振れる幅から上限を決め、それより鋭い指定はそこまで広げる。
    var amp = 0.05 + 0.85 * (1 - rough);
    if (exCap && exCap < ex) { amp *= Math.pow(exCap / ex, 0.35); ex = exCap; }
    var spec = Math.pow(ndh, ex) * amp;
    var cex = exCap ? Math.min(1600, exCap) : 1600;
    var coat = m.coat > 0 ? Math.pow(ndh, cex) * m.coat * 2.2 * Math.pow(cex / 1600, 0.6) : 0;
    var fres = Math.pow(1 - ndv, 4.2);
    var sheen = m.sheen > 0 ? fres * m.sheen * 0.75 : 0;
    // 透け。視線と反対から光が来ているところほど強い（＝逆光で縁が抜ける）
    var sss = m.sss > 0
        ? Math.pow(1 - ndv, 2.1) * m.sss * (0.30 + 0.70 * Math.max(0, -(nx * L[0] + nz * L[2])))
        : 0;
    var ambK = m.ambK == null ? 1 : m.ambK;
    var expo = m.expo == null ? 1 : m.expo;
    var tm = m.tonemap !== false;
    var amb = (0.12 + 0.21 * (ny * 0.5 + 0.5)) * ambK;
    var key = ndl * 1.02 + f * 0.20;

    var sc = m.sssCol || [1, 0.55, 0.4];
    var shc = m.sheenCol || [0.86, 0.82, 0.68];
    var r = (srgbToLin(alb[0]) * (amb + key) + spec + coat + sss * sc[0] * 0.7 + sheen * shc[0]) * expo;
    var g = (srgbToLin(alb[1]) * (amb + key) + spec + coat + sss * sc[1] * 0.7 + sheen * shc[1]) * expo;
    var b = (srgbToLin(alb[2]) * (amb + key) + spec + coat + sss * sc[2] * 0.7 + sheen * shc[2]) * expo;
    return "rgb(" + (encode(r, tm) * 255 | 0) + "," + (encode(g, tm) * 255 | 0) + "," + (encode(b, tm) * 255 | 0) + ")";
}

var faceBuf = [];

function renderMesh(ctx, W, H, mesh, o) {
    var rot = o.rot || 0, mode = o.mode || "solid";
    var smoothN = o.smooth !== false, flip = !!o.flip, cull = o.cull !== false;
    var mat = o.mat || { rough: 0.4, coat: 0.2, sss: 0.1, sheen: 0 };
    var alb = o.albedo || function () { return [0.8, 0.55, 0.3]; };
    var L = o.light || [-0.42, 0.72, -0.55];
    var Ll = Math.hypot(L[0], L[1], L[2]) || 1; L = [L[0] / Ll, L[1] / Ll, L[2] / Ll];

    var S = Math.min(W, H) * (o.zoom || 1), cx = W / 2 + (o.xShift || 0), cy = H / 2 + (o.yShift || 0);
    var cs = Math.cos(rot), sn = Math.sin(rot);
    var elev = o.elev || 0, ce = Math.cos(elev), se = Math.sin(elev);
    var P = mesh.P, Nn = mesh.Nn, UV = mesh.UV, cols = mesh.cols, N = mesh.N, M = mesh.M;
    var cnt = mesh.count;

    var vx = new Float32Array(cnt * 3), vn = new Float32Array(cnt * 3);
    var sx = new Float32Array(cnt), sy = new Float32Array(cnt);
    for (var k = 0; k < cnt; k++) {
        var x = P[k * 3], y = P[k * 3 + 1], z = P[k * 3 + 2];
        var rx = x * cs + z * sn, qz = -x * sn + z * cs;
        var ry = y * ce + qz * se, rz = -y * se + qz * ce;
        vx[k * 3] = rx; vx[k * 3 + 1] = ry; vx[k * 3 + 2] = rz;
        var a = Nn[k * 3], b = Nn[k * 3 + 1], c = Nn[k * 3 + 2];
        var qn = -a * sn + c * cs;
        vn[k * 3] = a * cs + c * sn; vn[k * 3 + 1] = b * ce + qn * se; vn[k * 3 + 2] = -b * se + qn * ce;
        var d = rz + CAM.dist, sc2 = CAM.f * S / Math.max(0.4, d);
        sx[k] = cx + rx * sc2; sy[k] = cy - ry * sc2;
    }

    faceBuf.length = 0;
    for (var i = 0; i < N - 1; i++) {
        for (var j = 0; j < M; j++) {
            var iA = i * cols + j, iB = iA + 1, iC = iA + cols, iD = iC + 1;
            var order = flip ? [iA, iB, iD, iC] : [iA, iC, iD, iB];
            var ax = sx[order[0]], ay = sy[order[0]];
            var bx = sx[order[1]], by = sy[order[1]];
            var cx2 = sx[order[2]], cy2 = sy[order[2]];
            // スクリーン座標は y が下向きなので、正の面積が表向きになる
            var area = (bx - ax) * (cy2 - ay) - (by - ay) * (cx2 - ax);
            var back = area < 0;
            if (cull && back && mode !== "facing") continue;

            var z0 = (vx[iA * 3 + 2] + vx[iB * 3 + 2] + vx[iC * 3 + 2] + vx[iD * 3 + 2]) * 0.25;
            var pts = [
                sx[order[0]], sy[order[0]], sx[order[1]], sy[order[1]],
                sx[order[2]], sy[order[2]], sx[order[3]], sy[order[3]]
            ];
            var col;
            if (mode === "wire") {
                col = null;
            } else if (mode === "facing") {
                col = back ? "#8F1619" : "#8FA754";
            } else {
                var nx, ny, nz;
                if (smoothN) {
                    nx = (vn[iA * 3] + vn[iB * 3] + vn[iC * 3] + vn[iD * 3]) * 0.25;
                    ny = (vn[iA * 3 + 1] + vn[iB * 3 + 1] + vn[iC * 3 + 1] + vn[iD * 3 + 1]) * 0.25;
                    nz = (vn[iA * 3 + 2] + vn[iB * 3 + 2] + vn[iC * 3 + 2] + vn[iD * 3 + 2]) * 0.25;
                } else {
                    var ux = vx[iC * 3] - vx[iA * 3], uy = vx[iC * 3 + 1] - vx[iA * 3 + 1], uz = vx[iC * 3 + 2] - vx[iA * 3 + 2];
                    var wx = vx[iB * 3] - vx[iA * 3], wy = vx[iB * 3 + 1] - vx[iA * 3 + 1], wz = vx[iB * 3 + 2] - vx[iA * 3 + 2];
                    nx = uy * wz - uz * wy; ny = uz * wx - ux * wz; nz = ux * wy - uy * wx;
                }
                var nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
                if (back) { nx = -nx; ny = -ny; nz = -nz; }
                if (mode === "normal") {
                    col = "rgb(" + ((nx * 0.5 + 0.5) * 255 | 0) + "," + ((ny * 0.5 + 0.5) * 255 | 0) + "," + ((nz * 0.5 + 0.5) * 255 | 0) + ")";
                } else {
                    var u0 = (UV[iA * 2] + UV[iD * 2]) * 0.5, v0 = (UV[iA * 2 + 1] + UV[iD * 2 + 1]) * 0.5;
                    var c3 = alb(u0, v0);
                    var mx = (vx[iA * 3] + vx[iD * 3]) * 0.5;
                    var my = (vx[iA * 3 + 1] + vx[iD * 3 + 1]) * 0.5;
                    var mz = (vx[iA * 3 + 2] + vx[iD * 3 + 2]) * 0.5;
                    // 対角の2頂点で法線がどれだけ開いているか（≒この面の曲がり具合）
                    var dnd = 1 - (vn[iA * 3] * vn[iD * 3] + vn[iA * 3 + 1] * vn[iD * 3 + 1] + vn[iA * 3 + 2] * vn[iD * 3 + 2]);
                    col = shadePixel(nx, ny, nz, mx, my, mz, c3, mat, L, dnd > 1e-6 ? 0.963 / dnd : 0);
                }
            }
            faceBuf.push({ z: z0, p: pts, c: col });
        }
    }
    faceBuf.sort(function (a, b) { return b.z - a.z; });

    if (mode === "wire") {
        ctx.strokeStyle = "rgba(36,28,21,.55)"; ctx.lineWidth = 0.7;
        ctx.beginPath();
        for (var q = 0; q < faceBuf.length; q++) {
            var p = faceBuf[q].p;
            ctx.moveTo(p[0], p[1]); ctx.lineTo(p[2], p[3]); ctx.lineTo(p[4], p[5]); ctx.lineTo(p[6], p[7]); ctx.closePath();
        }
        ctx.stroke();
    } else {
        for (var q2 = 0; q2 < faceBuf.length; q2++) {
            var fq = faceBuf[q2], pp = fq.p;
            ctx.fillStyle = fq.c; ctx.strokeStyle = fq.c; ctx.lineWidth = 0.6;
            ctx.beginPath();
            ctx.moveTo(pp[0], pp[1]); ctx.lineTo(pp[2], pp[3]); ctx.lineTo(pp[4], pp[5]); ctx.lineTo(pp[6], pp[7]);
            ctx.closePath(); ctx.fill(); ctx.stroke();
        }
    }
    return { sx: sx, sy: sy, cols: cols, N: N, M: M };
}

/* --------------------------------------------------------------
   5. キャンバスの下ごしらえ（高DPI対応 + 画面内でだけ描く）
   -------------------------------------------------------------- */
function setupCanvas(cv) {
    var ctx = cv.getContext("2d");
    var w = parseInt(cv.getAttribute("width"), 10);
    var h = parseInt(cv.getAttribute("height"), 10);
    function fit() {
        var dpr = Math.min(2, window.devicePixelRatio || 1);
        var cw = cv.clientWidth || w;
        var scale = cw / w;
        cv.width = Math.round(w * scale * dpr);
        cv.height = Math.round(h * scale * dpr);
        cv.style.height = Math.round(h * scale) + "px";
        ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
    }
    fit();
    window.addEventListener("resize", fit);
    return { ctx: ctx, W: w, H: h, fit: fit, cv: cv };
}

var loops = [];
function addLoop(cv, fn) {
    var o = { cv: cv, fn: fn, on: true };
    loops.push(o);
    if ("IntersectionObserver" in window) {
        var io = new IntersectionObserver(function (es) { o.on = es[0].isIntersecting; }, { rootMargin: "120px" });
        io.observe(cv);
    }
    return o;
}

var lastT = 0, lastRun = 0;
function spin(now, k) { return reduce ? 0.7 : now * k; }
function tick(now) {
    var dt = Math.min(0.05, (now - lastT) / 1000 || 0.016); lastT = now;
    if (reduce && now - lastRun < 70) { requestAnimationFrame(tick); return; }
    lastRun = now;
    for (var i = 0; i < loops.length; i++) if (loops[i].on) loops[i].fn(dt, now / 1000);
    requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

/* 何度も描き直さないための「汚れフラグ」つきループ。
   canvas は width/height を入れ直すと中身が消えるので、
   リサイズのあとは必ず描き直す必要がある */
function lazyLoop(cv, draw) {
    var dirty = true;
    function mark() { dirty = true; }
    window.addEventListener("resize", mark);
    addLoop(cv, function () { if (!dirty) return; dirty = false; draw(); });
    return mark;
}

/* ドラッグで視点を回す。

   3Dの実験は、既定でゆっくり自動で回している。ただし自動で回っているだけだと
   「裏はどうなっているのか」「上から見るとどうか」を確かめられない。
   触った時点で自動回転を止め、そこから先はドラッグで向きを決められるようにする。

     ・横のドラッグ … 軸のまわりの向き
     ・縦のドラッグ … 見下ろし角（真横から、真上まで）
     ・ダブルクリック … 元の角度に戻して、自動回転を再開する

   【対策】触ったのに勝手に回り続けると、見たい角度で止められない。
           自動回転は「その時点の角度で固定」して足し込む形にする。
           途中で 0 に戻すと、掴んだ瞬間に絵が飛ぶ */
function orbit(cv, o) {
    o = o || {};
    var st = {
        yaw: 0,
        elev0: o.elev == null ? 0.24 : o.elev,
        elev: o.elev == null ? 0.24 : o.elev,
        speed: o.speed == null ? 0.42 : o.speed,
        auto: true,
        touched: false,      // 一度でもドラッグされたか（既定値の差し替え判断に使う）
        base: 0,             // 自動回転ぶん。止めた時点の角度で固定される
        mark: o.mark || null
    };
    var elevMin = o.elevMin == null ? -0.50 : o.elevMin;
    var elevMax = o.elevMax == null ? 1.30 : o.elevMax;
    if (!cv) return st;

    var drag = null;
    cv.style.cursor = "grab";
    cv.style.touchAction = "none";
    cv.title = "ドラッグで回す／ダブルクリックで戻す";

    cv.addEventListener("pointerdown", function (e) {
        drag = { x: e.clientX, y: e.clientY, yaw: st.yaw, elev: st.elev };
        st.auto = false;
        st.touched = true;
        cv.style.cursor = "grabbing";
        try { cv.setPointerCapture(e.pointerId); } catch (err) { /* noop */ }
        e.preventDefault();
    });
    cv.addEventListener("pointermove", function (e) {
        if (!drag) return;
        // 画面の幅いっぱいのドラッグで、ほぼ1周ぶん回るようにする
        var w = cv.clientWidth || 320;
        st.yaw = drag.yaw + (e.clientX - drag.x) / w * TAU;
        st.elev = clamp(drag.elev - (e.clientY - drag.y) / w * 2.2, elevMin, elevMax);
        if (st.mark) st.mark();
        e.preventDefault();
    });
    // 【対策】pointerleave では外さないこと。掴んだままキャンバスの外へ
    //         出たときにドラッグが切れて、大きく回せなくなる
    //         （setPointerCapture しているので、外に出ても追従してよい）
    ["pointerup", "pointercancel"].forEach(function (ev) {
        cv.addEventListener(ev, function () { drag = null; cv.style.cursor = "grab"; });
    });
    cv.addEventListener("dblclick", function () {
        st.yaw = 0; st.elev = st.elev0; st.auto = true; st.touched = false;
        if (st.mark) st.mark();
    });

    // 自動回転ぶん＋ドラッグぶん。止めているあいだ base は動かない
    st.rot = function (now) {
        if (st.auto) st.base = spin(now, st.speed);
        return st.base + st.yaw;
    };
    // まだ触られていないときだけ、既定の見下ろし角を差し替える
    st.setElev = function (v) {
        st.elev0 = v;
        if (!st.touched) st.elev = v;
    };
    return st;
}

function chipGroup(sel, cb) {
    var els = $$(sel + " .chip");
    els.forEach(function (b) {
        b.addEventListener("click", function () {
            els.forEach(function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
            cb(b.getAttribute("data-v"));
        });
    });
}
function slider(id, vid, fmt, cb) {
    var el = $(id); if (!el) return null;
    var out = vid ? $(vid) : null;
    function upd() {
        var n = parseFloat(el.value);
        if (out) out.textContent = fmt ? fmt(n) : String(n);
        cb(n);
    }
    el.addEventListener("input", upd);
    upd();
    return el;
}
function toggle(id, cb) {
    var el = $(id); if (!el) return null;
    el.addEventListener("change", function () { cb(el.checked); });
    cb(el.checked);
    return el;
}
function f2(n) { return n.toFixed(2); }

/* オフスクリーンに1ピクセルずつ描いて、拡大して貼る。
   ImageData を直接 canvas に置くと DPI 変換が効かないので、
   小さいキャンバスに書いてから drawImage で伸ばす */
function pixelPanel(w, h) {
    var c = document.createElement("canvas");
    c.width = w; c.height = h;
    var x = c.getContext("2d");
    var img = x.createImageData(w, h);
    return {
        cv: c, w: w, h: h, data: img.data,
        set: function (i, r, g, b) {
            var k = i * 4;
            img.data[k] = clamp(r, 0, 1) * 255; img.data[k + 1] = clamp(g, 0, 1) * 255;
            img.data[k + 2] = clamp(b, 0, 1) * 255; img.data[k + 3] = 255;
        },
        flush: function () { x.putImageData(img, 0, 0); }
    };
}

/* --------------------------------------------------------------
   6. 料理のプリセット（断面と材質）
   数値は各サンプルの CONFIG から拾って、この実験の尺度に直したもの
   -------------------------------------------------------------- */
var PROFILES = {
    // 団子。球ではなく、上下がわずかに詰まっている
    dango: [{ t: 0, r: 0.02 }, { t: 0.04, r: 0.30 }, { t: 0.13, r: 0.52 }, { t: 0.28, r: 0.63 },
            { t: 0.50, r: 0.66 }, { t: 0.72, r: 0.63 }, { t: 0.87, r: 0.52 }, { t: 0.96, r: 0.30 }, { t: 1, r: 0.02 }],
    // 茶碗。高台 → 胴 → 口縁。ご飯.js の Bowl に合わせた
    bowl: [{ t: 0, r: 0.30 }, { t: 0.07, r: 0.29 }, { t: 0.12, r: 0.20 }, { t: 0.18, r: 0.28 },
           { t: 0.36, r: 0.52 }, { t: 0.60, r: 0.72 }, { t: 0.84, r: 0.88 }, { t: 1, r: 0.95 }],
    // クッキー。最大径は側面の中ほど（縁が丸く膨らむ）。底は平ら
    cookie: [{ t: 0, r: 0.80 }, { t: 0.10, r: 0.86 }, { t: 0.30, r: 0.90 }, { t: 0.50, r: 0.895 },
             { t: 0.72, r: 0.86 }, { t: 0.88, r: 0.76 }, { t: 0.97, r: 0.55 }, { t: 1, r: 0.30 }],
    // たこ焼き。下半分は型の写しでほぼ正確な半球、上半分は折り込んだ不定形
    tako: [{ t: 0, r: 0.16 }, { t: 0.06, r: 0.42 }, { t: 0.18, r: 0.60 }, { t: 0.34, r: 0.685 },
           { t: 0.50, r: 0.70 }, { t: 0.66, r: 0.675 }, { t: 0.82, r: 0.58 }, { t: 0.94, r: 0.36 }, { t: 1, r: 0.05 }]
};
var PROFILE_H = { dango: 1.20, bowl: 1.05, cookie: 0.42, tako: 1.30 };
function cloneProfile(p) { return p.map(function (o) { return { t: o.t, r: o.r }; }); }

// 材質。値は各サンプルの CONFIG から
var MATS = {
    dango:  { rough: 0.36, coat: 0.42, sss: 0.45, sheen: 0, col: [0.955, 0.930, 0.860], sssCol: [1.0, 0.88, 0.72] },
    choco:  { rough: 0.14, coat: 0.55, sss: 0.02, sheen: 0, col: [0.226, 0.130, 0.088], sssCol: [0.6, 0.3, 0.2] },
    wiener: { rough: 0.30, coat: 0.30, sss: 0.16, sheen: 0, col: [0.800, 0.395, 0.155], sssCol: [1.0, 0.45, 0.25] },
    rice:   { rough: 0.30, coat: 0.55, sss: 0.42, sheen: 0, col: [0.952, 0.932, 0.878], sssCol: [1.0, 0.93, 0.80] },
    akami:  { rough: 0.34, coat: 0.22, sss: 0.55, sheen: 0, col: [0.560, 0.088, 0.098], sssCol: [1.0, 0.14, 0.12] },
    tako:   { rough: 0.44, coat: 0.26, sss: 0.10, sheen: 0, col: [0.808, 0.565, 0.243], sssCol: [1.0, 0.7, 0.35] },
    karaage:{ rough: 0.55, coat: 0.20, sss: 0.05, sheen: 0.12, col: [0.670, 0.335, 0.090], sssCol: [1.0, 0.6, 0.3] }
};
function copyMat(m) {
    return { rough: m.rough, coat: m.coat, sss: m.sss, sheen: m.sheen, col: m.col, sssCol: m.sssCol };
}

/* トーストの色。トースト.js の TextureLab から */
var CRUMB = [0.948, 0.910, 0.812], CPORE = [0.930, 0.888, 0.775];
var CBR1 = [0.945, 0.848, 0.638], CBR2 = [0.878, 0.608, 0.325], CBR3 = [0.762, 0.452, 0.208];
var CCHAR = [0.310, 0.161, 0.063];
function bakeColor(heat) {
    if (heat < 0.34) return mix3(CRUMB, CBR1, heat / 0.34);
    if (heat < 0.68) return mix3(CBR1, CBR2, (heat - 0.34) / 0.34);
    if (heat < 0.90) return mix3(CBR2, CBR3, (heat - 0.68) / 0.22);
    return mix3(CBR3, CCHAR, (heat - 0.90) / 0.10);
}

/* たこ焼きの「折り込み」の場。形にもテクスチャにも同じものを使う（たべもの編12章） */
function foldField(u, v, seed) {
    // 上半分ほど折り込みが強い。下半分は型の写しなので平ら
    var top = smooth(0.30, 0.95, v);
    var n = Noise.fbmu(u * 5, v * 4.2, 5, seed || 31, 4);
    var ridged = 1 - Math.abs(n - 0.5) * 2;      // 尾根状にして「折り目」らしくする
    return clamp(0.5 + (ridged - 0.5) * 1.5 * top, 0, 1);
}

/* ======================================================================
   HERO — 断面からドーナツが組み上がり、焼き色がついて、チョコに浸かる
   形も色もドーナツ.js の値から（断面 PROFILE_PTS・寸法・生地とチョコの色）
   ====================================================================== */
(function () {
    var cv = $("#heroCanvas"); if (!cv) return;
    var c = setupCanvas(cv), ctx = c.ctx;
    var stageEl = $("#heroStage"), countEl = $("#heroCount");

    // ドーナツ.js の断面。[横（−1 が穴側, 1 が外側）, 高さ（0〜1）, 肌（0 = 型に接した面, 1 = 膨れた面）]
    // 外側の赤道から、上の膨れた面 → 穴 → 型の底 と一周する閉じた輪郭
    var SECT = [
        [1.000, 0.494, 0.00], [0.996, 0.655, 0.00], [0.952, 0.792, 0.08], [0.856, 0.918, 0.60],
        [0.700, 1.000, 1.00], [0.430, 0.958, 1.00], [0.070, 0.930, 1.00], [-0.300, 0.946, 1.00],
        [-0.575, 0.975, 1.00], [-0.795, 0.930, 0.72], [-0.928, 0.808, 0.14], [-1.000, 0.580, 0.00],
        [-0.985, 0.340, 0.00], [-0.898, 0.155, 0.00], [-0.660, 0.042, 0.00], [-0.280, 0.004, 0.00],
        [0.180, 0.000, 0.00], [0.580, 0.031, 0.00], [0.850, 0.146, 0.00], [0.968, 0.312, 0.00]
    ];
    var NSECT = SECT.length;
    // 寸法（cm）。外径 7.0 / 高さ 2.05。この実験の尺度（外径 ≒ 1.5）に縮める
    var RING = 2.32, TW = 1.20, TH = 2.05, K = 0.95 / (RING + TW);

    // 閉じた Catmull-Rom。s は 0〜1 で一周
    function sect(s, k) {
        var f = (s - Math.floor(s)) * NSECT, i = Math.floor(f), t = f - i;
        var p0 = SECT[(i + NSECT - 1) % NSECT][k], p1 = SECT[i % NSECT][k];
        var p2 = SECT[(i + 1) % NSECT][k], p3 = SECT[(i + 2) % NSECT][k];
        return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t);
    }
    // 外形もわずかに楕円で、真円ではない（ドーナツ.js の ringMod。工業製品なので幅は狭い）
    function ringMod(a) { return 1 + 0.018 * Math.cos(2 * a + 0.7) + 0.010 * Math.sin(3 * a + 1.9); }
    function sectR(s, a) { return (RING * ringMod(a) + sect(s, 0) * TW) * K; }
    function sectY(s) { return (sect(s, 1) - 0.5) * TH * K; }

    // 断面を軸のまわりに回す。行 = 断面に沿った s、列 = 周方向
    var NS = 40, MW = 64;
    var mesh = buildGrid(NS, MW, function (s, w, out) {
        var a = w * TAU, r = sectR(s, a);
        out[0] = r * Math.cos(a); out[1] = sectY(s); out[2] = r * Math.sin(a);
        return out;
    });

    // 上から見下ろして穴が見える角度にする
    var orb = orbit(cv, { elev: 0.62, speed: 0.275 });

    var STAGES = [
        { t: 1.5, name: "断面をひく" },
        { t: 3.0, name: "軸のまわりに点を回す" },
        { t: 4.5, name: "面を張る" },
        { t: 6.5, name: "焼き色をつける" },
        { t: 9.9, name: "チョコに浸ける" }
    ];
    var t0 = 0, started = false;

    // 生地の色（ドーナツ.js の doughAlbedo）
    var CRUMB = [0.906, 0.796, 0.616], BAKE = [0.868, 0.618, 0.334];
    var EDGE = [0.664, 0.392, 0.170], RAW = [0.948, 0.884, 0.744];
    var CHOCO = [0.170, 0.092, 0.058];
    // 1個の中に2つの肌。型に接した面は滑らかで濃く、膨れた面は浅い色でざらつく
    function skin(v) { return clamp(sect(v, 2), 0, 1); }
    function albedo(u, v) {
        var sk = skin(v);
        var n = Noise.fbmu(u * 14, v * 6, 14, 41, 4);
        var mold = mix3(BAKE, EDGE, clamp(0.25 + 0.55 * n, 0, 1));
        // 【対策】気泡を暗く塗るとカビになる。中は焼けていない生地なので明るい
        // 面1枚より細かい模様は四角いモザイクになるので、気泡は面の数に合わせて粗く引く
        var pore = smooth(0.58, 0.80, Noise.fbmu(u * 12, v * 6, 12, 7, 2));
        var risen = mix3(mix3(CRUMB, BAKE, 0.25 + 0.35 * n), RAW, pore * 0.35);
        var col = mix3(mold, risen, sk);
        // 型からあふれた縁（シーム）に、水平の一本線
        var seam = Math.exp(-Math.pow((v - 1 / NSECT) / 0.012, 2));
        return mix3(col, EDGE, seam * 0.7);
    }
    // チョコに浸けた範囲。膨れた面（上）だけで、境界は1本の弦。reach 0 → 1 で浸かっていく
    var DIP = 0.4;
    function choco(u, v, reach) {
        // 上の面（高さ 0.75 より上）だけ。外側の肩から内側の肩まで
        var top = smooth(0.70, 0.80, sect(v, 1));
        if (top <= 0) return 0;
        var a = u * TAU, r = sectR(v, a) / K;
        var wob = 0.30 * 2 * (Noise.fbmu(u * 7, 2.5, 7, 87, 2) - 0.5);
        var chord = mix(RING + TW + 0.4, -0.55, reach);
        var d = r * Math.cos(a - DIP) + wob;
        return top * smooth(chord - 0.18, chord + 0.18, d);
    }

    var matDough = { rough: 0.62, coat: 0.0, sss: 0.12, sheen: 0, sssCol: [1.0, 0.78, 0.55] };

    function drawProfileStage(k) {
        // 軸の左右に、同じ断面を1枚ずつ引く（回す前の「横顔」）
        var W = c.W, H = c.H, cx = W / 2, cy = H / 2, S = Math.min(W, H) * 0.42;
        ctx.strokeStyle = "rgba(138,119,101,.5)"; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(cx, cy - S * 0.6); ctx.lineTo(cx, cy + S * 0.6); ctx.stroke();
        [-1, 1].forEach(function (side) {
            ctx.strokeStyle = "#B8737E"; ctx.lineWidth = 2;
            ctx.beginPath();
            for (var i = 0; i <= 120; i++) {
                var s = i / 120;
                var x = cx + side * sectR(s, 0) * S, y = cy - sectY(s) * S;
                i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
            }
            ctx.closePath(); ctx.stroke();
            ctx.fillStyle = "#8F5A2B";
            for (var j = 0; j < NSECT; j++) {
                var px = cx + side * sectR(j / NSECT, 0) * S, py = cy - sectY(j / NSECT) * S;
                ctx.beginPath(); ctx.arc(px, py, 3.0 * clamp(k, 0.2, 1), 0, TAU); ctx.fill();
            }
        });
    }

    // 【対策】倍率は、このあと renderMesh に渡す zoom と同じにすること。
    //         違う値だと、点の群れと面を張ったあとで大きさが跳ぶ
    function drawPoints(rot, elev, k) {
        var W = c.W, H = c.H, S = Math.min(W, H) * 0.84, cx = W / 2, cy = H / 2;
        var cs = Math.cos(rot), sn = Math.sin(rot);
        var ce = Math.cos(elev), se = Math.sin(elev);
        var lim = Math.floor(mesh.count * clamp(k, 0, 1));
        ctx.fillStyle = "rgba(150,104,80,.85)";
        for (var i = 0; i < lim; i += 1) {
            var x = mesh.P[i * 3], y = mesh.P[i * 3 + 1], z = mesh.P[i * 3 + 2];
            var rx = x * cs + z * sn, qz = -x * sn + z * cs;
            var ry = y * ce + qz * se, rz = -y * se + qz * ce;
            var d = rz + CAM.dist, sc = CAM.f * S / Math.max(0.4, d);
            ctx.fillRect(cx + rx * sc - 0.9, cy - ry * sc - 0.9, 1.8, 1.8);
        }
        return lim;
    }

    addLoop(cv, function (dt, now) {
        if (!started) { t0 = now; started = true; }
        var el = now - t0;
        if (el > STAGES[STAGES.length - 1].t) { t0 = now; el = 0; }
        var si = 0;
        while (si < STAGES.length - 1 && el > STAGES[si].t) si++;
        var prev = si === 0 ? 0 : STAGES[si - 1].t;
        var k = clamp((el - prev) / (STAGES[si].t - prev || 1), 0, 1);

        ctx.clearRect(0, 0, c.W, c.H);
        var rot = orb.rot(now), ev = orb.elev;
        var shown = mesh.count;

        if (si === 0) { drawProfileStage(k); shown = NSECT; }
        else if (si === 1) { shown = drawPoints(rot, ev, k); }
        else if (si === 2) {
            renderMesh(ctx, c.W, c.H, mesh, { rot: rot, elev: ev, mode: "wire", zoom: 0.84 });
        } else if (si === 3) {
            renderMesh(ctx, c.W, c.H, mesh, {
                rot: rot, elev: ev, zoom: 0.84, mat: matDough,
                albedo: function (u, v) {
                    return mix3(RAW, albedo(u, v), clamp(k * 1.3, 0, 1));   // 生の生地 → 焼き色
                }
            });
        } else {
            // 【対策】ドーナツ.js はチョコにだけクリアコートを付け、生地には絶対に付けない。
            //         このミニレンダラは材質が1つしか持てないので、艶は足さずに色だけ変える
            var reach = smooth(0, 0.75, k);
            renderMesh(ctx, c.W, c.H, mesh, {
                rot: rot, elev: ev, zoom: 0.84, mat: matDough,
                albedo: function (u, v) { return mix3(albedo(u, v), CHOCO, choco(u, v, reach)); }
            });
        }

        if (stageEl) stageEl.textContent = STAGES[si].name;
        if (countEl) countEl.textContent = shown.toLocaleString("ja-JP") + " 頂点";
    });

    var replay = $("#heroReplay");
    if (replay) replay.addEventListener("click", function () { started = false; });
})();

/* ======================================================================
   02 — 種（シード）。ウィンナー8本の個体差
   ====================================================================== */
(function () {
    var cv = $("#seedCanvas"); if (!cv) return;
    var c = setupCanvas(cv), ctx = c.ctx;
    var seed = 7, useRng = true, mark;
    var out = $("#seedOut");

    function drawOne(x, y, len, rad, bend, R) {
        // 弓なりの軸に沿って断面を並べる（10章の掃引の2D版）
        var N = 48, top = [], bot = [];
        for (var i = 0; i <= N; i++) {
            var s = i / N;
            var cx = x + (s - 0.5) * len;
            var cy = y - Math.sin(Math.PI * s) * bend * len;
            // 端に向かって細る。両端は結び目
            var taper = Math.pow(Math.sin(Math.PI * clamp(s * 1.04 - 0.02, 0, 1)), 0.30);
            var wob = 1 + 0.045 * Math.sin(s * 11 + rad * 30);
            var r = rad * taper * wob;
            var ang = Math.atan2(-Math.PI * Math.cos(Math.PI * s) * bend * len, len);
            var nx = -Math.sin(ang), ny = -Math.cos(ang);
            top.push([cx + nx * r, cy + ny * r]);
            bot.push([cx - nx * r, cy - ny * r]);
        }
        ctx.beginPath();
        ctx.moveTo(top[0][0], top[0][1]);
        for (var a = 1; a <= N; a++) ctx.lineTo(top[a][0], top[a][1]);
        for (var b = N; b >= 0; b--) ctx.lineTo(bot[b][0], bot[b][1]);
        ctx.closePath();
        var g = ctx.createLinearGradient(0, y - rad, 0, y + rad);
        g.addColorStop(0, "#E8A16C"); g.addColorStop(0.42, "#CC6528"); g.addColorStop(1, "#8E3E15");
        ctx.fillStyle = g; ctx.fill();
        ctx.save(); ctx.clip();
        // 焼き色は「斑」。等高線状のグラデーションにしない
        for (var k = 0; k < 26; k++) {
            var s2 = R(), rr = R();
            var px = x + (s2 - 0.5) * len, py = y - Math.sin(Math.PI * s2) * bend * len + (rr - 0.5) * rad * 1.7;
            var rad2 = rad * (0.16 + R() * 0.34);
            ctx.fillStyle = R() > 0.72 ? "rgba(48,21,10,.55)" : "rgba(142,62,21,.42)";
            ctx.beginPath(); ctx.ellipse(px, py, rad2 * 1.5, rad2, R() * 3, 0, TAU); ctx.fill();
        }
        // 脂の膜のハイライトは点ではなく、稜に沿って長く伸びる筋
        ctx.strokeStyle = "rgba(255,238,214,.5)"; ctx.lineWidth = rad * 0.30;
        ctx.beginPath();
        for (var m = 0; m <= N; m++) {
            var p = top[m], q = bot[m];
            var hx = p[0] * 0.72 + q[0] * 0.28, hy = p[1] * 0.72 + q[1] * 0.28;
            m ? ctx.lineTo(hx, hy) : ctx.moveTo(hx, hy);
        }
        ctx.stroke();
        ctx.restore();
    }

    function draw() {
        ctx.clearRect(0, 0, c.W, c.H);
        var first = [];
        for (var i = 0; i < 8; i++) {
            var rng = useRng ? new Rng(seed + i * 1013) : null;
            var R = useRng ? function () { return rng.next(); } : Math.random;
            var len = 122 + R() * 34;
            var rad = 13 + R() * 5.5;
            var bend = 0.03 + R() * 0.09;
            var col = i % 2, row = (i / 2) | 0;
            drawOne(60 + col * 150 + (R() - 0.5) * 10, 52 + row * 76, len, rad, bend, R);
            if (i === 0) first = [len, rad, bend];
        }
        if (out) {
            out.innerHTML = (useRng ? "Rng(" + seed + ")" : "Math.random()") +
                "<br>1本目 … 長さ " + first[0].toFixed(1) +
                " / 太さ " + first[1].toFixed(2) + " / 曲がり " + first[2].toFixed(3) +
                "<br>" + (useRng ? "何度作っても同じ8本になります" :
                    "<b style='color:#8F1619'>作り直すたびに別の8本になります</b>");
        }
    }
    mark = lazyLoop(cv, draw);
    slider("#seedRange", "#seedRangeV", function (n) { return String(n | 0); }, function (n) { seed = n | 0; mark(); });
    chipGroup("#seedFn", function (v) { useRng = v === "rng"; mark(); });
    var btn = $("#seedRedraw");
    if (btn) btn.addEventListener("click", mark);
})();

/* ======================================================================
   03 — ノイズ。乱数 / 値ノイズ / fBm
   ====================================================================== */
(function () {
    var cv = $("#noiseCanvas"); if (!cv) return;
    var c = setupCanvas(cv), ctx = c.ctx;
    var S = 150;
    var pnA = pixelPanel(S, S), pnB = pixelPanel(S, S);
    var scale = 4, oct = 1, gain = 0.5, use = "raw", mark;

    function paint(pn, fn) {
        for (var y = 0; y < S; y++) for (var x = 0; x < S; x++) {
            var n = fn(x / S, y / S);
            var col;
            if (use === "raw") col = [n, n, n];
            else if (use === "bake") col = bakeColor(clamp(n * 1.25 - 0.05, 0, 1));
            else col = n < 0.45 ? mix3(CPORE, [0.42, 0.34, 0.26], (0.45 - n) / 0.45) : CRUMB;
            pn.set(y * S + x, col[0], col[1], col[2]);
        }
        pn.flush();
    }

    function draw() {
        ctx.clearRect(0, 0, c.W, c.H);
        paint(pnA, function (u, v) { return Noise.h2((u * S * scale / 6) | 0, (v * S * scale / 6) | 0, 5); });
        paint(pnB, function (u, v) { return Noise.fbm(u * scale, v * scale, 12, oct, gain); });
        var w = 250, h = 250, y = 42;
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(pnA.cv, 46, y, w, h);
        ctx.drawImage(pnB.cv, 46 + w + 48, y, w, h);
        ctx.strokeStyle = "rgba(36,28,21,.35)"; ctx.lineWidth = 1;
        ctx.strokeRect(46.5, y + 0.5, w, h);
        ctx.strokeRect(46.5 + w + 48, y + 0.5, w, h);
        ctx.fillStyle = "#57493C";
        ctx.font = "12px ui-monospace, Consolas, monospace";
        ctx.fillText("となりと無関係な乱数", 46, y - 12);
        ctx.fillText("値ノイズ（オクターブ " + oct + "）", 46 + w + 48, y - 12);
        ctx.fillStyle = "#8A7765";
        ctx.fillText("砂嵐にしかならない", 46, y + h + 20);
        ctx.fillText(oct === 1 ? "1枚だけだと、ぼんやりしたムラ" : "細かい粒が乗ってくる", 46 + w + 48, y + h + 20);
    }
    mark = lazyLoop(cv, draw);
    slider("#noiseScale", "#noiseScaleV", function (n) { return n.toFixed(1); }, function (n) { scale = n; mark(); });
    slider("#noiseOct", "#noiseOctV", function (n) { return String(n | 0); }, function (n) { oct = n | 0; mark(); });
    slider("#noiseGain", "#noiseGainV", f2, function (n) { gain = n; mark(); });
    chipGroup("#noiseUse", function (v) { use = v; mark(); });
})();

/* ======================================================================
   04 — 断面エディタ + 回転体プレビュー
   ====================================================================== */
(function () {
    var pcv = $("#profCanvas"), rcv = $("#revCanvas");
    if (!pcv || !rcv) return;
    var pc = setupCanvas(pcv), rc = setupCanvas(rcv);
    var key = "dango";
    var orb = orbit(rcv, { elev: 0.25, speed: 0.45 });
    var ctrl = cloneProfile(PROFILES.dango);
    var height = PROFILE_H.dango;
    var bump = 0.10;
    var drag = -1, markP;

    function px(p) { return 34 + p.r * (pc.W - 60) * 0.62; }
    function py(p) { return pc.H - 22 - p.t * (pc.H - 44); }

    function drawProfile() {
        var ctx = pc.ctx, W = pc.W, H = pc.H;
        ctx.clearRect(0, 0, W, H);
        // 方眼
        ctx.strokeStyle = "rgba(200,186,156,.65)"; ctx.lineWidth = 1;
        for (var g = 0; g <= 8; g++) {
            var gy = 22 + g * (H - 44) / 8;
            ctx.beginPath(); ctx.moveTo(20, gy); ctx.lineTo(W - 14, gy); ctx.stroke();
        }
        // 軸
        ctx.strokeStyle = "rgba(36,28,21,.5)"; ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.moveTo(34, 16); ctx.lineTo(34, H - 16); ctx.stroke();
        // 曲線
        ctx.strokeStyle = "#8F1619"; ctx.lineWidth = 2;
        ctx.beginPath();
        for (var i = 0; i <= 80; i++) {
            var t = i / 80, r = sampleProfile(ctrl, t);
            var x = 34 + r * (W - 60) * 0.62, y = H - 22 - t * (H - 44);
            i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.stroke();
        // 左右対称の相方（回すとこうなる、が見えるように薄く）
        ctx.strokeStyle = "rgba(143,22,25,.22)";
        ctx.beginPath();
        for (var i2 = 0; i2 <= 80; i2++) {
            var t2 = i2 / 80, r2 = sampleProfile(ctrl, t2);
            var x2 = 34 - r2 * (W - 60) * 0.62, y2 = H - 22 - t2 * (H - 44);
            i2 ? ctx.lineTo(x2, y2) : ctx.moveTo(x2, y2);
        }
        ctx.stroke();
        // 制御点
        for (var j = 0; j < ctrl.length; j++) {
            ctx.fillStyle = j === drag ? "#8F1619" : "#F5F1E8";
            ctx.strokeStyle = "#8F1619"; ctx.lineWidth = 1.6;
            ctx.beginPath(); ctx.arc(px(ctrl[j]), py(ctrl[j]), 5, 0, TAU);
            ctx.fill(); ctx.stroke();
        }
        ctx.fillStyle = "#8A7765";
        ctx.font = "11px ui-monospace, Consolas, monospace";
        ctx.fillText("r →", W - 40, H - 6);
        ctx.fillText("t", 22, 16);
    }

    var mesh = null;
    function rebuild() {
        var shape = makeShape(ctrl, { height: height, bump: bump, seed: 19 });
        mesh = buildMesh(shape, 42, 44);
    }

    function pick(k) {
        key = k;
        ctrl = cloneProfile(PROFILES[k]);
        height = PROFILE_H[k];
        // 茶碗だけは、既定でもう少し見下ろしたほうが中が見える。
        // ただし自分で角度を決めたあとは上書きしない
        orb.setElev(k === "bowl" ? 0.45 : 0.25);
        rebuild(); drawProfile();
    }

    // ドラッグで半径を変える
    function local(e) {
        var b = pcv.getBoundingClientRect();
        return { x: (e.clientX - b.left) / b.width * pc.W, y: (e.clientY - b.top) / b.height * pc.H };
    }
    pcv.addEventListener("pointerdown", function (e) {
        var p = local(e), best = -1, bd = 20 * 20;
        for (var i = 0; i < ctrl.length; i++) {
            var dx = px(ctrl[i]) - p.x, dy = py(ctrl[i]) - p.y, d = dx * dx + dy * dy;
            if (d < bd) { bd = d; best = i; }
        }
        if (best >= 0) { drag = best; pcv.setPointerCapture(e.pointerId); drawProfile(); }
    });
    pcv.addEventListener("pointermove", function (e) {
        if (drag < 0) return;
        var p = local(e);
        var r = (p.x - 34) / ((pc.W - 60) * 0.62);
        // 両端は 0 付近に留める。開けると穴になって中が見える
        var lim = (drag === 0 || drag === ctrl.length - 1) ? 0.34 : 1.05;
        ctrl[drag].r = clamp(r, 0.01, lim);
        rebuild(); drawProfile();
    });
    ["pointerup", "pointercancel"].forEach(function (ev) {
        pcv.addEventListener(ev, function () { drag = -1; drawProfile(); });
    });

    pick("dango");
    addLoop(rcv, function (dt, now) {
        var ctx = rc.ctx;
        ctx.clearRect(0, 0, rc.W, rc.H);
        if (!mesh) return;
        var m = key === "cookie" ? MATS.tako : (key === "bowl" ? MATS.rice : MATS.dango);
        renderMesh(ctx, rc.W, rc.H, mesh, {
            rot: orb.rot(now), elev: orb.elev, zoom: 0.9,
            mat: m, albedo: function () { return m.col; }
        });
    });
    window.addEventListener("resize", function () { setTimeout(drawProfile, 60); });
    chipGroup("#profPreset", pick);
    slider("#profBump", "#profBumpV", f2, function (n) { bump = n; rebuild(); });
})();

/* ======================================================================
   05 — 巻き順と法線
   ====================================================================== */
(function () {
    var cv = $("#meshCanvas"); if (!cv) return;
    var c = setupCanvas(cv), ctx = c.ctx;
    var mode = "solid", smoothN = true, flip = false, N = 40, M = 40;
    var orb = orbit(cv, { elev: 0.24, speed: 0.42 });
    var mesh = null;

    function rebuild() {
        mesh = buildMesh(makeShape(PROFILES.dango, { height: PROFILE_H.dango, bump: 0.06, seed: 3 }), N, M);
    }
    rebuild();

    addLoop(cv, function (dt, now) {
        ctx.clearRect(0, 0, c.W, c.H);
        renderMesh(ctx, c.W, c.H, mesh, {
            rot: orb.rot(now), elev: orb.elev, zoom: 0.92,
            mode: mode, smooth: smoothN, flip: flip,
            mat: MATS.dango, albedo: function () { return MATS.dango.col; }
        });
        if (mode === "facing") {
            ctx.fillStyle = "#57493C";
            ctx.font = "12px ui-monospace, Consolas, monospace";
            ctx.fillText("緑＝表　赤＝裏（ふつうは裏は描かれない）", 14, c.H - 12);
        }
    });
    chipGroup("#meshMode", function (v) { mode = v; });
    toggle("#meshSmooth", function (v) { smoothN = v; });
    toggle("#meshFlip", function (v) { flip = v; });
    slider("#meshN", "#meshNV", function (n) { return String(n | 0); }, function (n) { N = n | 0; rebuild(); });
    slider("#meshM", "#meshMV", function (n) { return String(n | 0); }, function (n) { M = n | 0; rebuild(); });
})();

/* ======================================================================
   06 — テクスチャ（トーストの3枚）
   ====================================================================== */
(function () {
    var cv = $("#texCanvas"); if (!cv) return;
    var c = setupCanvas(cv), ctx = c.ctx;
    var S = 150;
    var pnMap = pixelPanel(S, S), pnOut = pixelPanel(S, S);
    var map = "albedo", bake = 0.45, pore = 0.5, applyOn = true, mark;

    // す（気泡）の高さの場。低いところが穴
    function height(u, v) {
        var n = Noise.fbm(u * 7.5, v * 7.5, 44, 4);
        var cell = Noise.fbm(u * 15, v * 15, 88, 2);
        var h = 1 - smooth(0.42, 0.62, mix(n, cell, 0.55)) * pore;
        return h;
    }
    function heat(u, v) {
        // 焼き色は高いところほど濃い（たべもの編12章）。ムラも少し混ぜる
        var h = height(u, v);
        var n = Noise.fbm(u * 3.2, v * 3.2, 21, 4);
        return clamp(bake * 1.35 * (0.45 + 0.75 * h) + (n - 0.5) * 0.34, 0, 1);
    }
    function rough(u, v) {
        // 焦げるほど炭化して光らない＝粗い。すの底も粗い
        return clamp(0.42 + heat(u, v) * 0.42 + (1 - height(u, v)) * 0.2, 0, 1);
    }
    function normalAt(u, v, e) {
        var hu = height(u + e, v), hd = height(u - e, v);
        var hv1 = height(u, v + e), hv2 = height(u, v - e);
        // 【対策】v 方向は (下 - 上)。逆にすると凸が凹に化ける
        var nx = (hd - hu) * 6, ny = (hv2 - hv1) * 6, nz = 1;
        var L = Math.hypot(nx, ny, nz);
        return [nx / L, ny / L, nz / L];
    }

    function draw() {
        ctx.clearRect(0, 0, c.W, c.H);
        var e = 1 / S;
        for (var y = 0; y < S; y++) for (var x = 0; x < S; x++) {
            var u = x / S, v = y / S, i = y * S + x, col;
            if (map === "albedo") col = bakeColor(heat(u, v));
            else if (map === "rough") { var r = rough(u, v); col = [r, r, r]; }
            else { var n = normalAt(u, v, e); col = [n[0] * 0.5 + 0.5, n[1] * 0.5 + 0.5, n[2] * 0.5 + 0.5]; }
            pnMap.set(i, col[0], col[1], col[2]);

            // 右側：3枚を全部使って陰影をつけた結果
            var alb = bakeColor(heat(u, v));
            if (!applyOn) { pnOut.set(i, alb[0], alb[1], alb[2]); continue; }
            var nn = normalAt(u, v, e);
            var L2 = [-0.42, -0.52, 0.74];
            var ndl = Math.max(0, nn[0] * L2[0] + nn[1] * L2[1] + nn[2] * L2[2]);
            var rg = rough(u, v);
            var hx = L2[0], hy = L2[1], hz = L2[2] + 1;
            var hl = Math.hypot(hx, hy, hz); hx /= hl; hy /= hl; hz /= hl;
            var ndh = Math.max(0, nn[0] * hx + nn[1] * hy + nn[2] * hz);
            var spec = Math.pow(ndh, mix(4, 220, (1 - rg) * (1 - rg))) * (0.03 + 0.5 * (1 - rg));
            var lit = 0.30 + 0.85 * ndl;
            pnOut.set(i, srgbToLin(alb[0]) * lit + spec, srgbToLin(alb[1]) * lit + spec, srgbToLin(alb[2]) * lit + spec);
        }
        pnMap.flush(); pnOut.flush();

        var w = 250, h = 250, y0 = 46;
        ctx.drawImage(pnMap.cv, 40, y0, w, h);
        ctx.drawImage(pnOut.cv, 40 + w + 50, y0, w, h);
        ctx.strokeStyle = "rgba(36,28,21,.35)"; ctx.lineWidth = 1;
        ctx.strokeRect(40.5, y0 + 0.5, w, h);
        ctx.strokeRect(40.5 + w + 50, y0 + 0.5, w, h);
        ctx.fillStyle = "#57493C"; ctx.font = "12px ui-monospace, Consolas, monospace";
        var names = { albedo: "1枚目 色（アルベド）", rough: "2枚目 粗さ（ORM の G）", normal: "3枚目 凹凸（法線マップ）" };
        ctx.fillText(names[map], 40, y0 - 12);
        ctx.fillText(applyOn ? "3枚とも使って陰影をつけた結果" : "色だけを貼った結果", 40 + w + 50, y0 - 12);
        if (map === "rough") {
            ctx.fillStyle = "#8A7765";
            ctx.fillText("白いほど、ざらざら（光らない）", 40, y0 + h + 20);
        }
    }
    mark = lazyLoop(cv, draw);
    chipGroup("#texMap", function (v) { map = v; mark(); });
    slider("#texBake", "#texBakeV", f2, function (n) { bake = n; mark(); });
    slider("#texPore", "#texPoreV", f2, function (n) { pore = n; mark(); });
    toggle("#texApplyOn", function (v) { applyOn = v; mark(); });
})();

/* ======================================================================
   07 — PBR（粗さ・クリアコート・透け）
   ====================================================================== */
(function () {
    var cv = $("#pbrCanvas"); if (!cv) return;
    var c = setupCanvas(cv), ctx = c.ctx;
    var base = MATS.dango, mat = copyMat(base);
    var orb = orbit(cv, { elev: 0.22, speed: 0.40 });
    var mesh = buildMesh(makeShape(PROFILES.dango, { height: PROFILE_H.dango, bump: 0.045, seed: 11 }), 44, 46);
    var out = $("#pbrOut");

    function say() {
        if (!out) return;
        var t = [];
        if (mat.rough < 0.12) t.push("<b style='color:#8F1619'>粗さが鋭すぎます（成型品に見えます）</b>");
        else if (mat.rough > 0.8) t.push("完全なつや消し。粉をふいた状態");
        if (mat.coat > 0.7) t.push("膜が強く、下地の色まで明るく見えます");
        if (mat.sss < 0.05) t.push("<b style='color:#8F1619'>透けなし。石膏や消しゴムに見えます</b>");
        else if (mat.sss > 0.8) t.push("透けすぎ。光る風船です");
        out.innerHTML = "rough " + f2(mat.rough) + " / coat " + f2(mat.coat) + " / sss " + f2(mat.sss) +
            (t.length ? "<br>" + t.join("<br>") : "<br>実物の範囲に入っています");
    }
    addLoop(cv, function (dt, now) {
        ctx.clearRect(0, 0, c.W, c.H);
        renderMesh(ctx, c.W, c.H, mesh, {
            rot: orb.rot(now), elev: orb.elev, zoom: 0.92,
            mat: mat, albedo: function () { return base.col; }
        });
    });
    var sr = slider("#pbrRough", "#pbrRoughV", f2, function (n) { mat.rough = n; say(); });
    var sc = slider("#pbrCoat", "#pbrCoatV", f2, function (n) { mat.coat = n; say(); });
    var ss = slider("#pbrSss", "#pbrSssV", f2, function (n) { mat.sss = n; say(); });
    chipGroup("#pbrPreset", function (v) {
        base = MATS[v] || MATS.dango;
        mat = copyMat(base);
        if (sr) { sr.value = mat.rough; sr.dispatchEvent(new Event("input")); }
        if (sc) { sc.value = mat.coat; sc.dispatchEvent(new Event("input")); }
        if (ss) { ss.value = mat.sss; ss.dispatchEvent(new Event("input")); }
    });
})();

/* ======================================================================
   08 — 落として積む（唐揚げの山）
   断面（横から見た2D）での簡易シミュレーション
   ====================================================================== */
(function () {
    var cv = $("#dropCanvas"); if (!cv) return;
    var c = setupCanvas(cv), ctx = c.ctx;
    var count = 18, fric = 0.55, rest = 0.04;
    var out = $("#dropOut");
    var bodies = [], queue = 0, timer = 0, R = null;

    // 皿。円弧の内側に落ちる
    var BOWL = { x: 320, y: 120, r: 208 };

    function reset() {
        bodies = []; queue = count; timer = 0; R = new Rng(20250809);
    }
    reset();

    function spawn() {
        var r = 15 + R.next() * 7;
        bodies.push({
            x: BOWL.x + (R.next() - 0.5) * 120, y: 26,
            vx: (R.next() - 0.5) * 18, vy: 0, r: r,
            a: R.next() * TAU, va: (R.next() - 0.5) * 2,
            k: R.next()
        });
    }

    function step(dt) {
        var g = 620;
        for (var s = 0; s < 2; s++) {
            var h = dt / 2;
            for (var i = 0; i < bodies.length; i++) {
                var b = bodies[i];
                b.vy += g * h;
                b.x += b.vx * h; b.y += b.vy * h; b.a += b.va * h;
                b.va *= 0.985;
            }
            // 皿との衝突
            for (var j = 0; j < bodies.length; j++) {
                var p = bodies[j];
                var dx = p.x - BOWL.x, dy = p.y - BOWL.y;
                var d = Math.hypot(dx, dy) || 1;
                var lim = BOWL.r - p.r;
                if (d > lim) {
                    var nx = dx / d, ny = dy / d;
                    p.x = BOWL.x + nx * lim; p.y = BOWL.y + ny * lim;
                    var vn = p.vx * nx + p.vy * ny;
                    if (vn > 0) {
                        p.vx -= (1 + rest) * vn * nx; p.vy -= (1 + rest) * vn * ny;
                        // 接線方向を摩擦で減らす
                        var tx = -ny, ty = nx, vt = p.vx * tx + p.vy * ty;
                        p.vx -= vt * fric * tx; p.vy -= vt * fric * ty;
                        p.va -= vt * fric * 0.02;
                    }
                }
            }
            // 粒どうし
            for (var a = 0; a < bodies.length; a++) for (var b2 = a + 1; b2 < bodies.length; b2++) {
                var A = bodies[a], B = bodies[b2];
                var ddx = B.x - A.x, ddy = B.y - A.y;
                var dd = Math.hypot(ddx, ddy) || 1, mn = A.r + B.r;
                if (dd < mn) {
                    var ux = ddx / dd, uy = ddy / dd, pen = (mn - dd) * 0.5;
                    A.x -= ux * pen; A.y -= uy * pen; B.x += ux * pen; B.y += uy * pen;
                    var rv = (B.vx - A.vx) * ux + (B.vy - A.vy) * uy;
                    if (rv < 0) {
                        var jimp = -(1 + rest) * rv * 0.5;
                        A.vx -= jimp * ux; A.vy -= jimp * uy;
                        B.vx += jimp * ux; B.vy += jimp * uy;
                        var tx2 = -uy, ty2 = ux;
                        var rvt = (B.vx - A.vx) * tx2 + (B.vy - A.vy) * ty2;
                        A.vx += rvt * fric * 0.5 * tx2; A.vy += rvt * fric * 0.5 * ty2;
                        B.vx -= rvt * fric * 0.5 * tx2; B.vy -= rvt * fric * 0.5 * ty2;
                        A.va -= rvt * 0.004; B.va += rvt * 0.004;
                    }
                }
            }
        }
    }

    function drawPiece(b) {
        // 唐揚げ1個。衣のでこぼこを7角形のゆらぎで作る
        ctx.save();
        ctx.translate(b.x, b.y); ctx.rotate(b.a);
        ctx.beginPath();
        for (var i = 0; i <= 22; i++) {
            var a = i / 22 * TAU;
            var rr = b.r * (0.86 + 0.20 * Noise.v2u(a / TAU * 7, b.k * 40, 7, 5, 3));
            var x = Math.cos(a) * rr, y = Math.sin(a) * rr * 0.86;
            i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.closePath();
        var g = ctx.createRadialGradient(-b.r * 0.3, -b.r * 0.4, b.r * 0.15, 0, 0, b.r * 1.3);
        g.addColorStop(0, "#D9A14E"); g.addColorStop(0.55, "#AB5517"); g.addColorStop(1, "#6E320B");
        ctx.fillStyle = g; ctx.fill();
        ctx.strokeStyle = "rgba(70,32,10,.35)"; ctx.lineWidth = 1; ctx.stroke();
        ctx.restore();
    }

    addLoop(cv, function (dt, now) {
        timer += dt;
        if (queue > 0 && timer > 0.10) { timer = 0; spawn(); queue--; }
        step(Math.min(0.03, dt));
        ctx.clearRect(0, 0, c.W, c.H);
        // 皿
        ctx.beginPath();
        ctx.arc(BOWL.x, BOWL.y, BOWL.r, 0.10 * Math.PI, 0.90 * Math.PI);
        ctx.strokeStyle = "#3A3A3C"; ctx.lineWidth = 7; ctx.stroke();
        for (var i = 0; i < bodies.length; i++) drawPiece(bodies[i]);
        if (out) {
            var moving = 0, top = 999;
            for (var j = 0; j < bodies.length; j++) {
                if (Math.hypot(bodies[j].vx, bodies[j].vy) > 6) moving++;
                top = Math.min(top, bodies[j].y);
            }
            out.innerHTML = bodies.length + " 個 / 動いている " + moving +
                "<br>山の高さ " + (bodies.length ? Math.round(BOWL.y + BOWL.r - top) : 0) + " px";
        }
    });
    slider("#dropCount", "#dropCountV", function (n) { return String(n | 0); }, function (n) { count = n | 0; });
    slider("#dropFric", "#dropFricV", f2, function (n) { fric = n; });
    slider("#dropRest", "#dropRestV", f2, function (n) { rest = n; });
    var b = $("#dropRun"); if (b) b.addEventListener("click", reset);
})();

/* ======================================================================
   09 — トッピングを撒いて、重なりをほぐす
   ====================================================================== */
(function () {
    var cv = $("#scatterCanvas"); if (!cv) return;
    var c = setupCanvas(cv), ctx = c.ctx;
    var n = 90, iter = 0, mode = "random", mark;
    var out = $("#scatterOut");
    var CX = 320, CY = 178, RAD = 148;

    function build() {
        var R = new Rng(4649), pts = [];
        if (mode === "grid") {
            var side = Math.ceil(Math.sqrt(n * 1.27));
            for (var i = 0; i < side && pts.length < n; i++)
                for (var j = 0; j < side && pts.length < n; j++) {
                    var x = CX + (i / (side - 1) - 0.5) * RAD * 2;
                    var y = CY + (j / (side - 1) - 0.5) * RAD * 2;
                    if (Math.hypot(x - CX, y - CY) < RAD - 8) pts.push({ x: x, y: y, a: 0, k: R.next() });
                }
        } else {
            for (var k = 0; k < n; k++) {
                // 面積で一様にするため sqrt をとる。とらないと中心に集まる
                var t = R.next() * TAU, rr = Math.sqrt(R.next()) * (RAD - 8);
                pts.push({ x: CX + Math.cos(t) * rr, y: CY + Math.sin(t) * rr, a: R.next() * TAU, k: R.next() });
            }
        }
        // 近すぎる組を、離れる方向へ少しずつ押す
        var MIN = 15;
        for (var it = 0; it < iter; it++) {
            for (var a = 0; a < pts.length; a++) for (var b = a + 1; b < pts.length; b++) {
                var dx = pts[b].x - pts[a].x, dy = pts[b].y - pts[a].y;
                var d = Math.hypot(dx, dy) || 1;
                if (d < MIN) {
                    var push = (MIN - d) * 0.24, ux = dx / d, uy = dy / d;
                    pts[a].x -= ux * push; pts[a].y -= uy * push;
                    pts[b].x += ux * push; pts[b].y += uy * push;
                }
            }
            for (var q = 0; q < pts.length; q++) {
                var ddx = pts[q].x - CX, ddy = pts[q].y - CY, dd = Math.hypot(ddx, ddy);
                if (dd > RAD - 8) { pts[q].x = CX + ddx / dd * (RAD - 8); pts[q].y = CY + ddy / dd * (RAD - 8); }
            }
        }
        return pts;
    }

    function draw() {
        var pts = build();
        ctx.clearRect(0, 0, c.W, c.H);
        // たこ焼きの玉（上から見たところ）
        var g = ctx.createRadialGradient(CX - 40, CY - 50, 20, CX, CY, RAD);
        g.addColorStop(0, "#C98B3E"); g.addColorStop(0.7, "#965821"); g.addColorStop(1, "#5E3210");
        ctx.beginPath(); ctx.arc(CX, CY, RAD, 0, TAU); ctx.fillStyle = g; ctx.fill();

        var overlap = 0;
        for (var i = 0; i < pts.length; i++) {
            for (var j = i + 1; j < pts.length; j++) {
                if (Math.hypot(pts[j].x - pts[i].x, pts[j].y - pts[i].y) < 13) { overlap++; break; }
            }
            var p = pts[i];
            ctx.save();
            ctx.translate(p.x, p.y); ctx.rotate(p.a + p.k * 3);
            // 青のりは板ポリゴン。細長いかけら
            var w = 8 + p.k * 9, h = 2.4 + p.k * 2.2;
            ctx.fillStyle = p.k > 0.82 ? "rgba(232,222,196,.95)" : "rgba(46,86,34,.92)";
            ctx.fillRect(-w / 2, -h / 2, w, h);
            ctx.restore();
        }
        if (out) {
            out.innerHTML = pts.length + " 枚 / 重なっている組 " + overlap +
                "<br>" + (mode === "grid" ? "<b style='color:#8F1619'>重なりは 0。でも「並べた」に見えます</b>"
                    : iter === 0 ? "撒いたまま。濃い染みができています"
                        : iter > 20 ? "<b style='color:#8F1619'>ほぐしすぎ。格子に近づいています</b>"
                            : "ほぐし中。このあたりが実物に近い");
        }
    }
    mark = lazyLoop(cv, draw);
    slider("#scatterN", "#scatterNV", function (v) { return String(v | 0); }, function (v) { n = v | 0; mark(); });
    slider("#scatterIter", "#scatterIterV", function (v) { return String(v | 0); }, function (v) { iter = v | 0; mark(); });
    chipGroup("#scatterMode", function (v) { mode = v; mark(); });
})();

/* ======================================================================
   10 — 軸に沿った掃引（ウィンナー / 秋刀魚）
   ====================================================================== */
(function () {
    var cv = $("#sweepCanvas"); if (!cv) return;
    var c = setupCanvas(cv), ctx = c.ctx;
    var kind = "wiener", bend = 0.06, plump = 0.06, flat = 1.0, ring = false;
    var orb = orbit(cv, { elev: 0.30, speed: 0.105 });
    var mesh = null;

    // 秋刀魚の体高。焼き魚（サンマ）.js が線画から実測した表をそのまま使う
    // （最大体高を 1 とした比。u=0 が吻端、u=1 が尾柄）
    // 【対策】ここは以前、山を1つ置いた式（ピーク u=0.22、幅 0.30）で
    //         近似していた。2か所まちがえていて、木の葉に見えていた。
    //         ・最大体高は u≒0.22 ではなく u≒0.39。鰓蓋のすぐ後ろではなく、
    //           胴の中ほど
    //         ・胴の後半が早く細りすぎ。実測では u=0.48 でまだ 0.99 あるのに、
    //           山の式では 0.60 まで落ちていた。だから頭寄りだけが膨らんだ
    var SANMA_D = [
        { t: 0.000, r: 0.075 }, { t: 0.030, r: 0.190 }, { t: 0.060, r: 0.360 },
        { t: 0.095, r: 0.545 }, { t: 0.130, r: 0.720 }, { t: 0.175, r: 0.888 },
        { t: 0.225, r: 0.972 }, { t: 0.300, r: 0.996 }, { t: 0.390, r: 1.000 },
        { t: 0.480, r: 0.988 }, { t: 0.570, r: 0.945 }, { t: 0.665, r: 0.858 },
        { t: 0.760, r: 0.712 }, { t: 0.850, r: 0.458 }, { t: 0.920, r: 0.302 },
        { t: 0.965, r: 0.226 }, { t: 1.000, r: 0.180 }
    ];
    // 【対策】比だけ合っていても、全長との釣り合いを外すと魚に見えない。
    //         秋刀魚は全長 30cm に対し体高 4.15cm で、7:1 を超える細長さ。
    //         軸の長さ LEN=2.5 が 30cm ぶんなので、最大半径は
    //         4.15 / 2 / 12 = 0.173。以前は 0.45 あり、2.8:1 の魚だった
    var SANMA_R = 0.173;

    // 体型。u=0 が頭（左）、u=1 が尾
    function bodyR(u) {
        if (kind === "sanma") return sampleProfile(SANMA_D, u) * SANMA_R;
        // ウィンナー。ほぼ平行で、端は結び目に向かって細る
        return 0.30 * Math.pow(Math.sin(Math.PI * clamp(u * 1.06 - 0.03, 0, 1)), 0.28) + 0.004;
    }

    function rebuild() {
        var LEN = 2.5;
        mesh = buildGrid(72, 40, function (s, w, out) {
            var a = w * TAU;
            // 軸（スパイン）。ゆるい弓なり
            var cx = (s - 0.5) * LEN;
            var cy = -Math.sin(Math.PI * s) * bend * LEN;
            // 接線 → 断面の平面（面内の N と、奥行きの B）
            var dx = LEN, dy = -Math.PI * Math.cos(Math.PI * s) * bend * LEN;
            var dl = Math.hypot(dx, dy) || 1;
            var nx = -dy / dl, ny = dx / dl;
            var r = bodyR(s) * (1 + plump * Math.sin(s * 13.7) + plump * 0.6 * (Noise.v2(s * 9, 3, 12) - 0.5) * 2);
            var co = Math.cos(a) * r, si = Math.sin(a) * r * flat;
            out[0] = cx + nx * co; out[1] = cy + ny * co; out[2] = si;
            return out;
        });
    }
    rebuild();

    addLoop(cv, function (dt, now) {
        ctx.clearRect(0, 0, c.W, c.H);
        var m = kind === "sanma"
            ? { rough: 0.30, coat: 0.30, sss: 0.10, sheen: 0.10, sssCol: [0.9, 0.9, 1.0] }
            : MATS.wiener;
        renderMesh(ctx, c.W, c.H, mesh, {
            rot: orb.rot(now) + 0.25, elev: orb.elev, zoom: 1.15, cull: true,
            mode: ring ? "wire" : "solid",
            mat: m,
            albedo: function (u, v) {
                if (kind === "sanma") {
                    // 背は青黒、体側は銀、腹は白銀。u は周方向
                    var up = Math.cos(u * TAU);
                    var t = clamp(up * 0.5 + 0.5, 0, 1);
                    var col = t > 0.62 ? mix3([0.605, 0.665, 0.700], [0.078, 0.142, 0.150], (t - 0.62) / 0.38)
                        : mix3([0.882, 0.868, 0.822], [0.605, 0.665, 0.700], t / 0.62);
                    // 焼き目は「点在する丸い斑」。全面を覆わせない
                    var n = Noise.fbmu(u * 6, v * 5, 6, 66, 4);
                    var burn = smooth(0.60, 0.78, n);
                    return mix3(col, [0.758, 0.606, 0.372], burn * 0.75);
                }
                var n2 = Noise.fbmu(u * 5, v * 4, 5, 33, 4);
                return mix3([0.865, 0.520, 0.290], [0.560, 0.245, 0.095], smooth(0.38, 0.72, n2));
            }
        });
    });
    chipGroup("#sweepShape", function (v) {
        kind = v; rebuild();
        var f = $("#sweepFlat");
        if (f) { f.value = v === "sanma" ? 0.6 : 1.0; f.dispatchEvent(new Event("input")); }
    });
    slider("#sweepBend", "#sweepBendV", function (n) { return n.toFixed(3); }, function (n) { bend = n; rebuild(); });
    slider("#sweepPlump", "#sweepPlumpV", function (n) { return n.toFixed(3); }, function (n) { plump = n; rebuild(); });
    slider("#sweepFlat", "#sweepFlatV", f2, function (n) { flat = n; rebuild(); });
    toggle("#sweepRing", function (v) { ring = v; });
})();

/* ======================================================================
   11 — シーン（露出・環境光・トーンマッピング）
   ====================================================================== */
(function () {
    var cv = $("#sceneCanvas"); if (!cv) return;
    var c = setupCanvas(cv), ctx = c.ctx;
    var mat = copyMat(MATS.dango);
    mat.expo = 1; mat.ambK = 1; mat.tonemap = true;
    var keyDeg = -40;
    var orb = orbit(cv, { elev: 0.22, speed: 0.36 });
    var mesh = buildMesh(makeShape(PROFILES.dango, { height: PROFILE_H.dango, bump: 0.05, seed: 8 }), 44, 46);
    var out = $("#sceneOut");

    function say() {
        if (!out) return;
        var msg = [];
        if (!mat.tonemap && mat.expo > 1.3) msg.push("<b style='color:#8F1619'>ハイライトが真っ白に貼り付いています</b>");
        if (mat.ambK < 0.15) msg.push("影が黒く潰れています");
        if (mat.ambK > 1.8) msg.push("環境光が強すぎて、平べったく見えます");
        if (keyDeg > 100 || keyDeg < -100) msg.push("逆光ぎみ。縁が抜けて立体に見えます");
        out.innerHTML = "露出 " + f2(mat.expo) + " / 環境光 " + f2(mat.ambK) +
            " / " + (mat.tonemap ? "ACES あり" : "切り落とし") +
            (msg.length ? "<br>" + msg.join("<br>") : "");
    }
    addLoop(cv, function (dt, now) {
        ctx.clearRect(0, 0, c.W, c.H);
        var a = keyDeg * Math.PI / 180;
        renderMesh(ctx, c.W, c.H, mesh, {
            rot: orb.rot(now), elev: orb.elev, zoom: 0.92, mat: mat,
            light: [Math.sin(a), 0.72, -Math.cos(a)],
            albedo: function () { return MATS.dango.col; }
        });
    });
    slider("#sceneExpo", "#sceneExpoV", f2, function (n) { mat.expo = n; say(); });
    slider("#sceneAmb", "#sceneAmbV", f2, function (n) { mat.ambK = n; say(); });
    slider("#sceneKey", "#sceneKeyV", function (n) { return (n | 0) + "°"; }, function (n) { keyDeg = n; say(); });
    toggle("#sceneTone", function (v) { mat.tonemap = v; say(); });
})();

/* ======================================================================
   12 — たれは色ではなく層（吸収）
   1ピクセルずつ解いて、3個の団子に掛ける
   ====================================================================== */
(function () {
    var cv = $("#glazeCanvas"); if (!cv) return;
    var c = setupCanvas(cv), ctx = c.ctx;
    var W = 300, H = 168;
    var pn = pixelPanel(W, H);
    var paint = false, thick = 0.45, cover = 0.62, body = true, mark;
    var out = $("#glazeOut");

    // みたらしのたれ。花見団子.js の飴色に合わせた吸収係数
    var EXT = [1.35, 3.05, 5.20];
    var DOUGH = [0.955, 0.930, 0.860];

    var BALLS = [{ x: 78, y: 92 }, { x: 150, y: 84 }, { x: 222, y: 92 }];
    var BR = 44;

    // その点に乗っているたれの厚み。上から掛かって、途中で止まる
    function glazeAt(bx, by, nx, ny) {
        // ny > 0 が上。上ほど厚く、下へ流れて止まる
        var top = ny;                                   // -1（下）〜 1（上）
        var line = 1 - cover * 2;                       // これより下には行かない
        if (top < line) return 0;
        var t = (top - line) / (1 - line + 1e-6);
        var streak = 0.55 + 0.45 * Noise.v2(nx * 3 + bx * 0.05, top * 3, 9);
        // たまり（下端の縁）が厚くなる
        var pool = 1 + 0.9 * Math.exp(-Math.pow((top - line) / 0.18, 2));
        return thick * (0.35 + 0.75 * t) * streak * pool;
    }

    function draw() {
        for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) {
            var i = y * W + x;
            var r = 0.94, g = 0.92, b = 0.87;           // 背景（紙）
            var best = -1, bz = -1e9, bn = null;
            for (var k = 0; k < BALLS.length; k++) {
                var B = BALLS[k];
                var dx = (x - B.x) / BR, dy = (y - B.y) / BR;
                // 厚みを形にも出す：たれの乗るところが少し膨らむ
                var d2 = dx * dx + dy * dy;
                if (d2 > 1.25) continue;
                var nz0 = 1 - d2;
                if (nz0 <= 0) continue;
                var nzz = Math.sqrt(nz0);
                var nyv = -dy, nxv = dx;
                var extra = body && !paint ? glazeAt(B.x, B.y, nxv, nyv) * 0.10 : 0;
                var dd = Math.hypot(dx, dy) * (1 - extra);
                if (dd > 1) continue;
                var z = Math.sqrt(Math.max(0, 1 - dd * dd));
                if (z > bz) { bz = z; best = k; bn = [dx, -dy, nzz]; }
            }
            if (best >= 0) {
                var L = [-0.42, 0.55, 0.72];
                var n = bn, nl = Math.hypot(n[0], n[1], n[2]) || 1;
                var nx = n[0] / nl, ny = n[1] / nl, nz = n[2] / nl;
                var ndl = Math.max(0, nx * L[0] + ny * L[1] + nz * L[2]);
                var th = glazeAt(BALLS[best].x, BALLS[best].y, nx, ny);
                var col, rough;
                if (paint) {
                    // 昔の版：アルベドに茶色を塗る。厚みが色に効かない
                    col = th > 0 ? [0.42, 0.24, 0.10] : DOUGH;
                    rough = 0.55;
                } else if (th > 0) {
                    // 層として解く：base * exp(-EXT * 厚み)
                    col = [DOUGH[0] * Math.exp(-EXT[0] * th),
                           DOUGH[1] * Math.exp(-EXT[1] * th),
                           DOUGH[2] * Math.exp(-EXT[2] * th)];
                    rough = 0.10;                        // 液体の面は下の肌理を埋める
                } else {
                    col = DOUGH; rough = 0.42;
                }
                var hx = L[0], hy = L[1], hz = L[2] + 1;
                var hl = Math.hypot(hx, hy, hz); hx /= hl; hy /= hl; hz /= hl;
                var ndh = Math.max(0, nx * hx + ny * hy + nz * hz);
                var spec = Math.pow(ndh, mix(6, 420, (1 - rough) * (1 - rough))) * (0.05 + 0.75 * (1 - rough));
                var sss = Math.pow(1 - nz, 2.2) * (th > 0 ? 0.10 : 0.35);
                var lit = 0.26 + 0.92 * ndl;
                r = srgbToLin(col[0]) * lit + spec + sss * 0.9;
                g = srgbToLin(col[1]) * lit + spec + sss * 0.80;
                b = srgbToLin(col[2]) * lit + spec + sss * 0.66;
                r = tone(r); g = tone(g); b = tone(b);
            }
            pn.set(i, r, g, b);
        }
        pn.flush();
        ctx.clearRect(0, 0, c.W, c.H);
        ctx.drawImage(pn.cv, 20, 12, 600, 336);
        // 串。3個を貫いて右へ抜ける。平たい竹なので線で描く
        ctx.strokeStyle = "rgba(178,148,100,.95)"; ctx.lineWidth = 6;
        ctx.beginPath(); ctx.moveTo(548, 199); ctx.lineTo(626, 210); ctx.stroke();
        if (out) {
            var sample = thick * 1.2;
            out.innerHTML = paint
                ? "<b style='color:#8F1619'>アルベドに茶色を塗っています。厚みを変えても色が変わりません</b>"
                : "厚み " + f2(sample) + " のところ<br>" +
                  "R exp(-" + EXT[0] + "×" + f2(sample) + ") = " + Math.exp(-EXT[0] * sample).toFixed(3) + "<br>" +
                  "G exp(-" + EXT[1] + "×" + f2(sample) + ") = " + Math.exp(-EXT[1] * sample).toFixed(3) + "<br>" +
                  "B exp(-" + EXT[2] + "×" + f2(sample) + ") = " + Math.exp(-EXT[2] * sample).toFixed(3);
        }
    }
    mark = lazyLoop(cv, draw);
    toggle("#glazePaint", function (v) { paint = v; mark(); });
    slider("#glazeThick", "#glazeThickV", f2, function (n) { thick = n; mark(); });
    slider("#glazeCover", "#glazeCoverV", f2, function (n) { cover = n; mark(); });
    toggle("#glazeBody", function (v) { body = v; mark(); });
})();

/* ======================================================================
   13 — 触れ合うと潰れる（接触変形）
   ====================================================================== */
(function () {
    var cv = $("#squashCanvas"); if (!cv) return;
    var c = setupCanvas(cv), ctx = c.ctx;
    var amt = 0.30, useVol = true, useRim = true, useStack = true, mark;
    var out = $("#squashOut");

    // 三方に積んだ団子を、正面から切った断面。
    // 【対策】以前は 4・3・2・1 の10個を積んでいた。月見団子.js の既定は
    //         十五夜の 9 + 4 + 2 = 15個（3x3 / 2x2 / 2個を縦に並べる）で、
    //         正面から切ると 3・2・1 に見える。同じ章の本文が
    //         「15個を三方に積みます（9 + 4 + 2）」と書いているのに、
    //         その下の実験だけ別の積み方になっていた
    var R0 = 40, GY = 320;
    function layout() {
        var rows = [3, 2, 1], balls = [], y = GY - R0;
        for (var r = 0; r < rows.length; r++) {
            var n = rows[r];
            for (var i = 0; i < n; i++) {
                balls.push({
                    x: 320 + (i - (n - 1) / 2) * (R0 * 1.86),
                    y: y, row: r,
                    depth: (rows.length - 1 - r) / (rows.length - 1)   // 下ほど 1
                });
            }
            y -= R0 * 1.62;
        }
        return balls;
    }

    // 多項式スムーズ最小値。k のぶんだけ境目が丸くつながる（＝土手）
    function smin(a, b, k) {
        if (k <= 0) return Math.min(a, b);
        var h = Math.max(0, k - Math.abs(a - b)) / k;
        return Math.min(a, b) - h * h * k * 0.25;
    }

    function radiusAt(ball, contacts, ang, k, press) {
        var dx = Math.cos(ang), dy = Math.sin(ang);
        var r = R0;
        for (var i = 0; i < contacts.length; i++) {
            var cN = contacts[i];
            var d = dx * cN.nx + dy * cN.ny;
            if (d > 0.02) r = smin(r, cN.dist / d, k);
        }
        return r;
    }

    function draw() {
        var balls = layout();
        ctx.clearRect(0, 0, c.W, c.H);
        // 三方の台
        ctx.fillStyle = "#C9B896";
        ctx.fillRect(150, GY, 340, 14);
        ctx.fillStyle = "#B8A47F";
        ctx.fillRect(210, GY + 14, 220, 26);

        var totalLoss = 0;
        for (var b = 0; b < balls.length; b++) {
            var B = balls[b];
            var press = amt * (useStack ? (0.35 + 0.65 * B.depth) : 1);
            var contacts = [];
            // 台（いちばん下の段だけ）
            if (B.row === 0) contacts.push({ nx: 0, ny: 1, dist: R0 * (1 - press) });
            // 隣・上下
            for (var o = 0; o < balls.length; o++) {
                if (o === b) continue;
                var dx = balls[o].x - B.x, dy = -(balls[o].y - B.y);
                var d = Math.hypot(dx, dy);
                if (d > R0 * 2.2 || d < 1) continue;
                contacts.push({ nx: dx / d, ny: dy / d, dist: d / 2 * (1 - press * 0.62) });
            }
            // 縁の丸み。月見団子.js は R x 0.090 だが、それでは画面上 4px 弱に
            // なって切り口との差が見えないので、ここでは誇張してある
            var k = useRim ? R0 * 0.30 : 0;
            // 潰して減った面積を測る（体積の代わり）
            var STEP = 84, base = 0, cur = 0, rs = [];
            for (var i = 0; i < STEP; i++) {
                var a = i / STEP * TAU;
                var r = radiusAt(B, contacts, a, k, press);
                rs.push(r); cur += r * r; base += R0 * R0;
            }
            var loss = clamp(1 - cur / base, 0, 1);
            totalLoss += loss;
            var grow = useVol ? 1 + loss * 0.5 : 1;

            ctx.beginPath();
            for (var j = 0; j < STEP; j++) {
                var a2 = j / STEP * TAU;
                var rr = rs[j] * grow;
                var x = B.x + Math.cos(a2) * rr, y = B.y - Math.sin(a2) * rr;
                j ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
            }
            ctx.closePath();
            var g = ctx.createRadialGradient(B.x - 14, B.y - 18, 6, B.x, B.y, R0 * 1.35);
            g.addColorStop(0, "#FFFDF7"); g.addColorStop(0.6, "#F1EADC"); g.addColorStop(1, "#CFC5B0");
            ctx.fillStyle = g; ctx.fill();
            ctx.strokeStyle = "rgba(120,108,88,.45)"; ctx.lineWidth = 1; ctx.stroke();
        }
        if (out) {
            var avg = totalLoss / balls.length;
            out.innerHTML = "十五夜（9 + 4 + 2 = 15個）の断面 " + balls.length +
                " 個 / 平均で断面の " + (avg * 100).toFixed(1) + "% が潰れています<br>" +
                (!useVol && !useRim && amt < 0.02
                    ? "<b style='color:#8F1619'>ただの球。発泡スチロールに見えます</b>"
                    : (useVol ? "" : "<b style='color:#8F1619'>体積が戻っていません（やせた球）</b><br>") +
                      (useRim ? "" : "<b style='color:#8F1619'>接触の縁に角ができています</b>"));
        }
    }
    mark = lazyLoop(cv, draw);
    slider("#squashAmt", "#squashAmtV", f2, function (n) { amt = n; mark(); });
    toggle("#squashVol", function (v) { useVol = v; mark(); });
    toggle("#squashRim", function (v) { useRim = v; mark(); });
    toggle("#squashStack", function (v) { useStack = v; mark(); });
})();

/* ======================================================================
   14 — 揺れはばねの重ね合わせ（モーダル変形）
   プリンを真横から見る。せん断（横揺れ）と縦の2モードだけ回す
   ====================================================================== */
(function () {
    var cv = $("#jigCanvas"); if (!cv) return;
    var c = setupCanvas(cv), ctx = c.ctx;
    var W = 200, H = 170;
    var pn = pixelPanel(W, H);
    var out = $("#jigOut");

    // 寸法は画素。プリン.js の rBot 3.30 / rTop 2.30 / H 4.30 の比に合わせる
    var BH = 112, RB = 70, RT = 49, CX = 100, GY = 160;
    // 周波数はプリン.js の modeFreq × freqScale（5.8 × 0.5）。縦は 9.2 / 5.8 倍、減衰比は 0.145 / 0.105 倍
    var PRESET = {
        purin:  { f: 2.90, z: 0.105 },
        jelly:  { f: 5.60, z: 0.055 },   // ゼリー.js 8.0 × 0.70
        kanten: { f: 2.90, z: 0.30 },
        gomu:   { f: 2.90, z: 0.03 }
    };
    var freq = 2.9, zeta = 0.105, useN = true;
    var q = [0, 0], qd = [0, 0], acc = 0, t = 0;
    var hist = [], HN = 240;
    var MAXQ = [26, 16];     // tanh の頭打ち（プリン.js の modeMax）

    function omega(k) { return TAU * freq * (k === 0 ? 1 : 9.2 / 5.8); }
    function zk(k) { return zeta * (k === 0 ? 1 : 0.145 / 0.105); }
    var dir = 1;
    function shake() {
        dir = -dir;              // 左右を交互に押す
        qd[0] += dir * 340; qd[1] += 120;
    }
    // 片持ちのたわみ形状と、その傾き
    function psi(s) { return 1.5 * s * s - 0.5 * s * s * s; }
    function dpsi(s) { return 3 * s - 1.5 * s * s; }

    function step(dt) {
        acc += Math.min(dt, 0.05);
        var h = 1 / 240;
        while (acc >= h) {
            for (var k = 0; k < 2; k++) {
                var w = omega(k), z = zk(k);
                qd[k] += (-2 * z * w * qd[k] - w * w * q[k]) * h;
                q[k] += qd[k] * h;
            }
            acc -= h; t += h;
        }
    }

    function draw() {
        var Q0 = MAXQ[0] * Math.tanh(q[0] / MAXQ[0]);
        var Q1 = MAXQ[1] * Math.tanh(q[1] / MAXQ[1]);
        var L = [-0.45, 0.55, 0.70], Ll = Math.hypot(L[0], L[1], L[2]);
        L = [L[0] / Ll, L[1] / Ll, L[2] / Ll];
        var hx = L[0], hy = L[1], hz = L[2] + 1, hl = Math.hypot(hx, hy, hz);
        hx /= hl; hy /= hl; hz /= hl;
        var taper = (RB - RT) / BH;
        for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) {
            var i = y * W + x;
            var r = 0.955, g = 0.945, b = 0.925;
            // 変形した点から、静止形状の点へ戻す（縦: y = y0(1 - Q1/H)、せん断: x += Q0·ψ(s)）
            var yy = GY - y;
            var y0 = yy / (1 - Q1 / BH);
            var s = y0 / BH;
            if (s >= 0 && s <= 1) {
                var x0 = (x - CX - Q0 * psi(s)) / (1 + Q1 / (2 * BH));
                var rad = mix(RB, RT, s);
                // 上の縁の丸め
                var fl = 7;
                if (y0 > BH - fl) rad -= fl - Math.sqrt(Math.max(0, fl * fl - Math.pow(y0 - (BH - fl), 2)));
                if (Math.abs(x0) < rad) {
                    var u = x0 / rad;
                    var nx = u, nz = Math.sqrt(Math.max(0, 1 - u * u)), ny = taper;
                    if (useN) {
                        // n' = n − (∇u)ᵀ n。せん断は ∂ux/∂y、縦は対角成分
                        ny -= nx * Q0 * dpsi(s) / BH;
                        nx *= 1 - Q1 / (2 * BH); nz *= 1 - Q1 / (2 * BH); ny *= 1 + Q1 / BH;
                    }
                    var nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
                    var ndl = Math.max(0, nx * L[0] + ny * L[1] + nz * L[2]);
                    var spec = Math.pow(Math.max(0, nx * hx + ny * hy + nz * hz), 140) * 0.9;
                    // カスタード → 上端のカラメルの染み（プリン.js の CUSTARD）
                    var st = smooth(0.80, 0.97, s);
                    var col = mix3([0.955, 0.840, 0.550], [0.760, 0.480, 0.190], st);
                    if (s > 0.965) col = [0.36, 0.14, 0.04];
                    var lit = 0.30 + 0.85 * ndl;
                    var sss = Math.pow(1 - nz, 2) * 0.18;
                    r = tone(srgbToLin(col[0]) * lit + spec + sss);
                    g = tone(srgbToLin(col[1]) * lit + spec + sss * 0.75);
                    b = tone(srgbToLin(col[2]) * lit + spec + sss * 0.40);
                }
            }
            if (y >= GY && y < GY + 4) { r = 0.86; g = 0.87; b = 0.88; }   // 皿
            pn.set(i, r, g, b);
        }
        pn.flush();
        ctx.clearRect(0, 0, c.W, c.H);
        ctx.drawImage(pn.cv, 0, 8, 400, 340);

        // q の記録
        var X0 = 420, X1 = 626, YM = 180, AMP = 120;
        ctx.strokeStyle = "rgba(36,28,21,.25)"; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(X0, YM); ctx.lineTo(X1, YM); ctx.stroke();
        ctx.strokeStyle = "#C27A30"; ctx.lineWidth = 2;
        ctx.beginPath();
        for (var j = 0; j < hist.length; j++) {
            var px = X0 + (X1 - X0) * j / (HN - 1), py = YM - hist[j] / MAXQ[0] * AMP;
            j ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
        }
        ctx.stroke();
        ctx.fillStyle = "rgba(36,28,21,.6)"; ctx.font = "12px sans-serif";
        ctx.fillText("横揺れ q（直近 4 秒）", X0, 40);

        if (out) {
            var w0 = omega(0), z0 = zk(0);
            var t10 = Math.log(10) / (z0 * w0);       // 振幅が 1/10 になるまで
            out.innerHTML = "振幅が 1/10 になるまで " + t10.toFixed(2) + " 秒<br>" +
                "そのあいだに約 " + (t10 * freq).toFixed(1) + " 回揺れる" +
                (useN ? "" : "<br><b style='color:#8F1619'>法線が止まっています。ハイライトが一緒に滑りません</b>");
        }
    }

    var last = 0;
    addLoop(cv, function (dt, now) {
        step(dt);
        // 1/60 秒ごとに記録（4 秒ぶん）
        if (now - last > 1 / 60) {
            last = now;
            hist.push(MAXQ[0] * Math.tanh(q[0] / MAXQ[0]));
            if (hist.length > HN) hist.shift();
        }
        draw();
    });

    var fEl = slider("#jigFreq", "#jigFreqV", f2, function (n) { freq = n; });
    var zEl = slider("#jigZeta", "#jigZetaV", function (n) { return n.toFixed(3); }, function (n) { zeta = n; });
    chipGroup("#jigPreset", function (v) {
        var p = PRESET[v]; if (!p) return;
        if (fEl) { fEl.value = p.f; fEl.dispatchEvent(new Event("input")); }
        if (zEl) { zEl.value = p.z; zEl.dispatchEvent(new Event("input")); }
        shake();
    });
    toggle("#jigNormal", function (v) { useN = v; });
    var btn = $("#jigShake");
    if (btn) btn.addEventListener("click", shake);
    cv.addEventListener("click", shake);
    cv.style.cursor = "pointer";
    shake();
})();

/* ======================================================================
   15 — ゼリーの色は光路長で決まる
   菊型のゼリーを正面から見て、画素ごとに中を通る距離を数える
   ====================================================================== */
(function () {
    var cv = $("#jellyCanvas"); if (!cv) return;
    var c = setupCanvas(cv), ctx = c.ctx;
    var W = 220, H = 170;
    var pn = pixelPanel(W, H), pd = pixelPanel(W, H);
    var out = $("#jellyOut");
    var paint = false, sigma = 1, thin = true, flavor = "melon", mark;

    // ゼリー.js の FLAVORS。基準の光路 4.5cm を通ったあとの透過率（linear）
    var T0 = {
        melon: [0.300, 0.440, 0.050],
        strawberry: [0.560, 0.030, 0.030],
        grape: [0.230, 0.045, 0.310],
        orange: [0.800, 0.310, 0.028]
    };
    var REF = 4.5;
    // 寸法（cm）。ゼリー.js の rBot 4.05 / rTop 2.50 / H 5.30 / 溝 12本・深さ 0.34・g^0.6
    var JH = 5.3, RB = 4.05, RT = 2.5, FIL = 0.72, NF = 12, DEP = 0.34, POW = 0.6;
    var S = 21;                 // 1cm あたりの画素
    var CX = W / 2, GY = H - 8;

    // 周方向の形を表にしておく（1 が山、0 が谷）
    var NT = 1024, FT = new Float32Array(NT);
    for (var k = 0; k < NT; k++) {
        var gg = 0.5 + 0.5 * Math.cos(NF * k / NT * TAU);
        FT[k] = Math.pow(gg, POW);
    }
    function flute(th) {
        // 【対策】u が丸めでちょうど 1 になると表の外を引いて NaN になり、白い点が散る
        var u = th / TAU; u -= Math.floor(u);
        return FT[((u * NT) | 0) & (NT - 1)];
    }
    // 母線の半径。胴は少しふくらみ、肩は丸い
    function side(y) { var s = y / JH; return mix(RB, RT + FIL, s) + 0.15 * Math.sin(Math.PI * s); }
    function prof(y) {
        if (y < 0 || y > JH) return 0;
        var y0 = JH - FIL;
        if (y <= y0) return side(y);
        // 肩：胴の半径から天面の RT まで、段を作らずに丸める
        var t = (y - y0) / FIL;
        return RT + (side(y0) - RT) * Math.sqrt(Math.max(0, 1 - t * t));
    }
    function rEff(th, y, carve) {
        var r = prof(y);
        if (!carve) return r;
        return r - DEP * smooth(0, 0.3, y) * (1 - flute(th));
    }
    // 光路長：視線（z 方向）に沿って中にいる長さを数える
    function chord(X, Y, carve) {
        var R = prof(Y); if (R <= 0 || Math.abs(X) >= R) return 0;
        // 【対策】中か外かだけを数えると、刻みの段が縦縞になって出る。
        //         境目をまたぐ区間は、内外の深さの比で按分する
        var zM = Math.sqrt(R * R - X * X), n = 48, dz = 2 * zM / n, d = 0;
        var fPrev = rEff(Math.atan2(-zM, X), Y, carve) - R;
        for (var i = 1; i <= n; i++) {
            var z = -zM + i * dz;
            var f = rEff(Math.atan2(z, X), Y, carve) - Math.hypot(X, z);
            if (fPrev > 0 && f > 0) d += dz;
            else if (fPrev > 0 || f > 0) d += dz * Math.max(fPrev, f) / (Math.abs(fPrev) + Math.abs(f) + 1e-9);
            fPrev = f;
        }
        return d;
    }
    // 手前の面の法線（∇F、F = r − rEff(θ, y)）
    function frontNormal(X, Y) {
        var R = prof(Y), zM = Math.sqrt(Math.max(0, R * R - X * X));
        var z = zM;
        for (var i = 0; i < 40; i++) {
            if (Math.hypot(X, z) < rEff(Math.atan2(z, X), Y, true)) break;
            z -= zM / 40;
        }
        var th = Math.atan2(z, X), r = Math.hypot(X, z) || 1e-6, e = 0.004;
        var dth = (rEff(th + e, Y, true) - rEff(th - e, Y, true)) / (2 * e);
        // 底のすぐ上で下側を測ると prof が 0 になって傾きが跳ねる（白い点が出る）
        var ya = Math.max(0.005, Y - 0.02), yb = Math.min(JH - 0.005, Y + 0.02);
        var dy = (rEff(th, yb, true) - rEff(th, ya, true)) / (yb - ya);
        var c0 = Math.cos(th), s0 = Math.sin(th);
        var nx = c0 + dth / r * s0, nz = s0 - dth / r * c0, ny = -dy;
        var l = Math.hypot(nx, ny, nz) || 1;
        return [nx / l, ny / l, nz / l];
    }

    function draw() {
        var T = T0[flavor];
        var sig = [-Math.log(T[0]) / REF * sigma, -Math.log(T[1]) / REF * sigma, -Math.log(T[2]) / REF * sigma];
        var L = [-0.40, 0.62, 0.68], Ll = Math.hypot(L[0], L[1], L[2]);
        L = [L[0] / Ll, L[1] / Ll, L[2] / Ll];
        var hx = L[0], hy = L[1], hz = L[2] + 1, hl = Math.hypot(hx, hy, hz);
        hx /= hl; hy /= hl; hz /= hl;
        var BG = [0.92, 0.93, 0.94], dMax = 2 * RB;
        for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) {
            var i = y * W + x;
            var X = (x + 0.5 - CX) / S, Y = (GY - y - 0.5) / S;
            var r = BG[0], g = BG[1], b = BG[2], dv = 0;
            var R = prof(Y);
            if (R > 0 && Math.abs(X) < R) {
                var dSil = chord(X, Y, true);
                if (dSil > 0) {
                    // 光路：溝の目減りを入れるかどうか
                    var d = thin ? dSil : chord(X, Y, false);
                    dv = d / dMax;
                    var n = frontNormal(X, Y);
                    var ndl = Math.max(0, n[0] * L[0] + n[1] * L[1] + n[2] * L[2]);
                    var spec = Math.pow(Math.max(0, n[0] * hx + n[1] * hy + n[2] * hz), 260) * 1.1;
                    var fres = 0.04 + 0.5 * Math.pow(1 - Math.max(0, n[2]), 5);
                    if (paint) {
                        // アルベドに「基準の厚みの色」を塗る。厚みに関係なく同じ
                        r = T[0] * (0.25 + 0.85 * ndl) + spec * 0.5;
                        g = T[1] * (0.25 + 0.85 * ndl) + spec * 0.5;
                        b = T[2] * (0.25 + 0.85 * ndl) + spec * 0.5;
                    } else {
                        // 透過光 = 背景 × exp(−σ·d)
                        r = BG[0] * Math.exp(-sig[0] * d) * (1 - fres) + fres * 0.9 + spec;
                        g = BG[1] * Math.exp(-sig[1] * d) * (1 - fres) + fres * 0.9 + spec;
                        b = BG[2] * Math.exp(-sig[2] * d) * (1 - fres) + fres * 0.9 + spec;
                    }
                    r = tone(r); g = tone(g); b = tone(b);
                } else { r = tone(r); g = tone(g); b = tone(b); }
            } else { r = tone(r); g = tone(g); b = tone(b); }
            if (y > GY) { r = 0.80; g = 0.80; b = 0.81; }
            pn.set(i, r, g, b);
            pd.set(i, dv, dv, dv);
        }
        pn.flush(); pd.flush();
        ctx.clearRect(0, 0, c.W, c.H);
        ctx.drawImage(pn.cv, 0, 10, 440, 340);
        ctx.drawImage(pd.cv, 456, 120, 176, 136);
        ctx.fillStyle = "rgba(36,28,21,.6)"; ctx.font = "12px sans-serif";
        ctx.fillText("光路長 d（白いほど長い）", 456, 112);

        if (out) {
            // 胴の高さで、中心と縁の近くを比べる
            var Y0 = JH * 0.45, R0 = prof(Y0) * 0.85;
            var dP = chord(0, Y0, thin), dV = chord(R0, Y0, thin);
            var tr = function (dd) {
                return [Math.exp(-sig[0] * dd), Math.exp(-sig[1] * dd), Math.exp(-sig[2] * dd)]
                    .map(function (v) { return v.toFixed(2); }).join(", ");
            };
            out.innerHTML = paint
                ? "<b style='color:#8F1619'>色を塗っています。光路長を見ていないので、厚みで色が変わりません</b>"
                : "σ（1cm あたり） " + sig.map(function (v) { return v.toFixed(2); }).join(", ") + "<br>" +
                  "胴の中心 d = " + dP.toFixed(2) + "cm → 透過 (" + tr(dP) + ")<br>" +
                  "縁の近く d = " + dV.toFixed(2) + "cm → 透過 (" + tr(dV) + ")";
        }
    }
    mark = lazyLoop(cv, draw);
    chipGroup("#jellyFlavor", function (v) { flavor = v; mark(); });
    toggle("#jellyPaint", function (v) { paint = v; mark(); });
    slider("#jellySigma", "#jellySigmaV", f2, function (n) { sigma = n; mark(); });
    toggle("#jellyThin", function (v) { thin = v; mark(); });
})();

/* ======================================================================
   16 — 距離の場から輪郭を拾う（2次元のサーフェスネット）
   飴細工.js のウサギを横から見た形。部品を smin で溶かし、格子から線を張る
   ====================================================================== */
(function () {
    var cv = $("#sdfCanvas"); if (!cv) return;
    var c = setupCanvas(cv), ctx = c.ctx;
    var out = $("#sdfOut");
    var kk = 0.6, hGrid = 0.36, mode = "proj", showField = true, mark;

    // 表示範囲（cm）と倍率
    var XMIN = -4.4, XMAX = 4.6, YMIN = -2.9, YMAX = 4.9, SC = 44;
    var OX = (c.W - (XMAX - XMIN) * SC) / 2, OY = (c.H - (YMAX - YMIN) * SC) / 2;
    function sx(x) { return OX + (x - XMIN) * SC; }
    function sy(y) { return OY + (YMAX - y) * SC; }

    function smin(a, b, k) {
        if (k <= 0) return Math.min(a, b);
        var h = Math.max(k - Math.abs(a - b), 0) / k;
        return Math.min(a, b) - h * h * k * 0.25;
    }
    // 楕円（iq の近似距離。飴細工.js の sdEll を2次元にしたもの）
    function ell(px, py, cx, cy, rx, ry) {
        var a = (px - cx) / rx, b = (py - cy) / ry;
        var k0 = Math.sqrt(a * a + b * b);
        var a2 = a / rx, b2 = b / ry, k1 = Math.sqrt(a2 * a2 + b2 * b2);
        return k0 * (k0 - 1) / Math.max(k1, 1e-9);
    }
    // 先細りカプセル（半径を線形に変える簡易版）
    function cap(px, py, ax, ay, bx, by, r1, r2) {
        var pax = px - ax, pay = py - ay, bax = bx - ax, bay = by - ay;
        var h = clamp((pax * bax + pay * bay) / (bax * bax + bay * bay), 0, 1);
        return Math.hypot(pax - bax * h, pay - bay * h) - mix(r1, r2, h);
    }
    // k は飴細工.js の値の比を保って、頭と胴の 0.7 を基準に振る
    function sdf(x, y) {
        var m = kk / 0.7;
        var d = ell(x, y, -1.3, 0.15, 1.55, 1.45);
        d = smin(d, ell(x, y, 0.3, 0.0, 1.7, 1.25), 0.9 * m);
        d = smin(d, ell(x, y, 1.55, 0.45, 1.1, 1.2), 0.9 * m);
        d = smin(d, cap(x, y, 0.1, -0.7, 0.1, -2.6, 0.62, 0.5), 0.6 * m);
        d = smin(d, ell(x, y, -2.75, 1.25, 0.55, 0.62), 0.3 * m);
        var hd = ell(x, y, 2.7, 1.9, 1.18, 1.05);
        hd = smin(hd, ell(x, y, 3.62, 1.58, 0.62, 0.55), 0.45 * m);
        hd = smin(hd, cap(x, y, 2.35, 2.6, 1.35, 4.5, 0.42, 0.26), 0.25 * m);
        hd = smin(hd, cap(x, y, 2.6, 2.6, 2.4, 4.4, 0.40, 0.25), 0.25 * m);
        d = smin(d, hd, 0.7 * m);
        var leg = smin(cap(x, y, 1.6, -0.3, 2.3, -1.5, 0.42, 0.3), ell(x, y, 2.45, -1.65, 0.42, 0.24), 0.15 * m);
        d = smin(d, leg, 0.3 * m);
        var hind = smin(ell(x, y, -1.5, -0.5, 1.0, 0.75), cap(x, y, -1.9, -0.8, -3.0, -1.9, 0.5, 0.36), 0.3 * m);
        d = smin(d, hind, 0.35 * m);
        return d;
    }

    function draw() {
        ctx.clearRect(0, 0, c.W, c.H);
        // 距離の場（等高線）
        if (showField) {
            var PW = 220, PH = 180, pn = pixelPanel(PW, PH);
            for (var j = 0; j < PH; j++) for (var i = 0; i < PW; i++) {
                var x = XMIN + (i + 0.5) / PW * (XMAX - XMIN);
                var y = YMAX - (j + 0.5) / PH * (YMAX - YMIN);
                var d = sdf(x, y);
                var band = Math.abs((d / 0.3) - Math.round(d / 0.3));
                var line = band < 0.07 ? 0.10 : 0;
                var col = d < 0 ? [1.0, 0.86, 0.62] : [0.97, 0.95, 0.91];
                pn.set(j * PW + i, col[0] - line, col[1] - line, col[2] - line * 0.8);
            }
            pn.flush();
            ctx.drawImage(pn.cv, OX, OY, (XMAX - XMIN) * SC, (YMAX - YMIN) * SC);
        }

        // 格子で測る
        var h = hGrid;
        var nx = Math.ceil((XMAX - XMIN) / h) + 1, ny = Math.ceil((YMAX - YMIN) / h) + 1;
        var F = new Float32Array(nx * ny);
        for (var b = 0; b < ny; b++) for (var a = 0; a < nx; a++) F[b * nx + a] = sdf(XMIN + a * h, YMIN + b * h);
        if (mode === "blur") {
            // アイス.js と同じ 1:2:1 を軸ごとに1回
            var T = new Float32Array(F.length);
            for (b = 0; b < ny; b++) for (a = 0; a < nx; a++) {
                var l = F[b * nx + Math.max(0, a - 1)], r = F[b * nx + Math.min(nx - 1, a + 1)];
                T[b * nx + a] = (l + 2 * F[b * nx + a] + r) * 0.25;
            }
            for (b = 0; b < ny; b++) for (a = 0; a < nx; a++) {
                var u = T[Math.max(0, b - 1) * nx + a], dn = T[Math.min(ny - 1, b + 1) * nx + a];
                F[b * nx + a] = (u + 2 * T[b * nx + a] + dn) * 0.25;
            }
        }
        // セルごとに頂点を1つ（符号の変わる辺の交点の平均）
        var cellV = new Int32Array((nx - 1) * (ny - 1)).fill(-1), P = [];
        for (b = 0; b < ny - 1; b++) for (a = 0; a < nx - 1; a++) {
            var f = [F[b * nx + a], F[b * nx + a + 1], F[(b + 1) * nx + a], F[(b + 1) * nx + a + 1]];
            var neg = (f[0] < 0) + (f[1] < 0) + (f[2] < 0) + (f[3] < 0);
            if (neg === 0 || neg === 4) continue;
            var E = [[0, 1, 0, 0, 1, 0], [2, 3, 0, 1, 1, 1], [0, 2, 0, 0, 0, 1], [1, 3, 1, 0, 1, 1]];
            var px = 0, py = 0, n = 0;
            for (var e = 0; e < 4; e++) {
                var f0 = f[E[e][0]], f1 = f[E[e][1]];
                if ((f0 < 0) === (f1 < 0)) continue;
                var t = f0 / (f0 - f1);
                px += mix(E[e][2], E[e][4], t); py += mix(E[e][3], E[e][5], t); n++;
            }
            cellV[b * (nx - 1) + a] = P.length;
            P.push([XMIN + (a + px / n) * h, YMIN + (b + py / n) * h]);
        }
        // 面へ射影（飴細工.js の projectToSurface。2回、1歩は格子の 0.6 倍まで）
        if (mode === "proj") {
            for (var v = 0; v < P.length; v++) {
                var p = P[v];
                for (var it = 0; it < 2; it++) {
                    var dd = sdf(p[0], p[1]), ee = 0.005;
                    var gx = (sdf(p[0] + ee, p[1]) - sdf(p[0] - ee, p[1])) / (2 * ee);
                    var gy = (sdf(p[0], p[1] + ee) - sdf(p[0], p[1] - ee)) / (2 * ee);
                    var g2 = gx * gx + gy * gy; if (g2 < 1e-8) break;
                    var stx = gx * dd / g2, sty = gy * dd / g2, sl = Math.hypot(stx, sty);
                    if (sl > h * 0.6) { stx *= h * 0.6 / sl; sty *= h * 0.6 / sl; }
                    p[0] -= stx; p[1] -= sty;
                }
            }
        }
        // 符号の変わる格子の辺ごとに、両側のセルの頂点を結ぶ
        var segs = 0;
        ctx.strokeStyle = "#57301A"; ctx.lineWidth = 2; ctx.lineJoin = "round";
        ctx.beginPath();
        for (b = 0; b < ny; b++) for (a = 0; a < nx; a++) {
            var s0 = F[b * nx + a] < 0;
            if (a + 1 < nx && b >= 1 && b < ny - 1 && s0 !== (F[b * nx + a + 1] < 0)) {
                var v0 = cellV[(b - 1) * (nx - 1) + a], v1 = cellV[b * (nx - 1) + a];
                if (v0 >= 0 && v1 >= 0) { ctx.moveTo(sx(P[v0][0]), sy(P[v0][1])); ctx.lineTo(sx(P[v1][0]), sy(P[v1][1])); segs++; }
            }
            if (b + 1 < ny && a >= 1 && a < nx - 1 && s0 !== (F[(b + 1) * nx + a] < 0)) {
                var w0 = cellV[b * (nx - 1) + a - 1], w1 = cellV[b * (nx - 1) + a];
                if (w0 >= 0 && w1 >= 0) { ctx.moveTo(sx(P[w0][0]), sy(P[w0][1])); ctx.lineTo(sx(P[w1][0]), sy(P[w1][1])); segs++; }
            }
        }
        ctx.stroke();
        // 頂点
        ctx.fillStyle = "#57301A";
        var err = 0;
        for (v = 0; v < P.length; v++) {
            err += Math.abs(sdf(P[v][0], P[v][1]));
            if (h >= 0.22) { ctx.beginPath(); ctx.arc(sx(P[v][0]), sy(P[v][1]), 2.2, 0, TAU); ctx.fill(); }
        }
        // 格子（粗いときだけ）
        if (h >= 0.3) {
            ctx.fillStyle = "rgba(36,28,21,.18)";
            for (b = 0; b < ny; b++) for (a = 0; a < nx; a++) ctx.fillRect(sx(XMIN + a * h) - 1, sy(YMIN + b * h) - 1, 2, 2);
        }
        if (out) {
            out.innerHTML = "格子点 " + (nx * ny) + " / 頂点 " + P.length + " / 線分 " + segs + "<br>" +
                "頂点と本当の輪郭のずれ 平均 " + (P.length ? err / P.length : 0).toFixed(3) + "cm" +
                (kk < 0.05 ? "<br><b style='color:#8F1619'>k = 0。耳と頭、頭と胴のつなぎ目に角が出ています</b>" : "");
        }
    }
    mark = lazyLoop(cv, draw);
    slider("#sdfK", "#sdfKV", f2, function (n) { kk = n; mark(); });
    slider("#sdfGrid", "#sdfGridV", f2, function (n) { hGrid = n; mark(); });
    chipGroup("#sdfMode", function (v) { mode = v; mark(); });
    toggle("#sdfField", function (v) { showField = v; mark(); });
})();

/* ======================================================================
   17 — 綿菓子は線の集まり
   綿菓子.js と同じ曲面（回転体 × 螺旋の帯）に糸を並べ、横から見る
   ====================================================================== */
(function () {
    var cv = $("#flossCanvas"); if (!cv) return;
    var c = setupCanvas(cv), ctx = c.ctx;
    var out = $("#flossOut");
    var count = 4000, fluff = 1, alongBand = true, useCore = true, color = "white", mark;

    // 綿菓子.js の PROF / bands / thick / segs
    var PROF = [
        [0.000, 0.000], [0.055, 0.030], [0.150, 0.100], [0.250, 0.200],
        [0.340, 0.320], [0.400, 0.450], [0.430, 0.580], [0.420, 0.700],
        [0.370, 0.810], [0.280, 0.900], [0.150, 0.960], [0.000, 0.985]
    ];
    var BANDS = 6.5, THICK = 0.075, SEG = 14;
    var COL = { white: [0.96, 0.91, 0.93], pink: [1.00, 0.62, 0.80] };
    var YAW = 0.5, SC = 300, CX = 250, CY = 330;

    function crom(a, b, cc, d, t) {
        return 0.5 * (2 * b + (-a + cc) * t + (2 * a - 5 * b + 4 * cc - d) * t * t + (-a + 3 * b - 3 * cc + d) * t * t * t);
    }
    function profile(v, o) {
        var n = PROF.length, f = clamp(v, 0, 0.99999) * (n - 1);
        var i = Math.floor(f), t = f - i;
        var p0 = PROF[Math.max(0, i - 1)], p1 = PROF[i], p2 = PROF[Math.min(n - 1, i + 1)], p3 = PROF[Math.min(n - 1, i + 2)];
        o[0] = Math.max(0, crom(p0[0], p1[0], p2[0], p3[0], t));
        o[1] = crom(p0[1], p1[1], p2[1], p3[1], t);
    }
    function bandK(phi, v) { return v * BANDS + phi / TAU + 0.22 * Math.sin(2 * phi + v * 5.0); }
    var pr = [0, 0];
    function surf(phi, v, o) {
        profile(v, pr);
        var k = bandK(phi, v), fr = k - Math.floor(k);
        var band = Math.pow(Math.sin(Math.PI * fr), 0.7);
        var sv = Math.sin(Math.PI * clamp(v, 0, 1));
        var lobe = 0.07 * Math.sin(phi + 1.3) + 0.045 * Math.sin(2 * phi + v * 3.0 + 0.5) + 0.03 * Math.sin(3 * phi - v * 4.0 + 1.1);
        var r = pr[0] * (0.84 + 0.16 * band + lobe * sv);
        o[0] = r * Math.cos(phi); o[1] = pr[1] + 0.012 * band * sv; o[2] = r * Math.sin(phi); o[3] = band;
    }
    var A = [0, 0, 0, 0], B = [0, 0, 0, 0], C = [0, 0, 0, 0], D = [0, 0, 0, 0];
    function frame(phi, v, P, N) {
        surf(phi, v, P);
        var vv = clamp(v, 0.004, 0.996), e = 1e-3;
        surf(phi + e, vv, A); surf(phi - e, vv, B); surf(phi, vv + e, C); surf(phi, vv - e, D);
        var ux = A[0] - B[0], uy = A[1] - B[1], uz = A[2] - B[2];
        var wx = C[0] - D[0], wy = C[1] - D[1], wz = C[2] - D[2];
        var nx = wy * uz - wz * uy, ny = wz * ux - wx * uz, nz = wx * uy - wy * ux;
        var l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
        if (nx * P[0] + ny * (P[1] - 0.5) + nz * P[2] < 0) { nx = -nx; ny = -ny; nz = -nz; }
        N[0] = nx; N[1] = ny; N[2] = nz;
    }
    // 画面へ（横から少し回して見る。depth が正なら手前）
    var cy0 = Math.cos(YAW), sy0 = Math.sin(YAW);
    function depth(x, z) { return x * sy0 + z * cy0; }

    // 糸は「表面の点」と「浮かせるベクトル」を別々に持つ（綿菓子.js の buildStrands）。
    // ふわふわ度を変えても作り直さず、描くときに掛けるだけ
    var strands = null, builtFor = "";
    function build() {
        var key = count + ":" + alongBand;
        if (key === builtFor) return;
        builtFor = key;
        var rng = new Rng(20261101), rnd = function () { return rng.next(); };
        var P = [0, 0, 0, 0], N = [0, 0, 0], q = [0, 0];
        strands = [];
        for (var k = 0; k < count; k++) {
            var v;
            do { v = 0.01 + 0.98 * rnd(); profile(v, q); } while (rnd() * 0.45 > q[0] + 0.02);
            var phi = rnd() * TAU;
            var stray = rnd() < 0.07;
            var d = THICK * (0.25 + 0.75 * Math.pow(rnd(), 0.8)) * (stray ? 1.6 + rnd() * 0.9 : 1.0);
            var len = (0.10 + 0.26 * rnd()) * (stray ? 1.5 : 1.0);
            var dphi = Math.min(2.4, len / Math.max(q[0], 0.06)) / SEG * (rnd() < 0.5 ? -1 : 1);
            var slope = alongBand
                ? -(1 + (rnd() - 0.5) * 0.9) / (TAU * BANDS)          // 帯に沿う傾き
                : (rnd() - 0.5) * 2.4 / Math.max(q[0], 0.08);            // ばらばらの向き
            var pts = [];
            for (var j = 0; j <= SEG; j++) {
                frame(phi, v, P, N);
                var s = j / SEG, dj = d;
                if (stray) dj += THICK * 0.5 * Math.pow(Math.abs(2 * s - 1), 3);
                pts.push(P[0], P[1], P[2], N[0] * dj, N[1] * dj, N[2] * dj);
                phi += dphi;
                v = clamp(v + dphi * slope + (rnd() - 0.5) * 0.006, 0.01, 0.99);
            }
            strands.push(pts);
        }
    }

    function draw() {
        build();
        ctx.clearRect(0, 0, c.W, c.H);
        var g = ctx.createRadialGradient(CX, 180, 20, CX, 180, 340);
        g.addColorStop(0, "#e8eaf0"); g.addColorStop(1, "#8e96a6");
        ctx.fillStyle = g; ctx.fillRect(0, 0, c.W, c.H);
        // 割り箸
        ctx.strokeStyle = "#C8A878"; ctx.lineWidth = 5;
        ctx.beginPath(); ctx.moveTo(CX, CY + 40); ctx.lineTo(CX, CY - 60); ctx.stroke();

        var col = COL[color];
        var c255 = function (k, m) { return (col[k] * m) | 0; };
        // 芯：曲面の輪郭を半透明で塗る（正面ほど濃く、縁ほど薄く）
        if (useCore) {
            ctx.beginPath();
            for (var i = 0; i <= 60; i++) {
                profile(i / 60, pr);
                var x = CX - pr[0] * 1.02 * SC, y = CY - pr[1] * SC;
                i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
            }
            for (i = 60; i >= 0; i--) {
                profile(i / 60, pr);
                ctx.lineTo(CX + pr[0] * 1.02 * SC, CY - pr[1] * SC);
            }
            ctx.closePath();
            var cg = ctx.createRadialGradient(CX - 30, CY - 190, 10, CX, CY - 150, 150);
            cg.addColorStop(0, "rgba(" + c255(0, 255) + "," + c255(1, 255) + "," + c255(2, 255) + ",0.9)");
            cg.addColorStop(1, "rgba(" + c255(0, 200) + "," + c255(1, 200) + "," + c255(2, 205) + ",0.45)");
            ctx.fillStyle = cg; ctx.fill();
        }
        // 糸：1本ずつ薄く重ねる。芯の深度が先にあれば、奥の半分にある点は描かれない
        ctx.strokeStyle = "rgb(" + c255(0, 255) + "," + c255(1, 255) + "," + c255(2, 255) + ")";
        ctx.lineWidth = 0.7; ctx.lineCap = "round";
        ctx.globalAlpha = useCore ? 0.40 : 0.25;
        var drawn = 0, hidden = 0;
        for (var k = 0; k < strands.length; k++) {
            var pts = strands[k], pen = false;
            ctx.beginPath();
            for (var j = 0; j <= SEG; j++) {
                var b = j * 6;
                var px = pts[b] + pts[b + 3] * fluff, py = pts[b + 1] + pts[b + 4] * fluff, pz = pts[b + 2] + pts[b + 5] * fluff;
                if (useCore && depth(pts[b], pts[b + 2]) < 0) { pen = false; hidden++; continue; }
                var X = CX + (px * cy0 - pz * sy0) * SC, Y = CY - py * SC;
                if (pen) ctx.lineTo(X, Y); else { ctx.moveTo(X, Y); pen = true; }
                drawn++;
            }
            ctx.stroke();
        }
        ctx.globalAlpha = 1;
        if (out) {
            out.innerHTML = "糸 " + strands.length + " 本 / 折れ線 " + (strands.length * SEG) + " 本<br>" +
                (useCore ? "芯に隠れた点 " + Math.round(hidden / Math.max(1, drawn + hidden) * 100) + "%"
                         : "<b style='color:#8F1619'>芯が無いので、奥の糸まで透けています</b>") +
                (alongBand ? "" : "<br><b style='color:#8F1619'>糸が帯に沿っていません（毛玉）</b>");
        }
    }
    mark = lazyLoop(cv, draw);
    slider("#flossN", "#flossNV", function (n) { return String(n | 0); }, function (n) { count = n | 0; mark(); });
    slider("#flossFluff", "#flossFluffV", f2, function (n) { fluff = n; mark(); });
    toggle("#flossBand", function (v) { alongBand = v; mark(); });
    toggle("#flossCore", function (v) { useCore = v; mark(); });
    chipGroup("#flossColor", function (v) { color = v; mark(); });
})();

/* ======================================================================
   ファイル一覧（図鑑とソースビューアで共有）
   [表示名, ファイル名, 色, 説明]
   色は各ファイルのコードに実際に書かれている値
   ====================================================================== */
var FILES = [
    // 和菓子
    ["花見団子", "花見団子.js", "#F49DAD", "たれは色ではなく層。串の入口はすり鉢状にへこむ。12章の教材。"],
    ["月見団子", "月見団子.js", "#D8CFBB", "接触で潰れる。減った体積の行き先と、縁の丸い土手。13章の教材。"],
    ["たい焼き", "たい焼き.js", "#D79D55", "型の縁にできるミミと、薄い所ほど濃い焼き色。手前の1個はクリックで割れ、生地のちぎれ面とつぶあんが見える。"],
    ["栗饅頭", "栗饅頭.js", "#B86126", "球を楕円に伸ばして頂点へ焼き込み（bakeCurrentTransformIntoVertices）、底を平らに、上をふっくら。焼き色は上の1/3に集める頂点カラー。いちばん短い1本で、05章で扱う。"],
    // 焼き菓子
    ["クッキー", "クッキー.js", "#8F5A2B", "7種を断面と外形の数値だけで作り分ける。工業製品なので乱数の幅が狭い。"],
    ["パンケーキ", "パンケーキ.js", "#EDAB37", "焼き色は縁の淡い環と側面の帯。天面のシロップは吸収を焼き込み、垂れと糸だけ背景を映した屈折で描く。"],
    ["ドーナツ", "ドーナツ.js", "#DD9E55", "型に接した滑らかな面と、膨れてざらついた面の2つの肌。閉じた輪なのでノイズは3Dで引き、当たり判定はカプセル列で穴を残す。"],
    ["ロールケーキ", "ロールケーキ.js", "#BB7745", "断面の渦巻きは線ではなくシート。生地とクリームの三日月を、テクスチャと形状が同じ断面関数から引く。"],
    // チョコレート
    ["チョコレート", "チョコレート.js", "#3A2116", "外形（スーパー楕円）× 縦断面。ブルームと櫛目。Havok で1粒ずつ落とす。"],
    ["チョコバナナ", "チョコバナナ.js", "#5D3322", "先端を下にして引き上げたチョコの垂れと滴。カラースプレーは上から振った背の側にだけ、半分沈めて付ける。"],
    // 冷やし固める・引いて作る
    ["プリン", "プリン.js", "#C27A30", "Havok で落として、揺れは減衰するばね6本の重ね合わせ。法線も一緒に動かしてハイライトを走らせる。14章の教材。"],
    ["ゼリー", "ゼリー.js", "#8EAB40", "色は塗らずに、中を通った光路長から解く。菊型の溝は母線の法線方向に彫り、谷のぶん光路を短くする。15章の教材。"],
    ["アイス", "アイス.js", "#F5D480", "玉と裾を距離関数で溶かし、サーフェスネットで面を張る。ディッシャーの筋・めくれ・気泡を焼き込み、下から溶かす。16章の教材。"],
    ["飴細工", "飴細工.js", "#FFA838", "ウサギは楕円体とカプセルを smin で溶かした一つの塊。脚の付け根だけ k を小さくして鋏の段を残す。16章の教材。"],
    ["綿菓子", "綿菓子.js", "#FF9ECC", "螺旋に巻いた帯を持つ回転体の上に、帯の向きに沿って糸を3万2千本。糸は線で描き、浮き量はシェーダで掛ける。芯は深度だけ先に書く。17章の教材。"]
];
function viewHref(file) { return "view.html?f=" + encodeURIComponent(file); }
function playHref(file) { return "play.html?f=" + encodeURIComponent(file); }

/* ======================================================================
   図鑑
   ====================================================================== */
(function () {
    var host = $("#catalog"); if (!host) return;
    // 実行結果のサムネイルがあれば使う（無くてもカードは出る）
    var TH = window.__THUMBS || {};
    var frag = document.createDocumentFragment();
    FILES.forEach(function (v) {
        // カードの中にリンクが2本（実行・ソース）入るので、カード自体は div
        var card = document.createElement("div");
        card.className = "card";
        card.style.setProperty("--sw", v[2]);
        var t = TH[v[1]];
        card.innerHTML =
            (t ? '<a class="shot"><img alt="" loading="lazy" decoding="async">' +
                 '<span class="playmark">▶ 動かす</span></a>' : "") +
            '<div class="cardbody"><h4></h4><p class="fn"></p><p class="d"></p>' +
            '<p class="acts"><a class="run"></a><a class="src">ソースを読む →</a></p></div>';
        if (t) {
            var shot = card.querySelector(".shot"), img = shot.querySelector("img");
            shot.style.background = t.bg || "#eee";
            shot.href = playHref(v[1]);
            img.src = "assets/thumbs/" + t.img;
            img.width = t.w; img.height = t.h;
            img.alt = v[0] + " — " + v[1] + " を実行した画面";
        }
        card.querySelector("h4").textContent = v[0];
        card.querySelector(".fn").textContent = v[1];
        card.querySelector(".d").textContent = v[3];
        var run = card.querySelector(".run");
        run.href = playHref(v[1]);
        run.textContent = "▶ 動かす";
        card.querySelector(".src").href = viewHref(v[1]);
        frag.appendChild(card);
    });
    host.appendChild(frag);
})();

/* ======================================================================
   ソースビューア
   ・色付けは自前。サンプルには正規表現リテラルが出てこないので、
     コメント/文字列/数値/キーワードだけを見れば足りる
   ・行番号は別の <pre>（ガター）に出す。コード側に混ぜると
     全選択したときに行番号までコピーされてしまう
   ====================================================================== */
var KEYWORDS = {};
"var let const function return if else for while do break continue new this class extends super typeof instanceof in of null undefined true false async await try catch finally throw switch case default delete void yield static import export from"
    .split(" ").forEach(function (w) { KEYWORDS[w] = 1; });

function escHtml(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function highlightJs(src) {
    var out = [], i = 0, n = src.length;
    function isDigit(ch) { return ch >= "0" && ch <= "9"; }
    function isIdStart(ch) { return /[A-Za-z_$]/.test(ch); }
    function isId(ch) { return /[A-Za-z0-9_$]/.test(ch); }

    while (i < n) {
        var c = src.charAt(i), d = src.charAt(i + 1), j;
        if (c === "/" && d === "/") {                       // 行コメント
            j = src.indexOf("\n", i); if (j < 0) j = n;
            out.push('<span class="c">' + escHtml(src.slice(i, j)) + "</span>");
            i = j;
        } else if (c === "/" && d === "*") {                // ブロックコメント
            j = src.indexOf("*/", i + 2); j = j < 0 ? n : j + 2;
            out.push('<span class="c">' + escHtml(src.slice(i, j)) + "</span>");
            i = j;
        } else if (c === '"' || c === "'" || c === "`") {   // 文字列
            j = i + 1;
            while (j < n) {
                var e = src.charAt(j);
                if (e === "\\") { j += 2; continue; }
                if (e === c) { j++; break; }
                if (e === "\n" && c !== "`") { break; }     // 閉じ忘れで暴走させない
                j++;
            }
            out.push('<span class="s">' + escHtml(src.slice(i, j)) + "</span>");
            i = j;
        } else if (isDigit(c) || (c === "." && isDigit(d))) { // 数値
            j = i;
            while (j < n && /[0-9a-fA-FxX._+\-]/.test(src.charAt(j))) {
                var ch2 = src.charAt(j);
                if ((ch2 === "+" || ch2 === "-") && !/[eE]/.test(src.charAt(j - 1))) break;
                j++;
            }
            out.push('<span class="n">' + escHtml(src.slice(i, j)) + "</span>");
            i = j;
        } else if (isIdStart(c)) {                          // 識別子・キーワード
            j = i; while (j < n && isId(src.charAt(j))) j++;
            var word = src.slice(i, j);
            out.push(KEYWORDS[word] ? '<span class="k">' + word + "</span>" : escHtml(word));
            i = j;
        } else {
            out.push(escHtml(c));
            i++;
        }
    }
    return out.join("");
}

(function () {
    var codeEl = $("#viewCode"); if (!codeEl) return;
    var gutterEl = $("#viewGutter"), chipHost = $("#viewChips");
    var titleEl = $("#viewTitle"), descEl = $("#viewDesc");
    var rawEl = $("#viewRaw"), metaEl = $("#viewMeta"), copyEl = $("#viewCopy");
    var wrapEl = $("#viewWrap");
    var current = null, currentText = "";

    function pick(name) {
        for (var i = 0; i < FILES.length; i++) if (FILES[i][1] === name) return FILES[i];
        return null;
    }

    function render(text) {
        // サンプルは CRLF のことがある。CSS の white-space:pre は CR も改行として
        // 数えるので、そのままだと1行ごとに空行が挟まって行番号とずれる
        text = text.replace(/\r\n?/g, "\n");
        currentText = text;
        var lines = text.split("\n");
        var nums = [];
        for (var i = 1; i <= lines.length; i++) nums.push(i);
        if (gutterEl) gutterEl.textContent = nums.join("\n");
        codeEl.innerHTML = highlightJs(text);
        if (metaEl) metaEl.textContent = lines.length + " 行 / " + Math.round(text.length / 1024) + " KB";
        if (wrapEl) wrapEl.scrollTop = 0;
        if (copyEl) { copyEl.disabled = false; copyEl.textContent = "コードをコピー"; }
    }

    function fail(msg) {
        if (gutterEl) gutterEl.textContent = "";
        codeEl.textContent = msg;
        if (metaEl) metaEl.textContent = "";
        if (copyEl) copyEl.disabled = true;
    }

    // 控えの読み込み。file:// では fetch が使えないので <script> で入れる
    function loadFallback(file, done) {
        if (window.__SRC && window.__SRC[file]) { done(window.__SRC[file]); return; }
        var s = document.createElement("script");
        s.src = "assets/src/" + encodeURIComponent(file.replace(/\.js$/, ".src.js"));
        s.onload = function () { done(window.__SRC && window.__SRC[file] ? window.__SRC[file] : null); };
        s.onerror = function () { done(null); };
        document.head.appendChild(s);
    }

    function load(v) {
        codeEl.textContent = "読み込んでいます…";
        if (gutterEl) gutterEl.textContent = "";
        var file = v[1];
        var settled = false;
        function useFallback() {
            loadFallback(file, function (text) {
                if (current !== v) return;
                if (text == null) fail(file + " を読み込めませんでした。右上の「別のタブで開く」から直接ご覧ください。");
                else render(text);
            });
        }
        // http で開かれているときは実ファイルを読む（編集がすぐ反映される）
        try {
            fetch("samples/" + encodeURIComponent(file)).then(function (r) {
                if (!r.ok) throw new Error(r.status);
                return r.text();
            }).then(function (t) {
                settled = true;
                if (current === v) render(t);
            }).catch(function () { if (!settled) useFallback(); });
        } catch (e) { useFallback(); }
    }

    function show(v, push) {
        current = v;
        if (titleEl) titleEl.textContent = v[1];
        if (descEl) descEl.textContent = v[3];
        if (rawEl) rawEl.href = "samples/" + encodeURIComponent(v[1]);
        var playEl = $("#viewPlay");
        if (playEl) playEl.href = playHref(v[1]);
        $$("#viewChips .chip").forEach(function (b) {
            b.setAttribute("aria-pressed", b.dataset.file === v[1] ? "true" : "false");
        });
        document.title = v[1] + " — たべもののつくりかた";
        // file:// では replaceState が拒否されることがある。握りつぶす
        if (push && window.history && history.replaceState) {
            try { history.replaceState(null, "", viewHref(v[1])); } catch (e) { /* noop */ }
        }
        load(v);
    }

    if (chipHost) {
        FILES.forEach(function (v) {
            var b = document.createElement("button");
            b.type = "button";
            b.className = "chip";
            b.dataset.file = v[1];
            b.textContent = v[0];
            b.addEventListener("click", function () { show(v, true); });
            chipHost.appendChild(b);
        });
    }

    if (copyEl) {
        copyEl.addEventListener("click", function () {
            if (!currentText) return;
            function ok() {
                copyEl.textContent = "コピーしました";
                setTimeout(function () { copyEl.textContent = "コードをコピー"; }, 1600);
            }
            function legacy() {
                var ta = document.createElement("textarea");
                ta.value = currentText;
                ta.style.position = "fixed"; ta.style.opacity = "0";
                document.body.appendChild(ta); ta.select();
                try { document.execCommand("copy"); ok(); } catch (e) { copyEl.textContent = "コピーできませんでした"; }
                document.body.removeChild(ta);
            }
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(currentText).then(ok, legacy);
            } else { legacy(); }
        });
    }

    var q = /[?&]f=([^&]+)/.exec(location.search);
    var target = (q && pick(decodeURIComponent(q[1]))) || FILES[0];
    show(target, false);
})();

/* ======================================================================
   用語集の絞り込み
   ====================================================================== */
(function () {
    var box = $("#termFilter"); if (!box) return;
    var rows = $$("#termTable tr");
    box.addEventListener("input", function () {
        var q = box.value.trim().toLowerCase();
        rows.forEach(function (tr, i) {
            if (i === 0) return;                    // 見出し行
            var hit = !q || tr.textContent.toLowerCase().indexOf(q) >= 0;
            tr.classList.toggle("hide", !hit);
        });
    });
})();

})();
