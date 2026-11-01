// ============================================================================
//  綿あめ（シンプル版）
//  BUILD: "cotton-candy-A"
//
//  Babylon.js Playground 形式。外部アセットは Babylon 公式の環境マップのみ。
//  製造工程は省き、できあがった綿あめを割り箸に刺して見せるだけのシーン。
//
//  勘所：
//   1) 形は「回転体の輪郭（下すぼまり・上が丸い）」に、
//      ・螺旋状に巻き重なった太い帯（ロープを巻いたような段々）
//      ・低周波のでこぼこ（左右非対称の膨らみ）
//      を半径の倍率として掛けたパラメトリック曲面 (φ, v)。
//   2) 糸は曲面上を「帯に沿って」周方向に走らせる。帯の等高線
//      k = v*BANDS + φ/2π = 一定 に沿うので、糸が段々の向きをなぞる。
//      頂点には「表面上の点」と「浮かせるベクトル（法線×浮き量）」を
//      別々に持たせ、ふわふわ度はシェーダで掛けるだけにする。
//   3) 糸だけだと中が空っぽに見えるので、少しだけ膨らませた曲面を
//      半透明の「芯」として深度だけ先に書く（needDepthPrePass）。
//      芯の縁ほど透明にして、輪郭は糸の毛羽で決まるようにする。
//   4) GUI は ui.layer.applyPostProcess = false でポストエフェクト後に描く。
// ============================================================================

var V3 = BABYLON.Vector3, C3 = BABYLON.Color3, C4 = BABYLON.Color4;
var TAU = Math.PI * 2;
var ENV_URL = "https://assets.babylonjs.com/environments/environmentSpecular.env";

// ---------------------------------------------------------------------------
// 0. 設定
// ---------------------------------------------------------------------------
var CFG = {
    strands: 32000,   // 糸の本数
    segs:    14,      // 1 本あたりの折れ線の数
    bands:   6.5,     // 巻き重なった帯の段数
    thick:   0.075,   // 綿の層の厚み
    fluff:   1.00,    // ふわふわ度
    alpha:   0.40,    // 糸 1 本の不透明度
    spin:    true,
    palette: "white"
};

var PALETTES = {
    white: { name: "白",       body: [0.96, 0.91, 0.93], body2: [1.00, 0.99, 0.99], grad: 0 },
    pink:  { name: "ピンク",   body: [1.00, 0.62, 0.80], body2: [1.00, 0.84, 0.92], grad: 0 },
    blue:  { name: "水色",     body: [0.62, 0.82, 1.00], body2: [0.86, 0.94, 1.00], grad: 0 },
    yume:  { name: "ゆめかわ", body: [0.60, 0.80, 1.00], body2: [1.00, 0.68, 0.86], grad: 1 }
};
var PALETTE_ORDER = ["white", "pink", "blue", "yume"];

// 輪郭（半径 r, 高さ y）。下は割り箸へ向かってすぼまり、上は丸い。
var PROF = [
    [0.000, 0.000], [0.055, 0.030], [0.150, 0.100], [0.250, 0.200],
    [0.340, 0.320], [0.400, 0.450], [0.430, 0.580], [0.420, 0.700],
    [0.370, 0.810], [0.280, 0.900], [0.150, 0.960], [0.000, 0.985]
];

// ---------------------------------------------------------------------------
// 1. 乱数・曲面
// ---------------------------------------------------------------------------
function mulberry32(a) {
    return function () {
        a |= 0; a = a + 0x6D2B79F5 | 0;
        var t = Math.imul(a ^ a >>> 15, 1 | a);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}

function crom(a, b, c, d, t) {
    return 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t);
}
// v∈[0,1] → [r, y]
function profile(v, o) {
    var n = PROF.length, f = Math.min(0.99999, Math.max(0, v)) * (n - 1);
    var i = Math.floor(f), t = f - i;
    var p0 = PROF[Math.max(0, i - 1)], p1 = PROF[i], p2 = PROF[Math.min(n - 1, i + 1)], p3 = PROF[Math.min(n - 1, i + 2)];
    o[0] = Math.max(0, crom(p0[0], p1[0], p2[0], p3[0], t));
    o[1] = crom(p0[1], p1[1], p2[1], p3[1], t);
}

