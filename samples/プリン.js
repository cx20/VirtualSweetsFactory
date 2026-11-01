// =====================================================================
//  Photoreal Custard Pudding  /  写実的なプリン      BUILD: purin-2026-09-02-e
//  Babylon.js Playground 用（そのまま貼り付けて実行できます）
//
//  構成:
//    0. CONFIG      … 寸法・揺れ・カラメル・皿・物理
//    1. Rng / helpers
//    2. Noise
//    3. Mesh utils  … 巻き順の自動判定・法線の溶接・掃引
//    4. Profile     … 角丸め掃引で母線を作り、弧長で刻む。厚みも実測する
//    5. Jiggle      … モーダル変形（プルプルの本体）
//    6. TextureLab  … カスタード肌・カラメル・白磁と絵付け・木/布/石
//    7. Pudding     … プリン本体 ＋ 上面カラメルと垂れ
//    8. Sauce       … 皿の上のカラメル溜まり
//    9. Plate       … 角丸スクエアの白磁皿
//   10. Scene       … 灯・物理（Havok）・ポストプロセス
//   11. GUI
//
//  ■ プルプルをどう作っているか（ここがこのサンプルの主題）
//
//  Babylon の Havok プラグインが公開しているのは剛体・シェイプ・拘束までで、
//  ソフトボディは出ていない（旧 Ammo.js の SoftbodyImpostor は Physics V2 へ
//  移植されていない）。そこで役割を分ける。
//
//    Havok  … 落下・着地・皿との接触。つまり「剛体としての運動」
//    自前   … 揺れそのもの。Havok が返す速度差分（＝接地の力積）を
//             入力にした減衰調和振動子（モーダル）6 本
//
//  変位はすべて「静止形状の関数」なので、モード形状 Φk(p) はビルド時に
//  頂点ごとに焼いておける。実行時は u = Σ qk Φk(p) の線形結合だけになり、
//  1万頂点でも 60fps に収まる。法線も同様に (∇Φk)ᵀ·n をビルド時に焼いて
//  おけば、実行時は n' = normalize(n − Σ qk wk) の 1 行で済む。
//
//  使っているモード（すべて底面 y=0 を固定端とする）:
//
//   | # | 内容             | 形状関数                    | 周波数 | 減衰比 |
//   |---|------------------|-----------------------------|--------|--------|
//   | 0 | せん断 X（横揺れ）| ψ1 = 1.5s²−0.5s³（片持ち） | 5.8 Hz | 0.105  |
//   | 1 | せん断 Z         | 同上                        | 5.8 Hz | 0.105  |
//   | 2 | 縦（つぶれ・のび）| u_y=−s / u_r=+r/2H（体積保存）| 9.2 Hz | 0.145  |
//   | 3 | 楕円 cos2θ       | φ3 = sin(0.78πs)            |12.5 Hz | 0.175  |
//   | 4 | 楕円 sin2θ       | 同上                        |12.5 Hz | 0.175  |
//   | 5 | 上面の膜         | τ(s)·(1−(r/rTop)²)          |15.5 Hz | 0.240  |
//
//  周波数の根拠: カスタードプリンのヤング率は数 kPa、密度 1.05。
//  せん断波速度 c = √(G/ρ) ≈ 1 m/s。高さ 4.3cm の片持ちなら
//  f ≈ c/(4H) ≈ 5.8 Hz。実物の「2〜3回揺れて1秒以内に収まる」挙動は
//  減衰比 0.10〜0.15 に対応する。ここを 0.3 まで上げると寒天になり、
//  0.03 まで下げるとゴムになる。
//
//  ■ 実物の要点（ここを外すと「黄色い円錐台」になる）
//    ・型から抜いた面なので表面は滑らか。凹凸で写実性を出す食べ物ではない。
//      効いているのは「透けること」と「ハイライトが面を走ること」の2つだけ
//    ・上面は平らではなく、わずかに皿状にへこんでいる（型の底の形）。
//      そこへカラメルが水平にたまるので、上面のカラメルは中央が厚く暗い
//    ・カラメルは custard に染みる。上端から 1cm ほどが橙に寄る。
//      この染みが無いと「黄色い物体に茶色い蓋が乗っている」ように見える
//    ・垂れは front に玉ができる（表面張力）。等厚の帯にすると塗装になる
//    ・皿のソースは薄い。0.5mm の膜を 2 回通るだけで橙、1.5mm で赤黒になる。
//      Beer–Lambert をそのまま使うと暗くなりすぎるので Saunderson の
//      内部反射補正を入れる
//    ・揺れているとき、形の変化より「ハイライトが表面を走ること」のほうが
//      目に付く。だから法線を必ず一緒に変形させる
// =====================================================================

