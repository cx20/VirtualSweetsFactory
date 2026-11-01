// ============================================================================
//  ウサギの飴細工（白い引き飴が棒の先で跳ねている姿）
//  BUILD: "candy-rabbit-2026-11-01-A"
//
//  Babylon.js Playground 形式。外部アセットは environmentSpecular.env のみ。
//  ウサギ・棒・台・コンクリートの壁・木目はすべてコードで作る。
//
//  仕組み：
//   ・ウサギは距離関数（SDF）。胴・頭・耳・脚・尾・棒の付け根を楕円体と
//     先細りカプセルで置き、smooth min で一つの塊に溶かす（飴は一つの塊を
//     引いて切って作るので、継ぎ目が無いのが本物らしい）。
//     脚の付け根だけ k を小さくして、鋏で切り分けた段を残す。
//   ・耳の内側は楕円体の差（smooth max）でくぼませる。
//   ・格子で SDF を評価 → Surface Nets で面を張る → 頂点を勾配で面へ射影し、
//     法線も勾配から取る（格子の段が出ない）。
//   ・耳の内側・目・鼻の紅は頂点色。白い引き飴は空気を含んで濁っているので
//     屈折は使わず translucency だけ、べっこう飴は屈折を使う。
// ============================================================================

// ---------------------------------------------------------------------------
// 0. 設定（単位は cm）
// ---------------------------------------------------------------------------
var CFG = {
    candy: "white",   // white=白い引き飴 / amber=べっこう飴
    paint: true,      // 耳・目・鼻に紅を差す
    swing: true,      // カメラをゆっくり左右に振る
    bloom: true
};

var CANDY = {
    white: { label: "白い引き飴", albedo: [0.97, 0.96, 0.94], tint: [1.00, 0.97, 0.92], refr: false, trans: 1.0, dist: 3.0, rough: 0.12 },
    amber: { label: "べっこう飴", albedo: [1.00, 0.66, 0.22], tint: [1.00, 0.52, 0.10], refr: true,  trans: 0.35, dist: 1.4, rough: 0.06 }
};
var PAINT = { ear: [0.97, 0.46, 0.36], eye: [0.93, 0.32, 0.22], nose: [0.96, 0.52, 0.46] };

var GRID = 0.065;      // 面を張る格子の間隔（cm）
var NEAR = 1;          // カメラ側の z の符号（手前の耳・前脚を少し前へ出す）

var SET = {
    rabbitY: 15.0,     // ウサギの腹の中心の高さ
    stickR:  0.2,
    stickTop: 13.4,    // 棒の先端（飴の中に埋まる）
    standR:  3.0,
    standH:  2.2
};

var ENV_URL = "https://assets.babylonjs.com/environments/environmentSpecular.env";

function clamp(x, a, b) { return x < a ? a : (x > b ? b : x); }
function lerp(a, b, t) { return a + (b - a) * t; }
function sstep(a, b, x) { var t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }

// --- 小さなノイズ -----------------------------------------------------------
function hash2(i, j, s) { var n = Math.sin(i * 127.1 + j * 311.7 + s * 74.7) * 43758.5453; return n - Math.floor(n); }
function vnoise2(x, y, s) {
    var i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j;
    var ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
    return lerp(lerp(hash2(i, j, s), hash2(i + 1, j, s), ux), lerp(hash2(i, j + 1, s), hash2(i + 1, j + 1, s), ux), uy);
}
function fbm2(x, y, s, oct) {
    var v = 0, amp = 0.5, f = 1;
    for (var o = 0; o < oct; o++) { v += amp * vnoise2(x * f, y * f, s + o * 3); amp *= 0.5; f *= 2; }
    return v;
}
function hash3(i, j, k) { var n = Math.sin(i * 127.1 + j * 311.7 + k * 74.7) * 43758.5453; return n - Math.floor(n); }
function vnoise3(x, y, z) {
    var i = Math.floor(x), j = Math.floor(y), k = Math.floor(z);
    var fx = x - i, fy = y - j, fz = z - k;
    var ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy), uz = fz * fz * (3 - 2 * fz);
    var x00 = lerp(hash3(i, j, k), hash3(i + 1, j, k), ux), x10 = lerp(hash3(i, j + 1, k), hash3(i + 1, j + 1, k), ux);
    var x01 = lerp(hash3(i, j, k + 1), hash3(i + 1, j, k + 1), ux), x11 = lerp(hash3(i, j + 1, k + 1), hash3(i + 1, j + 1, k + 1), ux);
    return lerp(lerp(x00, x10, uy), lerp(x01, x11, uy), uz);
}