function bandK(phi, v) {
    return v * CFG.bands + phi / TAU + 0.22 * Math.sin(2 * phi + v * 5.0);
}

// 曲面上の点 → o[0..2]、帯の値 → o[3]
var _pr = [0, 0];
function surf(phi, v, o) {
    profile(v, _pr);
    var k = bandK(phi, v);
    var fr = k - Math.floor(k);
    var band = Math.pow(Math.sin(Math.PI * fr), 0.7);
    var sv = Math.sin(Math.PI * Math.min(1, Math.max(0, v)));
    var lobe = 0.07 * Math.sin(phi + 1.3) + 0.045 * Math.sin(2 * phi + v * 3.0 + 0.5) + 0.03 * Math.sin(3 * phi - v * 4.0 + 1.1);
    var r = _pr[0] * (0.84 + 0.16 * band + lobe * sv);
    o[0] = r * Math.cos(phi) + 0.05 * v * v;
    o[1] = _pr[1] + 0.012 * band * sv;
    o[2] = r * Math.sin(phi) - 0.02 * v * v;
    o[3] = band;
}

// 点と法線（有限差分）。極は少し内側で評価する。
var _a = [0, 0, 0, 0], _b = [0, 0, 0, 0], _c = [0, 0, 0, 0], _d = [0, 0, 0, 0];
function frame(phi, v, P, N) {
    surf(phi, v, P);
    var vv = Math.min(0.996, Math.max(0.004, v)), e = 1e-3;
    surf(phi + e, vv, _a); surf(phi - e, vv, _b);
    surf(phi, vv + e, _c); surf(phi, vv - e, _d);
    var ux = _a[0] - _b[0], uy = _a[1] - _b[1], uz = _a[2] - _b[2];
    var wx = _c[0] - _d[0], wy = _c[1] - _d[1], wz = _c[2] - _d[2];
    var nx = wy * uz - wz * uy, ny = wz * ux - wx * uz, nz = wx * uy - wy * ux;
    var L = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
    nx /= L; ny /= L; nz /= L;
    // 外向きに揃える（中心は胴の中ほど）
    if (nx * P[0] + ny * (P[1] - 0.5) + nz * P[2] < 0) { nx = -nx; ny = -ny; nz = -nz; }
    if (v <= 0.004) { nx = 0; ny = -1; nz = 0; }
    if (v >= 0.996) { nx = 0; ny = 1; nz = 0; }
    N[0] = nx; N[1] = ny; N[2] = nz;
}

// ---------------------------------------------------------------------------
// 2. 芯（曲面メッシュ）と糸
// ---------------------------------------------------------------------------
function buildCore(NU, NV) {
    var nv = (NU + 1) * (NV + 1);
    var pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3);
    var uv = new Float32Array(nv * 2), uv2 = new Float32Array(nv * 2);
    var P = [0, 0, 0, 0], N = [0, 0, 0], vi = 0;
    for (var j = 0; j <= NV; j++) {
        var v = j / NV;
        for (var i = 0; i <= NU; i++) {
            var phi = i / NU * TAU;
            frame(phi, v, P, N);
            pos[vi * 3] = P[0]; pos[vi * 3 + 1] = P[1]; pos[vi * 3 + 2] = P[2];
            nor[vi * 3] = N[0]; nor[vi * 3 + 1] = N[1]; nor[vi * 3 + 2] = N[2];
            uv[vi * 2] = i / NU; uv[vi * 2 + 1] = v;
            uv2[vi * 2] = bandK(phi, v); uv2[vi * 2 + 1] = P[3];
            vi++;
        }
    }
    var ind = [];
    for (j = 0; j < NV; j++) for (i = 0; i < NU; i++) {
        var a = j * (NU + 1) + i, b = a + 1, c = a + NU + 1, d = c + 1;
        ind.push(a, c, b, b, c, d);
    }
    return { pos: pos, nor: nor, uv: uv, uv2: uv2, ind: ind };
}

