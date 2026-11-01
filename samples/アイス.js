// =====================================================================
//  スクープのアイスクリーム  /  A classic scoop of ice cream
//  BUILD: icecream-scoop-2026-11-01-a
//
//  Babylon.js Playground 用（そのまま貼り付けて実行できます）。
//  外部アセットは環境マップ(.env) のみ。形状はコードで作ります。
//
//  ■ 形
//
//    ディッシャーで丸く抜いた「玉」と、器に押し付けたときに
//    ぐるりと広がる「裾（スカート）」の2つを距離関数で作り、なめらかに合成。
//    裾の縁は角度ごとに出入りさせ、千切れたように不揃いにする。
//    裾は外へ行くほど持ち上がる形にしておき、器の内面に沿わせやすくする。
//
//  ■ アイスらしさ（アヒル型と共通）
//
//    1. ディッシャーで削いだ面に、引いた向きへ走る細い筋
//    2. 削ぎ終わりにできる、めくれて千切れた縁
//    3. 小さな気泡の穴。表面は霜が降りたような艶消し
//    4. 器に触れる下のほうから溶けて、そこだけ艶が出て丸くなる
//    5. 裾はぼそぼそと荒れている
//
//  ■ 作り方
//
//    ・距離関数 → グリッド → 1回ぼかし → サーフェスネット
//    ・「ディッシャーの座標系」D＝引いた向き、S＝横、U＝上 で筋・めくれを焼く
//    ・艶は uv=(艶, 0.5) で metallicTexture の G（粗さランプ）を引く
//    ・溶けは「下ほど細部が消えて沈み、裾が広がる」＋器の底に溜まり
//    ・器に食い込む頂点は器の内面へ押し上げる
// =====================================================================