// --- 3 要素配列のベクトル ---------------------------------------------------
function vadd(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
function vsub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function vscl(a, s) { return [a[0] * s, a[1] * s, a[2] * s]; }
function vdot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function vcross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function vnrm(a) { var l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }

// ===========================================================================
// 1. 距離関数の部品
// ===========================================================================
function smin(a, b, k) { var h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; }
function smax(a, b, k) { return -smin(-a, -b, k); }

// 楕円体（u,v,w 軸に沿って半径 r）。iq の近似距離。
function ellA(c, r) { return { c: c, u: [1, 0, 0], v: [0, 1, 0], w: [0, 0, 1], r: r }; }
function ellO(c, L, hint, r) {   // 長軸 L、薄い軸は hint 寄り
    var u = vnrm(L);
    var w = vnrm(vsub(hint, vscl(u, vdot(hint, u))));
    return { c: c, u: u, v: vcross(w, u), w: w, r: r };
}
function sdEll(px, py, pz, E) {
    var dx = px - E.c[0], dy = py - E.c[1], dz = pz - E.c[2];
    var a = (dx * E.u[0] + dy * E.u[1] + dz * E.u[2]) / E.r[0];
    var b = (dx * E.v[0] + dy * E.v[1] + dz * E.v[2]) / E.r[1];
    var c = (dx * E.w[0] + dy * E.w[1] + dz * E.w[2]) / E.r[2];
    var k0 = Math.sqrt(a * a + b * b + c * c);
    var a2 = a / E.r[0], b2 = b / E.r[1], c2 = c / E.r[2];
    var k1 = Math.sqrt(a2 * a2 + b2 * b2 + c2 * c2);
    return k0 * (k0 - 1) / Math.max(k1, 1e-9);
}
// 楕円体のローカル座標（色差しで使う）
function ellLocal(px, py, pz, E) {
    var dx = px - E.c[0], dy = py - E.c[1], dz = pz - E.c[2];
    return [dx * E.u[0] + dy * E.u[1] + dz * E.u[2], dx * E.v[0] + dy * E.v[1] + dz * E.v[2], dx * E.w[0] + dy * E.w[1] + dz * E.w[2]];
}

// 先細りカプセル（iq の round cone）。a 側の半径 r1、b 側の半径 r2。
function rc(a, b, r1, r2) {
    var ba = vsub(b, a), l2 = vdot(ba, ba), rr = r1 - r2;
    return { a: a, ba: ba, l2: l2, rr: rr, a2: l2 - rr * rr, il2: 1 / l2, r1: r1, r2: r2 };
}
function sdRC(px, py, pz, R) {
    var pax = px - R.a[0], pay = py - R.a[1], paz = pz - R.a[2];
    var bx = R.ba[0], by = R.ba[1], bz = R.ba[2], l2 = R.l2;
    var y = pax * bx + pay * by + paz * bz, z = y - l2;
    var qx = pax * l2 - bx * y, qy = pay * l2 - by * y, qz = paz * l2 - bz * y;
    var x2 = qx * qx + qy * qy + qz * qz, y2 = y * y * l2, z2 = z * z * l2;
    var k = Math.sign(R.rr) * R.rr * R.rr * x2;
    if (Math.sign(z) * R.a2 * z2 > k) return Math.sqrt(x2 + z2) * R.il2 - R.r2;
    if (Math.sign(y) * R.a2 * y2 < k) return Math.sqrt(x2 + y2) * R.il2 - R.r1;
    return (Math.sqrt(x2 * R.a2 * R.il2) + y * R.rr) * R.il2 - R.r1;
}

// ===========================================================================
// 2. ウサギ（ローカル座標：+x が頭、+y が上、原点は腹の中心）
// ===========================================================================
function makeRabbit() {
    var s = NEAR;
    var body = [
        ellA([-1.30, 0.15, 0], [1.55, 1.45, 1.35]),   // 腰
        ellA([ 0.20, 0.00, 0], [1.70, 1.25, 1.20]),   // 腹
        ellA([ 1.55, 0.45, 0], [1.10, 1.20, 1.05])    // 胸
    ];
    var head   = ellA([2.70, 1.90, 0], [1.18, 1.05, 0.95]);
    var muzzle = ellA([3.62, 1.58, 0], [0.62, 0.55, 0.60]);
    var cheeks = [ellA([3.20, 1.32, 0.45], [0.52, 0.45, 0.45]), ellA([3.20, 1.32, -0.45], [0.52, 0.45, 0.45])];
    var tail   = ellA([-2.75, 1.25, 0], [0.55, 0.68, 0.55]);
    var stem   = rc([0.1, -0.7, 0], [0.1, -2.85, 0], 0.72, 0.55);   // 棒を包む飴

    // 耳：手前は後ろへ寝かせ、奥はやや立てる。内側（w の + 側）をくぼませる。
    var ears = [];
    [{ sd: s,  a: [2.35, 2.60, 0.40 * s],  b: [1.35, 4.85, 0.95 * s] },
     { sd: -s, a: [2.45, 2.60, -0.40 * s], b: [2.05, 4.70, -0.70 * s] }].forEach(function (e) {
        var L = vsub(e.b, e.a), len = Math.hypot(L[0], L[1], L[2]), u = vnrm(L);
        var c = vscl(vadd(e.a, e.b), 0.5);
        var hint = [0.45, 0, e.sd];
        var rl = len * 0.5 + 0.15;
        var outer = ellO(c, L, hint, [rl, 0.50, 0.23]);
        var cc = vadd(vadd(c, vscl(outer.w, 0.15)), vscl(u, 0.10));
        var cav = ellO(cc, L, hint, [rl * 0.76, 0.32, 0.13]);
        ears.push({ outer: outer, cav: cav, rl: rl });
    });

    // 前脚：前下へ伸ばす（手前を少し先へ）
    var fronts = [
        { leg: rc([1.8, -0.30, 0.52 * s], [3.85, -1.15, 0.58 * s], 0.64, 0.42), paw: ellA([4.10, -1.22, 0.58 * s], [0.52, 0.36, 0.40]) },
        { leg: rc([1.8, -0.35, -0.52 * s], [3.50, -1.50, -0.55 * s], 0.64, 0.42), paw: ellA([3.75, -1.58, -0.55 * s], [0.52, 0.36, 0.40]) }
    ];
    // 後脚：腿の膨らみ → すね → 後ろへ伸びる足
    var hinds = [
        { thigh: ellA([-1.45, -0.15, 0.95 * s], [1.25, 1.1, 0.55]),
          low:   rc([-1.9, -0.75, 0.95 * s], [-3.25, -1.85, 0.92 * s], 0.62, 0.42),
          foot:  rc([-3.25, -1.85, 0.92 * s], [-4.15, -2.25, 0.88 * s], 0.44, 0.36) },
        { thigh: ellA([-1.45, -0.15, -0.95 * s], [1.25, 1.1, 0.55]),
          low:   rc([-1.9, -0.80, -0.95 * s], [-3.05, -2.05, -0.92 * s], 0.62, 0.42),
          foot:  rc([-3.05, -2.05, -0.92 * s], [-3.85, -2.50, -0.88 * s], 0.44, 0.36) }
    ];

    function sdf(x, y, z) {
        var d = sdEll(x, y, z, body[0]);
        d = smin(d, sdEll(x, y, z, body[1]), 0.9);
        d = smin(d, sdEll(x, y, z, body[2]), 0.9);
        d = smin(d, sdRC(x, y, z, stem), 0.6);
        d = smin(d, sdEll(x, y, z, tail), 0.3);

        var hd = sdEll(x, y, z, head);
        hd = smin(hd, sdEll(x, y, z, muzzle), 0.45);
        hd = smin(hd, sdEll(x, y, z, cheeks[0]), 0.3);
        hd = smin(hd, sdEll(x, y, z, cheeks[1]), 0.3);
        for (var i = 0; i < 2; i++) {
            var e = smax(sdEll(x, y, z, ears[i].outer), -sdEll(x, y, z, ears[i].cav), 0.06);
            hd = smin(hd, e, 0.25);
        }
        d = smin(d, hd, 0.7);

        for (var f = 0; f < 2; f++) {
            var l = smin(sdRC(x, y, z, fronts[f].leg), sdEll(x, y, z, fronts[f].paw), 0.15);
            d = smin(d, l, 0.3);
        }
        for (var h = 0; h < 2; h++) {
            var g = smin(sdEll(x, y, z, hinds[h].thigh), sdRC(x, y, z, hinds[h].low), 0.3);
            g = smin(g, sdRC(x, y, z, hinds[h].foot), 0.12);
            d = smin(d, g, 0.35);
        }
        // 手で引いた程度のわずかな起伏（面の近くだけ評価して軽くする）
        if (d > -0.25 && d < 0.25) d += 0.025 * (vnoise3(x * 1.6 + 11, y * 1.6, z * 1.6) - 0.5);
        return d;
    }

    return { sdf: sdf, head: head, muzzle: muzzle, ears: ears,
             bmin: [-5.4, -4.0, -2.1], bmax: [5.4, 5.5, 2.1] };
}

// ===========================================================================
// 3. Surface Nets で面を張る
//    返す三角形は Babylon の既定（(v1-v0)×(v2-v0) が内向き）に揃える。
// ===========================================================================
function gradAt(sdf, x, y, z, e) {
    return [sdf(x + e, y, z) - sdf(x - e, y, z), sdf(x, y + e, z) - sdf(x, y - e, z), sdf(x, y, z + e) - sdf(x, y, z - e)];
}
function projectToSurface(sdf, p, iters, maxStep) {
    var x = p[0], y = p[1], z = p[2];
    for (var it = 0; it < iters; it++) {
        var d = sdf(x, y, z);
        var g = gradAt(sdf, x, y, z, 0.005);
        var gl2 = (g[0] * g[0] + g[1] * g[1] + g[2] * g[2]) / (0.01 * 0.01);
        if (gl2 < 1e-8) break;
        var k = d / gl2 / 0.01;
        var sx = g[0] * k, sy = g[1] * k, sz = g[2] * k;
        var sl = Math.hypot(sx, sy, sz);
        if (sl > maxStep) { sx *= maxStep / sl; sy *= maxStep / sl; sz *= maxStep / sl; }
        x -= sx; y -= sy; z -= sz;
    }
    return [x, y, z];
}

function polygonize(sdf, bmin, bmax, h) {
    var nx = Math.ceil((bmax[0] - bmin[0]) / h) + 1;
    var ny = Math.ceil((bmax[1] - bmin[1]) / h) + 1;
    var nz = Math.ceil((bmax[2] - bmin[2]) / h) + 1;
    var NXY = nx * ny;
    var F = new Float32Array(nx * ny * nz);
    // 4x4x4 のブロックごとに中心で評価し、面から十分遠いブロックはその値で埋める
    // （面の近くのブロックだけ全点を評価するので、全点評価の 1/10 程度で済む）
    var B = 4, rad = 1.4 * (0.5 * B * h * Math.sqrt(3)) + 0.06;
    for (var bk = 0; bk < nz; bk += B) for (var bj = 0; bj < ny; bj += B) for (var bi = 0; bi < nx; bi += B) {
        var ek = Math.min(bk + B, nz), ej = Math.min(bj + B, ny), ei = Math.min(bi + B, nx);
        var dc = sdf(bmin[0] + (bi + ei - 1) * 0.5 * h, bmin[1] + (bj + ej - 1) * 0.5 * h, bmin[2] + (bk + ek - 1) * 0.5 * h);
        var far = Math.abs(dc) > rad;
        for (var k = bk; k < ek; k++) for (var j = bj; j < ej; j++) for (var i = bi; i < ei; i++)
            F[i + nx * j + NXY * k] = far ? dc : sdf(bmin[0] + i * h, bmin[1] + j * h, bmin[2] + k * h);
    }

    // セルの頂点：符号の変わる辺の交点の平均
    var EDG = [];
    for (var a = 0; a < 8; a++) for (var bit = 1; bit < 8; bit <<= 1) if (!(a & bit)) EDG.push([a, a | bit]);
    var cellV = new Int32Array(nx * ny * nz).fill(-1);
    var P = [];
    var cv = new Float64Array(8);
    for (var k2 = 0; k2 < nz - 1; k2++) for (var j2 = 0; j2 < ny - 1; j2++) for (var i2 = 0; i2 < nx - 1; i2++) {
        var base = i2 + nx * j2 + NXY * k2, neg = 0;
        for (var c = 0; c < 8; c++) {
            cv[c] = F[base + (c & 1) + nx * ((c >> 1) & 1) + NXY * ((c >> 2) & 1)];
            if (cv[c] < 0) neg++;
        }
        if (neg === 0 || neg === 8) continue;
        var sx = 0, sy = 0, sz = 0, n = 0;
        for (var e = 0; e < 12; e++) {
            var c0 = EDG[e][0], c1 = EDG[e][1], f0 = cv[c0], f1 = cv[c1];
            if ((f0 < 0) === (f1 < 0)) continue;
            var t = f0 / (f0 - f1);
            sx += (c0 & 1) + t * ((c1 & 1) - (c0 & 1));
            sy += ((c0 >> 1) & 1) + t * (((c1 >> 1) & 1) - ((c0 >> 1) & 1));
            sz += ((c0 >> 2) & 1) + t * (((c1 >> 2) & 1) - ((c0 >> 2) & 1));
            n++;
        }
        cellV[base] = P.length / 3;
        P.push(bmin[0] + (i2 + sx / n) * h, bmin[1] + (j2 + sy / n) * h, bmin[2] + (k2 + sz / n) * h);
    }

    var I = [];
    function tri(A, B, C, ox, oy, oz) {
        var ax = P[B * 3] - P[A * 3], ay = P[B * 3 + 1] - P[A * 3 + 1], az = P[B * 3 + 2] - P[A * 3 + 2];
        var bx = P[C * 3] - P[A * 3], by = P[C * 3 + 1] - P[A * 3 + 1], bz = P[C * 3 + 2] - P[A * 3 + 2];
        var cx = ay * bz - az * by, cy = az * bx - ax * bz, cz = ax * by - ay * bx;
        if (cx * ox + cy * oy + cz * oz > 0) I.push(A, C, B); else I.push(A, B, C);
    }
    function quad(q0, q1, q2, q3, ox, oy, oz) {
        tri(q0, q1, q2, ox, oy, oz);
        tri(q0, q2, q3, ox, oy, oz);
    }
    function cid(i, j, k) { return cellV[i + nx * j + NXY * k]; }
    for (var k3 = 0; k3 < nz - 1; k3++) for (var j3 = 0; j3 < ny - 1; j3++) for (var i3 = 0; i3 < nx - 1; i3++) {
        var f00 = F[i3 + nx * j3 + NXY * k3];
        // x 方向の辺
        if (j3 > 0 && k3 > 0) {
            var fx1 = F[i3 + 1 + nx * j3 + NXY * k3];
            if ((f00 < 0) !== (fx1 < 0)) {
                var sxo = f00 < 0 ? 1 : -1;
                quad(cid(i3, j3 - 1, k3 - 1), cid(i3, j3, k3 - 1), cid(i3, j3, k3), cid(i3, j3 - 1, k3), sxo, 0, 0);
            }
        }
        // y 方向の辺
        if (i3 > 0 && k3 > 0) {
            var fy1 = F[i3 + nx * (j3 + 1) + NXY * k3];
            if ((f00 < 0) !== (fy1 < 0)) {
                var syo = f00 < 0 ? 1 : -1;
                quad(cid(i3 - 1, j3, k3 - 1), cid(i3, j3, k3 - 1), cid(i3, j3, k3), cid(i3 - 1, j3, k3), 0, syo, 0);
            }
        }
        // z 方向の辺
        if (i3 > 0 && j3 > 0) {
            var fz1 = F[i3 + nx * j3 + NXY * (k3 + 1)];
            if ((f00 < 0) !== (fz1 < 0)) {
                var szo = f00 < 0 ? 1 : -1;
                quad(cid(i3 - 1, j3 - 1, k3), cid(i3, j3 - 1, k3), cid(i3, j3, k3), cid(i3 - 1, j3, k3), 0, 0, szo);
            }
        }
    }
    return { pos: new Float32Array(P), idx: new Uint32Array(I) };
}

// 面を張り、頂点を面へ射影し、法線と紅の色を付ける
function buildRabbitGeometry() {
    var R = makeRabbit(), sdf = R.sdf;
    var g = polygonize(sdf, R.bmin, R.bmax, GRID);
    var P = g.pos, nv = P.length / 3;
    var N = new Float32Array(nv * 3);
    for (var v = 0; v < nv; v++) {
        var p = projectToSurface(sdf, [P[v * 3], P[v * 3 + 1], P[v * 3 + 2]], 2, GRID * 0.6);
        P[v * 3] = p[0]; P[v * 3 + 1] = p[1]; P[v * 3 + 2] = p[2];
        var gr = vnrm(gradAt(sdf, p[0], p[1], p[2], 0.01));
        N[v * 3] = gr[0]; N[v * 3 + 1] = gr[1]; N[v * 3 + 2] = gr[2];
    }

    // 目と鼻の位置：頭・鼻先の外から面へ射影する
    var hc = R.head.c, eyes = [];  // 目は頭の前上寄り
    [1, -1].forEach(function (sd) {
        var dir = vnrm([0.45, 0.30, 0.84 * sd]);
        eyes.push(projectToSurface(sdf, vadd(hc, vscl(dir, 1.5)), 8, 0.3));
    });
    var nose = projectToSurface(sdf, vadd(R.muzzle.c, [1.0, 0.08, 0]), 8, 0.3);

    var C = new Float32Array(nv * 3);
    for (var q = 0; q < nv; q++) {
        var x = P[q * 3], y = P[q * 3 + 1], z = P[q * 3 + 2];
        var r = 1, gg = 1, b = 1;
        // 耳の内側：くぼみの中を、毛並みのような筋を入れて刷く
        for (var e = 0; e < 2; e++) {
            var E = R.ears[e], lc = ellLocal(x, y, z, E.outer);
            var el = (lc[0] / (E.rl * 0.76)) * (lc[0] / (E.rl * 0.76)) + (lc[1] / 0.32) * (lc[1] / 0.32);
            var w = (1 - sstep(0.35, 0.95, el)) * sstep(-0.08, -0.02, lc[2])
                  * sstep(-0.95, -0.55, lc[0] / E.rl) * (1 - sstep(0.35, 0.85, lc[0] / E.rl));
            if (w > 0) {
                var streak = 0.72 + 0.28 * Math.sin(lc[1] * 30 + 3.0 * vnoise3(x * 3, y * 3, z * 3));
                w *= streak;
                r = lerp(r, PAINT.ear[0], w); gg = lerp(gg, PAINT.ear[1], w); b = lerp(b, PAINT.ear[2], w);
            }
        }
        // 目：小さな紅の点
        for (var k = 0; k < 2; k++) {
            var de = Math.hypot(x - eyes[k][0], y - eyes[k][1], z - eyes[k][2]);
            var we = 1 - sstep(0.09, 0.14, de);
            if (we > 0) { r = lerp(r, PAINT.eye[0], we); gg = lerp(gg, PAINT.eye[1], we); b = lerp(b, PAINT.eye[2], we); }
        }
        // 鼻：縦に少し長い点
        var dn = Math.hypot((x - nose[0]) * 1.4, (y - nose[1]) * 0.8, (z - nose[2]) * 1.4);
        var wn = 0.8 * (1 - sstep(0.06, 0.13, dn));
        if (wn > 0) { r = lerp(r, PAINT.nose[0], wn); gg = lerp(gg, PAINT.nose[1], wn); b = lerp(b, PAINT.nose[2], wn); }
        C[q * 3] = r; C[q * 3 + 1] = gg; C[q * 3 + 2] = b;
    }
    return { pos: P, nrm: N, idx: g.idx, paint: C };
}

// ===========================================================================
// 4. テクスチャ（木目・コンクリート）
// ===========================================================================
function makeWoodTexture(scene, name, base, dark, freq) {
    var S = 512;
    var dt = new BABYLON.DynamicTexture(name, { width: S, height: S }, scene, true);
    var g = dt.getContext(), img = g.createImageData(S, S);
    for (var y = 0; y < S; y++) for (var x = 0; x < S; x++) {
        var u = x / S, v = y / S;
        var grain = 0.5 + 0.5 * Math.sin(v * freq + 6.0 * fbm2(u * 2.5, v * 0.8, 41, 4) + 2.0 * fbm2(u * 9, v * 9, 7, 3));
        var k = Math.pow(grain, 2.2) * 0.8 + 0.2 * vnoise2(u * 60, v * 60, 3);
        var o = (y * S + x) * 4;
        img.data[o]     = Math.round(255 * lerp(base[0], dark[0], k));
        img.data[o + 1] = Math.round(255 * lerp(base[1], dark[1], k));
        img.data[o + 2] = Math.round(255 * lerp(base[2], dark[2], k));
        img.data[o + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    dt.update(false);
    dt.wrapU = dt.wrapV = BABYLON.Texture.WRAP_ADDRESSMODE;
    return dt;
}

// 打ちっぱなしのコンクリート：まだらの濃淡＋細かな気泡跡
function makeConcreteTexture(scene, name) {
    var S = 512;
    var dt = new BABYLON.DynamicTexture(name, { width: S, height: S }, scene, true);
    var g = dt.getContext(), img = g.createImageData(S, S);
    for (var y = 0; y < S; y++) for (var x = 0; x < S; x++) {
        var u = x / S, v = y / S;
        var m = 0.50 + 0.22 * (fbm2(u * 3, v * 3, 5, 5) - 0.5) + 0.10 * (fbm2(u * 14, v * 14, 17, 3) - 0.5);
        var pit = vnoise2(u * 140, v * 140, 9);
        if (pit > 0.86) m -= (pit - 0.86) * 0.9;
        m += 0.03 * (vnoise2(u * 300, v * 300, 21) - 0.5);
        var o = (y * S + x) * 4;
        img.data[o]     = Math.round(255 * clamp(m * 1.00, 0, 1));
        img.data[o + 1] = Math.round(255 * clamp(m * 0.99, 0, 1));
        img.data[o + 2] = Math.round(255 * clamp(m * 0.97, 0, 1));
        img.data[o + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    dt.update(false);
    dt.wrapU = dt.wrapV = BABYLON.Texture.WRAP_ADDRESSMODE;
    return dt;
}

// ===========================================================================
// 5. シーン
// ===========================================================================
var createScene = function () {
    var scene = new BABYLON.Scene(engine);
    scene.clearColor = new BABYLON.Color4(0.30, 0.30, 0.29, 1);
    var V3 = BABYLON.Vector3, C3 = BABYLON.Color3;
    var uid = 0;
    function named(o, n) { o.name = n; o.id = n + "#" + (uid++); return o; }

    // カメラ：+z 側から見る（頭 = +x が画面の左に来る）。少し前寄り・少し上から。
    var target = new V3(0.2, SET.rabbitY + 0.5, 0);
    var A0 = Math.PI / 2 - 0.22;
    var camera = new BABYLON.ArcRotateCamera("cam", A0, 1.38, 21, target, scene);
    camera.attachControl(engine.getRenderingCanvas(), true);
    camera.minZ = 0.2; camera.maxZ = 400;
    camera.lowerRadiusLimit = 8; camera.upperRadiusLimit = 45;
    camera.lowerAlphaLimit = A0 - 1.0; camera.upperAlphaLimit = A0 + 1.0;   // 壁の裏へ回り込まない
    camera.upperBetaLimit = 1.55;
    camera.wheelPrecision = 20; camera.pinchPrecision = 60;

    // --- 環境と光 -------------------------------------------------------------
    scene.environmentTexture = BABYLON.CubeTexture.CreateFromPrefilteredData(ENV_URL, scene);
    scene.environmentIntensity = 0.7;
    var hemi = new BABYLON.HemisphericLight("hemi", new V3(0.1, 1, 0.3), scene);
    hemi.intensity = 0.35; hemi.groundColor = new C3(0.30, 0.29, 0.28);
    var key = new BABYLON.DirectionalLight("key", new V3(-0.45, -1.0, -0.55), scene);
    key.position = new V3(18, 40, 22); key.intensity = 1.5;
    key.diffuse = new C3(1.0, 0.97, 0.92);
    var shadow = new BABYLON.ShadowGenerator(2048, key);
    shadow.usePercentageCloserFiltering = true;
    shadow.filteringQuality = BABYLON.ShadowGenerator.QUALITY_MEDIUM;
    shadow.darkness = 0.45; shadow.bias = 0.0008; shadow.normalBias = 0.02;

    // --- 壁と台 ---------------------------------------------------------------
    var wallMat = named(new BABYLON.PBRMaterial("wallMat", scene), "wallMat");
    wallMat.albedoTexture = makeConcreteTexture(scene, "concreteTex");
    wallMat.albedoTexture.uScale = 2; wallMat.albedoTexture.vScale = 1.3;
    wallMat.metallic = 0; wallMat.roughness = 0.92;
    var wall = named(BABYLON.MeshBuilder.CreatePlane("wall", { width: 140, height: 90, sideOrientation: BABYLON.Mesh.DOUBLESIDE }, scene), "wall");
    wall.position = new V3(0, 30, -14); wall.material = wallMat; wall.receiveShadows = true;

    var woodMat = named(new BABYLON.PBRMaterial("woodMat", scene), "woodMat");
    woodMat.albedoTexture = makeWoodTexture(scene, "woodTex", [0.46, 0.34, 0.22], [0.24, 0.15, 0.08], 55);
    woodMat.albedoTexture.uScale = 3; woodMat.albedoTexture.vScale = 2;
    woodMat.metallic = 0; woodMat.roughness = 0.6;
    var table = named(BABYLON.MeshBuilder.CreateBox("table", { width: 140, height: 2.5, depth: 50 }, scene), "table");
    table.position = new V3(0, -1.25, 11); table.material = woodMat; table.receiveShadows = true;

    // --- 棒と台 ---------------------------------------------------------------
    var standMat = named(new BABYLON.PBRMaterial("standMat", scene), "standMat");
    standMat.albedoTexture = makeWoodTexture(scene, "standTex", [0.50, 0.36, 0.22], [0.26, 0.16, 0.08], 30);
    standMat.metallic = 0; standMat.roughness = 0.55;
    var stand = named(BABYLON.MeshBuilder.CreateCylinder("stand", { diameter: SET.standR * 2, height: SET.standH, tessellation: 40 }, scene), "stand");
    stand.position = new V3(0.1, SET.standH / 2, 0); stand.material = standMat; stand.receiveShadows = true;
    var stickMat = named(new BABYLON.PBRMaterial("stickMat", scene), "stickMat");
    stickMat.albedoColor = new C3(0.03, 0.03, 0.03); stickMat.metallic = 0; stickMat.roughness = 0.35;
    var stickH = SET.stickTop - SET.standH + 0.5;
    var stick = named(BABYLON.MeshBuilder.CreateCylinder("stick", { diameter: SET.stickR * 2, height: stickH, tessellation: 16 }, scene), "stick");
    stick.position = new V3(0.1, SET.standH - 0.5 + stickH / 2, 0); stick.material = stickMat;
    shadow.addShadowCaster(stick); shadow.addShadowCaster(stand);

    // --- 飴の材質 -------------------------------------------------------------
    var candyMat = named(new BABYLON.PBRMaterial("candyMat", scene), "candyMat");
    candyMat.metallic = 0;
    candyMat.subSurface.isTranslucencyEnabled = true;
    candyMat.subSurface.indexOfRefraction = 1.52;
    candyMat.subSurface.useAlbedoToTintRefraction = true;
    candyMat.subSurface.minimumThickness = 0.2;
    candyMat.subSurface.maximumThickness = 3.0;
    candyMat.clearCoat.isEnabled = true;        // 冷めた飴の表面の薄い艶
    candyMat.clearCoat.intensity = 0.5;
    candyMat.clearCoat.roughness = 0.04;
    function applyCandy() {
        var ct = CANDY[CFG.candy];
        candyMat.albedoColor = C3.FromArray(ct.albedo);
        candyMat.roughness = ct.rough;
        candyMat.subSurface.tintColor = C3.FromArray(ct.tint);
        candyMat.subSurface.tintColorAtDistance = ct.dist;
        candyMat.subSurface.translucencyIntensity = ct.trans;
        candyMat.subSurface.isRefractionEnabled = ct.refr;
        candyMat.subSurface.refractionIntensity = ct.refr ? 0.85 : 0;
    }
    applyCandy();

    // --- ウサギ ---------------------------------------------------------------
    var geo = buildRabbitGeometry();
    var nv = geo.pos.length / 3;
    var rabbit = named(new BABYLON.Mesh("candyRabbit", scene), "candyRabbit");
    var vd = new BABYLON.VertexData();
    vd.positions = geo.pos; vd.normals = geo.nrm; vd.indices = geo.idx;
    vd.applyToMesh(rabbit, false);
    var colors = new Float32Array(nv * 4);
    function applyPaint() {
        for (var i = 0; i < nv; i++) {
            colors[i * 4]     = CFG.paint ? geo.paint[i * 3]     : 1;
            colors[i * 4 + 1] = CFG.paint ? geo.paint[i * 3 + 1] : 1;
            colors[i * 4 + 2] = CFG.paint ? geo.paint[i * 3 + 2] : 1;
            colors[i * 4 + 3] = 1;
        }
        rabbit.setVerticesData(BABYLON.VertexBuffer.ColorKind, colors, true);
    }
    applyPaint();
    rabbit.material = candyMat;
    rabbit.position = new V3(0, SET.rabbitY, 0);
    shadow.addShadowCaster(rabbit);

    // --- ポストプロセス -------------------------------------------------------
    var pipe = new BABYLON.DefaultRenderingPipeline("pp", true, scene, [camera]);
    pipe.fxaaEnabled = true;
    pipe.bloomEnabled = CFG.bloom; pipe.bloomThreshold = 0.85; pipe.bloomWeight = 0.15; pipe.bloomKernel = 48;
    pipe.imageProcessing.toneMappingEnabled = true;
    pipe.imageProcessing.exposure = 1.1; pipe.imageProcessing.contrast = 1.1;
    pipe.imageProcessing.vignetteEnabled = true; pipe.imageProcessing.vignetteWeight = 1.0;

    // --- GUI ------------------------------------------------------------------
    if (typeof BABYLON.GUI !== "undefined") {
        var ui = BABYLON.GUI.AdvancedDynamicTexture.CreateFullscreenUI("ui", true, scene);
        if (ui.layer) ui.layer.applyPostProcess = false;
        var narrow = engine.getRenderWidth() < 820;
        var SC = narrow ? Math.max(1.0, Math.min(window.devicePixelRatio || 1, 2.5) * 0.85) : 1.0;

        var root = new BABYLON.GUI.StackPanel();
        root.width = (narrow ? 220 * SC : 230) + "px";
        root.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
        root.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_TOP;
        root.paddingLeft = "8px"; root.paddingTop = "8px";
        ui.addControl(root);

        var toggle = BABYLON.GUI.Button.CreateSimpleButton("tg", "≡  飴細工の設定");
        toggle.height = (30 * SC) + "px"; toggle.color = "white"; toggle.fontSize = Math.round(13 * SC);
        toggle.background = "rgba(40,36,34,0.85)"; toggle.cornerRadius = 6; toggle.thickness = 0; toggle.paddingBottom = "4px";
        root.addControl(toggle);
        var box = new BABYLON.GUI.StackPanel();
        box.background = "rgba(30,28,26,0.88)"; box.paddingTop = "6px"; box.paddingBottom = "8px";
        box.adaptHeightToChildren = true; box.isVisible = !narrow;
        root.addControl(box);
        toggle.onPointerUpObservable.add(function () { box.isVisible = !box.isVisible; });

        var ACT = "rgba(214,120,100,0.95)", IDLE = "rgba(64,58,54,0.92)";
        function head(txt) {
            var t = new BABYLON.GUI.TextBlock();
            t.text = txt; t.height = (21 * SC) + "px"; t.color = "#f0c8b8"; t.fontSize = Math.round(11 * SC);
            t.textHorizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
            t.paddingLeft = "10px"; t.paddingTop = "5px";
            box.addControl(t);
        }
        var radios = [];
        function paintRadios() { radios.forEach(function (r) { r.b.background = CFG.candy === r.k ? ACT : IDLE; }); }
        function radio(k) {
            var b = BABYLON.GUI.Button.CreateSimpleButton("b" + k, CANDY[k].label);
            b.height = (25 * SC) + "px"; b.color = "white"; b.fontSize = Math.round(12 * SC);
            b.cornerRadius = 4; b.thickness = 0; b.paddingLeft = "10px"; b.paddingRight = "10px"; b.paddingTop = "2px";
            b.onPointerUpObservable.add(function () { CFG.candy = k; applyCandy(); paintRadios(); });
            box.addControl(b); radios.push({ k: k, b: b });
        }
        function checkbox(txt, get, set) {
            var line = new BABYLON.GUI.StackPanel();
            line.isVertical = false; line.height = (25 * SC) + "px"; line.paddingLeft = "10px";
            var c = new BABYLON.GUI.Checkbox();
            c.width = (15 * SC) + "px"; c.height = (15 * SC) + "px";
            c.isChecked = get(); c.color = ACT; c.background = IDLE;
            c.onIsCheckedChangedObservable.add(function (v) { set(v); });
            var lb = new BABYLON.GUI.TextBlock();
            lb.text = "  " + txt; lb.color = "white"; lb.fontSize = Math.round(12 * SC); lb.width = (170 * SC) + "px";
            lb.textHorizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
            line.addControl(c); line.addControl(lb); box.addControl(line);
        }
        head("飴");
        radio("white"); radio("amber"); paintRadios();
        head("表示");
        checkbox("耳・目・鼻に紅を差す", function () { return CFG.paint; }, function (v) { CFG.paint = v; applyPaint(); });
        checkbox("カメラをゆっくり振る", function () { return CFG.swing; }, function (v) { CFG.swing = v; });
        checkbox("ブルーム", function () { return CFG.bloom; }, function (v) { CFG.bloom = v; pipe.bloomEnabled = v; });
    }

    // --- 毎フレーム：カメラを振る（差分で足すので手で回した向きは保たれる） ----
    var tSwing = 0, prevOff = 0;
    scene.onBeforeRenderObservable.add(function () {
        if (!CFG.swing) return;
        tSwing += engine.getDeltaTime() * 0.001;
        var off = 0.45 * Math.sin(tSwing * 0.35);
        camera.alpha += off - prevOff;
        prevOff = off;
    });

    return scene;
};

export default createScene;