// 頂点属性：position = 表面上の点, normal = 法線×浮き量,
//           uv = (糸に沿った位置 s, 乱数), uv2 = (高さパラメータ v, 0)
function buildStrands(rnd) {
    var NS = CFG.strands, SEG = CFG.segs, NV = NS * (SEG + 1), TH = CFG.thick;
    var pos = new Float32Array(NV * 3), off = new Float32Array(NV * 3);
    var uv = new Float32Array(NV * 2), uv2 = new Float32Array(NV * 2);
    var ind = new Uint32Array(NS * SEG * 2);
    var P = [0, 0, 0, 0], N = [0, 0, 0], pr = [0, 0];
    var vi = 0, ii = 0;

    for (var k = 0; k < NS; k++) {
        // 面積にほぼ比例（半径で重み付け）して始点を選ぶ
        var v;
        do { v = 0.01 + 0.98 * rnd(); profile(v, pr); } while (rnd() * 0.45 > pr[0] + 0.02);
        var phi = rnd() * TAU;

        var stray = rnd() < 0.07;                       // 外へ飛び出す毛羽
        var dn = Math.pow(rnd(), 0.8);
        var d = TH * (0.25 + 0.75 * dn) * (stray ? 1.6 + rnd() * 0.9 : 1.0);
        var len = (0.10 + 0.26 * rnd()) * (stray ? 1.5 : 1.0);
        var dphi = Math.min(2.4, len / Math.max(pr[0], 0.06)) / SEG * (rnd() < 0.5 ? -1 : 1);
        var slope = -(1 + (rnd() - 0.5) * 0.9) / (TAU * CFG.bands);  // 帯に沿う傾き
        var r0 = rnd(), ph = rnd() * TAU;

        for (var j = 0; j <= SEG; j++) {
            frame(phi, v, P, N);
            var s = j / SEG;
            var dj = d * (1.0 + 0.18 * Math.sin(ph + j * 0.9));
            if (stray) dj += TH * 0.5 * Math.pow(Math.abs(2 * s - 1), 3);   // 端がめくれる
            pos[vi * 3] = P[0]; pos[vi * 3 + 1] = P[1]; pos[vi * 3 + 2] = P[2];
            off[vi * 3] = N[0] * dj; off[vi * 3 + 1] = N[1] * dj; off[vi * 3 + 2] = N[2] * dj;
            uv[vi * 2] = s; uv[vi * 2 + 1] = r0;
            uv2[vi * 2] = v; uv2[vi * 2 + 1] = 0;
            if (j < SEG) { ind[ii++] = vi; ind[ii++] = vi + 1; }
            vi++;
            phi += dphi;
            v = Math.min(0.99, Math.max(0.01, v + dphi * slope + (rnd() - 0.5) * 0.006));
        }
    }
    return { pos: pos, off: off, uv: uv, uv2: uv2, ind: ind };
}

// ---------------------------------------------------------------------------
// 3. シェーダ
// ---------------------------------------------------------------------------
BABYLON.Effect.ShadersStore["candyFlossVertexShader"] = [
    "precision highp float;",
    "attribute vec3 position; attribute vec3 normal; attribute vec2 uv; attribute vec2 uv2;",
    "uniform mat4 world; uniform mat4 viewProjection;",
    "uniform float uFluff, uTime, uGrad;",
    "varying vec3 vW; varying vec3 vN; varying float vT; varying float vS;",
    "void main(){",
    "  vec3 dir = normalize(normal + vec3(1e-6));",
    "  vec3 p = position + normal * uFluff;",
    "  p += dir * sin(uTime * 1.3 + uv.y * 40.0 + uv.x * 5.0) * 0.002 * uFluff;",
    "  vec4 w = world * vec4(p, 1.0);",
    "  vW = w.xyz;",
    "  vN = normalize(mat3(world) * dir);",
    "  vT = mix(uv.y, clamp(uv2.x * 1.1 - 0.05 + (uv.y - 0.5) * 0.3, 0.0, 1.0), uGrad);",
    "  vS = uv.x;",
    "  gl_Position = viewProjection * w;",
    "}"
].join("\n");