var createScene = async function () {
    // =================================================================
    // 0. CONFIG （単位は cm）
    // =================================================================
    const GLOBAL = {
        // ---- プリン本体の寸法 ---------------------------------------
        // 実物の 3号プリン型（上口径 66mm / 底 46mm / 深さ 43mm）を
        // ひっくり返した形。写真の 高さ/底径 = 0.65 に合わせてある
        rBot: 3.30,          // 接地側（広いほう）の半径
        rTop: 2.30,          // 上面（狭いほう）の半径
        H: 4.30,          // 高さ
        filletTop: 0.44,          // 上縁の丸め。写真ではかなり丸い
        filletBot: 0.30,          // 下縁の丸め
        dish: 0.060,         // 上面のへこみ（型の底の形。カラメルがたまる）
        barrel: 0.048,         // 自重で樽型に膨らむぶん
        bottomSpread: 0.055,         // 接地部が少し広がるぶん
        lobeAmp: 0.0045,        // 周方向のごく浅いうねり（真円に見せない）
        dentAmp: 0.030,         // 型から抜くときに付くへこみ 1 箇所
        // 【対策】型に接していた面には、写真で見えるほどの「す」は無い。
        //         気泡跡を強く出すと、ゴマを振ったように見える
        poreAmt: 0.22,          // 「す」（気泡跡）の強さ。0 で完全に消える

        segAxis: 76,            // 母線方向の分割
        segRound: 104,           // 周方向の分割
        profileRes: 720,          // 母線の内部テーブル解像度

        // ---- 揺れ（モーダル）----------------------------------------
        // freq は Hz、zeta は減衰比
        modeFreq: [5.80, 5.80, 9.20, 12.50, 12.50, 15.50],
        modeZeta: [0.105, 0.105, 0.145, 0.175, 0.175, 0.240],
        baseSlip: 0.05,          // 底も完全には固定されない（皿の上を少し滑る）
        // 参加係数。剛体の速度差分 Δv[cm/s] を、各モードのモード速度
        // q̇[cm/s] へどれだけ移すか。着地速度 33cm/s に対して
        // 縦モードは q̇ = 8.7 → 振幅 q = q̇/ω = 1.5mm になる
        driveShear: 0.30,          // 水平の Δv → せん断モード
        driveVert: 0.26,          // 鉛直の Δv → 縦モード
        driveTop: 0.11,          // 鉛直の Δv → 上面の膜
        jiggleGain: 2.50,          // GUI で振れ幅をまとめて振る
        freqScale: 0.50,          // 「やわらかさ」。小さいほどゆっくり大きく揺れる
        // 【対策】モード形状は微小変形の 1 次近似なので、振幅を上げていくと
        //         体積が反転して裏返る（縦モードなら q = H で潰れきる）。
        //         振動子は線形のまま回し、表示に渡すところで tanh で
        //         滑らかに飽和させる。実物のゲルも大ひずみでは硬くなる
        modeMax: [1.05, 1.05, 0.62, 0.55, 0.55, 0.34],
        dampScale: 1.00,
        jiggleSub: 1 / 240,        // 振動子の内部ステップ（15.5Hz でも安定させる）
        quietQ: 2.0e-4,        // これ以下なら頂点更新を休む（cm）
        quietQd: 2.0e-3,        // 同 速度（cm/s）
        shakeVel: 9.0,           // 「ゆらす」で与える初速（cm/s）
        pokeVel: 7.0,           // クリックでつついたときの初速

        // ---- カラメル -----------------------------------------------
        // σ は「1cm あたりの消散係数」（linear RGB）。膜厚 t の層を
        // 往復で 2t 通るので、透過率は exp(-σ·2t)
        //
        // 【実測】3枚の写真からソースを逆算した。1枚目は白熱寄りの
        //   ホワイトバランスで赤紫に転んでいたが、2・3枚目はどちらも
        //   素直な飴色だったのでそちらに合わせる。
        //   薄い (2t=1.0mm) sRGB(150, 95, 45)  ← 写真B のソース
        //   濃い (2t=2.3mm) sRGB(102, 20,  3)  ← 写真C のソース
        //   B がいちばん速く落ちるので、薄いところが橙、厚いところが赤黒
        caramelSigma: [4.60, 12.00, 26.00],
        // 【対策】純吸収（Beer–Lambert）だけだと濃いところが黒に落ちる。
        //         実物のカラメルはわずかに濁っていて多重散乱の底がある。
        //         リニアで下駄を履かせると、写真どおり「黒くない赤黒」になる
        caramelScatter: [0.018, 0.010, 0.008],
        sigmaScale: 1.00,
        internalRefl: 0.45,          // Saunderson の内部反射率
        capRise: 0.045,         // 上面カラメルの液面（プリン天面 H からの高さ）
        filmMin: 0.018,         // いちばん薄いところの膜厚
        rimFilm: 0.038,         // 縁を回り込むところ
        dripFilm: 0.024,         // 垂れの胴の厚み
        dripBead: 0.042,         // 垂れの先端の玉（表面張力）
        dripBeadW: 0.24,          // 玉の長さ
        caramelBase: 0.34,          // 天面から何 cm 下まではぐるり一周かかっているか
        // 【対策】写真の側面に「盛り上がった飴の帯」は無い。見えているのは
        //         カスタードに染みた茶色い流れ跡のほう。立体的な垂れを
        //         何本も出すと、チョコがけの菓子になる。幾何の垂れは
        //         短いものを数本に留めて、流れは染みで描く
        dripCount: 3,
        stainRuns: 5,             // 染みて流れた跡の本数
        runStain: 0.85,          // その濃さ
        segCaramel: 34,            // カラメル層の母線方向分割
        stainDepth: 0.85,          // 天面のふちから染みる深さ
        swirl: 0.011,         // 上面カラメルの渦（膜厚のゆらぎ）

        // ---- 皿のソース ---------------------------------------------
        sauceR: 4.10,          // 溜まりの基準半径（見込みの内側に収まる範囲で）
        sauceLobe: 0.30,          // 輪郭のうねり
        sauceH0: 0.052,         // 膜厚（バルク）
        sauceClimb: 0.115,         // プリンの裾を這い上がるメニスカス
        sauceEdge: 0.022,         // 外縁のふくらみ
        sauceMin: 0.014,         // 端の最小膜厚（淡い飴色のフリンジ。深度の余裕も兼ねる）
        sauceAmt: 1.00,          // GUI で量を振る
        sauceSegR: 40,
        sauceSegA: 128,
        dropletN: 6,             // まわりに散った小さな滴

        // ---- 皿 -------------------------------------------------------
        // 写真は無地の白磁の丸皿。スーパー楕円の指数 2 が真円
        plateHalf: 10.60,         // 半径（指数 2 なら全方位でこの値）
        plateN: 2.00,          // 2 = 真円 / 4 = 角丸スクエア
        // 【対策】見込みが狭いと、ソースの量を増やしても途中から
        //         立ち上がりで頭打ちになり、スライダーの上半分が効かなくなる
        plateWellS: 0.620,         // 見込みの割合
        plateLip: 1.05,          // 縁の立ち上がり
        plateThick: 0.46,
        plateSegA: 176,
        plateSegR: 46,
        plateCorner: 0.00,         // 丸皿なので角の反りは無し
        printSprigs: 3,
        secondPlate: true,          // 奥に重ねた皿（被写界深度でボケる）

        // ---- 物理 -----------------------------------------------------
        // 【対策】cm 系なので理屈では 981 だが、Havok の接触許容量と
        //         スリープ閾値はメートル系前提の絶対値。981 だと 1 ステップの
        //         めり込みが許容量を超えて押し戻され続けて震える
        usePhysics: true,
        gravity: 620,
        physicsHz: 120,
        // 【対策】0.9cm だと落ちた瞬間が見えない。5cm 上から放すと、
        //         着地の力積が 2.9 倍になって最初の一撃がはっきり出る
        dropH: 5.00,          // 皿の見込みから何 cm 上で放すか
        mass: 0.50,
        friction: 0.92,
        restitution: 0.02,
        linearDamping: 0.22,
        angularDamping: 0.92,
        hullSegA: 34,            // 凸包用の代理メッシュ（表示用は使わない）
        hullSegV: 22,
        settleVel: 0.9,
        settleTime: 0.45,
        settleTimeout: 4.0,

        // ---- 見た目 ---------------------------------------------------
        textureSize: 1024,
        plateTexSize: 1024,
        useSSAO: true,
        useDOF: true,
        dofRatio: 0.072,
        dofFStop: 2.6,
        exposure: 1.12,
        contrast: 1.06,
        showTable: true,
        compactWidth: 760,

        // 【対策】フルスクリーン GUI を専用カメラへ分離すると Inspector が
        //         3系統まとめて壊れる（Physics Helper / 選択ハイライト /
        //         ピッカー）。Layer.applyPostProcess = false なら 2台目を
        //         作らずに GUI だけポストプロセスの外へ出せる
        guiOwnCamera: false,
        debug: false
    };

    // =================================================================
    //  テーブルと皿のプリセット
    // =================================================================
    // 【対策】皿もテーブルも背景も白のまま置くと、全部が同じ明度に沈んで
    //         シルエットがまったく読めない（実測で 219,219,219 の一色）。
    //         主役の色を変えるより、下に敷くものに色を入れるほうが速い
    const TABLES = {
        oak: {
            label: "樫の板", kind: "wood", tile: 6.2, sheen: 0,
            P: {
                extent: 42, plankW: 11.5, pitch: 1.05, ringCenter: 9.0, figure: 2.10,
                lateW: 0.20, pore: 0.85, seamW: 0.16, rough: 0.52,
                // 【実測】写真Cの木は sRGB(134,90,45)〜(104,66,35)
                early: [0.560, 0.395, 0.222], late: [0.330, 0.200, 0.105]
            }
        },
        walnut: {
            label: "胡桃の板", kind: "wood", tile: 5.4, sheen: 0,
            P: {
                extent: 42, plankW: 13.0, pitch: 0.86, ringCenter: 12.0, figure: 1.70,
                lateW: 0.24, pore: 0.70, seamW: 0.16, rough: 0.44,
                early: [0.395, 0.262, 0.168], late: [0.212, 0.128, 0.082]
            }
        },
        pinkCloth: {
            // 【実測】写真Bの布は明部 sRGB(255,226,214)、手前 sRGB(204,160,149)
            label: "桃色の布", kind: "cloth", tile: 3.2, sheen: 0.34,
            col: [0.885, 0.700, 0.665], contrast: 0.075
        },
        linen: {
            label: "生成りの布", kind: "cloth", tile: 3.2, sheen: 0.32,
            col: [0.880, 0.850, 0.800], contrast: 0.065
        },
        slate: {
            label: "濃灰の石", kind: "stone", tile: 2.4, sheen: 0,
            col: [0.285, 0.288, 0.300]
        }
    };

    const PLATES = {
        goldRim: {
            // 【実測】写真Cの金縁は sRGB(185,120,55) 前後の細い二重線
            label: "金縁の白磁", albedo: [0.885, 0.893, 0.902], rough: 0.10,
            deco: "rings", ringCol: [0.700, 0.480, 0.185],
            rings: [[0.828, 0.006], [0.872, 0.020]]
        },
        white: {
            label: "白磁（無地）", albedo: [0.888, 0.897, 0.908], rough: 0.10,
            deco: "none"
        },
        grey: {
            // 【実測】写真Bの皿は sRGB(157,148,149)〜(121,111,112) の暖かい灰
            label: "灰の縁皿", albedo: [0.620, 0.585, 0.578], rough: 0.17,
            deco: "none"
        },
        indigo: {
            label: "藍の染付", albedo: [0.892, 0.900, 0.905], rough: 0.11,
            deco: "print", printTint: [0.150, 0.265, 0.500],
            ringCol: [0.170, 0.290, 0.520], rings: [[0.900, 0.012]]
        },
        fruit: {
            label: "果実と葉", albedo: [0.890, 0.896, 0.902], rough: 0.11,
            deco: "print", printTint: null
        }
    };

    const START_TABLE = "oak";
    const START_PLATE = "goldRim";
    const START_SEED = 20260902;

    // =================================================================
    // 1. Rng / helpers
    // =================================================================
    const V3 = BABYLON.Vector3;
    const TAU = Math.PI * 2;
    const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
    const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
    const mix = (a, b, t) => a + (b - a) * t;
    const frac = (x) => x - Math.floor(x);
    // 【対策】パレットは sRGB で考えたほうが直感的だが、頂点カラーも
    //         albedoColor もリニアで解釈される。必ず通す
    const sRGB = (c) => new BABYLON.Color3(c[0], c[1], c[2]).toLinearSpace();
    const lin = (v) => Math.pow(clamp(v, 0, 1), 2.2);

    class Rng {
        constructor(seed) { this.s = seed >>> 0; }
        next() {
            this.s = (this.s + 0x6D2B79F5) | 0;
            let t = Math.imul(this.s ^ (this.s >>> 15), 1 | this.s);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        }
        range(a, b) { return a + (b - a) * this.next(); }
        gauss(m, sd) {
            const u = Math.max(1e-9, this.next()), v = this.next();
            return m + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v);
        }
        int(n) { return Math.floor(this.next() * n) % n; }
    }

    // =================================================================
    // 2. Noise
    // =================================================================
    const Noise = {
        _h2(x, y, seed) {
            let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(seed | 0, 1274126177);
            h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
            return (h >>> 0) / 4294967295;
        },
        v2(x, y, seed) {
            const xi = Math.floor(x), yi = Math.floor(y);
            const xf = x - xi, yf = y - yi;
            const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
            const a = this._h2(xi, yi, seed), b = this._h2(xi + 1, yi, seed);
            const c = this._h2(xi, yi + 1, seed), d = this._h2(xi + 1, yi + 1, seed);
            const t0 = a + (b - a) * u, t1 = c + (d - c) * u;
            return t0 + (t1 - t0) * v;
        },
        fbm2(x, y, seed, oct) {
            let s = 0, a = 0.5, f = 1, n = 0;
            for (let o = 0; o < oct; o++) { s += a * this.v2(x * f, y * f, seed + o * 131); n += a; f *= 2; a *= 0.5; }
            return s / n;
        },
        // 【対策】x 方向しか折り返さないノイズでテクスチャを焼くと、
        //         上下の継ぎ目に横一文字の線が出る。周方向は必ず周期にする
        v2u(x, y, px, seed) {
            const xi = Math.floor(x), yi = Math.floor(y);
            const xf = x - xi, yf = y - yi;
            const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
            const p = Math.max(1, px | 0);
            let x0 = xi % p; if (x0 < 0) x0 += p;
            let x1 = (xi + 1) % p; if (x1 < 0) x1 += p;
            const a = this._h2(x0, yi, seed), b = this._h2(x1, yi, seed);
            const c = this._h2(x0, yi + 1, seed), d = this._h2(x1, yi + 1, seed);
            const t0 = a + (b - a) * u, t1 = c + (d - c) * u;
            return t0 + (t1 - t0) * v;
        },
        fbm2u(x, y, period, seed, oct) {
            let s = 0, a = 0.5, f = 1, n = 0;
            for (let o = 0; o < oct; o++) {
                s += a * this.v2u(x * f, y * f, (period * f) | 0, seed + o * 131);
                n += a; f *= 2; a *= 0.5;
            }
            return s / n;
        },
        // 周期 1 の 1D ノイズ（角度に使う。継ぎ目ができない）
        ang(t, period, seed) { return this.v2u(t * period, 0.5, period, seed); },
        angFbm(t, period, seed, oct) {
            let s = 0, a = 0.5, f = 1, n = 0;
            for (let o = 0; o < oct; o++) {
                s += a * this.v2u(t * period * f, 0.5, (period * f) | 0, seed + o * 977);
                n += a; f *= 2; a *= 0.5;
            }
            return s / n;
        },
        // セルノイズ。カスタードの「す」（気泡跡）に使う。
        // 【対策】x（周方向）を折り返さないと u=0 に継ぎ目の線が出る
        cell2(x, y, seed, px) {
            const xi = Math.floor(x), yi = Math.floor(y);
            const P = (px | 0) > 0 ? (px | 0) : 0;
            let f1 = 1e9, f2 = 1e9;
            for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                    let gx = xi + dx; const gy = yi + dy;
                    if (P) { gx = gx % P; if (gx < 0) gx += P; }
                    const jx = (xi + dx) + this._h2(gx, gy, seed);
                    const jy = gy + this._h2(gx, gy, seed + 7717);
                    const ex = jx - x, ey = jy - y;
                    const d = Math.sqrt(ex * ex + ey * ey);
                    if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) { f2 = d; }
                }
            }
            return [f1, f2];
        }
    };

    // =================================================================
    // 3. Mesh utils
    // =================================================================
    // 【対策】VertexData.ComputeNormals の外積は (v0−v1)×(v2−v1) で、
    //         右手系の外積とは符号が逆。巻き順の規約を決め打ちすると
    //         環境や部品で裏返るので、実行時に判定して必要なら全反転する。
    //         代表点1個での判定は法線が基準方向と直交したときに符号が
    //         不安定になるので、全頂点の総和（重心基準）で取る
    function finalize(positions, indices) {
        let normals = new Float32Array(positions.length);
        BABYLON.VertexData.ComputeNormals(positions, indices, normals);
        const n = positions.length / 3;
        let cx = 0, cy = 0, cz = 0;
        for (let i = 0; i < n; i++) {
            cx += positions[i * 3]; cy += positions[i * 3 + 1]; cz += positions[i * 3 + 2];
        }
        cx /= n; cy /= n; cz /= n;
        let acc = 0;
        for (let i = 0; i < n; i++) {
            acc += normals[i * 3] * (positions[i * 3] - cx)
                + normals[i * 3 + 1] * (positions[i * 3 + 1] - cy)
                + normals[i * 3 + 2] * (positions[i * 3 + 2] - cz);
        }
        finalize.lastScore = acc;
        finalize.lastFlipped = acc < 0;
        if (acc < 0) {
            for (let i = 0; i < indices.length; i += 3) {
                const t = indices[i + 1]; indices[i + 1] = indices[i + 2]; indices[i + 2] = t;
            }
            normals = new Float32Array(positions.length);
            BABYLON.VertexData.ComputeNormals(positions, indices, normals);
        }
        return normals;
    }

    // 【対策】カラメル層は閉じていない（縁がある）ので重心基準の判定が
    //         効かない。外向きの参照方向を渡して、その内積の総和で決める
    function finalizeOpen(positions, indices, refN) {
        let normals = new Float32Array(positions.length);
        BABYLON.VertexData.ComputeNormals(positions, indices, normals);
        const n = positions.length / 3;
        let acc = 0;
        for (let i = 0; i < n; i++) {
            acc += normals[i * 3] * refN[i * 3]
                + normals[i * 3 + 1] * refN[i * 3 + 1]
                + normals[i * 3 + 2] * refN[i * 3 + 2];
        }
        finalizeOpen.lastScore = acc;
        finalizeOpen.lastFlipped = acc < 0;
        if (acc < 0) {
            for (let i = 0; i < indices.length; i += 3) {
                const t = indices[i + 1]; indices[i + 1] = indices[i + 2]; indices[i + 2] = t;
            }
            normals = new Float32Array(positions.length);
            BABYLON.VertexData.ComputeNormals(positions, indices, normals);
        }
        return normals;
    }

    // 【対策】回転体は始端と終端で頂点が重複する。そのまま ComputeNormals
    //         すると継ぎ目に縦線が出る。位置が一致する頂点の法線を平均する
    function weldNormals(positions, normals) {
        const map = new Map();
        const n = positions.length / 3;
        for (let i = 0; i < n; i++) {
            const k = Math.round(positions[i * 3] * 8192) + "," +
                Math.round(positions[i * 3 + 1] * 8192) + "," +
                Math.round(positions[i * 3 + 2] * 8192);
            let a = map.get(k); if (!a) { a = []; map.set(k, a); }
            a.push(i);
        }
        for (const a of map.values()) {
            if (a.length < 2) continue;
            let nx = 0, ny = 0, nz = 0;
            for (const i of a) { nx += normals[i * 3]; ny += normals[i * 3 + 1]; nz += normals[i * 3 + 2]; }
            const l = Math.hypot(nx, ny, nz) || 1;
            for (const i of a) { normals[i * 3] = nx / l; normals[i * 3 + 1] = ny / l; normals[i * 3 + 2] = nz / l; }
        }
    }

    function makeMesh(name, positions, indices, normals, uvs, colors, scene, updatable) {
        const mesh = new BABYLON.Mesh(name, scene);
        // 【対策】Babylon の Node コンストラクタは id = name を入れる。
        //         Inspector のツリーは id で照合するので、同名の個体が
        //         あると Scene Explorer のピッカーが別の物を選ぶ。
        //         name と id の両方を明示的にユニークにする
        mesh.id = name;
        const vd = new BABYLON.VertexData();
        vd.positions = positions; vd.indices = indices; vd.normals = normals;
        if (uvs) vd.uvs = uvs;
        if (colors) vd.colors = colors;
        vd.applyToMesh(mesh, !!updatable);
        // 【対策】頂点カラーを stride 4 で入れると hasVertexAlpha が立ち、
        //         不透明なのに透過パスへ回される。透過パスは深度書き込みが
        //         切られるので、皿とプリンの前後関係が壊れる
        mesh.hasVertexAlpha = false;
        return mesh;
    }

    // 角を円弧で丸めた折れ線。母線と皿の断面の両方で使う。
    // 【対策】円錐台の上下の縁を「別々の円弧」として手で置くと、側面が
    //         斜めなぶん接線が合わず、丸めの端にわずかな折れ線が残る。
    //         接線距離から半径を決める一般解にしておけばどの角でも合う
    function roundPolyline(pts, radii, seg) {
        const out = [[pts[0][0], pts[0][1]]];
        for (let i = 1; i < pts.length - 1; i++) {
            const R = radii[i] || 0;
            const P = pts[i], A = pts[i - 1], C = pts[i + 1];
            if (R <= 1e-6) { out.push([P[0], P[1]]); continue; }
            let u1x = A[0] - P[0], u1y = A[1] - P[1];
            const l1 = Math.hypot(u1x, u1y) || 1; u1x /= l1; u1y /= l1;
            let u2x = C[0] - P[0], u2y = C[1] - P[1];
            const l2 = Math.hypot(u2x, u2y) || 1; u2x /= l2; u2y /= l2;
            const cosT = clamp(u1x * u2x + u1y * u2y, -1, 1);
            const theta = Math.acos(cosT), half = theta * 0.5;
            if (half < 1e-4 || Math.PI - theta < 1e-4) { out.push([P[0], P[1]]); continue; }
            let d = R / Math.tan(half);
            d = Math.min(d, l1 * 0.49, l2 * 0.49);
            const Rr = d * Math.tan(half);
            const t1x = P[0] + u1x * d, t1y = P[1] + u1y * d;
            const t2x = P[0] + u2x * d, t2y = P[1] + u2y * d;
            let bx = u1x + u2x, by = u1y + u2y;
            const bl = Math.hypot(bx, by) || 1; bx /= bl; by /= bl;
            const cd = Rr / Math.sin(half);
            const cxp = P[0] + bx * cd, cyp = P[1] + by * cd;
            const a1 = Math.atan2(t1y - cyp, t1x - cxp);
            const a2 = Math.atan2(t2y - cyp, t2x - cxp);
            let da = a2 - a1;
            while (da > Math.PI) da -= TAU;
            while (da < -Math.PI) da += TAU;
            for (let k = 0; k <= seg; k++) {
                const a = a1 + da * (k / seg);
                out.push([cxp + Math.cos(a) * Rr, cyp + Math.sin(a) * Rr]);
            }
        }
        out.push([pts[pts.length - 1][0], pts[pts.length - 1][1]]);
        return out;
    }

    // 折れ線を「弧長 ＋ 曲率」で重み付けして等分に刻み直す。
    // 【対策】素の弧長で等分すると、丸めた縁（曲率が高い）に数点しか
    //         入らず、シルエットに折れが出る。曲率の高いところへ点を
    //         寄せるだけで、同じ頂点数で縁の質が上がる
    function resampleByArc(poly, count, curvW) {
        const n = poly.length;
        const w = new Float64Array(n);
        w[0] = 0;
        for (let i = 1; i < n; i++) {
            const dx = poly[i][0] - poly[i - 1][0], dy = poly[i][1] - poly[i - 1][1];
            let ds = Math.hypot(dx, dy);
            if (curvW > 0 && i > 1 && i < n - 1) {
                const ax = poly[i][0] - poly[i - 1][0], ay = poly[i][1] - poly[i - 1][1];
                const bx = poly[i + 1][0] - poly[i][0], by = poly[i + 1][1] - poly[i][1];
                const la = Math.hypot(ax, ay) || 1e-9, lb = Math.hypot(bx, by) || 1e-9;
                const cs = clamp((ax * bx + ay * by) / (la * lb), -1, 1);
                ds *= 1 + curvW * Math.acos(cs) / Math.max(1e-9, ds);
            }
            w[i] = w[i - 1] + ds;
        }
        const total = w[n - 1] || 1;
        const out = [];
        let j = 0;
        for (let k = 0; k < count; k++) {
            const target = total * k / (count - 1);
            while (j < n - 2 && w[j + 1] < target) j++;
            const seg = (w[j + 1] - w[j]) || 1e-9;
            const t = clamp((target - w[j]) / seg, 0, 1);
            out.push([mix(poly[j][0], poly[j + 1][0], t), mix(poly[j][1], poly[j + 1][1], t)]);
        }
        return out;
    }

    // =================================================================
    // 4. Profile （母線）
    // =================================================================
    // v = 0 が上面の中心、v = 1 が底面の中心。刻みは弧長（＋曲率重み）。
    //
    // 【対策】制御点の添字で v を刻むと、丸めた縁だけテクスチャが詰まって
    //         縞に見える。必ず弧長で正規化する
    class Profile {
        constructor(cfg) {
            this.cfg = cfg;
            const H = cfg.H, rT = cfg.rTop, rB = cfg.rBot;

            // 角丸め前の骨格。上面 → 側面 → 底面
            const ctrl = [[0, H], [rT, H], [rB, 0], [0, 0]];
            const rad = [0, cfg.filletTop, cfg.filletBot, 0];
            let poly = roundPolyline(ctrl, rad, 26);

            // 一度細かく刻み直してから変形を掛ける（変形後の弧長で刻むため）
            poly = resampleByArc(poly, 900, 0);

            for (const p of poly) {
                const r = p[0], y = p[1];
                // 上面のへこみ。型の底の形がそのまま出る。カラメルはここへたまる
                const kTop = clamp((y - (H - cfg.filletTop)) / cfg.filletTop, 0, 1);
                const rIn = Math.min(1, r / Math.max(1e-6, rT - cfg.filletTop));
                p[1] = y - cfg.dish * (1 - rIn * rIn) * kTop;
                // 自重の樽型。上下の面（sin = 0）には効かない
                let rr = r + cfg.barrel * Math.sin(Math.PI * clamp(y / H, 0, 1));
                // 接地部の広がり。やわらかいものは座ったところが少し潰れて出る
                rr += cfg.bottomSpread * Math.exp(-(y / 0.55) * (y / 0.55))
                    * smooth(0.2, 1.2, r);
                p[0] = rr;
            }

            // 曲率重み付きで最終解像度へ。丸めた縁に点が寄る
            const fine = resampleByArc(poly, cfg.profileRes, 0.55);
            const N = fine.length;
            this.N = N;
            this.r = new Float64Array(N);
            this.y = new Float64Array(N);
            this.nr = new Float64Array(N);
            this.ny = new Float64Array(N);
            this.th = new Float64Array(N);   // 実測した肉厚
            for (let i = 0; i < N; i++) { this.r[i] = fine[i][0]; this.y[i] = fine[i][1]; }

            // 法線。v が増える向きの接線 t に対して (−t_y, t_r) が外向き
            for (let i = 0; i < N; i++) {
                const a = Math.max(0, i - 1), b = Math.min(N - 1, i + 1);
                const tr = this.r[b] - this.r[a], ty = this.y[b] - this.y[a];
                const l = Math.hypot(tr, ty) || 1;
                this.nr[i] = -ty / l;
                this.ny[i] = tr / l;
            }
            // 中心（r = 0）では上面が真上、底面が真下
            this.nr[0] = 0; this.ny[0] = 1;
            this.nr[N - 1] = 0; this.ny[N - 1] = -1;

            this._measureThickness();

            this.topY = this.y[0];
            this.maxR = Math.max.apply(null, Array.from(this.r));
            // テクスチャのノイズを実寸で刻むために総弧長を持っておく
            let L = 0;
            for (let i = 1; i < N; i++) L += Math.hypot(this.r[i] - this.r[i - 1], this.y[i] - this.y[i - 1]);
            this.arcLen = L;
        }

        // 【対策】subSurface の厚みを「2r」や「y」で近似すると、シルエットの
        //         きわで厚みが最大になってしまい、いちばん透けるべき縁が
        //         いちばん透けなくなる。断面多角形（母線を軸で鏡像にしたもの）
        //         に対して内向きのレイを飛ばし、実際の弦長を測る。
        //
        // 【対策】ただし −n の1本だけで測ると、上縁の丸めのように「外から
        //         見れば薄いのに、法線方向には胴を斜めに貫く」場所で最大値が
        //         出てしまう。実際にそこを抜けてくる光は、法線から外れた
        //         浅い経路を通ってくる。内向き半球にファン状にレイを飛ばして
        //         平均を取ると、凸な縁がきちんと薄くなる
        _measureThickness() {
            const N = this.N;
            // 断面の閉多角形（+r 側を上から下へ、−r 側を下から上へ）
            const px = [], py = [];
            for (let i = 0; i < N; i++) { px.push(this.r[i]); py.push(this.y[i]); }
            for (let i = N - 2; i >= 1; i--) { px.push(-this.r[i]); py.push(this.y[i]); }
            const M = px.length;
            const FAN = 9, SPAN = 1.22;          // ±70°
            for (let i = 0; i < N; i++) {
                const ox = this.r[i], oy = this.y[i];
                const base = Math.atan2(-this.ny[i], -this.nr[i]);
                let acc = 0, wsum = 0;
                for (let f = 0; f < FAN; f++) {
                    const a2 = base + SPAN * (f / (FAN - 1) * 2 - 1);
                    const dx = Math.cos(a2), dy = Math.sin(a2);
                    // 法線に近い向きほど重い（Lambert 的な重み）
                    const wgt = Math.cos(SPAN * (f / (FAN - 1) * 2 - 1));
                    let best = 1e9;
                    for (let k = 0; k < M; k++) {
                        const ax = px[k], ay = py[k];
                        const bx = px[(k + 1) % M], by = py[(k + 1) % M];
                        const ex = bx - ax, ey = by - ay;
                        const den = dx * ey - dy * ex;
                        if (Math.abs(den) < 1e-12) continue;
                        const t = ((ax - ox) * ey - (ay - oy) * ex) / den;
                        const u = ((ax - ox) * dy - (ay - oy) * dx) / den;
                        if (t > 1e-3 && u >= -1e-6 && u <= 1 + 1e-6 && t < best) best = t;
                    }
                    if (best < 1e8) { acc += best * wgt; wsum += wgt; }
                }
                this.th[i] = wsum > 0 ? acc / wsum : 0;
            }
            // 【対策】断面が多角形なので、レイの当たる辺が切り替わるところで
            //         測定値に段が出る。そのまま焼くと厚みテクスチャに横縞が
            //         乗る。母線に沿って広めに均す
            const sm = new Float64Array(N);
            for (let i = 0; i < N; i++) {
                let s = 0, w = 0;
                for (let k = -11; k <= 11; k++) {
                    const j = clamp(i + k, 0, N - 1);
                    const ww = 1 / (1 + Math.abs(k));
                    s += this.th[j] * ww; w += ww;
                }
                sm[i] = s / w;
            }
            this.th = sm;
            this.thMax = Math.max.apply(null, Array.from(sm));
        }

        // v ∈ [0,1] → { r, y, nr, ny, th }
        at(v) {
            const N = this.N;
            const f = clamp(v, 0, 1) * (N - 1);
            const i = Math.min(N - 2, Math.floor(f)), t = f - i;
            return {
                r: mix(this.r[i], this.r[i + 1], t),
                y: mix(this.y[i], this.y[i + 1], t),
                nr: mix(this.nr[i], this.nr[i + 1], t),
                ny: mix(this.ny[i], this.ny[i + 1], t),
                th: mix(this.th[i], this.th[i + 1], t)
            };
        }

        // 高さ y に対応する v を返す（側面は y が単調に減るので二分探索できる）
        vAtY(yy) {
            const N = this.N;
            let lo = 0, hi = N - 1;
            if (yy >= this.y[0]) return 0;
            if (yy <= this.y[N - 1]) return 1;
            while (hi - lo > 1) {
                const m = (lo + hi) >> 1;
                if (this.y[m] > yy) lo = m; else hi = m;
            }
            const d = (this.y[lo] - this.y[hi]) || 1e-9;
            const t = (this.y[lo] - yy) / d;
            return (lo + t) / (N - 1);
        }
    }

    // 周方向のごく浅い歪み。
    // 【対策】完全な真円だと縁のハイライトが定規で引いた線になり、
    //         成形品のプラスチックに見える。ただしプリンは型物なので
    //         野菜と同じ幅で振ると手びねりの粘土になる。0.5% 以下に抑える
    function makeDeviation(cfg, seed) {
        const rng = new Rng(seed);
        const dentA = rng.range(0, TAU);
        const dentW = rng.range(0.34, 0.52);
        const dentY = rng.range(0.30, 0.62);   // へこみの高さ（H に対する比）
        return function (theta, y) {
            const u = theta / TAU;
            let k = 1;
            k += cfg.lobeAmp * (Math.cos(3 * theta) * 0.6 + Math.sin(5 * theta + 1.1) * 0.4);
            k += cfg.lobeAmp * 1.3 * (Noise.angFbm(u, 7, seed + 11, 3) - 0.5) * 2;
            // 型から抜くときのへこみ。1 箇所だけ、上下になだらかに伸びる
            let da = theta - dentA;
            while (da > Math.PI) da -= TAU;
            while (da < -Math.PI) da += TAU;
            const az = Math.exp(-Math.pow(Math.abs(da) / dentW, 1.7));
            const ay = Math.exp(-Math.pow((y / cfg.H - dentY) / 0.30, 2));
            k -= (cfg.dentAmp / cfg.rBot) * az * ay;
            return k;
        };
    }

    // =================================================================
    // 5. Jiggle （プルプル）
    // =================================================================
    // Havok にはソフトボディが無いので、剛体の運動と変形を分けて持つ。
    //
    //   Havok : 落下・着地・皿との接触（PhysicsBody の position / rotation）
    //   ここ  : 変形。減衰調和振動子 6 本を積分して、モード形状の線形結合で
    //           頂点を動かす
    //
    // 変位が q について線形なので、モード形状 Φk(p) は静止形状の関数として
    // ビルド時に焼ける。実行時は u = Σ qk Φk(p) の線形結合だけ。
    //
    // 【対策】位置だけ動かして法線を放置すると、揺れているのに濡れて見えない。
    //         プルプル感の視覚的な主成分は「形の変化」ではなく
    //         「ハイライトが表面を走ること」なので、法線の更新が本体。
    //         変形勾配 F = I + ∇u に対して n' ∝ cof(F)·n。振幅が数 mm と
    //         小さいので 1 次で十分で、n' ≈ normalize(n − (∇u)ᵀ n)。
    //         静止法線 n はビルド時に決まっているから (∇Φk)ᵀ n も焼ける。
    //         結果、頂点あたり「モード数 × 6 個の float」で足りる
    const NMODE = 6;

    class ModeField {
        constructor(cfg, prof) {
            this.cfg = cfg;
            this.H = cfg.H;
            this.rTop = cfg.rTop;
            this.rBot = prof.maxR;
            this.slip = cfg.baseSlip;
        }

        // 片持ちの 1 次たわみ形状。s = 1 で 1、s = 0 で接線 0（固定端）
        psi1(s) { const b = this.slip; return b + (1 - b) * (1.5 * s * s - 0.5 * s * s * s); }

        // 楕円モードの高さ方向分布。底で 0、6 割の高さで最大、天面で 0.64
        phi3(s) { return Math.sin(0.78 * Math.PI * s); }

        // 上面の膜。天面付近だけ
        tauTop(s) { return smooth(0.62, 1.0, s); }

        // モード k の単位振幅変位（cm/cm）。out に (ux, uy, uz)
        vec(k, x, y, z, out) {
            const H = this.H;
            const s = clamp(y / H, 0, 1);
            out[0] = 0; out[1] = 0; out[2] = 0;
            if (k === 0) { out[0] = this.psi1(s); return; }
            if (k === 1) { out[2] = this.psi1(s); return; }
            if (k === 2) {
                // 縦。q>0 で天面が q だけ沈み、体積保存で半径が r·q/(2H) 増える
                out[0] = x / (2 * H); out[1] = -s; out[2] = z / (2 * H); return;
            }
            if (k === 3 || k === 4) {
                const r = Math.hypot(x, z);
                if (r < 1e-7) return;
                const rho = Math.min(1, r / this.rBot);
                const th = Math.atan2(z, x);
                const a = (k === 3) ? Math.cos(2 * th) : Math.sin(2 * th);
                const ur = rho * this.phi3(s) * a;
                out[0] = ur * (x / r); out[2] = ur * (z / r); return;
            }
            if (k === 5) {
                const r = Math.hypot(x, z);
                const rr = Math.min(1, r / this.rTop);
                out[1] = this.tauTop(s) * (1 - rr * rr); return;
            }
        }
    }

    // 変形するメッシュ1枚ぶんの焼き込み。
    // M[k][i] = (Φkx, Φky, Φkz, wkx, wky, wkz)   w = (∇Φk)ᵀ n_rest
    class Deformable {
        constructor(mesh, field) {
            this.mesh = mesh;
            this.field = field;
            const pos = mesh.getVerticesData(BABYLON.VertexBuffer.PositionKind);
            const nor = mesh.getVerticesData(BABYLON.VertexBuffer.NormalKind);
            const n = pos.length / 3;
            this.n = n;
            this.rest = new Float32Array(pos);
            this.restN = new Float32Array(nor);
            this.pos = new Float32Array(pos);
            this.nor = new Float32Array(nor);
            this.M = new Float32Array(NMODE * n * 6);

            const a = [0, 0, 0], b = [0, 0, 0], c = [0, 0, 0];
            const EPS = 4e-3;
            for (let k = 0; k < NMODE; k++) {
                const base = k * n * 6;
                for (let i = 0; i < n; i++) {
                    const x = this.rest[i * 3], y = this.rest[i * 3 + 1], z = this.rest[i * 3 + 2];
                    const nx = this.restN[i * 3], ny = this.restN[i * 3 + 1], nz = this.restN[i * 3 + 2];
                    field.vec(k, x, y, z, a);
                    const o = base + i * 6;
                    this.M[o] = a[0]; this.M[o + 1] = a[1]; this.M[o + 2] = a[2];
                    // (∇Φ)ᵀ n を中心差分で。列 j = ∂Φ/∂x_j なので
                    // ((∇Φ)ᵀ n)_j = Σ_m n_m ∂Φ_m/∂x_j
                    let w0 = 0, w1 = 0, w2 = 0;
                    field.vec(k, x + EPS, y, z, b); field.vec(k, x - EPS, y, z, c);
                    w0 = ((b[0] - c[0]) * nx + (b[1] - c[1]) * ny + (b[2] - c[2]) * nz) / (2 * EPS);
                    field.vec(k, x, y + EPS, z, b); field.vec(k, x, y - EPS, z, c);
                    w1 = ((b[0] - c[0]) * nx + (b[1] - c[1]) * ny + (b[2] - c[2]) * nz) / (2 * EPS);
                    field.vec(k, x, y, z + EPS, b); field.vec(k, x, y, z - EPS, c);
                    w2 = ((b[0] - c[0]) * nx + (b[1] - c[1]) * ny + (b[2] - c[2]) * nz) / (2 * EPS);
                    this.M[o + 3] = w0; this.M[o + 4] = w1; this.M[o + 5] = w2;
                }
            }
        }

        apply(Q) {
            const n = this.n, M = this.M, rest = this.rest, rn = this.restN;
            const pos = this.pos, nor = this.nor;
            const stride = n * 6;
            for (let i = 0; i < n; i++) {
                const o6 = i * 6;
                let ux = 0, uy = 0, uz = 0, wx = 0, wy = 0, wz = 0;
                for (let k = 0; k < NMODE; k++) {
                    const q = Q[k];
                    if (q === 0) continue;
                    const b = k * stride + o6;
                    ux += q * M[b]; uy += q * M[b + 1]; uz += q * M[b + 2];
                    wx += q * M[b + 3]; wy += q * M[b + 4]; wz += q * M[b + 5];
                }
                const i3 = i * 3;
                pos[i3] = rest[i3] + ux;
                pos[i3 + 1] = rest[i3 + 1] + uy;
                pos[i3 + 2] = rest[i3 + 2] + uz;
                let nx = rn[i3] - wx, ny = rn[i3 + 1] - wy, nz = rn[i3 + 2] - wz;
                const l = Math.hypot(nx, ny, nz) || 1;
                nor[i3] = nx / l; nor[i3 + 1] = ny / l; nor[i3 + 2] = nz / l;
            }
            this.mesh.updateVerticesData(BABYLON.VertexBuffer.PositionKind, pos, false, false);
            this.mesh.updateVerticesData(BABYLON.VertexBuffer.NormalKind, nor, false, false);
        }

        dispose() { this.M = null; this.rest = null; this.restN = null; }
    }

    // 減衰調和振動子の束。
    // 【対策】60fps のデルタでそのまま積分すると、15.5Hz のモードは
    //         ωh = 1.6 まで行って符号が振動する。内部で 1/240 に刻む
    class Jiggle {
        constructor(cfg) {
            this.cfg = cfg;
            this.q = new Float64Array(NMODE);
            this.qd = new Float64Array(NMODE);
            this.Q = new Float64Array(NMODE);
            this.acc = 0;
            this.imp = new Float64Array(NMODE); // 次のステップで入れる力積（cm/s）
            this.vPrev = new V3(0, 0, 0);
            this.hasPrev = false;
            this.kicked = false;
            this.rng = new Rng(0x51ED17);
            this.awake = true;
            this.peak = 0;
        }

        omega(k) { return TAU * this.cfg.modeFreq[k] * this.cfg.freqScale; }
        zeta(k) { return this.cfg.modeZeta[k] * this.cfg.dampScale; }

        // 剛体から届いた「速度の差分」を参加係数を通してモードへ渡す。
        //
        // 台の加速度 a で励振される振動子は q̈ + 2ζωq̇ + ω²q = −Γa だが、
        // 接地の一撃を決めるのは力ではなく力積 ∫Γa dt = Γ·Δv のほう。
        //
        // 【対策】加速度（＝Δv / デルタ時間）を外力として積分すると、
        //         内部ステップ 1/240 の端数が持ち越されるぶんだけ、
        //         2〜3 フレームで終わる衝撃の伝わり方が表示フレームレートで
        //         変わる（実測 60fps と 144fps で振幅が 2 倍違った）。
        //         Δv をそのまま q̇ へ足せば、時間の刻みが一切効かなくなる
        driveImpulse(dvx, dvy, dvz) {
            const c = this.cfg, g = c.jiggleGain;
            this.imp[0] += -c.driveShear * dvx * g;
            this.imp[1] += -c.driveShear * dvz * g;
            this.imp[2] += c.driveVert * dvy * g;
            this.imp[5] += c.driveTop * dvy * g;
        }

        // 着地の一撃。左右非対称なので楕円モードも少し起こす
        impact(strength) {
            const r = this.rng;
            const s = strength * this.cfg.jiggleGain;
            this.qd[3] += r.gauss(0, 0.30) * s;
            this.qd[4] += r.gauss(0, 0.30) * s;
            this.qd[0] += r.gauss(0, 0.20) * s;
            this.qd[1] += r.gauss(0, 0.20) * s;
            this.awake = true;
        }

        shake(vel) {
            const r = this.rng, a = r.range(0, TAU);
            const s = vel * this.cfg.jiggleGain;
            this.qd[0] += Math.cos(a) * s;
            this.qd[1] += Math.sin(a) * s;
            this.qd[2] += r.range(0.20, 0.45) * s;
            this.qd[3] += r.gauss(0, 0.35) * s;
            this.qd[4] += r.gauss(0, 0.35) * s;
            this.qd[5] += r.range(0.30, 0.60) * s;
            this.awake = true;
        }

        // 画面をクリックしてつつく。当たった点の位置と押した向きから配分する
        poke(px, py, pz, dx, dy, dz, vel, H, rTop) {
            const s = vel * this.cfg.jiggleGain;
            const sh = clamp(py / H, 0, 1);
            this.qd[0] += dx * s * (0.35 + 0.85 * sh);
            this.qd[1] += dz * s * (0.35 + 0.85 * sh);
            this.qd[2] += -dy * s * 0.55;
            const r = Math.hypot(px, pz);
            if (r > 1e-6) {
                const th = Math.atan2(pz, px);
                // 押した点が腹になるように位相を合わせる
                const amp = s * 0.55 * Math.hypot(dx, dz);
                this.qd[3] += -Math.cos(2 * th) * amp;
                this.qd[4] += -Math.sin(2 * th) * amp;
            }
            if (py > H * 0.80 && r < rTop) this.qd[5] += -dy * s * 0.9;
            this.awake = true;
        }

        step(dt) {
            const h = this.cfg.jiggleSub;
            // 力積は時間の刻みと無関係にそのまま速度へ入れる
            let any = 0;
            for (let k = 0; k < NMODE; k++) {
                if (this.imp[k] !== 0) { this.qd[k] += this.imp[k]; this.imp[k] = 0; any = 1; }
            }
            if (any) this.awake = true;
            this.acc += Math.min(dt, 0.05);
            let guard = 0, ran = 0;   // ran は内部ステップが回った回数（診断用）
            while (this.acc >= h && guard++ < 40) {
                for (let k = 0; k < NMODE; k++) {
                    const w = this.omega(k), z = this.zeta(k);
                    this.qd[k] += (-2 * z * w * this.qd[k] - w * w * this.q[k]) * h;
                    this.q[k] += this.qd[k] * h;
                }
                this.acc -= h;
                ran++;
            }
            void ran;

            let mq = 0, mqd = 0;
            for (let k = 0; k < NMODE; k++) {
                const aq = Math.abs(this.q[k]), ad = Math.abs(this.qd[k]);
                if (aq > mq) mq = aq;
                if (ad > mqd) mqd = ad;
            }
            this.peak = mq;
            const quiet = mq < this.cfg.quietQ && mqd < this.cfg.quietQd;
            if (quiet && this.awake) {
                // 完全に 0 へ落として、静止状態のメッシュを1回だけ書き戻す
                for (let k = 0; k < NMODE; k++) { this.q[k] = 0; this.qd[k] = 0; }
                this.awake = false;
                return true;      // 最後の1回は更新する
            }
            if (!quiet) this.awake = true;
            return this.awake;
        }

        // 【対策】モード形状は微小変形の 1 次近似なので、q を上げていくと
        //         体積が反転してメッシュが裏返る（縦モードは q = H で潰れきる）。
        //         振動子は線形のまま回して、表示へ渡すところだけ tanh で
        //         滑らかに頭打ちにする。実物のゲルも大ひずみでは硬くなるので、
        //         挙動としても外れていない
        current() {
            const mx = this.cfg.modeMax;
            for (let k = 0; k < NMODE; k++) {
                const m = mx ? mx[k] : 0;
                this.Q[k] = m > 0 ? m * Math.tanh(this.q[k] / m) : this.q[k];
            }
            return this.Q;
        }
    }

    // =================================================================
    // 6. TextureLab
    // =================================================================
    const TextureLab = {
        // 【対策】createImageData は整数しか受け付けない。設定値の消し忘れで
        //         undefined が来ると "Value is not of type 'long'" で落ちる
        _tex(name, w, h, fill, scene, opt) {
            w = Math.max(8, Math.round(w) || 512);
            h = Math.max(8, Math.round(h) || w);
            const dt = new BABYLON.DynamicTexture(name, { width: w, height: h }, scene, true);
            const ctx = dt.getContext();
            const img = ctx.createImageData(w, h);
            fill(img.data, w, h);
            ctx.putImageData(img, 0, 0);
            dt.update(false);
            dt.hasAlpha = false;
            dt.wrapU = BABYLON.Texture.WRAP_ADDRESSMODE;
            dt.wrapV = (opt && opt.clampV) ? BABYLON.Texture.CLAMP_ADDRESSMODE
                : BABYLON.Texture.WRAP_ADDRESSMODE;
            // 【対策】ORM と法線は「色」ではない。既定（gammaSpace = true）の
            //         ままだと粗さ 0.80 が線形 0.61 として渡り、狙いより光る
            if (opt && opt.linear) dt.gammaSpace = false;
            dt.anisotropicFilteringLevel = 8;
            return dt;
        },

        // 高さ場から法線マップ。3枚が同じ高さ場を参照するのが要点
        normalFromHeight(name, hf, w, h, strength, scene, opt) {
            return this._tex(name, w, h, (d) => {
                for (let y = 0; y < h; y++) {
                    const ym = ((y - 1) + h) % h, yp = (y + 1) % h;
                    for (let x = 0; x < w; x++) {
                        const xm = ((x - 1) + w) % w, xp = (x + 1) % w;
                        const dx = (hf[y * w + xp] - hf[y * w + xm]) * strength;
                        const dy = (hf[yp * w + x] - hf[ym * w + x]) * strength;
                        let nx = -dx, ny = -dy, nz = 1;
                        const l = Math.hypot(nx, ny, nz) || 1;
                        const i = (y * w + x) * 4;
                        d[i] = Math.round((nx / l * 0.5 + 0.5) * 255);
                        d[i + 1] = Math.round((ny / l * 0.5 + 0.5) * 255);
                        d[i + 2] = Math.round((nz / l * 0.5 + 0.5) * 255);
                        d[i + 3] = 255;
                    }
                }
            }, scene, Object.assign({ linear: true }, opt || {}));
        },

        // ---- カスタードの肌 ------------------------------------------
        // 型に接していた面なので、でこぼこで写実性を出す相手ではない。
        // 効くのはごく細かい肌理と、わずかな「す」（気泡跡）だけ。
        //
        // 【対策】ノイズを (x,z) の実寸で引くと、側面では半径がほとんど
        //         変わらないので座標が方位角しか運ばず、模様が高さ方向へ
        //         そのまま引き伸ばされる。結果、縦に伸びた黒い点が
        //         一面に並んで「ゴマを振った」ように見える。
        //         面上の距離、すなわち（周方向の弧長, 母線の弧長）で
        //         引かないといけない。周方向は整数周期で折り返して
        //         継ぎ目を消し、母線は cm で刻む
        custardFields(size, cfg, prof, seed) {
            const n = size * size;
            const F = { h: new Float32Array(n), pore: new Float32Array(n) };
            const seamY = cfg.H * 0.52;
            const arc = prof.arcLen, rRef = prof.maxR;
            // 周方向の分割数 P に対して、母線側の係数を合わせると等方になる
            const kOf = (P) => P / (TAU * rRef);
            const P_FINE = 192, P_MID = 64, P_PORE = 40, P_STREAK = 46;
            const kFine = kOf(P_FINE), kMid = kOf(P_MID), kPore = kOf(P_PORE), kSt = kOf(P_STREAK);
            const poreAmt = cfg.poreAmt;
            for (let y = 0; y < size; y++) {
                const v = y / size;
                const P = prof.at(v);
                const isSide = Math.abs(P.ny) < 0.72;
                // 【対策】極（r→0）へ寄ると周方向の座標が1点に潰れて
                //         放射状の星が出る。中心付近では周方向の寄与を落とす
                const polar = smooth(0.0, 0.55, P.r);
                const mvF = v * arc * kFine, mvM = v * arc * kMid;
                const mvP = v * arc * kPore, mvS = v * arc * kSt;
                for (let x = 0; x < size; x++) {
                    const u = x / size, i = y * size + x;

                    // 肌理。卵液が固まった面はごく細かい
                    const fine = Noise.fbm2u(u * P_FINE, mvF, P_FINE, seed + 5, 2);
                    const mid = Noise.fbm2u(u * P_MID, mvM, P_MID, seed + 17, 3);
                    let hgt = 0.52 + 0.045 * (fine - 0.5) * polar + 0.050 * (mid - 0.5) * polar;

                    // 「す」。気泡は焼成中に上へ集まるので、型の天井＝
                    // ひっくり返したあとの底寄りに多い。写真ではほとんど
                    // 見えないので、既定では影の気配が残る程度に留める
                    let pore = 0;
                    if (poreAmt > 0) {
                        const c = Noise.cell2(u * P_PORE, mvP, seed + 41, P_PORE);
                        const dens = mix(1.0, 0.30, smooth(0.10, 0.70, P.y / cfg.H));
                        const pit = (1 - smooth(0.10, 0.34, c[0])) * dens * polar;
                        pore = pit * (0.40 + 0.60 * Noise.v2u(u * P_PORE, mvP, P_PORE, seed + 61))
                            * poreAmt;
                    }
                    F.pore[i] = pore;
                    hgt -= 0.22 * pore;

                    // 型の合わせ目。側面の中ほどに一本だけ、ごく浅く
                    if (isSide) {
                        const d = Math.abs(P.y - seamY);
                        hgt -= 0.035 * Math.exp(-Math.pow(d / 0.045, 2));
                        // 型を抜いたときの縦の擦れ（こちらは高さ方向に伸びてよい）
                        const st = Noise.fbm2u(u * P_STREAK, mvS * 0.22, P_STREAK, seed + 71, 2) - 0.5;
                        hgt += 0.022 * st;
                    }
                    F.h[i] = hgt;
                }
            }
            return F;
        },

        // 【対策】アルベドテクスチャは頂点カラーに掛ける変調として使うので
        //         1.0 を超えない。ここで明るく振ると、染みで濃くした
        //         上端の色が白茶けて戻る
        custardAlbedo(size, F, scene) {
            return this._tex("purinAlb", size, size, (d) => {
                for (let i = 0; i < size * size; i++) {
                    const h = F.h[i], p = F.pore[i];
                    let k = 0.965 + 0.035 * (h - 0.52) / 0.12;
                    k *= 1 - 0.045 * p;                    // 気泡跡はわずかに影になる
                    k = clamp(k, 0.86, 1.0);
                    const o = i * 4;
                    d[o] = Math.round(k * 255);
                    d[o + 1] = Math.round(k * 0.998 * 255);
                    d[o + 2] = Math.round(k * 0.990 * 255);
                    d[o + 3] = 255;
                }
            }, scene, {});
        },

        // R = AO, G = roughness, B = metallic
        // 【対策】プリンの表面はつるつるだが、一様な粗さにすると
        //         「濡れたプラスチック」になる。気泡跡と肌理で散らす
        custardORM(size, F, scene) {
            return this._tex("purinORM", size, size, (d) => {
                for (let i = 0; i < size * size; i++) {
                    const h = F.h[i], p = F.pore[i];
                    const ao = clamp(1 - 0.16 * p, 0.80, 1);
                    // くぼみほど滑らか（水分が残る）
                    let rough = 0.235 + 0.075 * smooth(0.44, 0.62, h) + 0.055 * p;
                    rough = clamp(rough, 0.15, 0.42);
                    const o = i * 4;
                    d[o] = Math.round(ao * 255);
                    d[o + 1] = Math.round(rough * 255);
                    d[o + 2] = 0;
                    d[o + 3] = 255;
                }
            }, scene, { linear: true });
        },

        // subSurface の厚み。母線から実測した弦長をそのまま焼く。
        // v にしか依存しないので幅は 8 で足りる
        custardThickness(size, prof, scene) {
            const W = 8;
            return this._tex("purinThick", W, size, (d, w, h) => {
                for (let y = 0; y < h; y++) {
                    const t = clamp(prof.at(y / h).th / (prof.thMax || 1), 0, 1);
                    const g = Math.round(t * 255);
                    for (let x = 0; x < w; x++) {
                        const o = (y * w + x) * 4;
                        d[o] = 255; d[o + 1] = g; d[o + 2] = 0; d[o + 3] = 255;
                    }
                }
            }, scene, { linear: true, clampV: true });
        },

        // ---- カラメルの照り ------------------------------------------
        // 色は頂点に焼くので、ここは粗さと法線の微細な起伏だけ
        caramelFields(size, seed) {
            const n = size * size;
            const F = { h: new Float32Array(n) };
            for (let y = 0; y < size; y++) {
                for (let x = 0; x < size; x++) {
                    const u = x / size, v = y / size, i = y * size + x;
                    // 渦。上面のカラメルは流れた跡が残る
                    const a = Noise.fbm2u(u * 5, v * 3.2 + 3, 5, seed + 3, 3);
                    const b = Noise.fbm2u(u * 17, v * 11 + 9, 17, seed + 29, 2);
                    F.h[i] = 0.5 + 0.34 * (a - 0.5) + 0.10 * (b - 0.5);
                }
            }
            return F;
        },

        caramelORM(size, F, scene) {
            return this._tex("caramelORM", size, size, (d) => {
                for (let i = 0; i < size * size; i++) {
                    // 飴の面は鏡に近い。ただし一様にすると樹脂に見える
                    const rough = clamp(0.055 + 0.055 * F.h[i], 0.03, 0.16);
                    const o = i * 4;
                    d[o] = 255;
                    d[o + 1] = Math.round(rough * 255);
                    d[o + 2] = 0;
                    d[o + 3] = 255;
                }
            }, scene, { linear: true });
        },

        // ---- 白磁 ------------------------------------------------------
        porcelainFields(size, seed) {
            const n = size * size;
            const F = { h: new Float32Array(n), spec: new Float32Array(n) };
            for (let y = 0; y < size; y++) {
                for (let x = 0; x < size; x++) {
                    const u = x / size, v = y / size, i = y * size + x;
                    // 釉薬のうねり。ろくろ目ではなく、焼成でできる緩い波
                    const a = Noise.fbm2u(u * 9, v * 5 + 2, 9, seed + 7, 3);
                    const b = Noise.fbm2u(u * 40, v * 26 + 5, 40, seed + 23, 2);
                    F.h[i] = 0.5 + 0.30 * (a - 0.5) + 0.055 * (b - 0.5);
                    // ごく小さなピンホール（釉薬の気泡）
                    const c = Noise.v2(u * 220, v * 150, seed + 53);
                    F.spec[i] = smooth(0.975, 0.999, c);
                }
            }
            return F;
        },

        // ---- 布 --------------------------------------------------------
        // 【対策】白い布を白いまま置くと、皿も背景も同じ明度になって
        //         シルエットがまったく読めない（実際そうなった）。
        //         色は薄くても、皿との間に差が付くだけで写真になる
        cloth(scene, size, seed, col, contrast) {
            return this._tex("clothAlb", size, size, (d, w) => {
                for (let y = 0; y < w; y++) {
                    for (let x = 0; x < w; x++) {
                        const u = x / w, v = y / w, i = (y * w + x) * 4;
                        // 平織り。縦糸と横糸が交互に上に来る
                        const wu = 0.5 + 0.5 * Math.sin(u * w * 0.30);
                        const wv = 0.5 + 0.5 * Math.sin(v * w * 0.30);
                        const weave = 0.5 * (wu + wv);
                        const slub = Noise.fbm2u(u * 26, v * 26, 26, seed + 3, 3);
                        const dirt = Noise.fbm2u(u * 3.5, v * 3.5, 3.5, seed + 41, 3);
                        const k = clamp(1 + contrast * (0.9 * (weave - 0.5) * 2
                            + 0.9 * (slub - 0.5) - 1.0 * (dirt - 0.5)), 0.70, 1.14);
                        d[i] = Math.round(clamp(col[0] * k, 0, 1) * 255);
                        d[i + 1] = Math.round(clamp(col[1] * k, 0, 1) * 255);
                        d[i + 2] = Math.round(clamp(col[2] * k, 0, 1) * 255);
                        d[i + 3] = 255;
                    }
                }
            }, scene, {});
        },

        // ---- 木 --------------------------------------------------------
        // 【対策】年輪を sin(d) で描くと、等間隔・等濃度の縞になって
        //         段ボールにしか見えない。実物の年輪は 1 本ごとに幅も
        //         濃さも違う。輪の番号をハッシュして、幅・濃さ・位相を
        //         個別に振るだけで一気に木になる
        woodFields(size, seed, P) {
            const n = size * size, EXT = P.extent;
            const F = {
                h: new Float32Array(n), late: new Float32Array(n),
                plank: new Float32Array(n), pore: new Float32Array(n)
            };
            const hash1 = (i, s2) => Noise._h2(i | 0, 17, s2);
            for (let y = 0; y < size; y++) {
                const Z = y / size * EXT;
                for (let x = 0; x < size; x++) {
                    const X = x / size * EXT, i = y * size + x;
                    // 板取り。1 枚ごとに木取りの位置と色味が違う
                    const pi = Math.floor(Z / P.plankW);
                    const Zl = Z - pi * P.plankW;
                    const ph = hash1(pi, seed + 5);
                    const ctr = -P.ringCenter * (0.6 + 0.8 * hash1(pi, seed + 11));
                    // 年輪までの距離。X 方向に低周波でうねらせると
                    // 板目（キャセドラル）の山ができる
                    let dd = Math.abs(Zl - ctr) + ph * P.pitch;
                    dd += P.figure * (Noise.fbm2(X * 0.085 + pi * 13, 3.1, seed + 23, 3) - 0.5);
                    dd += P.figure * 0.35 * (Noise.fbm2(X * 0.30 + 7, Zl * 0.09, seed + 37, 2) - 0.5);
                    const t = dd / P.pitch;
                    const ri = Math.floor(t);
                    // 輪ごとの個性
                    const h1 = hash1(ri + pi * 977, seed + 53);
                    const h2 = hash1(ri + pi * 977, seed + 71);
                    const f = t - ri + 0.30 * (h1 - 0.5);
                    const lw = P.lateW * (0.50 + 1.00 * h1);
                    const late = smooth(1 - lw, 1 - lw * 0.22, clamp(f, 0, 1))
                        * (0.55 + 0.90 * h2);
                    F.late[i] = clamp(late, 0, 1);
                    // 繊維。X 方向に長く伸びる
                    const fib = Noise.fbm2(X * 3.2, Z * 46, seed + 89, 2) - 0.5;
                    // 導管（ポア）。早材側に多く、X 方向に伸びた点
                    const pn = Noise.v2(X * 2.6 + 31, Z * 62 + 3, seed + 101);
                    const pore = smooth(0.86, 0.99, pn) * (1 - F.late[i]) * P.pore;
                    F.pore[i] = pore;
                    // 板の継ぎ目
                    const seam = 1 - smooth(0.0, P.seamW, Math.min(Zl, P.plankW - Zl));
                    F.plank[i] = seam;
                    F.h[i] = 0.55 - 0.16 * F.late[i] + 0.05 * fib - 0.35 * pore - 0.45 * seam;
                }
            }
            return F;
        },

        wood(scene, size, seed, P) {
            const F = this.woodFields(size, seed, P);
            const alb = this._tex("tableAlb", size, size, (d, w, h) => {
                for (let i = 0; i < w * h; i++) {
                    const k = F.late[i];
                    let r = mix(P.early[0], P.late[0], k);
                    let g = mix(P.early[1], P.late[1], k);
                    let b = mix(P.early[2], P.late[2], k);
                    const sh = 1 - 0.30 * F.pore[i] - 0.45 * F.plank[i];
                    const o = i * 4;
                    d[o] = Math.round(clamp(r * sh, 0, 1) * 255);
                    d[o + 1] = Math.round(clamp(g * sh, 0, 1) * 255);
                    d[o + 2] = Math.round(clamp(b * sh, 0, 1) * 255);
                    d[o + 3] = 255;
                }
            }, scene, {});
            const orm = this._tex("tableORM", size, size, (d, w, h) => {
                for (let i = 0; i < w * h; i++) {
                    // 晩材は緻密で少しつやが出る。導管はざらつく
                    const rough = clamp(P.rough - 0.10 * F.late[i] + 0.16 * F.pore[i]
                        + 0.10 * F.plank[i], 0.18, 0.95);
                    const o = i * 4;
                    d[o] = Math.round(clamp(1 - 0.35 * F.plank[i] - 0.25 * F.pore[i], 0, 1) * 255);
                    d[o + 1] = Math.round(rough * 255);
                    d[o + 2] = 0; d[o + 3] = 255;
                }
            }, scene, { linear: true });
            const nrm = this.normalFromHeight("tableNrm", F.h, size, size, 2.2, scene, {});
            return { albedo: alb, orm: orm, normal: nrm };
        },

        // ---- 石（マットな面。皿を締めたいとき）--------------------------
        stone(scene, size, seed, col) {
            const F = { h: new Float32Array(size * size) };
            for (let y = 0; y < size; y++) {
                for (let x = 0; x < size; x++) {
                    const u = x / size, v = y / size, i = y * size + x;
                    const a = Noise.fbm2u(u * 7, v * 7, 7, seed + 3, 4);
                    const b = Noise.fbm2u(u * 38, v * 38, 38, seed + 19, 3);
                    F.h[i] = 0.5 + 0.34 * (a - 0.5) + 0.16 * (b - 0.5);
                }
            }
            const alb = this._tex("tableAlb", size, size, (d, w, h) => {
                for (let i = 0; i < w * h; i++) {
                    const k = 0.82 + 0.36 * (F.h[i] - 0.5);
                    const o = i * 4;
                    d[o] = Math.round(clamp(col[0] * k, 0, 1) * 255);
                    d[o + 1] = Math.round(clamp(col[1] * k, 0, 1) * 255);
                    d[o + 2] = Math.round(clamp(col[2] * k, 0, 1) * 255);
                    d[o + 3] = 255;
                }
            }, scene, {});
            const orm = this._tex("tableORM", size, size, (d, w, h) => {
                for (let i = 0; i < w * h; i++) {
                    const o = i * 4;
                    d[o] = 255;
                    d[o + 1] = Math.round(clamp(0.62 + 0.22 * (F.h[i] - 0.5), 0.3, 0.95) * 255);
                    d[o + 2] = 0; d[o + 3] = 255;
                }
            }, scene, { linear: true });
            const nrm = this.normalFromHeight("tableNrm", F.h, size, size, 1.1, scene, {});
            return { albedo: alb, orm: orm, normal: nrm };
        }
    };

    // =================================================================
    //  皿の絵付け（果実と葉）
    // =================================================================
    // 【対策】絵付けを UV 空間で描くと、極座標の歪みで中心寄りだけ
    //         引き伸ばされる。テクセルごとに (x,z) の実寸へ戻して、
    //         そこで図柄を評価する
    const PRINT_COL = {
        stem: [0.355, 0.275, 0.160],
        leafA: [0.400, 0.455, 0.235],   // 緑の葉
        leafB: [0.720, 0.455, 0.140],   // 色づいた葉
        leafC: [0.545, 0.215, 0.100],   // 赤く枯れた葉
        rib: [0.300, 0.240, 0.130],
        berryA: [0.870, 0.480, 0.165],
        berryB: [0.660, 0.200, 0.100]
    };

    function buildSprigs(cfg, seed) {
        const rng = new Rng(seed);
        const sprigs = [];
        const half = cfg.plateHalf;
        for (let s = 0; s < cfg.printSprigs; s++) {
            const a0 = (s / cfg.printSprigs) * TAU + rng.range(-0.30, 0.30) + 0.6;
            const rr = half * rng.range(0.60, 0.74);
            const cx = Math.cos(a0) * rr, cz = Math.sin(a0) * rr;
            // 枝はおおむね接線方向へ伸ばす
            const dir = a0 + Math.PI * 0.5 + rng.range(-0.55, 0.55);
            const len = rng.range(5.6, 8.4);
            const bend = rng.range(-1.5, 1.5);
            const P0 = [cx - Math.cos(dir) * len * 0.5, cz - Math.sin(dir) * len * 0.5];
            const P2 = [cx + Math.cos(dir) * len * 0.5, cz + Math.sin(dir) * len * 0.5];
            const nx = -Math.sin(dir), nz = Math.cos(dir);
            const P1 = [cx + nx * bend, cz + nz * bend];

            const leaves = [];
            const nLeaf = 5 + rng.int(3);
            for (let i = 0; i < nLeaf; i++) {
                const t = 0.14 + 0.80 * (i + rng.range(-0.16, 0.16)) / Math.max(1, nLeaf - 1);
                const side = (i % 2 === 0) ? 1 : -1;
                leaves.push({
                    t: clamp(t, 0.05, 0.98),
                    side: side,
                    len: rng.range(1.55, 2.75),
                    wid: rng.range(0.30, 0.44),
                    ang: rng.range(0.72, 1.20) * side,
                    tone: rng.next(),
                    curl: rng.range(-0.35, 0.35)
                });
            }
            const berries = [];
            const nB = 1 + rng.int(3);
            for (let i = 0; i < nB; i++) {
                const t = rng.range(0.02, 0.34);
                const off = rng.range(-0.85, 0.85);
                berries.push({ t: t, off: off, r: rng.range(0.52, 0.86), tone: rng.next() });
            }
            sprigs.push({ P0: P0, P1: P1, P2: P2, leaves: leaves, berries: berries });
        }
        return sprigs;
    }

    function bez(P0, P1, P2, t) {
        const m = 1 - t;
        return [m * m * P0[0] + 2 * m * t * P1[0] + t * t * P2[0],
        m * m * P0[1] + 2 * m * t * P1[1] + t * t * P2[1]];
    }
    function bezTan(P0, P1, P2, t) {
        const dx = 2 * (1 - t) * (P1[0] - P0[0]) + 2 * t * (P2[0] - P1[0]);
        const dz = 2 * (1 - t) * (P1[1] - P0[1]) + 2 * t * (P2[1] - P1[1]);
        const l = Math.hypot(dx, dz) || 1;
        return [dx / l, dz / l];
    }

    // 図柄を焼いておく。
    // 【対策】1024² のテクスチャで、テクセルごとに枝の 26 セグメントへの
    //         距離を測ると 7800万回の計算になり、皿1枚の焼き直しに 3.6 秒
    //         かかる。要素ごとの外接円と、図柄全体の矩形で早期棄却すると
    //         1/10 以下になる（絵柄は皿の縁寄りの帯にしか無い）
    function prepPrint(sprigs) {
        const items = [];
        for (const sp of sprigs) {
            const STEPS = 26;
            const pts = [];
            for (let k = 0; k <= STEPS; k++) pts.push(bez(sp.P0, sp.P1, sp.P2, k / STEPS));
            let sx0 = 1e9, sz0 = 1e9, sx1 = -1e9, sz1 = -1e9;
            for (const q of pts) {
                sx0 = Math.min(sx0, q[0]); sx1 = Math.max(sx1, q[0]);
                sz0 = Math.min(sz0, q[1]); sz1 = Math.max(sz1, q[1]);
            }
            const pad = 0.12;
            items.push({
                kind: "stem", pts: pts,
                bx0: sx0 - pad, bx1: sx1 + pad, bz0: sz0 - pad, bz1: sz1 + pad
            });
            for (const lf of sp.leaves) {
                const b = bez(sp.P0, sp.P1, sp.P2, lf.t);
                const tg = bezTan(sp.P0, sp.P1, sp.P2, lf.t);
                const ca = Math.cos(lf.ang), sa = Math.sin(lf.ang);
                const dx = tg[0] * ca - tg[1] * sa, dz = tg[0] * sa + tg[1] * ca;
                items.push({
                    kind: "leaf", ox: b[0], oz: b[1], dx: dx, dz: dz,
                    len: lf.len, wid: lf.wid, tone: lf.tone, curl: lf.curl,
                    cx: b[0] + dx * lf.len * 0.5, cz: b[1] + dz * lf.len * 0.5,
                    rad: lf.len * 0.62 + lf.wid
                });
            }
            for (const be of sp.berries) {
                const b = bez(sp.P0, sp.P1, sp.P2, be.t);
                const tg = bezTan(sp.P0, sp.P1, sp.P2, be.t);
                items.push({
                    kind: "berry", cx: b[0] - tg[1] * be.off, cz: b[1] + tg[0] * be.off,
                    r: be.r, tone: be.tone, rad: be.r * 1.15
                });
            }
        }
        // 図柄全体の外接矩形。ほとんどのテクセルはここで落ちる
        let X0 = 1e9, X1 = -1e9, Z0 = 1e9, Z1 = -1e9;
        for (const it of items) {
            const r = it.kind === "stem" ? 0 : (it.rad || it.r || 0);
            const x0 = it.kind === "stem" ? it.bx0 : it.cx - r;
            const x1 = it.kind === "stem" ? it.bx1 : it.cx + r;
            const z0 = it.kind === "stem" ? it.bz0 : it.cz - r;
            const z1 = it.kind === "stem" ? it.bz1 : it.cz + r;
            X0 = Math.min(X0, x0); X1 = Math.max(X1, x1);
            Z0 = Math.min(Z0, z0); Z1 = Math.max(Z1, z1);
        }
        items.bbox = [X0, X1, Z0, Z1];
        return items;
    }

    // (x,z) における図柄。out = [r, g, b, a]（sRGB）
    function printAt(items, x, z, out) {
        out[0] = 0; out[1] = 0; out[2] = 0; out[3] = 0;
        const bb = items.bbox;
        if (bb && (x < bb[0] || x > bb[1] || z < bb[2] || z > bb[3])) return 0;
        let ar = 0, ag = 0, ab = 0, aa = 0;
        for (const it of items) {
            if (it.kind === "stem") {
                if (x < it.bx0 || x > it.bx1 || z < it.bz0 || z > it.bz1) continue;
                let best = 1e9;
                for (let k = 0; k < it.pts.length - 1; k++) {
                    const ax = it.pts[k][0], az = it.pts[k][1];
                    const bx = it.pts[k + 1][0], bz = it.pts[k + 1][1];
                    const ex = bx - ax, ez = bz - az;
                    const ll = ex * ex + ez * ez || 1e-9;
                    let t = ((x - ax) * ex + (z - az) * ez) / ll;
                    t = clamp(t, 0, 1);
                    const qx = ax + ex * t - x, qz = az + ez * t - z;
                    const d = Math.hypot(qx, qz);
                    if (d < best) best = d;
                }
                const w = 0.075;
                const a = 1 - smooth(w * 0.65, w, best);
                if (a > 0.002) {
                    const c = PRINT_COL.stem;
                    ar = mix(ar, c[0], a); ag = mix(ag, c[1], a); ab = mix(ab, c[2], a);
                    aa = Math.max(aa, a);
                }
                continue;
            }
            const ddx = x - it.cx, ddz = z - it.cz;
            if (ddx * ddx + ddz * ddz > it.rad * it.rad) continue;

            if (it.kind === "berry") {
                const d = Math.hypot(ddx, ddz) / it.r;
                const a = 1 - smooth(0.90, 1.0, d);
                if (a <= 0.002) continue;
                // 中心から縁へ、橙 → 赤。ハイライトは左上に寄せる
                const g = clamp(d * 1.05, 0, 1);
                const hl = 1 - smooth(0.0, 0.55, Math.hypot(ddx / it.r + 0.30, ddz / it.r + 0.30));
                const cA = PRINT_COL.berryA, cB = PRINT_COL.berryB;
                let cr = mix(cA[0], cB[0], g), cg = mix(cA[1], cB[1], g), cb = mix(cA[2], cB[2], g);
                cr = mix(cr, 0.96, hl * 0.45); cg = mix(cg, 0.80, hl * 0.45); cb = mix(cb, 0.62, hl * 0.45);
                ar = mix(ar, cr, a); ag = mix(ag, cg, a); ab = mix(ab, cb, a);
                aa = Math.max(aa, a);
                continue;
            }

            // 葉。付け根を原点に、長さ方向 a、幅方向 b
            const lx = x - it.ox, lz = z - it.oz;
            let aa1 = (lx * it.dx + lz * it.dz) / it.len;
            let bb = (-lx * it.dz + lz * it.dx);
            if (aa1 < -0.02 || aa1 > 1.02) continue;
            // 反り
            bb -= it.curl * it.len * aa1 * (1 - aa1);
            const hw = it.wid * Math.pow(Math.max(0, Math.sin(Math.PI * clamp(aa1, 0, 1))), 0.62)
                * (1 - 0.32 * aa1);
            if (hw < 1e-4) continue;
            const q = Math.abs(bb) / hw;
            const a = (1 - smooth(0.86, 1.0, q))
                * (1 - smooth(0.94, 1.02, Math.abs(aa1 - 0.5) * 2));
            if (a <= 0.002) continue;
            // 先端ほど色づく
            const cA = PRINT_COL.leafA, cB = PRINT_COL.leafB, cC = PRINT_COL.leafC;
            const t1 = clamp(it.tone * 1.25 - 0.15 + aa1 * 0.55, 0, 1);
            let cr, cg, cb;
            if (t1 < 0.5) {
                const t2 = t1 * 2;
                cr = mix(cA[0], cB[0], t2); cg = mix(cA[1], cB[1], t2); cb = mix(cA[2], cB[2], t2);
            } else {
                const t2 = (t1 - 0.5) * 2;
                cr = mix(cB[0], cC[0], t2); cg = mix(cB[1], cC[1], t2); cb = mix(cB[2], cC[2], t2);
            }
            // 主脈と側脈
            const rib = 1 - smooth(0.045, 0.13, q);
            const vein = 1 - smooth(0.06, 0.16, Math.abs(frac(aa1 * 5.5 + q * 0.85) - 0.5));
            const dk = clamp(rib * 0.75 + vein * 0.30 * (1 - rib), 0, 1);
            const cr2 = mix(cr, PRINT_COL.rib[0], dk);
            const cg2 = mix(cg, PRINT_COL.rib[1], dk);
            const cb2 = mix(cb, PRINT_COL.rib[2], dk);
            ar = mix(ar, cr2, a); ag = mix(ag, cg2, a); ab = mix(ab, cb2, a);
            aa = Math.max(aa, a);
        }
        out[0] = ar; out[1] = ag; out[2] = ab; out[3] = aa;
        return aa;
    }

    // =================================================================
    // 7. Pudding （本体 ＋ カラメル）
    // =================================================================
    // カスタードのパレット（sRGB）。
    // 【対策】「クリーム色」だからと淡い色を広く置くと、いくら透光を足しても
    //         石膏の置物に見える。いちばん淡いところですでに卵色、という
    //         レンジに寄せて、上端はカラメルが染みた橙まで持っていく
    // 【実測】写真のカスタードを拾うと、明るい縁で linear(0.749, 0.446, 0.105)。
    //         白磁の照度 0.85 で割ると albedo は sRGB(0.95, 0.75, 0.38) 相当。
    //         青が想像よりずっと低い。ここを 0.73 のような値にすると、
    //         卵色ではなく「石膏に薄く色を付けたもの」になる
    // 写真の明るい部分 sRGB(224,178,91) から逆算すると albedo は
    // ほぼ (0.95, 0.76, 0.38)。上下方向の差はごくわずかで、暗く見えるのは
    // 天面の染みと、ソースに囲まれた裾のぶん
    // 【実測】3枚の明るい部分は sRGB(224,178,91) / (247,223,188) / (253,238,168)。
    //         白熱寄りの1枚目だけ極端に橙なので、残り2枚に寄せて
    //         linear の G/R ≈ 0.74、B/R ≈ 0.30 を狙う
    const CUSTARD = {
        pale: [0.945, 0.826, 0.530],   // 底寄り
        body: [0.955, 0.840, 0.550],   // 胴
        stain: [0.760, 0.480, 0.190]    // カラメルが染みたところ
    };

    // 膜厚 t（cm）の飴を往復で通したときの色。
    // 【対策】Beer–Lambert をそのまま掛けると暗くなりすぎて、
    //         薄い縁まで濁った茶になる。Saunderson の内部反射補正を
    //         入れると、薄いところが実物どおりの明るい橙に戻る
    function caramelColor(t, under, cfg, out) {
        const s = cfg.sigmaScale, Ri = cfg.internalRefl;
        const sc = cfg.caramelScatter;
        for (let c = 0; c < 3; c++) {
            const tr = Math.exp(-cfg.caramelSigma[c] * s * 2 * Math.max(0, t));
            const a = clamp(tr * under[c], 0, 1);
            const body = (1 - Ri) * a / Math.max(1e-6, 1 - Ri * a);
            // 多重散乱の底。光学的厚みとともに立ち上がるので (1 − 透過率) を掛ける。
            // t = 0 では消えるから、膜が無いところは下地そのものに戻る
            out[c] = clamp(body + sc[c] * (1 - tr), 0, 1);
        }
        return out;
    }

    // カラメルが染みて流れた跡。
    // 【対策】写真の側面に見える茶色い筋は、盛り上がった飴ではなく
    //         カスタードに染みた色。幾何で出すと厚みのある帯になって
    //         チョコがけに見えるので、頂点カラーで描く
    function makeRunSoak(cfg, seed) {
        const rng = new Rng(seed);
        const runs = [];
        const a0 = rng.range(0, TAU);
        for (let i = 0; i < cfg.stainRuns; i++) {
            runs.push({
                a: a0 + i * 2.39996 + rng.range(-0.30, 0.30),
                w: rng.range(0.22, 0.58),
                end: rng.range(0.15, 2.30),     // どこまで流れ落ちたか
                amp: rng.range(0.45, 1.00)
            });
        }
        return function (theta, y) {
            let v = 0;
            for (const r of runs) {
                let da = theta - r.a;
                while (da > Math.PI) da -= TAU;
                while (da < -Math.PI) da += TAU;
                const lobe = Math.exp(-Math.pow(Math.abs(da) / r.w, 1.5));
                v += r.amp * lobe * smooth(r.end, r.end + 1.15, y);
            }
            // 縁を滲ませる。まっすぐな帯だと転写シールに見える
            v *= 0.80 + 0.40 * Noise.angFbm(theta / TAU, 11, seed + 13, 3);
            return clamp(v, 0, 1);
        };
    }

    // 高さ y と方位における、カスタードのリニア色
    function custardLinear(y, cfg, mott, soak, out) {
        const t = smooth(0, cfg.H * 1.05, y);
        // 天面のふちから下へ染みるぶん
        const edge = smooth(cfg.H - cfg.stainDepth, cfg.H - 0.10, y);
        // 流れ落ちた跡
        const run = clamp((soak || 0) * cfg.runStain, 0, 1);
        const st = clamp(1 - (1 - edge) * (1 - run), 0, 1);
        // 【対策】ソースに囲まれた裾は、写真ではっきり沈んでいる。
        //         全体を均一の卵色にすると、円錐台に色を塗った物に見える
        const foot = 1 - 0.14 * smooth(1.50, 0.05, y);
        for (let c = 0; c < 3; c++) {
            let v = mix(CUSTARD.pale[c], CUSTARD.body[c], t * 0.86);
            v = mix(v, CUSTARD.stain[c], st * 0.90);
            out[c] = lin(clamp(v * mott * foot, 0, 1));
        }
        return out;
    }

    // 垂れの前縁。周方向の関数として持つ（各方位で v は連続区間になるので、
    // 等高線を切り出す必要がなく、格子がそのまま使える）
    // 【対策】被覆の境界を「格子のマス目を出すか出さないか」で決めると、
    //         周 104 分割では 1mm 近い階段が出る。前縁を θ の関数にして
    //         行をその範囲で刻み直せば、境界は解析的に滑らかになる
    function makeDripFront(cfg, prof, seed) {
        const rng = new Rng(seed);
        const drips = [];
        const n = cfg.dripCount;
        const a0 = rng.range(0, TAU);
        // 1本だけ皿まで届かせる。写真でもソースへ流れ込むのは1本
        for (let i = 0; i < n; i++) {
            const long = (i === 0);
            const mid = (i === 1);
            drips.push({
                a: a0 + i * 2.39996 + rng.range(-0.25, 0.25),
                w: long ? rng.range(0.22, 0.30) : (mid ? rng.range(0.17, 0.24) : rng.range(0.11, 0.18)),
                d: long ? rng.range(1.25, 1.70) : (mid ? rng.range(0.55, 0.90) : rng.range(0.20, 0.50))
            });
        }
        const yBase = cfg.H - cfg.caramelBase;
        return {
            drips: drips,
            yAt(theta) {
                let y = yBase;
                for (const d of drips) {
                    let da = theta - d.a;
                    while (da > Math.PI) da -= TAU;
                    while (da < -Math.PI) da += TAU;
                    y -= d.d * Math.exp(-Math.pow(Math.abs(da) / d.w, 1.6));
                }
                y += 0.055 * (Noise.angFbm(theta / TAU, 9, seed + 17, 3) - 0.5) * 2;
                return clamp(y, 0.11, cfg.H - 0.10);
            }
        };
    }

    class Pudding {
        constructor(scene, cfg, prof, dev, seed, mats) {
            this.scene = scene; this.cfg = cfg; this.prof = prof; this.dev = dev;
            this.seed = seed;
            this.front = makeDripFront(cfg, prof, seed + 313);
            this.soak = makeRunSoak(cfg, seed + 577);
            this.body = this._buildBody(mats);
            this.coat = this._buildCoat(mats);
            this.coat.parent = this.body;
            this.tris = (this.body.getTotalIndices() + this.coat.getTotalIndices()) / 3;
        }

        // 表面点。本体もカラメルも必ずこれを通す（食い違うと隙間が開く）
        surf(v, theta, out) {
            const P = this.prof.at(v);
            const k = this.dev(theta, P.y);
            const r = P.r * k;
            out.r = r; out.y = P.y;
            out.x = Math.cos(theta) * r; out.z = Math.sin(theta) * r;
            const nl = Math.hypot(P.nr, P.ny) || 1;
            out.nr = P.nr / nl; out.ny = P.ny / nl;
            out.nx = Math.cos(theta) * out.nr; out.nz = Math.sin(theta) * out.nr;
            out.th = P.th;
            return out;
        }

        _buildBody(mats) {
            const cfg = this.cfg, N = cfg.segAxis, M = cfg.segRound;
            const W = M + 1;                       // 周は継ぎ目で1点重ねる
            const total = N * W + 2;
            const positions = new Float32Array(total * 3);
            const uvs = new Float32Array(total * 2);
            const colors = new Float32Array(total * 4);
            const S = {}, col = [0, 0, 0];
            const rng = new Rng(this.seed + 7);
            const mottSeed = this.seed + 91;

            for (let i = 0; i < N; i++) {
                const v = mix(0.0035, 0.9965, i / (N - 1));
                for (let j = 0; j <= M; j++) {
                    const theta = (j % M) / M * TAU;
                    this.surf(v, theta, S);
                    const k = i * W + j;
                    positions[k * 3] = S.x; positions[k * 3 + 1] = S.y; positions[k * 3 + 2] = S.z;
                    uvs[k * 2] = j / M; uvs[k * 2 + 1] = v;
                    const mott = 0.985 + 0.030 * (Noise.fbm2(S.x * 1.35 + 5, S.z * 1.35 + 9, mottSeed, 3) - 0.5);
                    custardLinear(S.y, cfg, mott, this.soak(theta, S.y), col);
                    colors[k * 4] = col[0]; colors[k * 4 + 1] = col[1];
                    colors[k * 4 + 2] = col[2]; colors[k * 4 + 3] = 1;
                }
            }
            // 上下のキャップ中心
            const capA = N * W, capB = N * W + 1;
            const Ptop = this.prof.at(0), Pbot = this.prof.at(1);
            positions[capA * 3] = 0; positions[capA * 3 + 1] = Ptop.y; positions[capA * 3 + 2] = 0;
            positions[capB * 3] = 0; positions[capB * 3 + 1] = Pbot.y; positions[capB * 3 + 2] = 0;
            uvs[capA * 2] = 0.5; uvs[capA * 2 + 1] = 0;
            uvs[capB * 2] = 0.5; uvs[capB * 2 + 1] = 1;
            custardLinear(Ptop.y, cfg, 1, 1, col);
            colors[capA * 4] = col[0]; colors[capA * 4 + 1] = col[1]; colors[capA * 4 + 2] = col[2]; colors[capA * 4 + 3] = 1;
            custardLinear(Pbot.y, cfg, 1, 0, col);
            colors[capB * 4] = col[0]; colors[capB * 4 + 1] = col[1]; colors[capB * 4 + 2] = col[2]; colors[capB * 4 + 3] = 1;

            const indices = [];
            for (let i = 0; i < N - 1; i++) for (let j = 0; j < M; j++) {
                const A = i * W + j, B = A + 1, C = A + W, D = C + 1;
                indices.push(A, C, B, B, C, D);
            }
            // 【対策】両端のキャップは側面と巻き順を揃える。逆だと
            //         ComputeNormals が端のリングで外向きと内向きの面法線を
            //         足し合わせ、頂点法線が裏返って「中が見える」
            for (let j = 0; j < M; j++) indices.push(capA, j, j + 1);
            const o = (N - 1) * W;
            for (let j = 0; j < M; j++) indices.push(capB, o + j + 1, o + j);

            const normals = finalize(positions, indices);
            weldNormals(positions, normals);
            const mesh = makeMesh("purinBody", positions, indices, normals, uvs, colors, this.scene, true);
            mesh.material = mats.custard;
            mesh.receiveShadows = true;
            this._windScore = finalize.lastScore;
            void rng;
            return mesh;
        }

        // カラメルの膜厚。上面は「水平な液面」、側面は「垂れ」
        coatThickness(v, theta, S, yFront) {
            const cfg = this.cfg;
            const yLevel = cfg.H + cfg.capRise;
            // 上向きの度合い。縁の丸めで滑らかに側面へ渡す
            const wTop = smooth(0.55, 0.95, S.ny);
            // --- 上面の池 ---
            const swirl = cfg.swirl * (Noise.fbm2(S.x * 2.6 + 3, S.z * 2.6 + 7, this.seed + 131, 3) - 0.5) * 2;
            const pool = Math.max(cfg.filmMin, yLevel - S.y + swirl);
            // --- 側面の膜 ---
            const db = S.y - yFront;                        // 前縁からの距離
            let film = mix(cfg.rimFilm, cfg.dripFilm, smooth(cfg.H - 0.16, cfg.H - 1.05, S.y));
            // 表面張力で前縁に玉ができる
            film += cfg.dripBead * Math.exp(-Math.pow((db - 0.11) / cfg.dripBeadW, 2));
            // 【対策】前縁で厚みを持ったまま切ると、そこに 0.5mm の段が
            //         見えて塗装に見える。最後だけ本体へ落として殻を閉じる
            // 【対策】前縁を 0 まで落とすと本体と同一面になって、深度の
            //         勝ち負けでちらつく。0.2mm 残す。この段差は 30cm 先で
            //         1px 未満なので見えない
            film = film * smooth(0.0, 0.050, db) + 0.020;
            return mix(film, pool, wTop);
        }

        _buildCoat(mats) {
            const cfg = this.cfg, K = cfg.segCaramel, M = cfg.segRound;
            const W = M + 1;
            const total = K * W + 1;
            const positions = new Float32Array(total * 3);
            const refN = new Float32Array(total * 3);
            const uvs = new Float32Array(total * 2);
            const colors = new Float32Array(total * 4);
            const S = {}, under = [0, 0, 0], col = [0, 0, 0];
            const vF = new Float64Array(W), yF = new Float64Array(W);
            for (let j = 0; j <= M; j++) {
                const theta = (j % M) / M * TAU;
                yF[j] = this.front.yAt(theta);
                vF[j] = this.prof.vAtY(yF[j]);
            }

            for (let i = 0; i < K; i++) {
                const a = i / (K - 1);
                // 前縁に行を寄せる（玉とテーパーに解像度が要る）
                const f = 1 - Math.pow(1 - a, 1.28);
                for (let j = 0; j <= M; j++) {
                    const theta = (j % M) / M * TAU;
                    const v = mix(0.0040, vF[j], f);
                    this.surf(v, theta, S);
                    const t = this.coatThickness(v, theta, S, yF[j]);
                    const k = i * W + j;
                    positions[k * 3] = S.x + S.nx * t;
                    positions[k * 3 + 1] = S.y + S.ny * t;
                    positions[k * 3 + 2] = S.z + S.nz * t;
                    refN[k * 3] = S.nx; refN[k * 3 + 1] = S.ny; refN[k * 3 + 2] = S.nz;
                    uvs[k * 2] = j / M; uvs[k * 2 + 1] = a;
                    custardLinear(S.y, cfg, 1, this.soak(theta, S.y), under);
                    caramelColor(t, under, cfg, col);
                    colors[k * 4] = col[0]; colors[k * 4 + 1] = col[1];
                    colors[k * 4 + 2] = col[2]; colors[k * 4 + 3] = 1;
                }
            }
            // 天面中心のキャップ
            const cap = K * W;
            const Ptop = this.prof.at(0);
            const tc = Math.max(cfg.filmMin, cfg.H + cfg.capRise - Ptop.y);
            positions[cap * 3] = 0; positions[cap * 3 + 1] = Ptop.y + tc; positions[cap * 3 + 2] = 0;
            refN[cap * 3] = 0; refN[cap * 3 + 1] = 1; refN[cap * 3 + 2] = 0;
            uvs[cap * 2] = 0.5; uvs[cap * 2 + 1] = 0;
            custardLinear(Ptop.y, cfg, 1, 1, under);
            caramelColor(tc, under, cfg, col);
            colors[cap * 4] = col[0]; colors[cap * 4 + 1] = col[1];
            colors[cap * 4 + 2] = col[2]; colors[cap * 4 + 3] = 1;

            const indices = [];
            for (let i = 0; i < K - 1; i++) for (let j = 0; j < M; j++) {
                const A = i * W + j, B = A + 1, C = A + W, D = C + 1;
                indices.push(A, C, B, B, C, D);
            }
            for (let j = 0; j < M; j++) indices.push(cap, j, j + 1);

            // 【対策】カラメル層は縁のある開いた面なので、重心基準の
            //         巻き順判定が効かない。本体の外向き法線を参照にする
            const normals = finalizeOpen(positions, indices, refN);
            weldNormals(positions, normals);
            const mesh = makeMesh("purinCoat", positions, indices, normals, uvs, colors, this.scene, true);
            mesh.material = mats.caramel;
            mesh.receiveShadows = true;
            this._coatVF = vF;
            this._coatYF = yF;
            return mesh;
        }

        // 本体の色だけ焼き直す（GUI で染みの濃さを変えたとき）
        rebakeBody() {
            const cfg = this.cfg, N = cfg.segAxis, M = cfg.segRound, W = M + 1;
            const colors = this.body.getVerticesData(BABYLON.VertexBuffer.ColorKind);
            const S = {}, col = [0, 0, 0];
            const mottSeed = this.seed + 91;
            for (let i = 0; i < N; i++) {
                const v = mix(0.0035, 0.9965, i / (N - 1));
                for (let j = 0; j <= M; j++) {
                    const theta = (j % M) / M * TAU;
                    this.surf(v, theta, S);
                    const mott = 0.985 + 0.030 * (Noise.fbm2(S.x * 1.35 + 5, S.z * 1.35 + 9, mottSeed, 3) - 0.5);
                    custardLinear(S.y, cfg, mott, this.soak(theta, S.y), col);
                    const k = i * W + j;
                    colors[k * 4] = col[0]; colors[k * 4 + 1] = col[1]; colors[k * 4 + 2] = col[2];
                }
            }
            this.body.updateVerticesData(BABYLON.VertexBuffer.ColorKind, colors, false, false);
            this.body.hasVertexAlpha = false;
        }

        // カラメルの色だけ焼き直す（GUI で濃さを変えたとき）
        rebakeCaramel() {
            const cfg = this.cfg, K = cfg.segCaramel, M = cfg.segRound, W = M + 1;
            const colors = this.coat.getVerticesData(BABYLON.VertexBuffer.ColorKind);
            const S = {}, under = [0, 0, 0], col = [0, 0, 0];
            for (let i = 0; i < K; i++) {
                const a = i / (K - 1), f = 1 - Math.pow(1 - a, 1.28);
                for (let j = 0; j <= M; j++) {
                    const theta = (j % M) / M * TAU;
                    const v = mix(0.0040, this._coatVF[j], f);
                    this.surf(v, theta, S);
                    const t = this.coatThickness(v, theta, S, this._coatYF[j]);
                    custardLinear(S.y, cfg, 1, this.soak(theta, S.y), under);
                    caramelColor(t, under, cfg, col);
                    const k = i * W + j;
                    colors[k * 4] = col[0]; colors[k * 4 + 1] = col[1]; colors[k * 4 + 2] = col[2];
                }
            }
            const cap = K * W, Ptop = this.prof.at(0);
            const tc = Math.max(cfg.filmMin, cfg.H + cfg.capRise - Ptop.y);
            custardLinear(Ptop.y, cfg, 1, 1, under);
            caramelColor(tc, under, cfg, col);
            colors[cap * 4] = col[0]; colors[cap * 4 + 1] = col[1]; colors[cap * 4 + 2] = col[2];
            this.coat.updateVerticesData(BABYLON.VertexBuffer.ColorKind, colors, false, false);
            this.coat.hasVertexAlpha = false;
        }

        // 【対策】表示用メッシュは 8千頂点ある。これをそのまま
        //         PhysicsShapeConvexHull に渡すと生成のたびに固まる。
        //         同じ母線を低解像度で評価した代理から凸包を取って捨てる
        hullShape(scene) {
            const cfg = this.cfg, N = cfg.hullSegV, M = cfg.hullSegA;
            const pos = [];
            for (let i = 0; i < N; i++) {
                const v = mix(0.004, 0.996, i / (N - 1));
                const P = this.prof.at(v);
                for (let j = 0; j < M; j++) {
                    const th = j / M * TAU;
                    pos.push(Math.cos(th) * P.r, P.y, Math.sin(th) * P.r);
                }
            }
            const proxy = new BABYLON.Mesh("purinHullProxy", scene);
            proxy.id = "purinHullProxy";
            const vd = new BABYLON.VertexData();
            vd.positions = pos;
            // 凸包は点群だけ見るので、面はダミーで足りる
            const idx = [];
            for (let i = 0; i < N - 1; i++) for (let j = 0; j < M; j++) {
                const A = i * M + j, B = i * M + (j + 1) % M, C = A + M, D = B + M;
                idx.push(A, C, B, B, C, D);
            }
            vd.indices = idx;
            vd.applyToMesh(proxy, false);
            const shape = new BABYLON.PhysicsShapeConvexHull(proxy, scene);
            proxy.dispose();
            return shape;
        }

        dispose() { this.coat.dispose(); this.body.dispose(); }
    }

    // =================================================================
    // 8. Sauce （皿の上のカラメル溜まり）
    // =================================================================
    // 【対策】ソースを「濃い茶色の板」で置くと一気に嘘になる。実物は
    //         0.5mm の膜で、白磁を透かして見ているだけ。厚みから色を
    //         引けば、薄い外縁が明るい橙、プリンの裾が赤黒、という
    //         写真どおりの分布が自動的に出る
    function buildSauce(scene, cfg, prof, seed, mat, cx, cz, under) {
        const rng = new Rng(seed);
        const NR = cfg.sauceSegR, MA = cfg.sauceSegA, W = MA + 1;
        const amt = cfg.sauceAmt;
        // プリンが皿に触れているところの半径
        const rContact = prof.at(prof.vAtY(0.05)).r;
        const rin = Math.max(0.4, rContact - 0.36);

        // 【対策】皿の見込みは半径 plateHalf × plateWellS までしか平らでなく、
        //         その外は縁が立ち上がる。溜まりをそこより広げると、水平な
        //         ソースのメッシュが縁の内側へ潜って外周が消え、境目で
        //         深度が勝ち負けする。実物も同じで、流れたソースは
        //         立ち上がりに当たって止まる。見込みの内側で頭打ちにする
        const Rmax = cfg.plateHalf * cfg.plateWellS - 0.30;
        const baseR = Math.min(cfg.sauceR * (0.62 + 0.55 * amt), Rmax * 0.92);
        const Rout = new Float64Array(W);
        for (let j = 0; j <= MA; j++) {
            const th = (j % MA) / MA * TAU;
            const u = th / TAU;
            // 多周波でうねらせる。単一周波数だと歯車になる
            const n1 = Noise.angFbm(u, 3, seed + 5, 3) - 0.5;
            const n2 = Noise.angFbm(u, 9, seed + 29, 2) - 0.5;
            const R = baseR * (1 + cfg.sauceLobe * (n1 * 1.5 + n2 * 0.55));
            Rout[j] = clamp(R, rin + 0.55, Rmax);
        }

        const total = NR * W;
        const positions = new Float32Array(total * 3);
        const uvs = new Float32Array(total * 2);
        const colors = new Float32Array(total * 4);
        // 【対策】ソースは皿を透かして見ているだけなので、下地は
        //         いま敷いてある皿の色そのもの。白磁で固定すると、
        //         灰の皿に載せたときだけソースが浮いて明るく見える
        const uL = [lin(under[0]), lin(under[1]), lin(under[2])];
        const col = [0, 0, 0];
        // 【対策】GUI で濃さを変えるたびにメッシュを作り直すと、ドラッグ中に
        //         毎フレーム 5千頂点を生成して固まる。厚みだけ持っておけば
        //         色の焼き直しは頂点カラーの書き換えで済む
        const hArr = new Float32Array(total);
        let hMax = 0;

        for (let i = 0; i < NR; i++) {
            // 両端（内側のメニスカスと外縁）に点を寄せる
            const t = 0.5 - 0.5 * Math.cos(Math.PI * i / (NR - 1));
            for (let j = 0; j <= MA; j++) {
                const th = (j % MA) / MA * TAU;
                const R = Rout[j], L = R - rin;
                const r = mix(rin, R, t);
                const dIn = r - rin, dOut = R - r;
                // バルク ＋ 裾を這い上がるメニスカス ＋ 外縁のふくらみ
                let h = cfg.sauceH0 * (0.85 + 0.30 * (Noise.fbm2(
                    (cx + Math.cos(th) * r) * 1.5 + 11,
                    (cz + Math.sin(th) * r) * 1.5 + 3, seed + 61, 3) - 0.5) * 2);
                h += cfg.sauceClimb * Math.exp(-Math.pow(dIn / 0.55, 2));
                h += cfg.sauceEdge * Math.exp(-Math.pow(dOut / (L * 0.10 + 0.10), 2));
                // 端は接触角ぶんだけ薄く落ちる。ここが淡い橙のフリンジになる
                h *= 1 - smooth(0.94, 1.0, t);
                h = Math.max(h, cfg.sauceMin);
                if (h > hMax) hMax = h;

                const k = i * W + j;
                hArr[k] = h;
                positions[k * 3] = cx + Math.cos(th) * r;
                positions[k * 3 + 1] = h;
                positions[k * 3 + 2] = cz + Math.sin(th) * r;
                uvs[k * 2] = j / MA; uvs[k * 2 + 1] = t;
                caramelColor(h, uL, cfg, col);
                colors[k * 4] = col[0]; colors[k * 4 + 1] = col[1];
                colors[k * 4 + 2] = col[2]; colors[k * 4 + 3] = 1;
            }
        }
        const indices = [];
        for (let i = 0; i < NR - 1; i++) for (let j = 0; j < MA; j++) {
            const A = i * W + j, B = A + 1, C = A + W, D = C + 1;
            indices.push(A, C, B, B, C, D);
        }
        const refN = new Float32Array(total * 3);
        for (let i = 0; i < total; i++) refN[i * 3 + 1] = 1;
        const normals = finalizeOpen(positions, indices, refN);
        weldNormals(positions, normals);
        const mesh = makeMesh("caramelSauce", positions, indices, normals, uvs, colors, scene, true);
        mesh.__cfg = cfg;
        mesh.material = mat;
        mesh.receiveShadows = true;
        mesh.hMax = hMax;
        mesh.rin = rin;
        mesh.hArr = hArr;
        mesh.__under = under;
        return mesh;
    }

    // 膜厚は変わらないので、色だけ焼き直す
    function rebakeSauceColors(mesh) {
        if (!mesh || !mesh.hArr) return;
        const cfg = mesh.__cfg;
        const colors = mesh.getVerticesData(BABYLON.VertexBuffer.ColorKind);
        const u = mesh.__under || [0.888, 0.897, 0.908];
        const under = [lin(u[0]), lin(u[1]), lin(u[2])];
        const col = [0, 0, 0];
        const n = mesh.hArr.length;
        for (let i = 0; i < n; i++) {
            caramelColor(mesh.hArr[i], under, cfg, col);
            colors[i * 4] = col[0]; colors[i * 4 + 1] = col[1]; colors[i * 4 + 2] = col[2];
        }
        mesh.updateVerticesData(BABYLON.VertexBuffer.ColorKind, colors, false, false);
        mesh.hasVertexAlpha = false;
    }

    // 飛び散った小さな滴。写真でも溜まりの外に3〜6粒ある
    function buildDroplets(scene, cfg, seed, mat, cx, cz, avoidR, under) {
        const rng = new Rng(seed ^ 0x2f19);
        const NA = 16, NRr = 6;
        const positions = [], indices = [], colors = [], uvs = [];
        const uL = [lin(under[0]), lin(under[1]), lin(under[2])];
        const col = [0, 0, 0];
        const hList = [];
        let base = 0;
        for (let d = 0; d < cfg.dropletN; d++) {
            const a = rng.range(0, TAU);
            const rr = Math.min(avoidR + rng.range(0.35, 1.9),
                cfg.plateHalf * cfg.plateWellS - 0.45);
            const ox = cx + Math.cos(a) * rr, oz = cz + Math.sin(a) * rr;
            const rad = rng.range(0.16, 0.42);
            const hh = rng.range(0.026, 0.055) * (0.6 + 0.9 * rad);
            const sq = rng.range(0.78, 1.0);       // 少しつぶれた楕円にする
            const sa = rng.range(0, TAU);
            for (let i = 0; i < NRr; i++) {
                const t = i / (NRr - 1);
                for (let j = 0; j <= NA; j++) {
                    const th = (j % NA) / NA * TAU;
                    const lx = Math.cos(th) * rad * t, lz = Math.sin(th) * rad * t * sq;
                    const px = ox + lx * Math.cos(sa) - lz * Math.sin(sa);
                    const pz = oz + lx * Math.sin(sa) + lz * Math.cos(sa);
                    const h = Math.max(cfg.sauceMin, hh * Math.pow(Math.max(0, 1 - t * t), 0.55));
                    positions.push(px, h, pz);
                    hList.push(h);
                    uvs.push(j / NA, t);
                    caramelColor(h, uL, cfg, col);
                    colors.push(col[0], col[1], col[2], 1);
                }
            }
            const W = NA + 1;
            for (let i = 0; i < NRr - 1; i++) for (let j = 0; j < NA; j++) {
                const A = base + i * W + j, B = A + 1, C = A + W, D = C + 1;
                indices.push(A, C, B, B, C, D);
            }
            base += NRr * W;
        }
        if (!positions.length) return null;
        const pos = new Float32Array(positions);
        const refN = new Float32Array(pos.length);
        for (let i = 0; i < pos.length / 3; i++) refN[i * 3 + 1] = 1;
        const normals = finalizeOpen(pos, indices, refN);
        weldNormals(pos, normals);
        const mesh = makeMesh("caramelDrops", pos, indices, normals,
            new Float32Array(uvs), new Float32Array(colors), scene, true);
        mesh.hArr = new Float32Array(hList);
        mesh.__under = under;
        mesh.__cfg = cfg;
        mesh.material = mat;
        mesh.receiveShadows = true;
        return mesh;
    }

    // =================================================================
    // 9. Plate （角丸スクエアの白磁皿）
    // =================================================================
    // 【対策】物理の当たり判定に薄い一枚板を使うと、落下速度によっては
    //         すり抜ける。表と裏を張って縁で閉じた「厚みのある器」に
    //         しておけば、静的トライメッシュでも安定して受け止められる
    function plateOutline(theta, n) {
        const ca = Math.abs(Math.cos(theta)), sa = Math.abs(Math.sin(theta));
        return 1 / Math.pow(Math.pow(ca, n) + Math.pow(sa, n), 1 / n);
    }

    function buildPlate(scene, cfg, mat) {
        const M = cfg.plateSegA, K = cfg.plateSegR;
        const HALF = cfg.plateHalf, TH = cfg.plateThick;
        const wellS = cfg.plateWellS, LIP = cfg.plateLip;

        const prof = (s) => {
            // 平らな見込み → 立ち上がり → 平たい縁 → 最後にわずかに反る
            const y = LIP * smooth(wellS, wellS + 0.33, s) * 0.86
                + LIP * 0.14 * smooth(0.90, 1.0, s);
            return y;
        };
        const pslope = (s) => {
            const e = 2e-3;
            return (prof(Math.min(1, s + e)) - prof(Math.max(0, s - e))) / (2 * e);
        };

        const W = M + 1, LAY = (K + 1) * W, total = LAY * 2;
        const positions = new Float32Array(total * 3);
        const uvs = new Float32Array(total * 2);
        for (let i = 0; i <= K; i++) {
            const s = i / K;
            const y0 = prof(s), dy = pslope(s);
            for (let j = 0; j <= M; j++) {
                const theta = (j % M) / M * TAU;
                const ro = plateOutline(theta, cfg.plateN) * HALF;
                const r = ro * s;
                // 角がわずかに反る。完全な平面だと工業製品に見える
                const lift = cfg.plateCorner * (0.5 - 0.5 * Math.cos(4 * theta)) * smooth(0.52, 1.0, s);
                const y = y0 + lift;
                // 断面の法線（半径方向 ro に対する勾配なので dy/dr = dy/ds / ro）
                const g = dy / Math.max(1e-6, ro);
                const nl = Math.hypot(1, g) || 1;
                const nr = -g / nl, ny = 1 / nl;
                const cs = Math.cos(theta), sn = Math.sin(theta);
                const a = i * W + j, b = LAY + a;
                positions[a * 3] = r * cs; positions[a * 3 + 1] = y; positions[a * 3 + 2] = r * sn;
                const ro2 = r - nr * TH, yo = y - ny * TH;
                positions[b * 3] = ro2 * cs; positions[b * 3 + 1] = yo; positions[b * 3 + 2] = ro2 * sn;
                uvs[a * 2] = j / M; uvs[a * 2 + 1] = s;
                uvs[b * 2] = j / M; uvs[b * 2 + 1] = s;
            }
        }
        const indices = [];
        for (let i = 0; i < K; i++) for (let j = 0; j < M; j++) {
            const A = i * W + j, B = A + 1, C = A + W, D = C + 1;
            indices.push(A, C, B, B, C, D);
            indices.push(LAY + A, LAY + B, LAY + C, LAY + B, LAY + D, LAY + C);
        }
        for (let j = 0; j < M; j++) {
            const o0 = K * W + j, o1 = o0 + 1;
            indices.push(o0, LAY + o0, o1, o1, LAY + o0, LAY + o1);
        }
        const normals = finalize(positions, indices);
        weldNormals(positions, normals);
        const mesh = makeMesh("plate", positions, indices, normals, uvs, null, scene, false);
        mesh.material = mat;
        mesh.receiveShadows = true;
        return mesh;
    }

    // 皿のマテリアル。絵付けも縁の線もアルベドに焼き込む
    function makePlateMaterial(scene, cfg, seed, style) {
        const size = Math.max(8, Math.round(cfg.plateTexSize) || 1024);
        const F = TextureLab.porcelainFields(size, seed);
        const usePrint = style.deco === "print";
        const items = usePrint ? prepPrint(buildSprigs(cfg, seed + 77)) : [];
        const rings = style.rings || [];
        const A = style.albedo;
        const pc = [0, 0, 0, 0];

        const alb = TextureLab._tex("plateAlb", size, size, (d, w, h) => {
            for (let y = 0; y < h; y++) {
                const sRad = y / h;
                // 縁の線。半径方向の位置 s と幅で描く
                let ringK = 0;
                for (const rg of rings) {
                    ringK = Math.max(ringK, 1 - smooth(rg[1] * 0.45, rg[1], Math.abs(sRad - rg[0])));
                }
                for (let x = 0; x < w; x++) {
                    const u = x / w, i = y * w + x;
                    const theta = u * TAU;
                    const ro = plateOutline(theta, cfg.plateN) * cfg.plateHalf;
                    const px = Math.cos(theta) * ro * sRad, pz = Math.sin(theta) * ro * sRad;
                    // 【対策】「白い皿」だからと 0.97 を入れると、露出を上げた
                    //         ときに真っ先に飛んで階調が消える。白磁の実反射率は
                    //         0.88 前後。暗くしたぶんは露出で戻す
                    const k = 1 + 0.022 * (F.h[i] - 0.5) - 0.034 * F.spec[i];
                    let cr = A[0] * k, cg = A[1] * k, cb = A[2] * k;
                    if (items.length) {
                        const a2 = printAt(items, px, pz, pc);
                        if (a2 > 0.002) {
                            let pr = pc[0], pg = pc[1], pb = pc[2];
                            if (style.printTint) {
                                // 【対策】染付は多色では刷れない。図柄の明暗だけを
                                //         残して、呉須の一色へ置き換える
                                const lum = 0.30 * pr + 0.59 * pg + 0.11 * pb;
                                const t = clamp(1 - lum * 1.15, 0, 1);
                                pr = mix(A[0], style.printTint[0], t);
                                pg = mix(A[1], style.printTint[1], t);
                                pb = mix(A[2], style.printTint[2], t);
                            }
                            // 釉薬の下なので少し沈める
                            const m = a2 * 0.90;
                            cr = mix(cr, pr * 1.02, m);
                            cg = mix(cg, pg * 1.02, m);
                            cb = mix(cb, pb * 1.02, m);
                        }
                    }
                    if (ringK > 0.002 && style.ringCol) {
                        cr = mix(cr, style.ringCol[0], ringK);
                        cg = mix(cg, style.ringCol[1], ringK);
                        cb = mix(cb, style.ringCol[2], ringK);
                    }
                    const o = i * 4;
                    d[o] = Math.round(clamp(cr, 0, 1) * 255);
                    d[o + 1] = Math.round(clamp(cg, 0, 1) * 255);
                    d[o + 2] = Math.round(clamp(cb, 0, 1) * 255);
                    d[o + 3] = 255;
                }
            }
        }, scene, {});

        const orm = TextureLab._tex("plateORM", size, size, (d, w, h) => {
            for (let i = 0; i < w * h; i++) {
                const rough = clamp(style.rough + 0.055 * F.h[i] + 0.22 * F.spec[i], 0.05, 0.55);
                const o = i * 4;
                d[o] = 255; d[o + 1] = Math.round(rough * 255); d[o + 2] = 0; d[o + 3] = 255;
            }
        }, scene, { linear: true });

        const nrm = TextureLab.normalFromHeight("plateNrm", F.h, size, size, 1.5, scene, {});

        const m = new BABYLON.PBRMaterial("plateMat", scene);
        m.albedoTexture = alb;
        m.metallicTexture = orm;
        m.useRoughnessFromMetallicTextureGreen = true;
        m.useMetallnessFromMetallicTextureBlue = true;
        m.useAmbientOcclusionFromMetallicTextureRed = true;
        m.bumpTexture = nrm;
        m.bumpTexture.level = 0.35;
        m.metallic = 0; m.roughness = 1;
        m.transparencyMode = BABYLON.PBRMaterial.PBRMATERIAL_OPAQUE;
        // 【対策】陶器の艶は素地の反射ではなく「釉薬の層」。roughness を
        //         下げて出すと濡れた石になる。クリアコートで層として乗せる
        m.clearCoat.isEnabled = true;
        m.clearCoat.intensity = 0.92;
        m.clearCoat.roughness = 0.055;
        m.clearCoat.indexOfRefraction = 1.52;
        m.backFaceCulling = false;
        m.twoSidedLighting = true;
        m.texs = [alb, orm, nrm];
        return m;
    }

    // テーブルのマテリアル。板・布・石で作り方が違う
    function makeTableMaterial(scene, T, seed) {
        const m = new BABYLON.PBRMaterial("tableMat", scene);
        const texs = [];
        const SZ = 1024;
        if (T.kind === "wood" || T.kind === "stone") {
            const R = (T.kind === "wood")
                ? TextureLab.wood(scene, SZ, seed, T.P)
                : TextureLab.stone(scene, SZ, seed, T.col);
            m.albedoTexture = R.albedo;
            m.metallicTexture = R.orm;
            m.useRoughnessFromMetallicTextureGreen = true;
            m.useMetallnessFromMetallicTextureBlue = true;
            m.useAmbientOcclusionFromMetallicTextureRed = true;
            m.bumpTexture = R.normal;
            m.bumpTexture.level = 0.65;
            m.metallic = 0; m.roughness = 1;
            texs.push(R.albedo, R.orm, R.normal);
            if (T.kind === "wood") {
                // 木は板目に沿って異方性の反射が出る。オイル仕上げの照り
                m.clearCoat.isEnabled = true;
                m.clearCoat.intensity = 0.28;
                m.clearCoat.roughness = 0.40;
            }
        } else {
            const alb = TextureLab.cloth(scene, SZ, seed, T.col, T.contrast);
            m.albedoTexture = alb;
            m.metallic = 0; m.roughness = 0.93;
            texs.push(alb);
        }
        for (const t of texs) { t.uScale = T.tile; t.vScale = T.tile; }
        m.transparencyMode = BABYLON.PBRMaterial.PBRMATERIAL_OPAQUE;
        if (T.sheen > 0) {
            // 布は sheen が要る。無いと紙になる
            m.sheen.isEnabled = true;
            m.sheen.intensity = T.sheen;
            m.sheen.roughness = 0.86;
            m.sheen.color = new BABYLON.Color3(0.88, 0.85, 0.82);
        }
        m.texs = texs;
        return m;
    }

    // =================================================================
    // 10. Scene
    // =================================================================
    const scene = new BABYLON.Scene(engine);
    // 写真は白ホリゾントのハイキー。背景 sRGB(239,244,248) を実測して合わせる
    scene.clearColor = new BABYLON.Color4(0.937, 0.955, 0.972, 1);

    const vw = (typeof window !== "undefined" && window.innerWidth) || 1024;
    if (vw < GLOBAL.compactWidth) { GLOBAL.textureSize = 512; GLOBAL.plateTexSize = 768; }

    const env = BABYLON.CubeTexture.CreateFromPrefilteredData(
        "https://assets.babylonjs.com/environments/environmentSpecular.env", scene);
    scene.environmentTexture = env;
    // 【対策】ぼかしすぎるとハイライトのコントラストが消えて艶消しになる。
    //         飴の照りは環境の明暗が映り込んで初めて出る
    env.lodGenerationOffset = 0.22;
    scene.environmentIntensity = 0.95;

    // 【実測】写真の天面カラメルは短径/長径 = 0.33 の楕円に写っている。
    //         円を仰角 e で見たときの比が sin(e) なので e = 19.5°、
    //         つまり真上からの角度 beta = 1.23 rad。皿とソースが
    //         収まるよう距離は 30cm
    const camera = new BABYLON.ArcRotateCamera("cam", -1.30, 1.215, 30.0, new V3(0, 1.95, 0), scene);
    camera.attachControl(true);
    camera.fov = 0.485;
    camera.wheelPrecision = 14;
    // 【対策】ポストプロセスを有効にするとシーンは 16bit 深度の RT へ描かれる。
    //         minZ を 0.1 のままにすると分解能が mm 台になり、0.3mm の
    //         カラメル層が本体と勝ったり負けたりしてちらつく
    // 被写体は 30cm 先の 25cm 角。ここを [10, 90] まで詰めると、
    // 16bit 深度の分解能が 34µm → 12µm になり、0.2mm の膜が 16 段ぶん離れる
    camera.minZ = 10;
    camera.maxZ = 90;
    camera.lowerRadiusLimit = 13;
    camera.upperRadiusLimit = 62;
    camera.lowerBetaLimit = 0.05;
    camera.upperBetaLimit = 1.52;
    camera.panningSensibility = 260;
    scene.cameraToUseForPointers = camera;

    // ---- 灯（3灯 ＋ 環境）------------------------------------------
    const key = new BABYLON.DirectionalLight("key", new V3(-0.46, -0.86, 0.55).normalize(), scene);
    key.position = new V3(16, 30, -19);
    key.intensity = 2.85;
    key.diffuse = new BABYLON.Color3(1.0, 0.984, 0.952);
    key.specular = new BABYLON.Color3(0.62, 0.60, 0.56);
    key.shadowMinZ = 6; key.shadowMaxZ = 78;

    const fillL = new BABYLON.DirectionalLight("fillL", new V3(0.86, -0.36, -0.50).normalize(), scene);
    fillL.intensity = 0.92;
    fillL.diffuse = new BABYLON.Color3(0.98, 0.962, 0.945);
    fillL.specular = new BABYLON.Color3(0.16, 0.155, 0.150);

    // 【対策】平行光源のハイライトは1点しか出ない。カラメルの面に何本も
    //         走る照りを作るには「拡散をほぼ 0 にして鏡面だけ足す灯」が要る
    const kick = new BABYLON.DirectionalLight("kick", new V3(0.30, -0.42, 0.86).normalize(), scene);
    kick.intensity = 1.70;
    kick.diffuse = new BABYLON.Color3(0.06, 0.058, 0.055);
    kick.specular = new BABYLON.Color3(1.0, 0.96, 0.90);

    const amb = new BABYLON.HemisphericLight("amb", new V3(0, 1, 0), scene);
    amb.intensity = 0.46;
    amb.diffuse = new BABYLON.Color3(1, 1, 1);
    amb.groundColor = new BABYLON.Color3(0.80, 0.77, 0.73);
    amb.specular = new BABYLON.Color3(0, 0, 0);

    // 【対策】ESM は柔らかいが depthScale を詰めないと痣が出る。
    //         プリンのように大きく滑らかな面では PCF のほうが素直
    const sg = new BABYLON.ShadowGenerator(2048, key);
    sg.usePercentageCloserFiltering = true;
    sg.filteringQuality = BABYLON.ShadowGenerator.QUALITY_HIGH;
    sg.normalBias = 0.022;
    sg.bias = 0.0006;
    sg.darkness = 0.24;

    const ip = scene.imageProcessingConfiguration;
    ip.toneMappingEnabled = true;
    ip.toneMappingType = BABYLON.ImageProcessingConfiguration.TONEMAPPING_ACES;
    ip.exposure = GLOBAL.exposure;
    ip.contrast = GLOBAL.contrast;
    ip.vignetteEnabled = true;
    ip.vignetteWeight = 1.5;
    ip.vignetteColor = new BABYLON.Color4(0, 0, 0, 0);
    ip.vignetteBlendMode = BABYLON.ImageProcessingConfiguration.VIGNETTEMODE_MULTIPLY;

    // ---- 物理 -------------------------------------------------------
    let physicsOn = false;
    if (GLOBAL.usePhysics) {
        try {
            const havok = await HavokPhysics();
            // 【対策】HavokPlugin の第1引数は _useDeltaForWorldStep。true（既定）
            //         だとフレームのデルタでそのまま積分するため、フレーム落ちの
            //         たびにステップ幅が変わり、接触が解けたり深く食い込んだり
            //         を繰り返して震える
            const hk = new BABYLON.HavokPlugin(false, havok);
            // 【対策】cm 系なので理屈では 981 だが、Havok の接触許容量と
            //         スリープ閾値はメートル系前提の絶対値で決まっている。
            //         981 のままだと着地のたびに押し戻され続けて震える
            scene.enablePhysics(new V3(0, -GLOBAL.gravity, 0), hk);
            if (hk.setTimeStep) hk.setTimeStep(1 / GLOBAL.physicsHz);
            physicsOn = true;
        } catch (e) {
            console.warn("[Purin] Havok を初期化できませんでした。置いた状態から始めます。", e);
        }
    }

    // ---- 母線とテクスチャ -------------------------------------------
    const prof = new Profile(GLOBAL);
    const field = new ModeField(GLOBAL, prof);
    const TEX = GLOBAL.textureSize;

    const cusF = TextureLab.custardFields(TEX, GLOBAL, prof, 4211);
    const cusAlb = TextureLab.custardAlbedo(TEX, cusF, scene);
    const cusORM = TextureLab.custardORM(TEX, cusF, scene);
    const cusNrm = TextureLab.normalFromHeight("purinNrm", cusF.h, TEX, TEX, 2.6, scene, {});
    const cusThk = TextureLab.custardThickness(256, prof, scene);

    const carF = TextureLab.caramelFields(512, 907);
    const carORM = TextureLab.caramelORM(512, carF, scene);

    const mats = {};

    mats.custard = (function () {
        const m = new BABYLON.PBRMaterial("custardMat", scene);
        m.albedoColor = new BABYLON.Color3(1, 1, 1);   // 色は頂点が持つ
        m.albedoTexture = cusAlb;
        m.metallicTexture = cusORM;
        m.useRoughnessFromMetallicTextureGreen = true;
        m.useMetallnessFromMetallicTextureBlue = true;
        m.useAmbientOcclusionFromMetallicTextureRed = true;
        m.bumpTexture = cusNrm;
        m.bumpTexture.level = 0.55;
        m.metallic = 0; m.roughness = 1;
        m.transparencyMode = BABYLON.PBRMaterial.PBRMATERIAL_OPAQUE;
        // 型に接していた面はつるつるだが、鏡ではない。薄い層として乗せる
        m.clearCoat.isEnabled = true;
        m.clearCoat.intensity = 0.38;
        m.clearCoat.roughness = 0.10;
        m.clearCoat.indexOfRefraction = 1.42;
        // 【対策】プリンらしさの大半は「透けること」。translucency を切ると
        //         着色した石膏になる。厚みは母線から実測した弦長を渡す
        m.subSurface.isTranslucencyEnabled = true;
        // 【対策】0.80 まで上げると、プリンではなく琥珀のガラス細工になる。
        //         実物は「縁がわずかに光を通す不透明体」なので、
        //         強度を半分にして、減衰距離も体の半分ぶんまで詰める
        m.subSurface.translucencyIntensity = 0.40;
        // 【対策】tintColor の R を 1.0 にすると、透過色は tint^(厚み/距離) なので
        //         R だけ何 cm 通っても 1.0 のまま減らない。せっかく母線から
        //         実測した厚みテクスチャが R にまったく効かなくなり、
        //         胴の厚いところまで一律に光って琥珀のガラスに見える。
        //         必ず 1.0 未満にして、厚みで減るようにする
        m.subSurface.tintColor = sRGB([0.920, 0.680, 0.360]);
        m.subSurface.tintColorAtDistance = 1.00;
        m.subSurface.thicknessTexture = cusThk;
        m.subSurface.useMaskFromThicknessTexture = false;
        m.subSurface.minimumThickness = 0.12;
        m.subSurface.maximumThickness = prof.thMax;
        return m;
    })();

    const carNrms = [];
    // 【対策】カラメル層と皿のソースが1枚も描かれていなかった原因。
    //   ・material.zOffset は engine.setZOffset で符号が反転して
    //     gl.polygonOffset の factor になる。負値を入れると「奥へ」押されるので、
    //     0.3mm の膜が本体や皿の内側へ沈んで完全に消える。
    //     しかも zOffsetUnits が 0 だと factor は面の傾きに比例するため、
    //     斜めから見る側面や、ほぼ水平な皿の上のソースほど強く押される
    //     （＝いちばん見せたいところから消える）
    //   ・camera.maxZ = 240 のままだと 16bit 深度の分解能が 34µm 前後で、
    //     60µm の膜は 2 段ぶんしか離れていない
    // ポリゴンオフセットに頼るのをやめ、膜の最小厚を 0.2mm 確保して
    // 深度レンジを詰める。こちらは符号の解釈に依存しない
    function makeCaramelMat(name, zOff, uScale, vScale) {
        const m = new BABYLON.PBRMaterial(name, scene);
        m.albedoColor = new BABYLON.Color3(1, 1, 1);
        m.metallicTexture = carORM;
        m.useRoughnessFromMetallicTextureGreen = true;
        m.useMetallnessFromMetallicTextureBlue = true;
        m.useAmbientOcclusionFromMetallicTextureRed = true;
        // 【対策】ここで carNrm.clone() を使っていたのが、カラメル層と
        //   皿のソースが1枚も描かれなかった本当の原因。
        //   DynamicTexture.clone() は同じ大きさの空テクスチャを作るだけで、
        //   キャンバスの中身も update() も引き継がない。
        //   engine.createDynamicTexture は isReady = false で作るので、
        //   update() が来ない複製は永久に ready にならず、PBRMaterial は
        //   全テクスチャが ready になるまで isReadyForSubMesh が false の
        //   ままで、そのメッシュは1枚も描かれない。
        //   「濃さやソースの量を振っても見えが変わらない」の正体はこれで、
        //   そもそも画面に出ていなかった。
        //   違うのはタイリングだけなのだから、素直に必要な枚数を焼く
        const nrm = TextureLab.normalFromHeight("caramelNrm_" + name,
            carF.h, 512, 512, 0.9, scene, {});
        nrm.uScale = uScale; nrm.vScale = vScale;
        m.bumpTexture = nrm;
        m.bumpTexture.level = 0.30;
        carNrms.push(nrm);
        m.metallic = 0; m.roughness = 1;
        m.transparencyMode = BABYLON.PBRMaterial.PBRMATERIAL_OPAQUE;
        // 【対策】カラメルに subSurface の透光を足してはいけない。
        //   頂点カラーはすでに「膜を通って下地で反射して、もう一度膜を
        //   通って出てくる色」（Beer–Lambert ＋ Saunderson）そのものなので、
        //   透光を重ねると同じ透過を二重に数えることになる。
        //   しかも厚みテクスチャを渡していないので厚みは maximumThickness の
        //   一定値になり、頂点カラーと無関係な linear(0.233, 0.043, 0.002) が
        //   全面に乗る。実測すると、σ を 0.3 倍から 2.2 倍まで振っても
        //   合計は (0.53,0.11) → (0.29,0.05) までしか動かず、
        //   「濃さを変えても変化が無い」という状態になっていた。
        //   飴の見えは頂点カラー（色）と鏡面反射（照り）の 2 つで足りる
        m.subSurface.isTranslucencyEnabled = false;
        m.backFaceCulling = false;
        m.twoSidedLighting = true;
        void zOff;
        return m;
    }
    mats.caramel = makeCaramelMat("caramelMat", -1.5, 1, 1);
    mats.sauce = makeCaramelMat("sauceMat", -3.0, 3, 1);

    // ---- テーブルと皿（プリセット）------------------------------------
    let currentTable = START_TABLE, currentPlate = START_PLATE;
    let cloth = null, plate = null, plate2 = null;

    function applyTable(key) {
        currentTable = key;
        const old = cloth ? cloth.material : null;
        const m = makeTableMaterial(scene, TABLES[key], 3131);
        if (cloth) cloth.material = m;
        if (old) {
            if (old.texs) for (const t of old.texs) t.dispose();
            old.dispose(true, false);
        }
        return m;
    }
    function applyPlate(key) {
        currentPlate = key;
        const old = mats.plate;
        mats.plate = makePlateMaterial(scene, GLOBAL, 5501, PLATES[key]);
        if (plate) plate.material = mats.plate;
        // 【対策】ソースは皿を透かして見ているだけなので、皿を替えたら
        //         下地の色も替わる。ここを固定にすると、灰の皿のときだけ
        //         ソースが浮いて明るく見える
        if (state && state.sauce) {
            state.sauce.__under = PLATES[key].albedo;
            if (state.drops) state.drops.__under = PLATES[key].albedo;
            rebakeSauceColors(state.sauce);
            rebakeSauceColors(state.drops);
        }
        if (old) {
            if (old.texs) for (const t of old.texs) t.dispose();
            old.dispose(true, false);
        }
        return mats.plate;
    }

    if (GLOBAL.showTable) {
        // 【対策】厚みゼロの床は当たり判定に使えない（すり抜ける）ので箱にする
        cloth = BABYLON.MeshBuilder.CreateBox("table",
            { width: 260, height: 3, depth: 260 }, scene);
        cloth.id = "table";
        cloth.receiveShadows = true;
        cloth.position.y = -GLOBAL.plateThick - 1.5;
        applyTable(currentTable);
    }

    mats.plate = makePlateMaterial(scene, GLOBAL, 5501, PLATES[currentPlate]);
    plate = buildPlate(scene, GLOBAL, mats.plate);
    sg.addShadowCaster(plate);
    if (GLOBAL.secondPlate) {
        // 奥に重ねた皿。被写界深度でボケて「写真の外」を作る
        plate2 = plate.createInstance("plate2");
        plate2.position.set(-15.5, 0.02, -20.0);
        plate2.rotation.y = 0.6;
        plate2.receiveShadows = true;
    }

    if (physicsOn) {
        const pShape = new BABYLON.PhysicsShapeMesh(plate, scene);
        pShape.material = { friction: 0.92, restitution: 0.0 };
        const pBody = new BABYLON.PhysicsBody(plate, BABYLON.PhysicsMotionType.STATIC, false, scene);
        pBody.shape = pShape;
        if (cloth) {
            const tShape = new BABYLON.PhysicsShapeBox(
                new V3(0, 0, 0), BABYLON.Quaternion.Identity(), new V3(260, 3, 260), scene);
            tShape.material = { friction: 0.9, restitution: 0.0 };
            const tBody = new BABYLON.PhysicsBody(cloth, BABYLON.PhysicsMotionType.STATIC, false, scene);
            tBody.shape = tShape;
        }
    }

    // =================================================================
    //  生成・投入・揺れ
    // =================================================================
    let state = null, onRebuilt = null;
    let currentSeed = START_SEED;

    function clearState() {
        if (!state) return;
        if (state.body) { try { state.body.dispose(); } catch (e) { } }
        if (state.shape) { try { state.shape.dispose(); } catch (e) { } }
        if (state.defBody) state.defBody.dispose();
        if (state.defCoat) state.defCoat.dispose();
        if (state.sauce) state.sauce.dispose();
        if (state.drops) state.drops.dispose();
        if (state.pudding) state.pudding.dispose();
        state = null;
    }

    function build(seed) {
        const t0 = (typeof performance !== "undefined" ? performance.now() : Date.now());
        clearState();
        const dev = makeDeviation(GLOBAL, seed + 17);
        const pudding = new Pudding(scene, GLOBAL, prof, dev, seed, mats);
        sg.addShadowCaster(pudding.body);
        sg.addShadowCaster(pudding.coat);

        const pAlb = PLATES[currentPlate].albedo;
        const sauce = buildSauce(scene, GLOBAL, prof, seed + 51, mats.sauce, 0, 0, pAlb);
        const drops = buildDroplets(scene, GLOBAL, seed + 83, mats.sauce, 0, 0,
            Math.min(GLOBAL.sauceR * (0.62 + 0.55 * GLOBAL.sauceAmt) * 1.05,
                GLOBAL.plateHalf * GLOBAL.plateWellS - 0.30), pAlb);

        const defBody = new Deformable(pudding.body, field);
        const defCoat = new Deformable(pudding.coat, field);
        const jig = new Jiggle(GLOBAL);

        let body = null, shape = null;
        pudding.body.position.set(0, physicsOn ? GLOBAL.dropH : 0, 0);
        if (physicsOn) {
            // 【対策】物理で動かすメッシュは rotationQuaternion を使う。
            //         Euler の rotation のままだと Havok 側の姿勢と食い違う
            pudding.body.rotationQuaternion = BABYLON.Quaternion.Identity();
            pudding.body.computeWorldMatrix(true);
            shape = pudding.hullShape(scene);
            shape.material = { friction: GLOBAL.friction, restitution: GLOBAL.restitution };
            body = new BABYLON.PhysicsBody(pudding.body, BABYLON.PhysicsMotionType.DYNAMIC, false, scene);
            body.shape = shape;
            // 【対策】setMassProperties に mass だけ渡すと、慣性テンソルは
            //         既定値（各軸1）で上書きされる。半径 3.3 / 高さ 4.3 の
            //         塊の実際の慣性は 1.8〜2.1（mass=0.5, cm系）なので、
            //         1 のままだと接地の瞬間に不自然に起き上がる
            const k = GLOBAL.mass / 0.5;
            body.setMassProperties({
                mass: GLOBAL.mass,
                centerOfMass: new V3(0, GLOBAL.H * 0.44, 0),
                inertia: new V3(1.82 * k, 2.10 * k, 1.82 * k),
                inertiaOrientation: BABYLON.Quaternion.Identity()
            });
            // 【対策】damping は PhysicsAggregate のオプションでは効かない
            body.setLinearDamping(GLOBAL.linearDamping);
            body.setAngularDamping(GLOBAL.angularDamping);
            // 【対策】毎フレーム「メッシュ → ボディ」へ書き戻すと、物理が
            //         出した結果を読み直して押し込む往復が起きる
            body.disablePreStep = true;
        } else {
            pudding.body.rotation.set(0, 0, 0);
        }

        state = {
            pudding: pudding, sauce: sauce, drops: drops,
            defBody: defBody, defCoat: defCoat, jig: jig,
            body: body, shape: shape,
            settleTimer: 0, life: 0, frozen: false, impacted: false,
            ms: Math.round((typeof performance !== "undefined" ? performance.now() : Date.now()) - t0)
        };
        if (!physicsOn) {
            state.frozen = true;
            // 物理が無いときは「置いた直後」の一撃だけ再現する
            jig.shake(GLOBAL.shakeVel * 0.55);
        }
        if (onRebuilt) onRebuilt(state);
        return state;
    }

    build(currentSeed);

    // ---- 静止したら固定する ------------------------------------------
    // 【対策】静止後もソルバの残差で微振動が続く。速度が閾値を下回った
    //         状態が一定時間続いたら STATIC にする。微振動で判定が永久に
    //         通らないことがあるのでタイムアウトも設ける
    function freezeBody(st) {
        if (st.frozen || !st.body) return;
        try { st.body.setMotionType(BABYLON.PhysicsMotionType.STATIC); } catch (e) { }
        const m = st.pudding.body;
        // 【対策】rotationQuaternion を持ったまま凍らせると、Inspector v2 の
        //         プロパティ表示が例外を出す。Euler へ焼いてから外す
        if (m.rotationQuaternion) {
            m.rotation = m.rotationQuaternion.toEulerAngles();
            m.rotationQuaternion = null;
        }
        st.frozen = true;
        if (onRebuilt) onRebuilt(st);
    }

    const vTmp = new V3(0, 0, 0);
    scene.onBeforeRenderObservable.add(() => {
        if (!state) return;
        const dt = Math.min(0.05, engine.getDeltaTime() / 1000);
        const st = state, jig = st.jig;
        st.life += dt;

        if (st.body && !st.frozen) {
            let lv = null, av = null;
            try { lv = st.body.getLinearVelocity(); av = st.body.getAngularVelocity(); } catch (e) { }
            if (lv) {
                if (jig.hasPrev && dt > 1e-4) {
                    const dvx = lv.x - jig.vPrev.x;
                    const dvy = lv.y - jig.vPrev.y;
                    const dvz = lv.z - jig.vPrev.z;
                    // 【対策】Havok を固定ステップで回すと、1 フレームで進む
                    //         物理時間は表示のデルタと一致しない。自由落下中の
                    //         Δv は重力ぶんそのものなので、見かけの加速度が
                    //         表示フレームレート次第で変わってしまう。しかも
                    //         それが生むのは「空中で 0.5mm 伸びる」という
                    //         誰も見ていない効果でしかない。
                    //         上向きの Δv（＝接地による力積）だけを拾えば、
                    //         伝わる力積は Γ·Δv になってフレームレートに
                    //         依存しなくなる
                    const dvyC = Math.max(0, dvy);
                    jig.driveImpulse(dvx, dvyC, dvz);
                    // 着地の一撃。左右非対称なので楕円モードも起こす
                    if (!st.impacted && dvyC > 4 && jig.vPrev.y < -6) {
                        st.impacted = true;
                        jig.impact(Math.abs(jig.vPrev.y) * 0.28);
                    }
                }
                jig.vPrev.copyFrom(lv);
                jig.hasPrev = true;
                const speed = lv.length() + (av ? av.length() * 2 : 0);
                if (speed < GLOBAL.settleVel) st.settleTimer += dt; else st.settleTimer = 0;
                if (st.settleTimer > GLOBAL.settleTime || st.life > GLOBAL.settleTimeout) freezeBody(st);
            }
        }

        // 【対策】静止しているあいだも毎フレーム 1万頂点を書き戻すのは
        //         もったいない。振幅が閾値を切ったら 1 回だけ静止形状へ
        //         戻して更新を止める
        if (jig.step(dt)) {
            const Q = jig.current();
            st.defBody.apply(Q);
            st.defCoat.apply(Q);
        }
        void vTmp;
    });

    // ---- クリックでつつく --------------------------------------------
    scene.onPointerObservable.add((pi) => {
        if (pi.type !== BABYLON.PointerEventTypes.POINTERDOWN) return;
        if (!state) return;
        const bodyMesh = state.pudding.body, coatMesh = state.pudding.coat;
        const pick = scene.pick(scene.pointerX, scene.pointerY,
            (m) => m === bodyMesh || m === coatMesh);
        if (!pick || !pick.hit || !pick.pickedPoint) return;
        const inv = bodyMesh.getWorldMatrix().clone().invert();
        const lp = BABYLON.Vector3.TransformCoordinates(pick.pickedPoint, inv);
        const ray = scene.createPickingRay(scene.pointerX, scene.pointerY,
            BABYLON.Matrix.Identity(), camera);
        const ld = BABYLON.Vector3.TransformNormal(ray.direction, inv).normalize();
        state.jig.poke(lp.x, lp.y, lp.z, ld.x, ld.y, ld.z,
            GLOBAL.pokeVel, GLOBAL.H, GLOBAL.rTop);
    });

    // ---- ポストプロセス ----------------------------------------------
    let ssao = null;
    if (GLOBAL.useSSAO) {
        // 【対策】プリンと皿の接するところ、ソースの縁、垂れの根元に
        //         影が入らないと、全部が同じ平面に貼りついて見える
        ssao = new BABYLON.SSAO2RenderingPipeline("ssao", scene,
            { ssaoRatio: 0.8, blurRatio: 1.0 }, [camera]);
        ssao.radius = 0.55;
        ssao.totalStrength = 0.95;
        ssao.samples = 16;
        ssao.expensiveBlur = true;
        ssao.maxZ = 85;
        ssao.minZAspect = 0.20;
    }

    const dp = new BABYLON.DefaultRenderingPipeline("dp", true, scene, [camera]);
    dp.samples = 4;
    dp.fxaaEnabled = true;
    dp.bloomEnabled = true;
    dp.bloomThreshold = 0.92;
    dp.bloomWeight = 0.055;
    dp.bloomKernel = 40;
    dp.bloomScale = 0.6;
    dp.sharpenEnabled = true;
    dp.sharpen.edgeAmount = 0.20;
    // 【対策】Babylon の錯乱円は「シーン単位 × 1000 = mm」で計算される。
    //         cm 単位のシーンでカメラ距離 26cm は内部では 26000mm = 26m 先。
    //         focalLength を focusDistance の一定比率 K にすると focus が
    //         約分され、寄っても引いてもボケ量が変わらない
    dp.depthOfFieldEnabled = GLOBAL.useDOF;
    dp.depthOfFieldBlurLevel = BABYLON.DepthOfFieldEffectBlurLevel.High;
    dp.depthOfField.lensSize = 50;
    dp.depthOfField.fStop = GLOBAL.dofFStop;
    scene.onBeforeRenderObservable.add(() => {
        if (!dp.depthOfFieldEnabled) return;
        const focus = camera.radius * 1000;
        dp.depthOfField.focusDistance = focus;
        dp.depthOfField.focalLength = focus * GLOBAL.dofRatio;
    });

    // =================================================================
    // 11. GUI
    // =================================================================
    // 【対策】フルスクリーン GUI を既定のままにすると Bloom / 被写界深度 /
    //         シャープンが UI にも乗ってボケる。定石は layerMask で GUI
    //         専用カメラへ分離することだが、それをやると Inspector が
    //         3系統まとめて壊れる（Physics Helper / 選択ハイライト /
    //         ピッカー）。Layer.applyPostProcess = false なら 2台目の
    //         カメラを作らずに GUI だけポストプロセスの外へ出せる
    const GUI_MASK = 0x20000000;
    let guiCam = null;

    function bindDebugCamera(sc, mainCam) {
        // UtilityLayerRenderer.getRenderCamera は activeCameras の末尾を
        // 直接参照する。Inspector が内部の WeakMap に抱えていて外から
        // 触れないレイヤー（Scene Explorer の選択枠など）まで一括で
        // 直すため、インスタンスではなくプロトタイプを差し替える
        const ULR = BABYLON.UtilityLayerRenderer;
        if (ULR && ULR.prototype && !ULR.prototype.__njPatched) {
            const orig = ULR.prototype.getRenderCamera;
            ULR.prototype.getRenderCamera = function (getDefault) {
                if (this._renderCamera) return this._renderCamera;
                const s = this.originalScene || this.utilityLayerScene;
                if (s && s.__debugMainCamera) return s.__debugMainCamera;
                return orig.call(this, getDefault);
            };
            ULR.prototype.__njPatched = true;
        }
        sc.__debugMainCamera = mainCam;
        // scene.pick() を camera 引数なしで呼ぶと createPickingRay の中で
        // scene.activeCamera が使われる。描画ループが activeCameras を
        // 順に代入していくので、終わった時点では guiCam が残っている
        sc.onAfterRenderObservable.add(() => { sc.activeCamera = mainCam; });
        sc.cameraToUseForPointers = mainCam;
    }

    if (GLOBAL.guiOwnCamera) {
        guiCam = new BABYLON.FreeCamera("guiCam", new V3(0, 0, -50), scene);
        guiCam.layerMask = GUI_MASK;
        scene.activeCameras = [camera, guiCam];
        bindDebugCamera(scene, camera);
    } else {
        scene.activeCameras = [camera];
    }

    const ui = BABYLON.GUI.AdvancedDynamicTexture.CreateFullscreenUI("ui", true, scene);
    if (ui.layer) {
        if (GLOBAL.guiOwnCamera) ui.layer.layerMask = GUI_MASK;
        else ui.layer.applyPostProcess = false;
    }
    // 【対策】Babylon.GUI のサイズ指定はレンダー解像度基準（≒ CSS px × DPR）。
    //         DPR 3 の端末では 32px のボタンが実質 11 CSS px になる
    ui.idealWidth = 1400;
    ui.renderAtIdealSize = true;

    const COL = {
        idle: "#2a2724", active: "#8a5a22", edge: "#4a453d",
        text: "#f4eee2", sub: "#a9a294", accent: "#f0c98e"
    };
    const card = new BABYLON.GUI.Rectangle("card");
    card.width = "272px";
    card.height = "88%";
    card.cornerRadius = 10;
    card.thickness = 1;
    card.color = COL.edge;
    card.background = "rgba(17,16,14,0.84)";
    card.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
    card.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_TOP;
    card.left = "16px"; card.top = "16px";
    ui.addControl(card);

    const sv = new BABYLON.GUI.ScrollViewer("sv");
    sv.thickness = 0;
    sv.barSize = 10;
    sv.barColor = COL.edge;
    sv.barBackground = "rgba(0,0,0,0)";
    sv.wheelPrecision = 0.02;
    card.addControl(sv);

    const panel = new BABYLON.GUI.StackPanel("panel");
    panel.width = "232px";
    panel.isVertical = true;
    panel.paddingTop = "12px"; panel.paddingBottom = "16px";
    sv.addControl(panel);

    function addLabel(text, size, color, height) {
        const t = new BABYLON.GUI.TextBlock();
        t.text = text; t.height = height || "22px";
        t.color = color || COL.text; t.fontSize = size || 13;
        t.textHorizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
        t.textWrapping = true;
        panel.addControl(t);
        return t;
    }
    function addButton(name, text, onClick) {
        const b = BABYLON.GUI.Button.CreateSimpleButton(name, text);
        b.height = "32px"; b.paddingBottom = "5px";
        b.color = COL.text; b.background = COL.idle;
        b.cornerRadius = 6; b.thickness = 0; b.fontSize = 14;
        b.onPointerUpObservable.add(onClick);
        panel.addControl(b);
        return b;
    }
    function addSlider(labelText, min, max, value, fmt, onChange) {
        const lb = addLabel(labelText + "  " + fmt(value), 13, COL.accent, "22px");
        const s = new BABYLON.GUI.Slider(labelText);
        s.minimum = min; s.maximum = max; s.value = value;
        s.height = "18px"; s.width = "220px"; s.paddingBottom = "8px";
        s.color = COL.accent; s.background = "#38332c"; s.borderColor = "transparent";
        s.onValueChangedObservable.add((v) => { lb.text = labelText + "  " + fmt(v); onChange(v); });
        panel.addControl(s);
        return { label: lb, slider: s };
    }
    function addSpacer(h) {
        const r = new BABYLON.GUI.Rectangle();
        r.height = h || "8px"; r.thickness = 0; r.background = "";
        panel.addControl(r);
    }
    const f2 = (v) => v.toFixed(2);
    const f1 = (v) => v.toFixed(1);

    addLabel("PURIN / プリン", 11, COL.sub, "26px");
    addLabel("プリンをクリックするとつつけます", 11, COL.sub, "30px");

    addButton("drop", "落とし直す", () => { build(++currentSeed); });
    addButton("shake", "ゆらす", () => { if (state) state.jig.shake(GLOBAL.shakeVel); });

    addSpacer();
    addLabel("揺れ", 13, COL.accent, "22px");
    // 【対策】「やわらかさ」を周波数で振ると、遅くなるほど振幅も大きく
    //         見える（同じ初速なら q = v/ω）。実物のプリンも同じ挙動なので、
    //         ここは補正せずそのまま見せるのが正しい
    addSlider("かたさ（周波数 ×）", 0.45, 2.00, GLOBAL.freqScale, f2, (v) => {
        GLOBAL.freqScale = v; updateInfo();
    });
    addSlider("揺れの大きさ ×", 0.20, 4.00, GLOBAL.jiggleGain, f2, (v) => { GLOBAL.jiggleGain = v; });
    addSlider("減衰 ×", 0.25, 2.50, GLOBAL.dampScale, f2, (v) => { GLOBAL.dampScale = v; updateInfo(); });

    addSpacer();
    addLabel("カラメル", 13, COL.accent, "22px");
    let caramelDirty = false, sauceDirty = false, skinDirty = false, bodyDirty = false;
    addSlider("濃さ（消散係数 ×）", 0.30, 2.20, GLOBAL.sigmaScale, f2, (v) => {
        GLOBAL.sigmaScale = v; caramelDirty = true; updateInfo();
    });
    addSlider("内部反射（Saunderson）", 0.0, 0.75, GLOBAL.internalRefl, f2, (v) => {
        GLOBAL.internalRefl = v; caramelDirty = true;
    });
    addSlider("ソースの量", 0.10, 1.60, GLOBAL.sauceAmt, f2, (v) => {
        GLOBAL.sauceAmt = v; sauceDirty = true;
    });

    addSpacer();
    addLabel("カスタード", 13, COL.accent, "22px");
    // 【対策】型に接していた面に「す」はほとんど出ない。強く出すと
    //         ゴマを振ったように見えるので、既定は気配が残る程度
    addSlider("「す」（気泡跡）", 0.0, 1.20, GLOBAL.poreAmt, f2, (v) => {
        GLOBAL.poreAmt = v; skinDirty = true;
    });
    addSlider("カラメルの染み ×", 0.0, 1.60, GLOBAL.runStain, f2, (v) => {
        GLOBAL.runStain = v; bodyDirty = true;
    });
    addSlider("落とす高さ cm", 0.0, 14.0, GLOBAL.dropH, f1, (v) => { GLOBAL.dropH = v; });

    addSpacer();
    addLabel("テーブル", 13, COL.accent, "22px");
    const tableBtns = {}, plateBtns = {};
    function highlightSet() {
        for (const k in tableBtns) tableBtns[k].background = (k === currentTable) ? COL.active : COL.idle;
        for (const k in plateBtns) plateBtns[k].background = (k === currentPlate) ? COL.active : COL.idle;
    }
    for (const k of Object.keys(TABLES)) {
        tableBtns[k] = addButton("t_" + k, TABLES[k].label, () => {
            if (k === currentTable) return;
            tableBtns[k].textBlock.text = TABLES[k].label + "（焼き直し中…）";
            // 【対策】ボタンのラベルを先に描かせてから焼く。
            //         同じフレームで焼くと「押しても反応しない」ように見える
            setTimeout(() => {
                applyTable(k);
                tableBtns[k].textBlock.text = TABLES[k].label;
                highlightSet();
            }, 30);
        });
    }
    addLabel("皿", 13, COL.accent, "22px");
    for (const k of Object.keys(PLATES)) {
        plateBtns[k] = addButton("p_" + k, PLATES[k].label, () => {
            if (k === currentPlate) return;
            plateBtns[k].textBlock.text = PLATES[k].label + "（焼き直し中…）";
            setTimeout(() => {
                applyPlate(k);
                plateBtns[k].textBlock.text = PLATES[k].label;
                highlightSet();
            }, 30);
        });
    }
    highlightSet();

    addSpacer();
    addLabel("カメラ", 13, COL.accent, "22px");
    const dofBtn = addButton("dof", "被写界深度: ON", () => {
        GLOBAL.useDOF = !GLOBAL.useDOF;
        dp.depthOfFieldEnabled = GLOBAL.useDOF;
        dofBtn.background = GLOBAL.useDOF ? COL.active : COL.idle;
        dofBtn.textBlock.text = "被写界深度: " + (GLOBAL.useDOF ? "ON" : "OFF");
    });
    dofBtn.background = GLOBAL.useDOF ? COL.active : COL.idle;
    addSlider("ぼけ量", 0.01, 0.20, GLOBAL.dofRatio, f2, (v) => { GLOBAL.dofRatio = v; });
    addSlider("F値", 1.2, 11.0, GLOBAL.dofFStop, f1, (v) => { dp.depthOfField.fStop = v; });

    addSpacer();
    const info = addLabel("", 11, COL.sub, "132px");

    // 「す」を振ったときだけ肌のテクスチャを焼き直す
    function rebakeCustardSkin(F) {
        const alb = TextureLab.custardAlbedo(TEX, F, scene);
        const orm = TextureLab.custardORM(TEX, F, scene);
        const nrm = TextureLab.normalFromHeight("purinNrm", F.h, TEX, TEX, 2.6, scene, {});
        const m = mats.custard;
        const old = [m.albedoTexture, m.metallicTexture, m.bumpTexture];
        m.albedoTexture = alb;
        m.metallicTexture = orm;
        m.bumpTexture = nrm;
        m.bumpTexture.level = 0.55;
        for (const t of old) { if (t) t.dispose(); }
    }

    function updateInfo() {
        if (!state) return;
        const f = GLOBAL.modeFreq.map((x) => (x * GLOBAL.freqScale).toFixed(1));
        const z = GLOBAL.modeZeta.map((x) => (x * GLOBAL.dampScale).toFixed(2));
        const s = GLOBAL.caramelSigma.map((x) => (x * GLOBAL.sigmaScale).toFixed(1));
        const t2 = Math.exp(-GLOBAL.caramelSigma[1] * GLOBAL.sigmaScale * 2 * GLOBAL.dripFilm);
        info.text =
            "三角形 " + Math.round(state.pudding.tris).toLocaleString() + " / 変形頂点 "
            + (state.defBody.n + state.defCoat.n).toLocaleString() + "\n"
            + "モード f = [" + f.join(", ") + "] Hz\n"
            + "        ζ = [" + z.join(", ") + "]\n"
            + "σ = [" + s.join(", ") + "] /cm  垂れ0.24mm の G透過 " + t2.toFixed(2) + "\n"
            + "肉厚 最大 " + prof.thMax.toFixed(2) + "cm / 母線 " + prof.N + "点\n"
            + "振幅 " + (state.jig.peak * 10).toFixed(2) + "mm"
            + (state.frozen ? " / 剛体は静止" : " / 落下中")
            + "  seed " + currentSeed;
    }

    onRebuilt = () => { updateInfo(); };
    updateInfo();

    // 【対策】スライダーの onValueChanged で直に焼き直すと、ドラッグ中に
    //         同じフレームで何度も呼ばれて固まる。フラグに畳んで
    //         フレームに1回だけ実行する
    let infoTick = 0;
    scene.onBeforeRenderObservable.add(() => {
        if (caramelDirty && state) {
            caramelDirty = false;
            state.pudding.rebakeCaramel();
            rebakeSauceColors(state.sauce);
            rebakeSauceColors(state.drops);
        }
        if (bodyDirty && state) { bodyDirty = false; state.pudding.rebakeBody(); }
        if (skinDirty) {
            skinDirty = false;
            const F = TextureLab.custardFields(TEX, GLOBAL, prof, 4211);
            rebakeCustardSkin(F);
        }
        if (sauceDirty && state) {
            sauceDirty = false;
            if (state.sauce) state.sauce.dispose();
            if (state.drops) state.drops.dispose();
            const pA = PLATES[currentPlate].albedo;
            state.sauce = buildSauce(scene, GLOBAL, prof, currentSeed + 51, mats.sauce, 0, 0, pA);
            state.drops = buildDroplets(scene, GLOBAL, currentSeed + 83, mats.sauce, 0, 0,
                Math.min(GLOBAL.sauceR * (0.62 + 0.55 * GLOBAL.sauceAmt) * 1.05,
                    GLOBAL.plateHalf * GLOBAL.plateWellS - 0.30), pA);
        }
        infoTick += engine.getDeltaTime();
        if (infoTick > 160) { infoTick = 0; updateInfo(); }
    });

    // 狭い画面ではカードを畳む
    if (vw < GLOBAL.compactWidth) {
        card.width = "232px";
        card.height = "78%";
        panel.width = "198px";
    }

    console.log("[Purin] build purin-2026-09-02-e",
        "| profile N=" + prof.N, "thMax=" + prof.thMax.toFixed(3),
        "| body verts=" + state.defBody.n, "coat verts=" + state.defCoat.n,
        "| tris=" + Math.round(state.pudding.tris),
        "| physics=" + physicsOn, "| build=" + state.ms + "ms");

    scene.onDisposeObservable.add(() => {
        for (const t of [cusAlb, cusORM, cusNrm, cusThk, carORM]) { if (t) t.dispose(); }
        for (const t of carNrms) { if (t) t.dispose(); }
        if (cloth && cloth.material && cloth.material.texs)
            for (const t of cloth.material.texs) t.dispose();
        if (mats.plate && mats.plate.texs) for (const t of mats.plate.texs) t.dispose();
    });

    return scene;
};

export default createScene;