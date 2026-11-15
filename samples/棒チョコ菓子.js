// ============================================================================
//  11 月 11 日 — グラスに降ってくる棒チョコ菓子  [Babylon.js Playground]
//  build: 棒チョコ菓子-2026-11-11-c
//
//  ・形状もテクスチャもすべて手続き生成（外部依存は環境マップのみ）
//  ・単位は cm。Havok で 1 本ずつグラスへ落とし、縁に立てかかって束になる
//  ・グラスにはチョコ掛け 10 本と塩プレッツェル 10 本を交互に落とす
//  ・手前の卓上にはチョコ掛け 2 本・塩プレッツェル 2 本を「1111」に並べる（これも物理で置く）
//  ・菓子そのものだけを再現（パッケージ・ロゴは作らない）
// ============================================================================
const createScene = async function () {
    console.log("build: 棒チョコ菓子-2026-11-11-c");
    const V3 = BABYLON.Vector3, Q = BABYLON.Quaternion, C3 = BABYLON.Color3;

    const CFG = {
        seed: 1111,
        inGlass: 10,          // グラスに落とすチョコ掛けの本数
        pretzelInGlass: 10,   // グラスに落とす塩プレッツェルの本数（交互に投入。ボタンでも足せる）
        maxSticks: 48,        // グラスと卓上を合わせた上限
        gravity: 620,         // cm 系の安定域（SKILL 5.1）
        dt: 1 / 120,          // 固定ステップ（SKILL 5.2）
        stepsPerFrame: 2,     // 1/120 × 2 = 60fps で実時間
        releaseEvery: 16,     // 投入間隔（フレーム）
        dof: true,
    };

    // 実物の寸法 (cm)
    const L = 13.5;           // 全長
    const RB = 0.20;          // プレッツェルの半径
    const TC = 0.055;         // チョコの厚み
    const HANDLE = 2.4;       // 持ち手（チョコの掛かっていない部分）
    const SB = L - HANDLE;    // チョコの縁（先端からの距離）
    const RCOL = RB + TC;     // 衝突用の半径
    const PL = 11.7;          // 塩プレッツェルの全長
    const PR = 0.215;         // 塩プレッツェルの半径

    // グラス（内側の寸法）
    const G = { rbi: 2.9, rti: 3.6, floor: 1.0, H: 9.5, wall: 0.22 };

    // ---------------------------------------------------------------- 乱数・ノイズ
    class Rng {
        constructor(s) { this.s = (s >>> 0) || 1; }
        next() { let t = (this.s += 0x6D2B79F5); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
        range(a, b) { return a + (b - a) * this.next(); }
    }
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const lerp = (a, b, t) => a + (b - a) * t;
    const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
    const hash2 = (ix, iy, seed) => {
        let h = Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263) ^ Math.imul(seed, 1442695041);
        h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
        return (h >>> 0) / 4294967296;
    };
    const wrap = (i, p) => p > 0 ? ((i % p) + p) % p : i;
    // 値ノイズ。px / py > 0 でその周期に折り返す（SKILL 2.7：両軸とも指定できる）
    const vnoise = (x, y, seed, px, py) => {
        const xi = Math.floor(x), yi = Math.floor(y);
        let fx = x - xi, fy = y - yi; fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
        const x0 = wrap(xi, px), x1 = wrap(xi + 1, px), y0 = wrap(yi, py), y1 = wrap(yi + 1, py);
        return lerp(lerp(hash2(x0, y0, seed), hash2(x1, y0, seed), fx),
                    lerp(hash2(x0, y1, seed), hash2(x1, y1, seed), fx), fy);
    };

    // ---------------------------------------------------------------- シーン基盤
    const engine = scene_engine();
    function scene_engine() { return (typeof window !== "undefined" && window.engine) || BABYLON.EngineStore.LastCreatedEngine; }
    const scene = new BABYLON.Scene(engine);
    scene.clearColor = new BABYLON.Color4(0.16, 0.012, 0.02, 1);

    let uid = 0;
    const named = (m, n) => { m.name = n; m.id = n + "#" + (uid++); return m; };

    const camera = new BABYLON.ArcRotateCamera("cam", -Math.PI / 2 + 0.38, 1.08, 44, new V3(0, 5.2, -3.5), scene);
    camera.fov = 0.55; camera.minZ = 1; camera.maxZ = 400;     // maxZ を詰める（SKILL 4.3）
    camera.lowerRadiusLimit = 14; camera.upperRadiusLimit = 90;
    camera.upperBetaLimit = 1.5; camera.wheelDeltaPercentage = 0.01;
    camera.attachControl(engine.getRenderingCanvas && engine.getRenderingCanvas(), true);

    // 環境
    try {
        const env = BABYLON.CubeTexture.CreateFromPrefilteredData("https://assets.babylonjs.com/environments/environmentSpecular.env", scene);
        env.lodGenerationOffset = 0.2;
        scene.environmentTexture = env;
        scene.environmentIntensity = 0.85;
    } catch (e) { console.warn("env skipped", e); }

    // 3灯 + 環境光（SKILL 4.1）
    const key = new BABYLON.DirectionalLight("key", new V3(0.55, -1.0, 0.45), scene);
    key.position = new V3(-30, 55, -25); key.intensity = 3.0;
    const fill = new BABYLON.DirectionalLight("fill", new V3(-0.7, -0.5, 0.3), scene);
    fill.intensity = 0.7; fill.specular = new C3(0.18, 0.18, 0.18);
    const kick = new BABYLON.DirectionalLight("kick", new V3(0.2, -0.35, -1.0), scene);
    kick.intensity = 1.6; kick.diffuse = new C3(0.06, 0.06, 0.06);   // 鏡面だけ足す灯：チョコの照りを走らせる
    const hemi = new BABYLON.HemisphericLight("hemi", new V3(0, 1, 0), scene);
    hemi.intensity = 0.2; hemi.specular = new C3(0, 0, 0);

    const shadow = new BABYLON.ShadowGenerator(2048, key);
    shadow.usePercentageCloserFiltering = true;
    shadow.filteringQuality = BABYLON.ShadowGenerator.QUALITY_HIGH;
    shadow.bias = 0.0015; shadow.normalBias = 0.01; shadow.darkness = 0.3;
    key.shadowMinZ = 10; key.shadowMaxZ = 140; key.autoUpdateExtends = true;

    // ---------------------------------------------------------------- テクスチャ生成
    function makeTex(name, W, H, fn, hasAlpha) {
        W = Math.max(8, Math.round(W) || 512); H = Math.max(8, Math.round(H) || 512);
        const t = new BABYLON.DynamicTexture(name, { width: W, height: H }, scene, true);
        const ctx = t.getContext(), img = ctx.createImageData(W, H), d = img.data, o = [0, 0, 0, 255];
        for (let y = 0, p = 0; y < H; y++) for (let x = 0; x < W; x++, p += 4) {
            o[3] = 255; fn(x, y, o);
            d[p] = o[0]; d[p + 1] = o[1]; d[p + 2] = o[2]; d[p + 3] = o[3];
        }
        ctx.putImageData(img, 0, 0); t.update(false);
        t.hasAlpha = !!hasAlpha;
        return t;
    }
    // 高さ場 1 枚からアルベド / ORM / 法線の 3 枚を作る（SKILL 2.6）
    function bakeSet(name, W, H, heightFn, colorFn, roughFn, bumpK, wrapX) {
        const hf = new Float32Array(W * H);
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) hf[y * W + x] = heightFn(x, y);
        const at = (x, y) => hf[wrap(y, H) * W + (wrapX ? wrap(x, W) : clamp(x, 0, W - 1))];
        const c = [0, 0, 0];
        const albedo = makeTex(name + "_alb", W, H, (x, y, o) => {
            colorFn(x, y, at(x, y), c);
            o[0] = clamp(c[0], 0, 1) * 255; o[1] = clamp(c[1], 0, 1) * 255; o[2] = clamp(c[2], 0, 1) * 255;
        });
        const orm = makeTex(name + "_orm", W, H, (x, y, o) => {
            o[0] = 255; o[1] = clamp(roughFn(x, y, at(x, y)), 0.04, 1) * 255; o[2] = 0;
        });
        const nrm = makeTex(name + "_nrm", W, H, (x, y, o) => {
            const dx = (at(x + 1, y) - at(x - 1, y)) * bumpK, dy = (at(x, y + 1) - at(x, y - 1)) * bumpK;
            const il = 1 / Math.hypot(dx, dy, 1);
            o[0] = (-dx * il * 0.5 + 0.5) * 255; o[1] = (-dy * il * 0.5 + 0.5) * 255; o[2] = (il * 0.5 + 0.5) * 255;
        });
        for (const t of [albedo, orm, nrm]) {
            t.wrapU = wrapX ? BABYLON.Texture.WRAP_ADDRESSMODE : BABYLON.Texture.CLAMP_ADDRESSMODE;
            t.wrapV = BABYLON.Texture.WRAP_ADDRESSMODE;
        }
        return { albedo, orm, nrm };
    }
    function pbrFrom(name, set) {
        const m = new BABYLON.PBRMaterial(name, scene);
        m.albedoTexture = set.albedo; m.metallicTexture = set.orm; m.bumpTexture = set.nrm;
        m.metallic = 1; m.roughness = 1;
        m.useRoughnessFromMetallicTextureGreen = true; m.useMetallnessFromMetallicTextureBlue = true;
        m.useAmbientOcclusionFromMetallicTextureRed = true; m.useRoughnessFromMetallicTextureAlpha = false;
        return m;
    }

    // --- プレッツェル：u = 長さ方向 (1024px = 13.5cm), v = 周方向（折り返す）
    // 実物は細かい気泡のざらつきの上に、焼きむらが長さ方向へ流れている
    const BW = 1024, BH = 128;
    const biscuitSet = bakeSet("biscuit", BW, BH,
        (x, y) => 0.55 * vnoise(x / 4, y / 4, 11, 0, 32) + 0.30 * vnoise(x / 9, y / 8, 12, 0, 16) + 0.15 * vnoise(x / 40, y / 16, 13, 0, 8),
        (x, y, h, c) => {
            let b = 0.55 * vnoise(x / 70, y / 32, 21, 0, 4) + 0.25 * vnoise(x / 18, y / 16, 22, 0, 8) + 0.20 * h;
            b += 0.35 * sstep(0.975, 1.0, x / BW);                         // 端は焼き色が濃い
            const PALE = [0.90, 0.71, 0.41], MID = [0.84, 0.59, 0.29], DARK = [0.68, 0.42, 0.19];
            const t = clamp((b - 0.25) / 0.55, 0, 1);
            for (let k = 0; k < 3; k++) c[k] = t < 0.5 ? lerp(PALE[k], MID[k], t * 2) : lerp(MID[k], DARK[k], t * 2 - 1);
            const speck = sstep(0.80, 0.92, vnoise(x / 2.5, y / 2, 23, 0, 64));   // 焦げた小さな粒
            for (let k = 0; k < 3; k++) c[k] *= (1 - 0.30 * speck) * (0.90 + 0.10 * h);
        },
        (x, y, h) => 0.72 + 0.20 * h, 1.7, false);

    // --- 塩プレッツェル：油を吹いて焼いた濃いめのきつね色に、塩の粒・青のり状の緑・焦げ粒が散る
    const saltAt = (x, y) => sstep(0.90, 0.96, vnoise(x / 2, y / 2, 54, 0, 64));
    const herbAt = (x, y) => sstep(0.87, 0.93, vnoise(x / 3, y / 2, 53, 0, 64));
    const pretzelSet = bakeSet("pretzel", BW, BH,
        (x, y) => 0.40 * vnoise(x / 4, y / 4, 51, 0, 32) + 0.25 * vnoise(x / 10, y / 8, 52, 0, 16) + 0.35 * saltAt(x, y),
        (x, y, h, c) => {
            let b = 0.50 * vnoise(x / 60, y / 32, 55, 0, 4) + 0.30 * vnoise(x / 16, y / 16, 56, 0, 8) + 0.20 * h;
            b += 0.30 * (sstep(0.975, 1.0, x / BW) + sstep(0.025, 0.0, x / BW));     // 両端は焼き色が濃い
            const PALE = [0.87, 0.62, 0.30], MID = [0.79, 0.49, 0.20], DARK = [0.61, 0.34, 0.12];
            const t = clamp((b - 0.22) / 0.55, 0, 1);
            for (let k = 0; k < 3; k++) c[k] = t < 0.5 ? lerp(PALE[k], MID[k], t * 2) : lerp(MID[k], DARK[k], t * 2 - 1);
            const burnt = sstep(0.82, 0.92, vnoise(x / 2.5, y / 2, 57, 0, 64));
            const herb = herbAt(x, y), salt = saltAt(x, y), H = [0.27, 0.40, 0.11], S = [0.97, 0.93, 0.83];
            for (let k = 0; k < 3; k++) {
                c[k] *= 1 - 0.32 * burnt;
                c[k] = lerp(c[k], H[k], 0.85 * herb);
                c[k] = lerp(c[k], S[k], 0.80 * salt);
            }
        },
        (x, y, h) => 0.52 + 0.22 * h, 1.9, false);

    // --- チョコ：ゆるいうねりだけ。粗さはうねりの谷でわずかに下げる
    const CW = 512, CH = 64;
    const chocoSet = bakeSet("choco", CW, CH,
        (x, y) => 0.6 * vnoise(x / 26, y / 16, 31, 0, 4) + 0.3 * vnoise(x / 9, y / 8, 32, 0, 8) + 0.1 * vnoise(x / 3, y / 2, 33, 0, 32),
        (x, y, h, c) => {
            const s = 0.92 + 0.12 * h + 0.05 * vnoise(x / 60, y / 4, 34, 0, 16);   // 掛けたときの筋
            c[0] = 0.285 * s; c[1] = 0.160 * s; c[2] = 0.092 * s;
        },
        (x, y, h) => 0.30 + 0.16 * h, 0.55, false);

    // --- 卓：赤い紙。繊維の細かい凹凸のみ
    const PW = 512;
    const paperSet = bakeSet("paper", PW, PW,
        (x, y) => 0.6 * vnoise(x / 2, y / 2, 41, 256, 256) + 0.4 * vnoise(x / 16, y / 5, 42, 32, 128),
        (x, y, h, c) => { const s = 0.93 + 0.07 * h; c[0] = 0.74 * s; c[1] = 0.060 * s; c[2] = 0.085 * s; },
        (x, y, h) => 0.62 + 0.14 * h, 0.9, true);

    const biscuitMats = [[1, 1, 1], [1.0, 0.95, 0.90], [0.97, 0.90, 0.82]].map((tint, i) => {
        const m = pbrFrom("biscuitMat" + i, biscuitSet);
        m.albedoColor = new C3(tint[0], tint[1], tint[2]);            // 1 本ずつ焼き色を変える（SKILL 2.5）
        return m;
    });
    const pretzelMats = [[1, 1, 1], [0.97, 0.91, 0.84]].map((tint, i) => {
        const m = pbrFrom("pretzelMat" + i, pretzelSet);
        m.albedoColor = new C3(tint[0], tint[1], tint[2]);
        return m;
    });
    const chocoMat = pbrFrom("chocoMat", chocoSet);
    chocoMat.clearCoat.isEnabled = true;                              // ココアバターの薄い照り
    chocoMat.clearCoat.intensity = 0.22; chocoMat.clearCoat.roughness = 0.30;

    const paperMat = pbrFrom("paperMat", paperSet);
    for (const t of [paperSet.albedo, paperSet.orm, paperSet.nrm]) { t.uScale = 18; t.vScale = 18; }

    // ---------------------------------------------------------------- メッシュ生成の共通部
    // fn(i, j, out) → out.p = [x,y,z], out.u, out.v。refRow の行で外向きを判定して巻き順を合わせる（SKILL 1.3）
    function buildGrid(name, nr, seg, fn, refRow) {
        const pos = [], uv = [], idx = [], o = { p: [0, 0, 0], u: 0, v: 0 };
        for (let i = 0; i < nr; i++) for (let j = 0; j <= seg; j++) {
            fn(i, j, o); pos.push(o.p[0], o.p[1], o.p[2]); uv.push(o.u, o.v);
        }
        const W1 = seg + 1;
        for (let i = 0; i < nr - 1; i++) for (let j = 0; j < seg; j++) {
            const a = i * W1 + j, b = a + 1, c = a + W1, d = c + 1;
            idx.push(a, c, b, b, c, d);
        }
        let nor = []; BABYLON.VertexData.ComputeNormals(pos, idx, nor);
        let sum = 0;
        for (let j = 0; j < seg; j++) { const k = (refRow * W1 + j) * 3; sum += nor[k] * pos[k] + nor[k + 2] * pos[k + 2]; }
        if (sum < 0) {
            for (let k = 0; k < idx.length; k += 3) { const t = idx[k + 1]; idx[k + 1] = idx[k + 2]; idx[k + 2] = t; }
            nor = []; BABYLON.VertexData.ComputeNormals(pos, idx, nor);
        }
        // 継ぎ目と極の法線を溶接（SKILL 1.4）
        const acc = new Map();
        for (let k = 0; k < pos.length; k += 3) {
            const key = Math.round(pos[k] * 8192) + "," + Math.round(pos[k + 1] * 8192) + "," + Math.round(pos[k + 2] * 8192);
            let a = acc.get(key); if (!a) acc.set(key, a = [0, 0, 0, []]);
            a[0] += nor[k]; a[1] += nor[k + 1]; a[2] += nor[k + 2]; a[3].push(k);
        }
        for (const a of acc.values()) {
            const l = Math.hypot(a[0], a[1], a[2]) || 1;
            for (const k of a[3]) { nor[k] = a[0] / l; nor[k + 1] = a[1] / l; nor[k + 2] = a[2] / l; }
        }
        const vd = new BABYLON.VertexData();
        vd.positions = pos; vd.indices = idx; vd.normals = nor; vd.uvs = uv;
        const mesh = named(new BABYLON.Mesh(name, scene), name);
        vd.applyToMesh(mesh);
        return mesh;
    }

    // ---------------------------------------------------------------- 棒 1 本（芯＋チョコの鞘）
    // s = 先端からの距離。ローカル Y 軸に沿い、中心が原点。先端（チョコ側）が -Y
    const SEG = 20;
    function buildStickVariant(vi) {
        const r = new Rng(CFG.seed * 31 + vi * 7919);
        const ph = Array.from({ length: 10 }, () => r.range(0, Math.PI * 2));
        const bx = r.range(-0.05, 0.05), bz = r.range(-0.03, 0.03);        // 焼き上がりのわずかな反り
        const tilt = r.range(0.04, 0.11);                                   // チョコの縁は斜めに切れる
        const center = (s) => { const k = Math.sin(Math.PI * clamp(s / L, 0, 1)); return [bx * k, s - L / 2, bz * k]; };
        const coreR = (s, th) => RB * (1 + 0.020 * Math.sin(s * 2.1 + ph[0]) + 0.012 * Math.sin(3 * th + s * 0.7 + ph[1]) + 0.008 * Math.sin(s * 9.0 + ph[2]));
        const edge = (th) => SB + tilt * Math.sin(th + ph[3]) + 0.035 * Math.sin(2 * th + ph[4]) + 0.018 * Math.sin(5 * th + ph[5]);
        const thick = (s, th) => TC * (1 + 0.14 * Math.sin(s * 1.3 + ph[6]) + 0.10 * Math.sin(2 * th + s * 0.9 + ph[7]));

        // 芯：両端を閉じる。持ち手側の端は少し平たい丸み
        const cr = [[0, 0], [0.04, 0.55], [0.12, 0.85], [0.24, 1]];
        for (let s = 0.7; s < L - 0.2; s += 0.45) cr.push([s, 1]);
        const e = 0.09;
        for (let k = 0; k <= 5; k++) { const a = k / 5 * Math.PI / 2; cr.push([L - e + e * Math.sin(a), k === 5 ? 0 : Math.pow(Math.cos(a), 0.6)]); }
        const core = buildGrid("stickCore" + vi, cr.length, SEG, (i, j, o) => {
            const th = j / SEG * Math.PI * 2, s = cr[i][0], rr = coreR(s, th) * cr[i][1], c = center(s);
            o.p[0] = c[0] + rr * Math.cos(th); o.p[1] = c[1]; o.p[2] = c[2] + rr * Math.sin(th);
            o.u = s / L; o.v = j / SEG * 2;
        }, 8);

        // 鞘：先端は芯より 0.6mm 先まで被り、縁は周方向に不揃い。縁の直前に溜まりの膨らみ
        const sr = [];
        for (let k = 0; k <= 6; k++) { const a = k / 6 * Math.PI / 2; sr.push({ s: -0.06 + 0.30 * (1 - Math.cos(a)), f: Math.sin(a), q: -1 }); }
        const S0 = SB - 0.45;
        for (let s = 0.7; s < S0 - 0.1; s += 0.45) sr.push({ s, f: 1, q: -1 });
        for (let k = 0; k <= 9; k++) sr.push({ s: 0, f: 1, q: k / 9 });
        const sleeve = buildGrid("stickChoco" + vi, sr.length, SEG, (i, j, o) => {
            const th = j / SEG * Math.PI * 2, R = sr[i];
            let s, t;
            if (R.q < 0) { s = R.s; t = thick(Math.max(s, 0), th); }
            else {
                s = lerp(S0, edge(th), R.q);
                const body = thick(s, th);
                t = R.q < 0.72 ? body + 0.014 * sstep(0.2, 0.72, R.q) : lerp(body + 0.014, 0.006, sstep(0.72, 1, R.q));
            }
            const rr = (coreR(Math.max(s, 0.24), th) + t) * R.f, c = center(s);
            o.p[0] = c[0] + rr * Math.cos(th); o.p[1] = s - L / 2; o.p[2] = c[2] + rr * Math.sin(th);
            o.u = clamp(s / L, 0, 1); o.v = j / SEG;
        }, 9);
        sleeve.material = chocoMat;
        core.setEnabled(false); sleeve.setEnabled(false);
        return { core, sleeve };
    }
    const variants = [0, 1, 2, 3, 4].map(buildStickVariant);

    // 塩プレッツェル：チョコ無しの 1 層。両端とも切りっぱなしの平たい丸み、反りはやや大きい
    function buildPretzelVariant(vi) {
        const r = new Rng(CFG.seed * 17 + vi * 104729 + 5);
        const ph = Array.from({ length: 4 }, () => r.range(0, Math.PI * 2));
        const bx = r.range(-0.07, 0.07), bz = r.range(-0.04, 0.04);
        const rad = (s, th) => PR * (1 + 0.030 * Math.sin(s * 1.7 + ph[0]) + 0.015 * Math.sin(2 * th + s * 0.5 + ph[1]) + 0.010 * Math.sin(s * 8.0 + ph[2]));
        const e = 0.08, rings = [];
        for (let k = 5; k >= 0; k--) { const a = k / 5 * Math.PI / 2; rings.push([e - e * Math.sin(a), k === 5 ? 0 : Math.pow(Math.cos(a), 0.6)]); }
        for (let s = 0.5; s < PL - 0.2; s += 0.45) rings.push([s, 1]);
        for (let k = 0; k <= 5; k++) { const a = k / 5 * Math.PI / 2; rings.push([PL - e + e * Math.sin(a), k === 5 ? 0 : Math.pow(Math.cos(a), 0.6)]); }
        const m = buildGrid("pretzel" + vi, rings.length, SEG, (i, j, o) => {
            const th = j / SEG * Math.PI * 2, s = rings[i][0], rr = rad(s, th) * rings[i][1], k = Math.sin(Math.PI * s / PL);
            o.p[0] = bx * k + rr * Math.cos(th); o.p[1] = s - PL / 2; o.p[2] = bz * k + rr * Math.sin(th);
            o.u = s / PL; o.v = j / SEG * 2;
        }, 10);
        m.setEnabled(false);
        return m;
    }
    const pretzelVariants = [0, 1, 2, 3].map(buildPretzelVariant);

    const sticks = [];
    function createStick(i, kind) {
        let core;
        if (kind === "pretzel") {
            core = named(pretzelVariants[i % pretzelVariants.length].clone("pretzel" + i), "pretzelStick" + i);
            core.material = pretzelMats[(i * 5 + 1) % pretzelMats.length];
        } else {
            const v = variants[i % variants.length];
            core = named(v.core.clone("stick" + i), "stick" + i);
            const choco = named(v.sleeve.clone("stickChoco" + i), "stickChoco" + i);
            core.material = biscuitMats[(i * 7 + 1) % biscuitMats.length];
            choco.parent = core; choco.setEnabled(true); choco.receiveShadows = true;
            shadow.addShadowCaster(choco);
        }
        core.setEnabled(false);
        core.rotationQuaternion = Q.Identity();
        core.receiveShadows = true;
        shadow.addShadowCaster(core);
        const st = { root: core, body: null, frozen: false, kind: kind === "pretzel" ? "pretzel" : "coated", len: kind === "pretzel" ? PL : L };
        sticks.push(st);
        return st;
    }

    // ---------------------------------------------------------------- グラス
    {
        const w = G.wall, P = [];
        const rbo = G.rbi + w, rto = G.rti + w;
        P.push([0, 0], [rbo - 0.3, 0], [rbo - 0.1, 0.04], [rbo - 0.02, 0.14], [rbo, 0.3]);
        for (let k = 1; k <= 4; k++) P.push([lerp(rbo, rto, k / 5), lerp(0.3, G.H, k / 5)]);
        const rc = G.rti + w / 2;                                         // 口縁は半円で丸める
        for (let k = 0; k <= 6; k++) { const a = k / 6 * Math.PI; P.push([rc + (w / 2) * Math.cos(a), G.H + (w / 2) * Math.sin(a)]); }
        for (let k = 1; k <= 4; k++) P.push([lerp(G.rti, G.rbi + 0.05, k / 5), lerp(G.H, G.floor + 0.5, k / 5)]);
        P.push([G.rbi - 0.05, G.floor + 0.15], [G.rbi - 0.3, G.floor + 0.02], [G.rbi - 0.7, G.floor], [0, G.floor]);
        const GS = 72;
        const glass = buildGrid("glass", P.length, GS, (i, j, o) => {
            const th = j / GS * Math.PI * 2;
            o.p[0] = P[i][0] * Math.cos(th); o.p[1] = P[i][1]; o.p[2] = P[i][0] * Math.sin(th);
            o.u = j / GS; o.v = i / (P.length - 1);
        }, 6);
        const gm = new BABYLON.PBRMaterial("glassMat", scene);
        gm.albedoColor = new C3(0.02, 0.025, 0.025);                      // ガラスのアルベドは黒
        gm.metallic = 0; gm.roughness = 0.03; gm.indexOfRefraction = 1.5;
        gm.alpha = 0.14;
        gm.transparencyMode = BABYLON.PBRMaterial.PBRMATERIAL_ALPHABLEND;
        gm.useRadianceOverAlpha = true; gm.useSpecularOverAlpha = true;   // 映り込みとハイライトは透けさせない
        gm.backFaceCulling = false; gm.separateCullingPass = true;
        glass.material = gm; glass.alphaIndex = 10;

        // グラスは影を落とさないので、底の接地影だけ薄い円盤で置く
        const aoTex = makeTex("glassAO", 128, 128, (x, y, o) => {
            const d = Math.hypot(x - 63.5, y - 63.5) / 63.5;
            o[0] = o[1] = o[2] = 0; o[3] = 255 * 0.50 * (1 - sstep(0.52, 1.0, d));
        }, true);
        const ao = named(BABYLON.MeshBuilder.CreateGround("glassAO", { width: (rbo + 1.6) * 2, height: (rbo + 1.6) * 2 }, scene), "glassAO");
        ao.position.y = 0.012;
        const am = new BABYLON.StandardMaterial("glassAOMat", scene);
        am.diffuseTexture = aoTex; am.useAlphaFromDiffuseTexture = true;
        am.diffuseColor = C3.Black(); am.specularColor = C3.Black(); am.disableLighting = true;
        ao.material = am; ao.alphaIndex = 1; ao.isPickable = false;
    }

    // 卓（見た目は 1 枚、コライダーは厚い箱：SKILL 5.8）
    const table = named(BABYLON.MeshBuilder.CreateBox("table", { width: 260, height: 4, depth: 260 }, scene), "table");
    table.position.y = -2; table.material = paperMat; table.receiveShadows = true;

    // ---------------------------------------------------------------- 物理
    const quatFromTo = (a, b) => {                                         // 単位ベクトル a → b
        const c = V3.Cross(a, b);
        return new Q(c.x, c.y, c.z, 1 + V3.Dot(a, b)).normalize();
    };
    const UP = new V3(0, 1, 0);
    let physicsOK = false, stickShape = null, pretzelShape = null, hk = null;
    try {
        const havok = await HavokPhysics();
        hk = new BABYLON.HavokPlugin(false, havok);                        // false = 固定ステップ
        scene.enablePhysics(new V3(0, -CFG.gravity, 0), hk);
        if (hk.setTimeStep) hk.setTimeStep(CFG.dt);
        physicsOK = true;
    } catch (e) { console.warn("Havok を初期化できないため解析配置に切り替えます", e); }

    if (physicsOK) {
        new BABYLON.PhysicsAggregate(table, BABYLON.PhysicsShapeType.BOX, { mass: 0, friction: 0.6, restitution: 0.02 }, scene);

        // グラス：穴を残すため凸包ではなく、内壁に沿わせた箱の輪＋底の円柱。
        // 細い棒がすり抜けないよう、壁は見た目より厚く外側へ張り出させる
        const root = new BABYLON.TransformNode("glassCollider", scene);
        const cont = new BABYLON.PhysicsShapeContainer(scene);
        const N = 24, TH = 0.8;
        const dr = G.rti - G.rbi, dh = G.H - G.floor, sl = Math.hypot(dr, dh);
        const sa = dr / sl, ca = dh / sl;                                  // 壁の傾き
        const INSET = 0.13;                                              // 棒がガラスの肉に食い込んで見えない分だけ内へ寄せる
        const rm = (G.rti + G.rbi) / 2 - INSET, ym = (G.H + G.floor) / 2;
        const width = 2 * (G.rti + TH) * Math.tan(Math.PI / N) * 1.1;
        for (let k = 0; k < N; k++) {
            const th = k / N * Math.PI * 2, cx = Math.cos(th), cz = Math.sin(th);
            const n = new V3(cx * ca, -sa, cz * ca);                       // 壁の外向き法線（箱の X）
            const u = new V3(cx * sa, ca, cz * sa);                        // 壁に沿って上（箱の Y）
            const t = V3.Cross(n, u);                                      // 接線（箱の Z）
            const rot = Q.RotationQuaternionFromAxis(n, u, t);
            const c = new V3(cx * rm, ym, cz * rm).add(n.scale(TH / 2));
            cont.addChild(new BABYLON.PhysicsShapeBox(c, rot, new V3(TH, sl, width), scene));
        }
        cont.addChild(new BABYLON.PhysicsShapeCylinder(new V3(0, 0, 0), new V3(0, G.floor, 0), G.rbi + TH, scene));
        cont.material = { friction: 0.55, restitution: 0.02 };
        const gb = new BABYLON.PhysicsBody(root, BABYLON.PhysicsMotionType.STATIC, false, scene);
        gb.shape = cont;

        stickShape = new BABYLON.PhysicsShapeCapsule(new V3(0, -(L / 2 - RCOL), 0), new V3(0, L / 2 - RCOL, 0), RCOL, scene);
        stickShape.material = { friction: 0.7, restitution: 0.03 };
        pretzelShape = new BABYLON.PhysicsShapeCapsule(new V3(0, -(PL / 2 - PR), 0), new V3(0, PL / 2 - PR, 0), PR, scene);
        pretzelShape.material = { friction: 0.7, restitution: 0.03 };
    }

    function release(st, pos, quat) {
        st.root.position.copyFrom(pos);
        st.root.rotationQuaternion.copyFrom(quat);
        st.root.setEnabled(true);
        st.frozen = false;
        if (!physicsOK) return;
        st.root.computeWorldMatrix(true);
        const body = new BABYLON.PhysicsBody(st.root, BABYLON.PhysicsMotionType.DYNAMIC, false, scene);
        body.shape = st.kind === "pretzel" ? pretzelShape : stickShape;
        body.setMassProperties({ mass: 1 });
        body.setLinearDamping(0.12); body.setAngularDamping(0.85);         // 卓上で転がり続けるのを止める
        body.disablePreStep = true;
        st.body = body;
    }

    // ---------------------------------------------------------------- 投入の段取り
    const GOLDEN = 2.39996;
    const sim = { frame: 0, queue: [], calm: 0, sinceLast: 0, settled: false, round: 0, dropIndex: 0 };

    // グラスへ：先端を中心寄りに、頭を外へ倒して放す → 縁に立てかかって束が開く
    function glassPose(k, rng, len) {
        const phi = k * GOLDEN + rng.range(-0.3, 0.3), tau = rng.range(0.09, 0.22);
        const d = new V3(Math.sin(tau) * Math.cos(phi), Math.cos(tau), Math.sin(tau) * Math.sin(phi));
        const rho = rng.range(0.2, 1.5);
        const tip = new V3(-rho * Math.cos(phi), G.floor + 2.2, -rho * Math.sin(phi));
        const q = quatFromTo(UP, d).multiply(Q.RotationAxis(UP, rng.range(0, 6.28)));
        return { pos: tip.add(d.scale(len / 2)), q };
    }
    // 卓上の「1111」：持ち手を手前（カメラ側 = -Z）に向けて寝かせる
    function tablePose(k, rng, len) {
        const x = [-3.3, -1.9, 1.9, 3.3][k], yaw = rng.range(-0.035, 0.035);
        const d = new V3(Math.sin(yaw), 0, -Math.cos(yaw));
        const q = quatFromTo(UP, d).multiply(Q.RotationAxis(UP, rng.range(0, 6.28)));
        // 短い塩プレッツェルは手前の端がチョコ掛けと揃うように寄せる
        return { pos: new V3(x, RCOL + 0.25, -12.6 - (L - len) / 2 + rng.range(-0.25, 0.25)), q };
    }
    // Havok が使えないときの解析配置（底の一点から縁の一点へ立てかける）
    function fallbackPose(k, rng, len) {
        const phi = k * GOLDEN, rB = G.rbi * rng.range(0.35, 0.8);
        const B = new V3(-rB * Math.cos(phi), G.floor + RCOL, -rB * Math.sin(phi));
        const phi2 = phi + rng.range(-0.5, 0.5), rT = G.rti - RCOL - rng.range(0, 0.5);
        const d = new V3(rT * Math.cos(phi2), G.H, rT * Math.sin(phi2)).subtract(B).normalize();
        return { pos: B.add(d.scale(len / 2)), q: quatFromTo(UP, d) };
    }

    const busy = (st) => st.root.isEnabled() || sim.queue.some(it => it.st === st);
    const take = (kind) => sticks.find(st => st.kind === kind && !busy(st)) || createStick(sticks.length, kind);
    const queueGlass = (kind, rng) => {
        const st = take(kind), k = sim.dropIndex++;
        sim.queue.push({ st, p: physicsOK ? glassPose(k, rng, st.len) : fallbackPose(k, rng, st.len) });
    };
    function restart() {
        sim.round++;
        const rng = new Rng(CFG.seed + sim.round * 7919);
        for (const st of sticks) { if (st.body) { st.body.dispose(); st.body = null; } st.root.setEnabled(false); }
        sim.queue.length = 0; sim.calm = 0; sim.sinceLast = 0; sim.settled = false; sim.dropIndex = 0;
        for (let i = 0; i < 4; i++) {
            const st = take(i < 2 ? "coated" : "pretzel"), p = tablePose(i, rng, st.len);   // 左 2 本がチョコ掛け、右 2 本が塩プレッツェル
            if (!physicsOK) p.pos.y = RCOL;
            sim.queue.push({ st, p });
        }
        // 塩プレッツェルを混ぜるときは偏らないよう等間隔に差し込む
        const total = CFG.inGlass + CFG.pretzelInGlass;
        for (let i = 0, np = 0; i < total; i++) {
            const wantP = Math.floor((i + 1) * CFG.pretzelInGlass / total) > np;
            if (wantP) np++;
            queueGlass(wantP ? "pretzel" : "coated", rng);
        }
        if (!physicsOK) { for (const it of sim.queue) release(it.st, it.p.pos, it.p.q); sim.queue.length = 0; sim.settled = true; }
    }
    function addOne(kind) {
        if (!physicsOK || sticks.filter(busy).length >= CFG.maxSticks) return;
        const rng = new Rng(CFG.seed + sim.round * 7919 + sim.dropIndex * 104729 + sim.frame);
        queueGlass(kind === "pretzel" ? "pretzel" : "coated", rng);
        // 固定済みの束を動ける状態へ戻す（固定のままだと新しい 1 本が束の上で止まってしまう）
        for (const st of sticks) if (st.body && st.frozen) { st.body.setMotionType(BABYLON.PhysicsMotionType.DYNAMIC); st.frozen = false; }
        sim.settled = false; sim.calm = 0;
    }

    const tv = new V3(), ta = new V3();
    scene.onBeforeRenderObservable.add(() => {
        if (!physicsOK) return;
        // 既定の 1 ステップに加えて追加で進め、60fps でほぼ実時間にする
        const pe = scene.getPhysicsEngine();
        if (pe && pe._step) for (let k = 1; k < CFG.stepsPerFrame; k++) pe._step(CFG.dt);

        sim.frame++;
        if (sim.queue.length) {
            if (sim.frame % CFG.releaseEvery === 0) {                      // 1 本ずつ（SKILL 5.6）
                const it = sim.queue.shift(); release(it.st, it.p.pos, it.p.q); sim.sinceLast = 0;
            }
            return;
        }
        if (sim.settled) return;
        // 静止したら固定。微振動で判定が通らない場合は時間で打ち切る（SKILL 5.7）
        sim.sinceLast++;
        let moving = false;
        for (const st of sticks) {
            if (!st.body || st.frozen) continue;
            st.body.getLinearVelocityToRef(tv); st.body.getAngularVelocityToRef(ta);
            if (tv.lengthSquared() > 0.5 * 0.5 || ta.lengthSquared() > 0.35 * 0.35) { moving = true; break; }
        }
        sim.calm = moving ? 0 : sim.calm + 1;
        if (sim.calm > 50 || sim.sinceLast > 420) {
            for (const st of sticks) if (st.body && !st.frozen) { st.body.setMotionType(BABYLON.PhysicsMotionType.STATIC); st.frozen = true; }
            sim.settled = true;
        }
    });

    restart();

    // ---------------------------------------------------------------- ポストプロセス
    try {
        const dp = new BABYLON.DefaultRenderingPipeline("dp", true, scene, [camera]);
        dp.samples = 4; dp.fxaaEnabled = true;
        dp.bloomEnabled = true; dp.bloomThreshold = 0.9; dp.bloomWeight = 0.12; dp.bloomKernel = 48;
        const ip = dp.imageProcessing;
        ip.toneMappingEnabled = true; ip.toneMappingType = BABYLON.ImageProcessingConfiguration.TONEMAPPING_ACES;
        ip.exposure = 1.18; ip.contrast = 1.15;
        ip.vignetteEnabled = true; ip.vignetteWeight = 1.6;
        if (CFG.dof) {
            dp.depthOfFieldEnabled = true;
            dp.depthOfFieldBlurLevel = BABYLON.DepthOfFieldEffectBlurLevel.Medium;
            dp.depthOfField.lensSize = 50; dp.depthOfField.fStop = 5.6;
            // シーン単位 ×1000 = mm。焦点距離を合焦距離の一定比にしてボケ量を距離に依らず保つ（SKILL 4.3）
            scene.onBeforeRenderObservable.add(() => {
                const focus = camera.radius * 1000;
                dp.depthOfField.focusDistance = focus;
                dp.depthOfField.focalLength = focus * 0.076;
            });
        }
    } catch (e) { console.warn("pipeline skipped", e); }

    // ---------------------------------------------------------------- GUI
    try {
        const ui = BABYLON.GUI.AdvancedDynamicTexture.CreateFullscreenUI("ui", true, scene);
        if (ui.layer) ui.layer.applyPostProcess = false;                   // ポスト効果の後に描く（専用カメラ不要）
        const panel = new BABYLON.GUI.StackPanel();
        panel.isVertical = false; panel.height = "44px";
        panel.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
        panel.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
        panel.left = "12px"; panel.top = "-12px";
        ui.addControl(panel);
        const btn = (label, w, fn) => {
            const b = BABYLON.GUI.Button.CreateSimpleButton("b_" + label, label);
            b.width = w; b.height = "36px"; b.color = "#fff"; b.background = "rgba(60,10,14,0.72)";
            b.cornerRadius = 8; b.thickness = 1; b.fontSize = 15; b.paddingRight = "8px";
            b.onPointerUpObservable.add(fn); panel.addControl(b);
        };
        btn("もう一度", "110px", restart);
        if (physicsOK) {
            btn("＋チョコ掛け", "118px", () => addOne("coated"));
            btn("＋プレッツェル", "118px", () => addOne("pretzel"));
        }
    } catch (e) { console.warn("GUI skipped", e); }

    scene.metadata = { sim, sticks, CFG, G, L, PL, RCOL, physicsOK, restart, addOne };
    return scene;
};

export default createScene;