BABYLON.Effect.ShadersStore["candyFlossFragmentShader"] = [
    "precision highp float;",
    "varying vec3 vW; varying vec3 vN; varying float vT; varying float vS;",
    "uniform vec3 uBody, uBody2, uL, uCam;",
    "uniform float uAlpha;",
    "void main(){",
    "  vec3 base = mix(uBody, uBody2, vT);",
    "  vec3 N = normalize(vN);",
    "  vec3 V = normalize(uCam - vW);",
    "  float lam = clamp(dot(N, uL) * 0.5 + 0.5, 0.0, 1.0);",
    "  float rim = pow(1.0 - abs(dot(N, V)), 2.0);",
    // 逆光で縁が透ける感じ
    "  float trans = pow(clamp(dot(V, -uL), 0.0, 1.0), 4.0) * rim;",
    "  vec3 col = base * (0.50 + 0.60 * lam) + base * rim * 0.30 + vec3(1.0) * trans * 0.4;",
    // 砂糖の粒のきらめき
    "  float sp = fract(sin(dot(floor(vW * 240.0), vec3(12.9898, 78.233, 37.719))) * 43758.5453);",
    "  col += vec3(1.0) * step(0.993, sp) * lam * 0.6;",
    "  float ends = smoothstep(0.0, 0.15, vS) * smoothstep(1.0, 0.85, vS);",
    "  float a = uAlpha * (0.7 + 0.3 * lam) * (0.35 + 0.65 * ends);",
    "  if (a < 0.003) discard;",
    "  gl_FragColor = vec4(min(col, vec3(1.0)), a);",
    "}"
].join("\n");

BABYLON.Effect.ShadersStore["candyCoreVertexShader"] = [
    "precision highp float;",
    "attribute vec3 position; attribute vec3 normal; attribute vec2 uv; attribute vec2 uv2;",
    "uniform mat4 world; uniform mat4 viewProjection;",
    "uniform float uOff;",
    "varying vec3 vW; varying vec3 vN; varying vec2 vUV; varying float vK; varying float vB;",
    "void main(){",
    "  vec4 w = world * vec4(position + normal * uOff, 1.0);",
    "  vW = w.xyz; vN = normalize(mat3(world) * normal); vUV = uv; vK = uv2.x; vB = uv2.y;",
    "  gl_Position = viewProjection * w;",
    "}"
].join("\n");

BABYLON.Effect.ShadersStore["candyCoreFragmentShader"] = [
    "precision highp float;",
    "varying vec3 vW; varying vec3 vN; varying vec2 vUV; varying float vK; varying float vB;",
    "uniform vec3 uBody, uBody2, uL, uCam;",
    "uniform float uAlpha, uGrad;",
    "void main(){",
    "  float t = mix(0.5, clamp(vUV.y * 1.1 - 0.05, 0.0, 1.0), uGrad);",
    "  vec3 base = mix(uBody, uBody2, t);",
    "  vec3 N = normalize(vN);",
    "  vec3 V = normalize(uCam - vW);",
    "  float ndv = abs(dot(N, V));",
    "  float lam = clamp(dot(N, uL) * 0.5 + 0.5, 0.0, 1.0);",
    // 帯に沿った細い筋
    "  float st = 0.5 + 0.5 * sin(vK * 70.0 + sin(vUV.x * 40.0) * 1.5);",
    // 帯と帯の間（くぼみ）は少し陰る
    "  float ao = 0.78 + 0.22 * vB;",
    "  vec3 col = base * (0.45 + 0.60 * lam) * 0.90 * (0.92 + 0.08 * st) * ao;",
    "  float a = uAlpha * (0.40 + 0.60 * pow(ndv, 0.8));",
    "  gl_FragColor = vec4(col, a);",
    "}"
].join("\n");