var createScene = async function () {
    // =================================================================
    // 0. CONFIG （単位は cm）
    // =================================================================
    const GLOBAL = {
        envUrl: "https://assets.babylonjs.com/environments/environmentSpecular.env",
        height: 5.55,          // アイスとしての全高
        gridH: 0.072,          // 距離場のセルの大きさ
        shapeSeed: 7,          // 裾の出入りの乱数

        // ---- ディッシャーの跡 -----------------------------------------
        streakAmp: 0.075,      // 引いた筋
        streakFreq: 3.1,       // 筋の細かさ（1cm あたり）
        lumpAmp: 0.11,         // 大きなうねり
        lipAmp: 0.34,          // 削ぎ終わりのめくれ
        lipWidth: 0.17,
        lipAt: 0.60,           // 削ぎ終わりの位置（0 = 引き始め, 1 = 端）
        lipLean: 0.55,         // めくれを引いた向きへ倒す割合
        roughAmp: 0.095,       // めくれの先の千切れた肌
        skirtRough: 2.4,       // 裾の荒れの倍率
        pitFreq: 2.3,          // 気泡の密度
        pitDepth: 0.13,
        pitRate: 0.42,
        grain: 0.38,           // 霜のざらつき（法線の揺らぎ）

        melt: 0.18,            // 初期の溶け具合
        autoMeltRate: 0.012,   // 自動で溶かすときの速さ（/秒）
        exposure: 0.95,
        contrast: 1.08
    };

    // スクープの形
    const SCOOP = {
        r: 2.78, cy: 2.82,      // 玉の半径と中心の高さ
        squash: 1.03,           // 縦に少しつぶす
        collarR: 3.30,          // 裾の広がり
        collarT: 0.34,          // 裾の厚み（半分）
        collarY0: 0.22,         // 裾の中心での高さ
        collarRise: 1.15,       // 外へ行くほど持ち上がる量
        blend: 0.55,            // 玉と裾のつなぎの丸み
        rnd: 0.14               // 裾の縁の丸み
    };

    // パレット（sRGB）。写真の明るい面・暗い面から拾った値
    const FLAVORS = {
        vanilla: {
            label: "バニラ",
            lo: [0.870, 0.690, 0.330], base: [0.960, 0.830, 0.500], hi: [0.995, 0.925, 0.700],
            speck: [0.14, 0.09, 0.05], speckRate: 0.28, tint: [1.0, 0.86, 0.55]
        },
        cream: {
            label: "ミルク",
            lo: [0.900, 0.660, 0.400], base: [0.975, 0.800, 0.560], hi: [0.995, 0.905, 0.760],
            speck: null, speckRate: 0, tint: [1.0, 0.82, 0.56]
        },
        milktea: {
            label: "ミルクティー",
            lo: [0.665, 0.515, 0.330], base: [0.805, 0.675, 0.495], hi: [0.905, 0.815, 0.670],
            speck: [0.26, 0.17, 0.10], speckRate: 0.14, tint: [0.95, 0.76, 0.55]
        }
    };

    // 器。内面は y = floorY + depth·(r/R)^p の回転体
    const VESSELS = {
        coupe: { label: "クープグラス", kind: "glass", R: 5.2, depth: 3.5, p: 1.70, floorY: 5.1, wall: 0.16 },
        hobnail: { label: "ホブネイルの鉢", kind: "hobnail", R: 6.1, depth: 3.3, p: 2.30, floorY: 0.95, wall: 0.26 },
        porcelain: { label: "白磁の鉢", kind: "porcelain", R: 5.4, depth: 4.0, p: 2.00, floorY: 0.45, wall: 0.28 }
    };

    const TOPPINGS = { biscuit: "ビスケット", mint: "ミント", none: "なし" };
    const TABLES = { white: "白い板", oak: "樫の板" };

    // =================================================================
    // 1. ユーティリティ
    // =================================================================
    const V3 = BABYLON.Vector3;
    const TAU = Math.PI * 2;
    const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
    const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
    const mix = (a, b, t) => a + (b - a) * t;
    const lin = (v) => Math.pow(clamp(v, 0, 1), 2.2);
    const sRGB = (c) => new BABYLON.Color3(c[0], c[1], c[2]).toLinearSpace();
    const smin = (a, b, k) => { const h = clamp(0.5 + 0.5 * (b - a) / k, 0, 1); return mix(b, a, h) - k * h * (1 - h); };
    const smax = (a, b, k) => -smin(-a, -b, k);

    class Rng {
        constructor(seed) { this.s = seed >>> 0; }
        next() {
            this.s = (this.s + 0x6D2B79F5) | 0;
            let t = Math.imul(this.s ^ (this.s >>> 15), 1 | this.s);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        }
        range(a, b) { return a + (b - a) * this.next(); }
    }

    const Noise = {
        _h3(x, y, z, seed) {
            let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263)
                ^ Math.imul(z | 0, 2147483647) ^ Math.imul(seed | 0, 1274126177);
            h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
            return (h >>> 0) / 4294967295;
        },
        v3(x, y, z, seed) {
            const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
            const xf = x - xi, yf = y - yi, zf = z - zi;
            const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
            const c = (i, j, k) => this._h3(xi + i, yi + j, zi + k, seed);
            const x00 = mix(c(0, 0, 0), c(1, 0, 0), u), x10 = mix(c(0, 1, 0), c(1, 1, 0), u);
            const x01 = mix(c(0, 0, 1), c(1, 0, 1), u), x11 = mix(c(0, 1, 1), c(1, 1, 1), u);
            return mix(mix(x00, x10, v), mix(x01, x11, v), w);
        },
        fbm3(x, y, z, seed, oct) {
            let s = 0, a = 0.5, f = 1, n = 0;
            for (let o = 0; o < oct; o++) {
                s += a * this.v3(x * f, y * f, z * f, seed + o * 271); n += a; f *= 2.03; a *= 0.5;
            }
            return s / n;
        },
        // セルノイズ。out[0] = 最寄りの特徴点までの距離, out[1] = そのセルの乱数
        worley3(x, y, z, seed, out) {
            const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
            let f1 = 1e9, id = 0;
            for (let dz = -1; dz <= 1; dz++) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
                const cx = xi + dx, cy = yi + dy, cz = zi + dz;
                const fx = cx + this._h3(cx, cy, cz, seed);
                const fy = cy + this._h3(cx, cy, cz, seed + 17);
                const fz = cz + this._h3(cx, cy, cz, seed + 31);
                const d = Math.hypot(fx - x, fy - y, fz - z);
                if (d < f1) { f1 = d; id = this._h3(cx, cy, cz, seed + 47); }
            }
            out[0] = f1; out[1] = id;
            return out;
        }
    };

    // 【対策】ComputeNormals の巻き順の規約を決め打ちすると裏返る。
    //         重心からの向きと法線の内積の総和で判定して、必要なら反転する
    function finalize(positions, indices) {
        let normals = new Float32Array(positions.length);
        BABYLON.VertexData.ComputeNormals(positions, indices, normals);
        const n = positions.length / 3;
        let cx = 0, cy = 0, cz = 0;
        for (let i = 0; i < n; i++) { cx += positions[i * 3]; cy += positions[i * 3 + 1]; cz += positions[i * 3 + 2]; }
        cx /= n; cy /= n; cz /= n;
        let acc = 0;
        for (let i = 0; i < n; i++) {
            acc += normals[i * 3] * (positions[i * 3] - cx)
                + normals[i * 3 + 1] * (positions[i * 3 + 1] - cy)
                + normals[i * 3 + 2] * (positions[i * 3 + 2] - cz);
        }
        if (acc < 0) {
            for (let i = 0; i < indices.length; i += 3) {
                const t = indices[i + 1]; indices[i + 1] = indices[i + 2]; indices[i + 2] = t;
            }
            normals = new Float32Array(positions.length);
            BABYLON.VertexData.ComputeNormals(positions, indices, normals);
        }
        return normals;
    }

    function makeMesh(name, positions, indices, normals, uvs, colors, scene, updatable) {
        const mesh = new BABYLON.Mesh(name, scene);
        mesh.id = name;
        const vd = new BABYLON.VertexData();
        vd.positions = positions; vd.indices = indices; vd.normals = normals;
        if (uvs) vd.uvs = uvs;
        if (colors) vd.colors = colors;
        vd.applyToMesh(mesh, !!updatable);
        // 【対策】stride 4 の頂点カラーでも不透明パスに残す
        mesh.hasVertexAlpha = false;
        return mesh;
    }

    // =================================================================
    // 2. 距離場
    // =================================================================
    class Grid {
        setup(min, max, h) {
            const PAD = 3;
            this.h = h;
            this.ox = min[0] - PAD * h; this.oy = min[1] - PAD * h; this.oz = min[2] - PAD * h;
            this.nx = Math.ceil((max[0] - min[0]) / h) + PAD * 2 + 1;
            this.ny = Math.ceil((max[1] - min[1]) / h) + PAD * 2 + 1;
            this.nzc = Math.ceil((max[2] - min[2]) / h) + PAD * 2 + 1;
            this.N = this.nx * this.ny * this.nzc;
        }
        idx(x, y, z) { return (z * this.ny + y) * this.nx + x; }
        pos(i, j, k, out) {
            out[0] = this.ox + (i + 0.5) * this.h;
            out[1] = this.oy + (j + 0.5) * this.h;
            out[2] = this.oz + (k + 0.5) * this.h;
            return out;
        }
        blur(src) {
            const out = new Float32Array(this.N);
            const nx = this.nx, ny = this.ny, nzc = this.nzc;
            const pass = (a, b, stride, len) => {
                for (let o = 0; o < this.N; o++) {
                    const c = ((o / stride) | 0) % len;
                    const l = c > 0 ? a[o - stride] : a[o];
                    const r = c < len - 1 ? a[o + stride] : a[o];
                    b[o] = (l + 2 * a[o] + r) * 0.25;
                }
            };
            const tmp = new Float32Array(this.N);
            pass(src, out, 1, nx);
            pass(out, tmp, nx, ny);
            pass(tmp, out, nx * ny, nzc);
            return out;
        }
    }

    // 解析的な距離関数から
    class FnField extends Grid {
        constructor(fn, min, max, h, blurPasses) {
            super();
            this.setup(min, max, h);
            let phi = new Float32Array(this.N);
            const p = [0, 0, 0];
            for (let k = 0; k < this.nzc; k++) for (let j = 0; j < this.ny; j++) for (let i = 0; i < this.nx; i++) {
                this.pos(i, j, k, p);
                phi[this.idx(i, j, k)] = fn(p[0], p[1], p[2]);
            }
            for (let b = 0; b < (blurPasses || 0); b++) phi = this.blur(phi);
            this.phi = phi;
        }
    }

    // ---- スクープの距離関数 ------------------------------------------
    // 玉（少しつぶした球）＋ 裾（外へ行くほど持ち上がる円盤）を smin で合成
    function makeScoopSDF(seed) {
        const rng = new Rng(seed);
        const waves = [];
        for (const fa of [[3, 0.045], [5, 0.040], [7, 0.030], [11, 0.025], [14, 0.020], [19, 0.014], [23, 0.010]])
            waves.push([fa[0], fa[1], rng.range(0, TAU)]);
        const wob = (a) => { let s = 0; for (const w of waves) s += w[1] * Math.sin(w[0] * a + w[2]); return s; };
        const S = SCOOP;
        return (x, y, z) => {
            const rr = Math.hypot(x, z);
            const ball = Math.hypot(x, (y - S.cy) * S.squash, z) - S.r;
            const a = Math.atan2(z, x);
            const cr = S.collarR * (1 + wob(a));
            const t = clamp(rr / cr, 0, 1.3);
            const yc = S.collarY0 + S.collarRise * t * t;
            const th = S.collarT * (1 - 0.30 * t) * (1 + 0.6 * wob(a * 1.0 + 1.3));
            const qx = rr - cr + S.rnd, qy = Math.abs(y - yc) - th + S.rnd;
            const collar = Math.min(Math.max(qx, qy), 0) + Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) - S.rnd;
            let d = smin(ball, collar, S.blend);
            d = smax(d, -y, 0.15);            // 底は平らに
            return d;
        };
    }

    // =================================================================
    // 3. サーフェスネット
    // =================================================================
    function surfaceNets(F) {
        const nx = F.nx, ny = F.ny, nzc = F.nzc, phi = F.phi;
        const cellV = new Int32Array((nx - 1) * (ny - 1) * (nzc - 1)).fill(-1);
        const ci = (i, j, k) => (k * (ny - 1) + j) * (nx - 1) + i;
        const positions = [];
        const EDGE = [
            [0, 0, 0, 1, 0, 0], [0, 1, 0, 1, 1, 0], [0, 0, 1, 1, 0, 1], [0, 1, 1, 1, 1, 1],
            [0, 0, 0, 0, 1, 0], [1, 0, 0, 1, 1, 0], [0, 0, 1, 0, 1, 1], [1, 0, 1, 1, 1, 1],
            [0, 0, 0, 0, 0, 1], [1, 0, 0, 1, 0, 1], [0, 1, 0, 0, 1, 1], [1, 1, 0, 1, 1, 1]
        ];
        const p0 = [0, 0, 0], p1 = [0, 0, 0];
        for (let k = 0; k < nzc - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
            let neg = 0;
            for (let c = 0; c < 8; c++) if (phi[F.idx(i + (c & 1), j + ((c >> 1) & 1), k + ((c >> 2) & 1))] < 0) neg++;
            if (neg === 0 || neg === 8) continue;
            let sx = 0, sy = 0, sz = 0, n = 0;
            for (let e = 0; e < 12; e++) {
                const E = EDGE[e];
                const a = phi[F.idx(i + E[0], j + E[1], k + E[2])];
                const b = phi[F.idx(i + E[3], j + E[4], k + E[5])];
                if ((a < 0) === (b < 0)) continue;
                const t = a / (a - b);
                F.pos(i + E[0], j + E[1], k + E[2], p0);
                F.pos(i + E[3], j + E[4], k + E[5], p1);
                sx += mix(p0[0], p1[0], t); sy += mix(p0[1], p1[1], t); sz += mix(p0[2], p1[2], t);
                n++;
            }
            cellV[ci(i, j, k)] = positions.length / 3;
            positions.push(sx / n, sy / n, sz / n);
        }
        const indices = [];
        const quad = (a, b, c, d, flip) => {
            if (a < 0 || b < 0 || c < 0 || d < 0) return;
            if (flip) indices.push(a, c, b, a, d, c); else indices.push(a, b, c, a, c, d);
        };
        for (let k = 0; k < nzc; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
            const s0 = phi[F.idx(i, j, k)] < 0;
            if (i + 1 < nx && j >= 1 && k >= 1 && j < ny - 1 && k < nzc - 1) {
                if (s0 !== (phi[F.idx(i + 1, j, k)] < 0))
                    quad(cellV[ci(i, j - 1, k - 1)], cellV[ci(i, j, k - 1)], cellV[ci(i, j, k)], cellV[ci(i, j - 1, k)], s0);
            }
            if (j + 1 < ny && i >= 1 && k >= 1 && i < nx - 1 && k < nzc - 1) {
                if (s0 !== (phi[F.idx(i, j + 1, k)] < 0))
                    quad(cellV[ci(i - 1, j, k - 1)], cellV[ci(i, j, k - 1)], cellV[ci(i, j, k)], cellV[ci(i - 1, j, k)], !s0);
            }
            if (k + 1 < nzc && i >= 1 && j >= 1 && i < nx - 1 && j < ny - 1) {
                if (s0 !== (phi[F.idx(i, j, k + 1)] < 0))
                    quad(cellV[ci(i - 1, j - 1, k)], cellV[ci(i, j - 1, k)], cellV[ci(i, j, k)], cellV[ci(i - 1, j, k)], s0);
            }
        }
        const pos = new Float32Array(positions);
        return { positions: pos, indices: indices, normals: finalize(pos, indices) };
    }

    // =================================================================
    // 4. 器の内面
    // =================================================================
    const innerY = (V, r) => V.floorY + V.depth * Math.pow(Math.max(0, r) / V.R, V.p);
    const innerR = (V, y) => V.R * Math.pow(clamp((y - V.floorY) / V.depth, 0, 1.5), 1 / V.p);
    const rimY = (V) => V.floorY + V.depth;

    // =================================================================
    // 5. ディッシャーの跡を焼く（盛り付けごとに1回）
    // =================================================================
    function bakeScoop(base, seed) {
        const P = base.positions, Nn = base.normals, n = P.length / 3;
        const rng = new Rng(seed);
        const C = GLOBAL;

        // ディッシャーの座標系。引いた向き D は水平から少し下へ
        const th = rng.range(0, TAU);
        const D = new V3(Math.cos(th), -rng.range(0.15, 0.45), Math.sin(th)).normalize();
        const S = V3.Cross(D, V3.Up()).normalize();
        const U = V3.Cross(S, D).normalize();

        let uMin = 1e9, uMax = -1e9;
        for (let i = 0; i < n; i++) {
            if (Nn[i * 3 + 1] < 0.25) continue;
            const u = P[i * 3] * D.x + P[i * 3 + 1] * D.y + P[i * 3 + 2] * D.z;
            uMin = Math.min(uMin, u); uMax = Math.max(uMax, u);
        }
        const uEnd = mix(uMin, uMax, C.lipAt + rng.range(-0.08, 0.08));
        const s0 = (seed % 9973) | 0;

        const out = {
            D: D,
            streak: new Float32Array(n), lump: new Float32Array(n), lip: new Float32Array(n),
            rough: new Float32Array(n), pit: new Float32Array(n), speck: new Float32Array(n),
            grain: new Float32Array(n * 3), drip: new Float32Array(n)
        };
        const W = [0, 0];
        for (let i = 0; i < n; i++) {
            const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2];
            const nx = Nn[i * 3], ny = Nn[i * 3 + 1], nz = Nn[i * 3 + 2];
            const u = x * D.x + y * D.y + z * D.z;
            const v = x * S.x + y * S.y + z * S.z;
            const w = x * U.x + y * U.y + z * U.z;
            const skirt = 1 - smooth(0.6, 1.7, y);       // 1: 裾

            const jit = (Noise.fbm3(v * 0.9, w * 0.9, 3.1, s0 + 3, 2) - 0.5) * 1.3;
            const d = u - (uEnd + jit);
            const up = smooth(-0.05, 0.55, ny);

            // 1. 引いた筋（裾には付けない）
            const fq = C.streakFreq;
            const st = Noise.fbm3(u * 0.55 + 7.7, v * fq, w * fq, s0 + 11, 3) - 0.5;
            const stroke = smooth(0.25, -0.35, d) * mix(0.35, 1.0, up) * (1 - 0.7 * skirt);
            out.streak[i] = st * 2 * C.streakAmp * stroke;

            // 2. 大きなうねり
            out.lump[i] = (Noise.fbm3(x * 0.85, y * 0.85, z * 0.85, s0 + 21, 3) - 0.5) * 2 * C.lumpAmp;

            // 3. めくれ
            const rag = 0.45 + 1.1 * Noise.fbm3(v * 2.6, w * 2.6, u * 1.4, s0 + 5, 3);
            const tear = 1 - 0.8 * smooth(0.55, 0.72, Noise.fbm3(v * 1.7, w * 1.7, 0.5, s0 + 9, 2));
            const ridge = Math.exp(-Math.pow(d / C.lipWidth, 2))
                + 0.42 * Math.exp(-Math.pow((d + 0.85) / (C.lipWidth * 0.8), 2));
            out.lip[i] = C.lipAmp * ridge * rag * tear * up * (1 - skirt);

            // 4. 千切れた肌。裾はぼそぼそと荒い
            const past = smooth(-0.05, 0.45, d);
            out.rough[i] = (Noise.fbm3(x * 3.4, y * 3.4, z * 3.4, s0 + 13, 3) - 0.5) * 2 * C.roughAmp
                * mix(0.35, 1.0, past) * mix(1, C.skirtRough, skirt);

            // 5. 気泡の穴
            Noise.worley3(x * C.pitFreq, y * C.pitFreq, z * C.pitFreq, s0 + 29, W);
            if (W[1] < C.pitRate) {
                const rad = mix(0.12, 0.34, (W[1] / C.pitRate));
                if (W[0] < rad) { const t = 1 - W[0] / rad; out.pit[i] = t * t; }
            }

            // 6. バニラビーンズ・茶葉の粒（色だけ）
            Noise.worley3(x * 6.5, y * 6.5, z * 6.5, s0 + 37, W);
            if (W[0] < 0.11) out.speck[i] = W[1];

            // 溶けて垂れる筋
            out.drip[i] = smooth(0.52, 0.72, Noise.fbm3(x * 1.5, y * 0.22, z * 1.5, s0 + 53, 2));

            // 霜のざらつき
            const q = 11.0;
            let gx = Noise.v3(x * q, y * q, z * q, s0 + 41) - 0.5;
            let gy = Noise.v3(x * q + 17, y * q, z * q, s0 + 43) - 0.5;
            let gz = Noise.v3(x * q, y * q + 23, z * q, s0 + 47) - 0.5;
            const dn = gx * nx + gy * ny + gz * nz;
            out.grain[i * 3] = gx - dn * nx; out.grain[i * 3 + 1] = gy - dn * ny; out.grain[i * 3 + 2] = gz - dn * nz;
        }
        return out;
    }

    // =================================================================
    // 6. 溶け・器・フレーバーを反映して頂点を書き直す
    // =================================================================
    function applyIce(st) {
        const base = st.base, B = st.bake, V = VESSELS[state.vessel], F = FLAVORS[state.flavor];
        const P = base.positions, Nn = base.normals, n = P.length / 3;
        const m = state.melt, H = GLOBAL.height;
        const baseY = V.floorY + 0.10;
        const pos = st.pos, col = st.col, uv = st.uv;
        const lean = GLOBAL.lipLean, D = B.D;

        const hm = H * (0.05 + 0.30 * m);
        const detailKeep = 1 - 0.45 * m;
        const lo = F.lo.map(lin), bs = F.base.map(lin), hi = F.hi.map(lin);
        const sp = F.speck ? F.speck.map(lin) : null;
        st.contactN = 0;

        for (let i = 0; i < n; i++) {
            const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2];
            const nx = Nn[i * 3], ny = Nn[i * 3 + 1], nz = Nn[i * 3 + 2];
            const y01 = y / H;
            const hmi = hm * (1 + 1.6 * B.drip[i] * m);
            const wm = 1 - smooth(0, hmi, y);
            const keep = detailKeep * (1 - 0.88 * wm);

            const lip = B.lip[i] * keep * (1 - 0.5 * m);
            const dsp = (B.streak[i] + B.rough[i]) * keep
                - B.pit[i] * GLOBAL.pitDepth * keep
                + B.lump[i] * (1 - 0.4 * m)
                + lip
                + 0.05 * m * B.drip[i] * smooth(hmi, hmi * 0.6, y) * (1 - smooth(hmi * 0.6, 0, y) * 0.5);

            let qx = x + nx * dsp + D.x * lip * lean;
            let qy = y + ny * dsp + D.y * lip * lean;
            let qz = z + nz * dsp + D.z * lip * lean;

            qy *= 1 - 0.16 * m * m - 0.04 * m;
            const bulge = 1 + m * 0.22 * Math.pow(1 - clamp(y01, 0, 1), 4);
            qx *= bulge; qz *= bulge;
            qy += baseY;

            const r = Math.hypot(qx, qz);
            const yin = innerY(V, r) + 0.025;
            let contact = 0;
            if (qy < yin) { qy = yin; contact = 1; st.contactN++; }
            pos[i * 3] = qx; pos[i * 3 + 1] = qy; pos[i * 3 + 2] = qz;

            // ---- 艶 ----------------------------------------------------
            const lipN = clamp(B.lip[i] / GLOBAL.lipAmp, 0, 1.5);
            let g = 0.05 + 0.40 * m * m + wm * (0.50 + 0.35 * m) + contact * 0.4 - 0.05 * lipN;
            uv[i * 2] = clamp(g, 0, 1); uv[i * 2 + 1] = 0.5;

            // ---- 色 ----------------------------------------------------
            let t = 0.5 + 5.5 * (B.streak[i] + B.rough[i] * 0.8) * keep + 0.35 * lipN * keep - 0.55 * B.pit[i] * keep;
            t = clamp(t, 0, 1);
            let cr, cg, cb;
            if (t < 0.5) { const k = t * 2; cr = mix(lo[0], bs[0], k); cg = mix(lo[1], bs[1], k); cb = mix(lo[2], bs[2], k); }
            else { const k = (t - 0.5) * 2; cr = mix(bs[0], hi[0], k); cg = mix(bs[1], hi[1], k); cb = mix(bs[2], hi[2], k); }
            const wet = 0.22 * wm + 0.06 * m;
            cr = mix(cr, lo[0], wet); cg = mix(cg, lo[1], wet); cb = mix(cb, lo[2], wet);
            const ao = 0.80 + 0.20 * smooth(0.0, 0.9, qy - yin + 0.025);
            cr *= ao; cg *= ao; cb *= ao;
            if (sp && B.speck[i] > 0 && B.speck[i] < F.speckRate) {
                const k = 0.85 * (1 - 0.5 * wm);
                cr = mix(cr, sp[0], k); cg = mix(cg, sp[1], k); cb = mix(cb, sp[2], k);
            }
            col[i * 4] = cr; col[i * 4 + 1] = cg; col[i * 4 + 2] = cb; col[i * 4 + 3] = 1;
        }

        const nrm = st.nrm;
        BABYLON.VertexData.ComputeNormals(pos, base.indices, nrm);
        const ga = GLOBAL.grain * (1 - 0.6 * m);
        for (let i = 0; i < n; i++) {
            const y = P[i * 3 + 1];
            const k = ga * (1 - (1 - smooth(0, hm * (1 + 1.6 * B.drip[i] * m), y)) * 0.9);
            let ax = nrm[i * 3] + B.grain[i * 3] * k;
            let ay = nrm[i * 3 + 1] + B.grain[i * 3 + 1] * k;
            let az = nrm[i * 3 + 2] + B.grain[i * 3 + 2] * k;
            const l = Math.hypot(ax, ay, az) || 1;
            nrm[i * 3] = ax / l; nrm[i * 3 + 1] = ay / l; nrm[i * 3 + 2] = az / l;
        }

        const mesh = st.mesh;
        mesh.updateVerticesData(BABYLON.VertexBuffer.PositionKind, pos);
        mesh.updateVerticesData(BABYLON.VertexBuffer.NormalKind, nrm);
        mesh.updateVerticesData(BABYLON.VertexBuffer.ColorKind, col);
        mesh.updateVerticesData(BABYLON.VertexBuffer.UVKind, uv);
        mesh.refreshBoundingInfo();

        // ---- 器の底の溜まり ---------------------------------------------
        const level = V.floorY + 0.06 + m * V.depth * 0.52;
        const rl = innerR(V, level) - 0.03;
        puddle.isVisible = m > 0.03 && rl > 0.2;
        puddle.position.y = level;
        puddle.scaling.x = puddle.scaling.y = rl;
        const pc = F.base, ph = F.hi;
        mats.puddle.albedoColor = sRGB([mix(pc[0], ph[0], 0.5), mix(pc[1], ph[1], 0.5), mix(pc[2], ph[2], 0.5)]);

        placeToppings(st);
    }

    // =================================================================
    // 7. 器
    // =================================================================
    function vesselProfile(V) {
        const pts = [];
        const Ni = 40, t = V.wall;
        for (let i = 0; i <= Ni; i++) { const r = V.R * i / Ni; pts.push(new V3(r, innerY(V, r), 0)); }
        const top = rimY(V);
        for (let i = 1; i < 8; i++) {
            const a = Math.PI * i / 8;
            pts.push(new V3(V.R + t * 0.5 - Math.cos(a) * t * 0.5, top + Math.sin(a) * t * 0.55, 0));
        }
        const Ro = V.R + t;
        let bottomR;
        if (V.kind === "glass") bottomR = 0.62; else if (V.kind === "hobnail") bottomR = 3.3; else bottomR = 2.4;
        const oy = (r) => innerY(V, r * V.R / Ro) - t * 0.85;
        const No = 40;
        for (let i = 0; i <= No; i++) {
            const r = mix(Ro, bottomR, i / No);
            pts.push(new V3(r, Math.max(oy(r), 0), 0));
        }
        if (V.kind === "glass") {
            const yb = oy(bottomR);
            pts.push(new V3(0.50, yb - 0.45, 0), new V3(0.40, yb - 1.4, 0), new V3(0.38, 1.6, 0),
                new V3(0.46, 0.75, 0), new V3(0.95, 0.42, 0), new V3(2.6, 0.26, 0),
                new V3(3.35, 0.16, 0), new V3(3.45, 0.08, 0), new V3(3.35, 0.0, 0), new V3(0, 0.0, 0));
        } else if (V.kind === "hobnail") {
            pts.push(new V3(3.25, 0.05, 0), new V3(3.1, 0.0, 0), new V3(0, 0.0, 0));
        } else {
            pts.push(new V3(2.50, 0.03, 0), new V3(2.38, 0.0, 0), new V3(2.22, 0.03, 0),
                new V3(2.16, 0.22, 0), new V3(0, 0.26, 0));
        }
        return pts;
    }

    function hobnailNormalMap(scene, profile, V) {
        const len = [0];
        for (let i = 1; i < profile.length; i++) len.push(len[i - 1] + V3.Distance(profile[i], profile[i - 1]));
        const total = len[len.length - 1];
        const outerStart = len[48] + 0.5, outerEnd = len[40 + 7 + 40] - 0.35;
        const W = 512, Hh = 1024;
        const tex = new BABYLON.DynamicTexture("hobnailN", { width: W, height: Hh }, scene, true);
        const ctx = tex.getContext();
        const img = ctx.createImageData(W, Hh);
        const circ = TAU * (V.R * 0.85);
        const pitch = 0.62, rad = 0.25;
        for (let py = 0; py < Hh; py++) {
            const vcm = py / Hh * circ;
            for (let px = 0; px < W; px++) {
                const ucm = px / W * total;
                let nxv = 0, nyv = 0;
                if (ucm > outerStart && ucm < outerEnd) {
                    const row = Math.floor((ucm - outerStart) / pitch);
                    const cu = outerStart + (row + 0.5) * pitch;
                    const off = (row & 1) ? pitch * 0.5 : 0;
                    const cv = Math.round((vcm - off) / pitch) * pitch + off;
                    const du = ucm - cu, dv = vcm - cv;
                    const d = Math.hypot(du, dv);
                    if (d < rad) { nxv = du / rad * 0.9; nyv = dv / rad * 0.9; }
                }
                const nz = Math.sqrt(Math.max(0.05, 1 - nxv * nxv - nyv * nyv));
                const o = (py * W + px) * 4;
                img.data[o] = (nxv * 0.5 + 0.5) * 255;
                img.data[o + 1] = (nyv * 0.5 + 0.5) * 255;
                img.data[o + 2] = (nz * 0.5 + 0.5) * 255;
                img.data[o + 3] = 255;
            }
        }
        ctx.putImageData(img, 0, 0);
        tex.update(false);
        return tex;
    }

    function buildVessel(key) {
        for (const m of vesselMeshes) m.dispose();
        vesselMeshes.length = 0;
        const V = VESSELS[key];
        const profile = vesselProfile(V);
        const lathe = BABYLON.MeshBuilder.CreateLathe("vessel_" + key, { shape: profile, tessellation: 144, closed: true }, scene);
        if (V.kind === "porcelain") lathe.material = mats.porcelain;
        else if (V.kind === "hobnail") {
            if (!mats.hobnail.bumpTexture) mats.hobnail.bumpTexture = hobnailNormalMap(scene, profile, V);
            lathe.material = mats.hobnail;
        } else lathe.material = mats.glass;
        lathe.receiveShadows = true;
        sg.addShadowCaster(lathe);
        vesselMeshes.push(lathe);

        if (V.kind === "glass") {
            const rim = BABYLON.MeshBuilder.CreateTorus("rimLine", {
                diameter: (V.R + V.wall * 0.5) * 2, thickness: 0.075, tessellation: 144
            }, scene);
            rim.position.y = rimY(V) + V.wall * 0.42;
            rim.material = mats.platinum;
            vesselMeshes.push(rim);
        }
        puddle.material = mats.puddle;
    }

    // =================================================================
    // 8. 付け合わせ
    // =================================================================
    function biscuit2D(x, z) {
        const hx = 3.1, hz = 1.2, rr = 0.34;
        const qx = Math.abs(x) - hx + rr, qz = Math.abs(z) - hz + rr;
        let d = Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0) - rr;
        const s = (Math.abs(z) - hz > Math.abs(x) - hx) ? x : z;
        d -= 0.05 * (0.5 + 0.5 * Math.cos(TAU * s / 0.40));
        return d;
    }
    function buildBiscuit() {
        const sd = (x, y, z) => {
            const d2 = biscuit2D(x, z), rnd = 0.09;
            const wx = d2 + rnd, wy = Math.abs(y) - 0.21 + rnd;
            return Math.min(Math.max(wx, wy), 0) + Math.hypot(Math.max(wx, 0), Math.max(wy, 0)) - rnd;
        };
        const F = new FnField(sd, [-3.4, -0.3, -1.5], [3.4, 0.3, 1.5], 0.045, 0);
        const g = surfaceNets(F);
        const P = g.positions, N = g.normals, n = P.length / 3;
        const W = [0, 0];
        const col = new Float32Array(n * 4);
        const light = [0.70, 0.46, 0.25].map(lin), dark = [0.45, 0.26, 0.11].map(lin);
        for (let i = 0; i < n; i++) {
            const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2];
            const d2 = biscuit2D(x, z);
            let dsp = 0;
            Noise.worley3(x * 5, y * 5, z * 5, 71, W);
            if (W[1] < 0.5 && W[0] < 0.22) dsp -= 0.02 * (1 - W[0] / 0.22);
            if (Math.abs(N[i * 3 + 1]) > 0.6) dsp -= 0.028 * Math.exp(-Math.pow((d2 + 0.30) / 0.05, 2));
            dsp += (Noise.fbm3(x * 2, y * 2, z * 2, 73, 3) - 0.5) * 0.03;
            P[i * 3] += N[i * 3] * dsp; P[i * 3 + 1] += N[i * 3 + 1] * dsp; P[i * 3 + 2] += N[i * 3 + 2] * dsp;
            const burn = clamp(smooth(-0.35, 0.02, d2) * 0.8 + (Noise.fbm3(x * 1.3, 0, z * 1.3, 77, 3) - 0.5) * 0.8, 0, 1);
            for (let c = 0; c < 3; c++) col[i * 4 + c] = mix(light[c], dark[c], burn) * (dsp < -0.012 ? 0.85 : 1);
            col[i * 4 + 3] = 1;
        }
        const nrm = new Float32Array(P.length);
        BABYLON.VertexData.ComputeNormals(P, g.indices, nrm);
        const mesh = makeMesh("biscuit", P, g.indices, nrm, null, col, scene, false);
        mesh.material = mats.biscuit;
        sg.addShadowCaster(mesh);
        mesh.receiveShadows = true;
        return mesh;
    }

    function buildLeaf(name, L, Wd, seed) {
        const NU = 28, NV = 10;
        const pos = [], col = [], idx = [];
        const cBase = [0.26, 0.50, 0.14].map(lin), cVein = [0.52, 0.72, 0.30].map(lin), cEdge = [0.18, 0.38, 0.09].map(lin);
        for (let i = 0; i <= NU; i++) {
            const u = i / NU;
            let hw = Wd * Math.pow(Math.sin(Math.PI * Math.pow(u, 0.8)), 0.85);
            const sawtooth = (u * 11) % 1;
            hw *= 1 - 0.09 * sawtooth * smooth(0.08, 0.2, u) * smooth(1.0, 0.85, u);
            for (let j = 0; j <= NV; j++) {
                const v = j / NV * 2 - 1;
                const z = v * hw;
                const vein = Math.abs(((u * 6 - Math.abs(v) * 0.9) % 1 + 1) % 1 - 0.5);
                const y = 0.22 * Wd * Math.pow(Math.abs(v), 1.3) - 0.22 * L * u * u
                    + (Noise.v3(u * 9, v * 3, 0, seed) - 0.5) * 0.06 * Wd * (1 - vein);
                pos.push(u * L, y, z);
                const mid = Math.exp(-Math.pow(v / 0.08, 2));
                const lat = Math.exp(-Math.pow(vein / 0.05, 2)) * 0.5;
                for (let c = 0; c < 3; c++) col.push(mix(mix(cBase[c], cEdge[c], Math.abs(v) * 0.6), cVein[c], Math.max(mid, lat)));
                col.push(1);
            }
        }
        for (let i = 0; i < NU; i++) for (let j = 0; j < NV; j++) {
            const a = i * (NV + 1) + j, b = a + NV + 1;
            idx.push(a, b, a + 1, a + 1, b, b + 1);
        }
        const nrm = new Float32Array(pos.length);
        BABYLON.VertexData.ComputeNormals(pos, idx, nrm);
        const mesh = makeMesh(name, new Float32Array(pos), idx, nrm, null, new Float32Array(col), scene, false);
        mesh.material = mats.mint;
        sg.addShadowCaster(mesh);
        return mesh;
    }
    function buildMint() {
        const root = new BABYLON.TransformNode("mintSprig", scene);
        const spec = [
            [1.9, 1.10, 0.00, 0.55], [1.8, 1.00, Math.PI, 0.50],
            [1.1, 0.66, Math.PI * 0.5, 0.95], [1.0, 0.62, -Math.PI * 0.5, 0.90]
        ];
        spec.forEach((s, k) => {
            const leaf = buildLeaf("mintLeaf" + k, s[0], s[1] * 0.5, 90 + k);
            leaf.parent = root;
            leaf.rotation.y = s[2];
            leaf.rotation.z = s[3];
            leaf.position.y = k >= 2 ? 0.12 : 0.0;
        });
        return root;
    }

    // ビスケットを挿す向き（長手方向）。カメラから見て右奥へ、斜め上に立てる
    const BISCUIT_DIR = new V3(0.62, 0.76, -0.14).normalize();
    // 挿す点を探す向き（玉の中心から）
    const BISCUIT_SPOT = new V3(0.78, 0.52, -0.18).normalize();
    const BISCUIT_BURY = 1.1;     // 玉に埋める長さ

    // 【対策】溶けるたびに挿す位置を探し直すと裾の頂点が選ばれて飛ぶ。
    //         溶ける前の形で1回だけ決め、その頂点に追従させる
    function findAnchors(st) {
        const P = st.base.positions, n = P.length / 3, cy = SCOOP.cy;
        let bestB = -1e9, bi = 0, bestM = -1e9, mi = 0;
        for (let i = 0; i < n; i++) {
            const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2];
            if (y > bestM) { bestM = y; mi = i; }                 // てっぺん
            const dy = y - cy, l = Math.hypot(x, dy, z) || 1;
            const s = (x * BISCUIT_SPOT.x + dy * BISCUIT_SPOT.y + z * BISCUIT_SPOT.z) / l;
            if (s > bestB) { bestB = s; bi = i; }
        }
        st.anchorBiscuit = bi; st.anchorMint = mi;

        // 姿勢：ローカル X = 長手、ローカル Y（薄い向き）= 水平
        const X = BISCUIT_DIR;
        const Y = V3.Cross(X, V3.Up()).normalize();
        const Z = V3.Cross(X, Y).normalize();
        st.biscuitQuat = BABYLON.Quaternion.RotationQuaternionFromAxis(X, Y, Z);
    }

    const BISCUIT_PROBES = [];
    for (let i = 0; i <= 8; i++) for (const z of [-1.3, 1.3]) for (const y of [-0.22, 0.22])
        BISCUIT_PROBES.push(new V3(-3.2 + 6.4 * i / 8, y, z));

    function keepInsideVessel(node, V) {
        const w = new V3(), margin = V.wall * 0.5 + 0.06, top = rimY(V);
        for (let iter = 0; iter < 6; iter++) {
            node.computeWorldMatrix(true);
            const M = node.getWorldMatrix();
            let push = 0, lift = 0;
            for (const q of BISCUIT_PROBES) {
                V3.TransformCoordinatesToRef(q, M, w);
                if (w.y > top) continue;
                const r = Math.hypot(w.x, w.z);
                push = Math.max(push, r - (innerR(V, w.y) - margin));
                lift = Math.max(lift, innerY(V, r) + margin - w.y);
            }
            if (push <= 1e-3 && lift <= 1e-3) break;
            const c = node.position, rc = Math.hypot(c.x, c.z) || 1;
            if (push > 1e-3) { c.x -= c.x / rc * push; c.z -= c.z / rc * push; }
            if (lift > 1e-3) c.y += lift;
        }
    }

    function placeToppings(st) {
        const V = VESSELS[state.vessel];
        biscuit.setEnabled(state.topping === "biscuit");
        mint.setEnabled(state.topping === "mint");
        if (st.anchorBiscuit === undefined) findAnchors(st);
        const pos = st.pos;
        if (state.topping === "mint") {
            const i = st.anchorMint;
            mint.position.set(pos[i * 3], pos[i * 3 + 1] - 0.10, pos[i * 3 + 2]);
            mint.rotation.y = 0.6;
        }
        if (state.topping === "biscuit") {
            // 玉の肩に挿す。溶けて沈めば一緒に沈む
            const i = st.anchorBiscuit, k = 3.1 - BISCUIT_BURY;
            biscuit.rotationQuaternion = st.biscuitQuat;
            biscuit.position.set(
                pos[i * 3] + BISCUIT_DIR.x * k,
                pos[i * 3 + 1] + BISCUIT_DIR.y * k,
                pos[i * 3 + 2] + BISCUIT_DIR.z * k);
            keepInsideVessel(biscuit, V);
        }
    }

    // =================================================================
    // 9. テーブル
    // =================================================================
    function tableTexture(kind) {
        const S = 1024;
        const tex = new BABYLON.DynamicTexture("table_" + kind, { width: S, height: S }, scene, true);
        const ctx = tex.getContext();
        const rng = new Rng(kind === "oak" ? 5 : 9);
        const plank = S / 4;
        const baseC = kind === "oak" ? [186, 136, 84] : [236, 233, 226];
        const grainC = kind === "oak" ? [128, 84, 44] : [205, 199, 188];
        for (let p = 0; p < 4; p++) {
            const x0 = p * plank;
            const tone = rng.range(-10, 10);
            ctx.fillStyle = `rgb(${baseC[0] + tone},${baseC[1] + tone},${baseC[2] + tone})`;
            ctx.fillRect(x0, 0, plank, S);
            for (let k = 0; k < 70; k++) {
                const gx = x0 + rng.range(4, plank - 4);
                ctx.strokeStyle = `rgba(${grainC[0]},${grainC[1]},${grainC[2]},${rng.range(0.10, kind === "oak" ? 0.45 : 0.35)})`;
                ctx.lineWidth = rng.range(0.6, kind === "oak" ? 3.2 : 2.0);
                ctx.beginPath();
                const amp = rng.range(2, 9), f = rng.range(0.004, 0.012), ph = rng.range(0, TAU);
                for (let y = 0; y <= S; y += 16) {
                    const xx = gx + Math.sin(y * f + ph) * amp;
                    if (y === 0) ctx.moveTo(xx, y); else ctx.lineTo(xx, y);
                }
                ctx.stroke();
            }
            if (kind === "white") {
                for (let k = 0; k < 6; k++) {
                    ctx.fillStyle = `rgba(170,150,120,${rng.range(0.10, 0.25)})`;
                    ctx.fillRect(x0 + rng.range(0, plank - 30), rng.range(0, S), rng.range(8, 40), rng.range(2, 6));
                }
            }
            ctx.fillStyle = kind === "oak" ? "rgba(60,36,18,0.85)" : "rgba(150,142,130,0.8)";
            ctx.fillRect(x0, 0, 3, S);
        }
        tex.update(true);
        tex.uScale = tex.vScale = 1.0;
        return tex;
    }
    function applyTable(kind) {
        const t = tableTexture(kind);
        if (mats.table.albedoTexture) mats.table.albedoTexture.dispose();
        mats.table.albedoTexture = t;
        mats.table.roughness = kind === "oak" ? 0.62 : 0.55;
        scene.clearColor = kind === "oak" ? new BABYLON.Color4(0.23, 0.18, 0.14, 1) : new BABYLON.Color4(0.93, 0.93, 0.92, 1);
    }

    // =================================================================
    // 10. Scene
    // =================================================================
    const scene = new BABYLON.Scene(engine);
    scene.clearColor = new BABYLON.Color4(0.93, 0.93, 0.92, 1);
    const vw = (typeof window !== "undefined" && window.innerWidth) || 1024;
    if (vw < 760) GLOBAL.gridH = 0.095;

    const env = BABYLON.CubeTexture.CreateFromPrefilteredData(GLOBAL.envUrl, scene);
    scene.environmentTexture = env;
    scene.environmentIntensity = 0.9;

    const camera = new BABYLON.ArcRotateCamera("cam", -2.15, 1.10, 27, new V3(0.3, 7.6, 0), scene);
    camera.attachControl(true);
    camera.fov = 0.50;
    camera.minZ = 1; camera.maxZ = 300;
    camera.lowerRadiusLimit = 10; camera.upperRadiusLimit = 70;
    camera.upperBetaLimit = 1.50;
    camera.wheelPrecision = 12;
    camera.panningSensibility = 200;

    const key = new BABYLON.DirectionalLight("key", new V3(0.45, -0.80, 0.40).normalize(), scene);
    key.position = new V3(-18, 32, -16);
    key.intensity = 2.8;
    key.diffuse = new BABYLON.Color3(1.0, 0.975, 0.94);
    key.shadowMinZ = 5; key.shadowMaxZ = 90;
    const fill = new BABYLON.DirectionalLight("fill", new V3(-0.7, -0.4, -0.6).normalize(), scene);
    fill.intensity = 0.55;
    fill.specular = new BABYLON.Color3(0.25, 0.25, 0.25);
    const amb = new BABYLON.HemisphericLight("amb", new V3(0, 1, 0), scene);
    amb.intensity = 0.22;
    amb.groundColor = new BABYLON.Color3(0.75, 0.72, 0.68);
    amb.specular = BABYLON.Color3.Black();

    const sg = new BABYLON.ShadowGenerator(2048, key);
    sg.usePercentageCloserFiltering = true;
    sg.filteringQuality = BABYLON.ShadowGenerator.QUALITY_HIGH;
    sg.normalBias = 0.02; sg.bias = 0.0008;
    sg.darkness = 0.25;
    sg.transparencyShadow = true;
    sg.enableSoftTransparentShadow = true;

    const ip = scene.imageProcessingConfiguration;
    ip.toneMappingEnabled = true;
    ip.toneMappingType = BABYLON.ImageProcessingConfiguration.TONEMAPPING_ACES;
    ip.exposure = GLOBAL.exposure;
    ip.contrast = GLOBAL.contrast;

    // ---- マテリアル ---------------------------------------------------
    const mats = {};
    const roughRamp = (function () {
        const W = 256;
        const t = new BABYLON.DynamicTexture("roughRamp", { width: W, height: 4 }, scene, false);
        const ctx = t.getContext();
        const img = ctx.createImageData(W, 4);
        for (let x = 0; x < W; x++) {
            const g = x / (W - 1);
            const rough = mix(0.70, 0.14, Math.pow(g, 0.8));
            for (let y = 0; y < 4; y++) {
                const o = (y * W + x) * 4;
                img.data[o] = 255; img.data[o + 1] = rough * 255; img.data[o + 2] = 0; img.data[o + 3] = 255;
            }
        }
        ctx.putImageData(img, 0, 0);
        t.update(false);
        t.gammaSpace = false;
        t.wrapU = t.wrapV = BABYLON.Texture.CLAMP_ADDRESSMODE;
        return t;
    })();

    mats.ice = (function () {
        const m = new BABYLON.PBRMaterial("iceCreamMat", scene);
        m.albedoColor = BABYLON.Color3.White();
        m.metallicTexture = roughRamp;
        m.useRoughnessFromMetallicTextureGreen = true;
        m.useMetallnessFromMetallicTextureBlue = true;
        m.useAmbientOcclusionFromMetallicTextureRed = false;
        m.metallic = 1; m.roughness = 1;
        m.subSurface.isTranslucencyEnabled = true;
        m.subSurface.translucencyIntensity = 0.22;
        m.subSurface.maximumThickness = 1.2;
        m.subSurface.tintColor = sRGB(FLAVORS.vanilla.tint);
        m.environmentIntensity = 0.85;
        return m;
    })();

    mats.puddle = (function () {
        const m = new BABYLON.PBRMaterial("puddleMat", scene);
        m.metallic = 0; m.roughness = 0.06;
        m.subSurface.isTranslucencyEnabled = true;
        m.subSurface.translucencyIntensity = 0.5;
        return m;
    })();

    mats.glass = (function () {
        const m = new BABYLON.PBRMaterial("glassMat", scene);
        m.albedoColor = new BABYLON.Color3(0.95, 0.98, 0.97);
        m.metallic = 0; m.roughness = 0.03;
        m.alpha = 0.16;
        m.transparencyMode = BABYLON.PBRMaterial.PBRMATERIAL_ALPHABLEND;
        m.useRadianceOverAlpha = true;
        m.useSpecularOverAlpha = true;
        m.indexOfRefraction = 1.5;
        m.backFaceCulling = false;
        m.twoSidedLighting = true;
        return m;
    })();
    mats.hobnail = mats.glass.clone("hobnailMat");
    mats.hobnail.alpha = 0.20;

    mats.porcelain = (function () {
        const m = new BABYLON.PBRMaterial("porcelainMat", scene);
        m.albedoColor = new BABYLON.Color3(0.93, 0.93, 0.92);
        m.metallic = 0; m.roughness = 0.22;
        m.clearCoat.isEnabled = true;
        m.clearCoat.intensity = 0.9;
        m.clearCoat.roughness = 0.04;
        m.backFaceCulling = false;
        m.twoSidedLighting = true;
        return m;
    })();

    mats.platinum = new BABYLON.PBRMaterial("platinumMat", scene);
    mats.platinum.albedoColor = new BABYLON.Color3(0.86, 0.86, 0.84);
    mats.platinum.metallic = 1; mats.platinum.roughness = 0.18;

    mats.biscuit = new BABYLON.PBRMaterial("biscuitMat", scene);
    mats.biscuit.metallic = 0; mats.biscuit.roughness = 0.78;

    mats.mint = new BABYLON.PBRMaterial("mintMat", scene);
    mats.mint.metallic = 0; mats.mint.roughness = 0.42;
    mats.mint.backFaceCulling = false;
    mats.mint.twoSidedLighting = true;
    mats.mint.subSurface.isTranslucencyEnabled = true;
    mats.mint.subSurface.translucencyIntensity = 0.6;
    mats.mint.subSurface.tintColor = new BABYLON.Color3(0.3, 0.7, 0.1);

    mats.table = new BABYLON.PBRMaterial("tableMat", scene);
    mats.table.metallic = 0;

    const table = BABYLON.MeshBuilder.CreateGround("table", { width: 80, height: 80 }, scene);
    table.material = mats.table;
    table.receiveShadows = true;

    const puddle = BABYLON.MeshBuilder.CreateDisc("puddle", { radius: 1, tessellation: 96 }, scene);
    puddle.rotation.x = Math.PI / 2;
    puddle.isVisible = false;

    const vesselMeshes = [];
    const state = {
        flavor: "vanilla", vessel: "coupe", topping: "biscuit", table: "white",
        melt: GLOBAL.melt, seed: 20261101, autoMelt: false
    };

    const dp = new BABYLON.DefaultRenderingPipeline("dp", true, scene, [camera]);
    dp.samples = 4;
    dp.fxaaEnabled = true;
    dp.sharpenEnabled = true;
    dp.sharpen.edgeAmount = 0.18;
    dp.bloomEnabled = true;
    dp.bloomThreshold = 0.95;
    dp.bloomWeight = 0.05;

    // ---- 生成 ---------------------------------------------------------
    const biscuit = buildBiscuit();
    const mint = buildMint();

    function rescoop() {
        ice.bake = bakeScoop(ice.base, state.seed);
        applyIce(ice);
    }

    function focusVessel() {
        const V = VESSELS[state.vessel];
        camera.target = new V3(0.3, V.floorY + GLOBAL.height * 0.45, 0);
    }

    // スクープ本体
    const ext = SCOOP.collarR * 1.15 + 0.3;
    const field = new FnField(makeScoopSDF(GLOBAL.shapeSeed),
        [-ext, -0.3, -ext], [ext, SCOOP.cy + SCOOP.r + 0.4, ext], GLOBAL.gridH, 1);
    const base = surfaceNets(field);
    const nv = base.positions.length / 3;
    const ice = {
        base: base,
        pos: new Float32Array(nv * 3), nrm: new Float32Array(nv * 3),
        col: new Float32Array(nv * 4), uv: new Float32Array(nv * 2)
    };
    ice.mesh = makeMesh("iceCream", new Float32Array(base.positions), base.indices,
        new Float32Array(base.normals), ice.uv, ice.col, scene, true);
    ice.mesh.material = mats.ice;
    ice.mesh.receiveShadows = true;
    sg.addShadowCaster(ice.mesh);
    console.log("[IceCreamScoop] vertices:", nv, "triangles:", base.indices.length / 3);

    buildVessel(state.vessel);
    applyTable(state.table);
    mats.ice.subSurface.tintColor = sRGB(FLAVORS[state.flavor].tint);
    focusVessel();
    rescoop();

    // =================================================================
    // 11. GUI
    // =================================================================
    const ui = BABYLON.GUI.AdvancedDynamicTexture.CreateFullscreenUI("ui", true, scene);
    if (ui.layer) ui.layer.applyPostProcess = false;
    ui.idealWidth = 1400;
    ui.renderAtIdealSize = true;

    const COL = { idle: "#2b2825", active: "#b07a3a", text: "#f6efe4", sub: "#b3aa9b", accent: "#f2d09a" };
    const box = new BABYLON.GUI.Rectangle("box");
    box.width = "268px"; box.adaptHeightToChildren = true;
    box.cornerRadius = 10; box.thickness = 0; box.background = "rgba(24,21,18,0.80)";
    box.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
    box.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_TOP;
    box.left = "14px"; box.top = "14px";
    ui.addControl(box);
    const panel = new BABYLON.GUI.StackPanel("panel");
    panel.width = "244px"; panel.paddingTop = "10px"; panel.paddingBottom = "10px";
    box.addControl(panel);

    function addLabel(text, size, color, height) {
        const t = new BABYLON.GUI.TextBlock();
        t.text = text; t.height = height || "22px";
        t.color = color || COL.text; t.fontSize = size || 13;
        t.textHorizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
        panel.addControl(t);
        return t;
    }
    function addChoice(title, dict, get, set) {
        addLabel(title, 12, COL.sub, "22px");
        const row = new BABYLON.GUI.StackPanel();
        row.isVertical = false; row.height = "34px";
        panel.addControl(row);
        const keys = Object.keys(dict), btns = {};
        const w = Math.floor(244 / keys.length);
        const paint = () => { for (const k of keys) btns[k].background = (get() === k) ? COL.active : COL.idle; };
        for (const k of keys) {
            const label = typeof dict[k] === "string" ? dict[k] : dict[k].label;
            const b = BABYLON.GUI.Button.CreateSimpleButton("b_" + title + k, label);
            b.width = w + "px"; b.height = "32px";
            b.paddingLeft = "2px"; b.paddingRight = "2px";
            b.color = COL.text; b.thickness = 0; b.cornerRadius = 6; b.fontSize = 12;
            b.onPointerUpObservable.add(() => { set(k); paint(); });
            btns[k] = b; row.addControl(b);
        }
        paint();
        return paint;
    }

    addLabel("ICE CREAM / アイスクリーム", 12, COL.accent, "28px");

    addChoice("フレーバー", FLAVORS, () => state.flavor, (k) => {
        state.flavor = k;
        mats.ice.subSurface.tintColor = sRGB(FLAVORS[k].tint);
        applyIce(ice);
    });
    addChoice("器", VESSELS, () => state.vessel, (k) => {
        state.vessel = k;
        buildVessel(k); focusVessel();
        applyIce(ice);
    });
    addChoice("付け合わせ", TOPPINGS, () => state.topping, (k) => {
        state.topping = k;
        placeToppings(ice);
    });
    addChoice("テーブル", TABLES, () => state.table, (k) => { state.table = k; applyTable(k); });

    const meltLabel = addLabel("", 12, COL.sub, "24px");
    const slider = new BABYLON.GUI.Slider("melt");
    slider.minimum = 0; slider.maximum = 1; slider.value = state.melt;
    slider.height = "20px"; slider.width = "236px";
    slider.color = COL.accent; slider.background = "#3a342d"; slider.borderColor = "transparent";
    const showMelt = () => { meltLabel.text = "溶け具合  " + Math.round(state.melt * 100) + "%"; };
    let meltDirty = false;
    slider.onValueChangedObservable.add((v) => { state.melt = v; showMelt(); meltDirty = true; });
    panel.addControl(slider);
    showMelt();

    const sp = new BABYLON.GUI.Rectangle(); sp.height = "8px"; sp.thickness = 0; panel.addControl(sp);
    const row2 = new BABYLON.GUI.StackPanel();
    row2.isVertical = false; row2.height = "34px";
    panel.addControl(row2);
    const bScoop = BABYLON.GUI.Button.CreateSimpleButton("rescoop", "盛り直す");
    const bAuto = BABYLON.GUI.Button.CreateSimpleButton("auto", "自動で溶かす");
    for (const b of [bScoop, bAuto]) {
        b.width = "122px"; b.height = "32px"; b.paddingLeft = "2px"; b.paddingRight = "2px";
        b.color = COL.text; b.background = COL.idle; b.thickness = 0; b.cornerRadius = 6; b.fontSize = 13;
        row2.addControl(b);
    }
    bScoop.onPointerUpObservable.add(() => {
        state.seed = (Math.random() * 1e9) | 0;
        state.melt = GLOBAL.melt; slider.value = state.melt;
        rescoop();
    });
    bAuto.onPointerUpObservable.add(() => {
        state.autoMelt = !state.autoMelt;
        bAuto.background = state.autoMelt ? COL.active : COL.idle;
    });
    addLabel("ドラッグで回転・ホイールで寄れます", 11, COL.sub, "26px");

    let acc = 0;
    scene.onBeforeRenderObservable.add(() => {
        const dt = engine.getDeltaTime() / 1000;
        if (state.autoMelt && state.melt < 1) {
            state.melt = Math.min(1, state.melt + GLOBAL.autoMeltRate * dt);
            slider.value = state.melt;
        }
        acc += dt;
        if (meltDirty && acc > 0.05) { meltDirty = false; acc = 0; applyIce(ice); }
    });

    return scene;
};

export default createScene;