// ---------------------------------------------------------------------------
// 4. createScene
// ---------------------------------------------------------------------------
var createScene = function () {
    var scene = new BABYLON.Scene(engine);
    scene.clearColor = new C4(0.70, 0.73, 0.79, 1);
    scene.skipPointerMovePicking = true;

    var camera = new BABYLON.ArcRotateCamera("cam", -Math.PI / 2, 1.35, 2.6, new V3(0, 0.30, 0), scene);
    camera.lowerRadiusLimit = 1.0; camera.upperRadiusLimit = 6;
    camera.wheelDeltaPercentage = 0.01;
    camera.minZ = 0.02;
    camera.attachControl(canvas, true);

    scene.environmentTexture = BABYLON.CubeTexture.CreateFromPrefilteredData(ENV_URL, scene);
    scene.environmentIntensity = 0.6;

    var hemi = new BABYLON.HemisphericLight("hemi", new V3(0, 1, 0), scene);
    hemi.intensity = 0.5;
    var keyDir = new V3(0.45, -0.65, 0.6).normalize();
    var key = new BABYLON.DirectionalLight("key", keyDir, scene);
    key.intensity = 1.5;
    var uL = keyDir.scale(-1);

    // 背景（中央が明るい放射グラデーション。上下対称なので向きを気にしなくてよい）
    var bgTex = new BABYLON.DynamicTexture("bgTex", { width: 256, height: 256 }, scene, false);
    var g = bgTex.getContext();
    var grd = g.createRadialGradient(128, 128, 10, 128, 128, 190);
    grd.addColorStop(0, "#e8eaf0");
    grd.addColorStop(1, "#8e96a6");
    g.fillStyle = grd; g.fillRect(0, 0, 256, 256);
    bgTex.update();
    var bg = new BABYLON.Layer("bg", null, scene, true);
    bg.texture = bgTex;

    var pipe = new BABYLON.DefaultRenderingPipeline("dp", true, scene, [camera]);
    pipe.samples = 4;
    pipe.imageProcessingEnabled = true;
    pipe.imageProcessing.toneMappingEnabled = false;
    pipe.imageProcessing.contrast = 1.05;

    // --- 綿あめ ---------------------------------------------------------------
    var pivot = new BABYLON.TransformNode("candyPivot", scene);
    var rnd = mulberry32(20261101);

    var C = buildCore(180, 140);
    var core = new BABYLON.Mesh("candyCore", scene);
    core.setVerticesData(BABYLON.VertexBuffer.PositionKind, C.pos, false, 3);
    core.setVerticesData(BABYLON.VertexBuffer.NormalKind, C.nor, false, 3);
    core.setVerticesData(BABYLON.VertexBuffer.UVKind, C.uv, false, 2);
    core.setVerticesData(BABYLON.VertexBuffer.UV2Kind, C.uv2, false, 2);
    core.setIndices(C.ind);
    core.parent = pivot;
    core.isPickable = false;
    var coreMat = new BABYLON.ShaderMaterial("candyCoreMat", scene, { vertex: "candyCore", fragment: "candyCore" }, {
        attributes: ["position", "normal", "uv", "uv2"],
        uniforms: ["world", "viewProjection", "uOff", "uBody", "uBody2", "uL", "uCam", "uAlpha", "uGrad"],
        needAlphaBlending: true
    });
    coreMat.backFaceCulling = false;
    coreMat.needDepthPrePass = true;
    coreMat.setFloat("uAlpha", 0.90);
    coreMat.setVector3("uL", uL);
    core.material = coreMat;
    core.alphaIndex = 0;

    var B = buildStrands(rnd);
    var floss = new BABYLON.Mesh("candyFloss", scene);
    floss.setVerticesData(BABYLON.VertexBuffer.PositionKind, B.pos, false, 3);
    floss.setVerticesData(BABYLON.VertexBuffer.NormalKind, B.off, false, 3);
    floss.setVerticesData(BABYLON.VertexBuffer.UVKind, B.uv, false, 2);
    floss.setVerticesData(BABYLON.VertexBuffer.UV2Kind, B.uv2, false, 2);
    floss.setIndices(B.ind);
    floss.parent = pivot;
    floss.alwaysSelectAsActiveMesh = true;
    floss.isPickable = false;
    var flossMat = new BABYLON.ShaderMaterial("candyFlossMat", scene, { vertex: "candyFloss", fragment: "candyFloss" }, {
        attributes: ["position", "normal", "uv", "uv2"],
        uniforms: ["world", "viewProjection", "uFluff", "uTime", "uGrad", "uBody", "uBody2", "uL", "uCam", "uAlpha"],
        needAlphaBlending: true
    });
    flossMat.fillMode = BABYLON.Material.LineListDrawMode;
    flossMat.disableDepthWrite = true;
    flossMat.backFaceCulling = false;
    flossMat.setVector3("uL", uL);
    floss.material = flossMat;
    floss.alphaIndex = 1;

    // 割り箸（少しだけ曲がった細い棒。上端は綿の中に隠れる）
    var stickPath = [];
    for (var i = 0; i <= 12; i++) {
        var t = i / 12;
        stickPath.push(new V3(0.018 * Math.sin(t * 2.2), -0.80 + t * 1.10, 0.006 * t));
    }
    var stick = BABYLON.MeshBuilder.CreateTube("stick", { path: stickPath, radius: 0.012, tessellation: 12, cap: BABYLON.Mesh.CAP_ALL }, scene);
    var wood = new BABYLON.PBRMaterial("stickWood", scene);
    wood.albedoColor = new C3(0.80, 0.62, 0.42); wood.metallic = 0; wood.roughness = 0.75;
    stick.material = wood;
    stick.parent = pivot;

    function c3(a) { return new C3(a[0], a[1], a[2]); }
    function applyPalette() {
        var p = PALETTES[CFG.palette];
        [flossMat, coreMat].forEach(function (m) {
            m.setColor3("uBody", c3(p.body));
            m.setColor3("uBody2", c3(p.body2));
            m.setFloat("uGrad", p.grad);
        });
    }
    applyPalette();

    var time = 0;
    scene.onBeforeRenderObservable.add(function () {
        var dt = Math.min(0.05, engine.getDeltaTime() / 1000);
        time += dt;
        if (CFG.spin) pivot.rotation.y += dt * 0.25;
        var cam = camera.globalPosition;
        flossMat.setFloat("uTime", time);
        flossMat.setFloat("uFluff", CFG.fluff);
        flossMat.setFloat("uAlpha", CFG.alpha);
        flossMat.setVector3("uCam", cam);
        coreMat.setFloat("uOff", CFG.thick * 0.22 * CFG.fluff);
        coreMat.setVector3("uCam", cam);
    });

    // --- GUI ------------------------------------------------------------------
    if (typeof BABYLON.GUI !== "undefined") {
        var ui = BABYLON.GUI.AdvancedDynamicTexture.CreateFullscreenUI("ui", true, scene);
        ui.layer.applyPostProcess = false;

        var panel = new BABYLON.GUI.StackPanel();
        panel.width = "230px";
        panel.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
        panel.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_TOP;
        panel.left = "12px"; panel.top = "12px";
        panel.paddingTop = "8px"; panel.paddingBottom = "8px";
        panel.background = "rgba(20,24,40,0.6)";
        ui.addControl(panel);

        var addText = function (txt, size, color) {
            var tb = new BABYLON.GUI.TextBlock();
            tb.text = txt; tb.color = color || "white"; tb.fontSize = size || 14;
            tb.height = (size || 14) + 12 + "px";
            panel.addControl(tb);
            return tb;
        };
        var addButton = function (txt, cb) {
            var b = BABYLON.GUI.Button.CreateSimpleButton("btn" + txt, txt);
            b.width = "200px"; b.height = "32px";
            b.color = "white"; b.fontSize = 14; b.cornerRadius = 6;
            b.background = "rgba(255,150,200,0.35)";
            b.paddingTop = "4px";
            b.onPointerClickObservable.add(function () { cb(b); });
            panel.addControl(b);
        };
        var addSlider = function (label, min, max, val, cb) {
            var tb = addText(label + ": " + val.toFixed(2), 13, "#ddd");
            var sl = new BABYLON.GUI.Slider();
            sl.minimum = min; sl.maximum = max; sl.value = val;
            sl.width = "200px"; sl.height = "18px";
            sl.color = "#ff9ccc"; sl.background = "#333"; sl.thumbColor = "white";
            sl.onValueChangedObservable.add(function (v) { tb.text = label + ": " + v.toFixed(2); cb(v); });
            panel.addControl(sl);
        };

        addText("綿あめ", 18, "#ffe0ee");
        addButton("色: " + PALETTES[CFG.palette].name, function (b) {
            var i = (PALETTE_ORDER.indexOf(CFG.palette) + 1) % PALETTE_ORDER.length;
            CFG.palette = PALETTE_ORDER[i];
            b.textBlock.text = "色: " + PALETTES[CFG.palette].name;
            applyPalette();
        });
        addButton("回転: ON", function (b) {
            CFG.spin = !CFG.spin;
            b.textBlock.text = "回転: " + (CFG.spin ? "ON" : "OFF");
        });
        addSlider("ふわふわ", 0.4, 2.0, CFG.fluff, function (v) { CFG.fluff = v; });
        addSlider("糸の濃さ", 0.1, 0.8, CFG.alpha, function (v) { CFG.alpha = v; });
    }

    return scene;
};

export default createScene;