// =====================================================================
//  Photoreal Fruit Jelly  /  写実的なゼリー        BUILD: jelly-2026-09-02-i
//  Babylon.js Playground 用（そのまま貼り付けて実行できます）
//
//  構成:
//    0. CONFIG      … 寸法・菊型の溝・吸収・器・物理
//    1. プリセット  … 味（吸収スペクトル）／器／テーブル
//    2. Rng / helpers
//    3. Noise
//    4. Mesh utils  … 巻き順の自動判定・法線の溶接
//    5. Profile     … 菊型の母線。弦長（＝光路長）も実測する
//    6. Flute       … 溝と天面の花。母線法線に沿って彫る
//    7. Jiggle      … モーダル変形（プルプルの本体）
//    8. TextureLab  … ゼリー肌・厚み・ガラス・白磁・木/布
//    9. Jelly       … ゼリー本体
//   10. Vessel      … ガラスのコンポート／小鉢／白磁皿 ＋ 透過光だまり
//   11. Scene       … 灯・物理（Havok）・ポストプロセス
//   12. GUI
//
//  ■ プリンとゼリーの決定的な違い
//
//  プリンの色は「表面のアルベド」で決まる。ゼリーの色は違う。
//  ゼリーは中身の詰まった色ガラスで、見えている色は
//
//      透過光 = 背景 × exp(−σ · d)
//
//  の d、つまり「その画素で光が中を何 cm 通ったか」でしか決まらない。
//  だから同じ色素でも、厚いところは濃く、溝のところは薄い。
//  ここを「濃い緑のアルベド」で塗ると、必ず緑のプラスチックになる。
//
//  【実測】参考写真2枚から透過光を拾った（sRGB → linear）。
//
//    緑（メロン） 胴 linear(0.30, 0.44, 0.05)   ← R より G が高い黄緑
//    赤（いちご） 胴 linear(0.56, 0.030, 0.030) ← G/B はほぼ吸収しきり
//
//  どちらも「胴の光路 ≒ 4.5cm」として σ = −ln(T)/4.5 を逆算した。
//  味のプリセットはこの「基準深さでの透過率」で持たせてある。
//  濃い色を直接持たせるより、こちらのほうが写真から追える。
//
//  ■ 実装（Babylon でどう出すか）
//
//  PBRMaterial の subSurface.refraction は、体積の色減衰を
//
//      transmittance = tintColor ^ (thickness / tintColorAtDistance)
//
//  で計算する。これは Beer–Lambert そのもの。だから
//
//    tintColorAtDistance = 1cm
//    tintColor           = exp(−σ)
//    thicknessTexture    = 母線から実測した弦長（＋溝のぶんの目減り）
//
//  と入れれば、吸収の式をそのままシェーダに渡せる。
//  厚みを「2r」や定数で近似すると、いちばん薄いはずの溝と縁が
//  いちばん濃くなって、ゼリーではなく色付きの樹脂に見える。
//
//  【対策】本体は透過だが、レンダリングは不透明パスに置く。
//    refraction は alpha ブレンドと独立に効くので、透明メッシュに
//    しなくても向こう側は出る。不透明のままにすれば
//      ・深度を書くので、ガラスの器の「奥側の壁」が正しく隠れる
//      ・器・皿・テーブルとの前後関係でソートに悩まない
//    実際、写真でもゼリー越しに背景の形は読めない（白ホリゾント）。
//    透けて見えているのは「色の付いた明るさ」であって、背景の像ではない
//
//  ■ 実物の要点（ここを外すと「緑色の円錐台」になる）
//    ・菊型の溝は、単なる波ではない。山は広く丸く、谷は細く深い。
//      cos をそのまま使うと洗濯板になる
//    ・天面の花と側面の溝は同じ型の同じ面。別々に作ると位相がずれる。
//      母線の法線方向に彫れば、上では花、横では溝に自動的に変わる
//    ・溝の底は薄いので明るく、山は厚いので濃い。ここが逆だと
//      「緑に塗った菊の置物」になる
//    ・ハイライトは稜線を縦に走る。揺れているとき、目に付くのは
//      形の変化ではなくこの線が動くことなので、法線を必ず一緒に変形させる
//    ・器の底はゼリーを通った光で明るく色づく。これが無いと、
//      ゼリーだけが空中で光っているように見える
//    ・ガラスの器は 1 種類ではない。ボウルは肉厚 2.4mm の薄板、
//      ステムとフットは中身の詰まった無垢のガラスで、光が通る距離が
//      10 倍以上ちがう。同じマテリアルで描くと、脚だけ完全に消えて
//      器が宙に浮く。薄板は「縁の一本の線」、無垢は「厚みぶんの屈折と
//      減衰」で見せる、と分けて作る
//    ・ガラスの器は「白く塗ってはいけない」。ガラスは入射光を反射と透過に
//      振り分けるだけで拡散反射をほとんど持たない。アルベドを白のまま
//      置くと乳白色のすりガラスになり、中のゼリーを覆って台無しにする。
//      アルベドは黒、見えるものは鏡面反射・映り込み・屈折だけ。
//      これは透過（KHR_materials_transmission 相当）を使う場合も同じ。
//      glTF の仕様上 baseColor は透過の色づけに使われるので白を入れたく
//      なるが、Babylon では拡散として残ってしまい、
//      GlassVaseFlowers の「透過なし」の作例とそっくりの乳白色になる。
//      無色のガラスなら useAlbedoToTintRefraction を切って黒にするのが正解
//    ・透過テクスチャの色空間を外すと器が白く飛ぶ。中身がガンマなのに
//      リニアとして読むと 2.4 倍に持ち上がるので、ガラス越しだけ
//      コントラストが抜けて乳白色になる。判定は「ガラス越しと
//      その周りを見比べる」でできて、白く抜けるならガンマ、
//      暗く沈むならリニア。GUI のボタンで 1 クリックで切り替わる
//    ・そのガラスに映り込むものが無いと、結局そこに何も見えない。
//      平坦な白い環境はガラスにとって最悪の条件なので、明暗のある
//      屋外 IBL とスカイボックス、そして色のあるテーブルを必ず置く
//    ・ゼリーはカスタードよりずっとよく響く。減衰比 0.05 前後で、
//      3〜4回揺れてから止まる。0.15 まで上げるとプリンに戻る
// =====================================================================

var createScene = async function () {
    // =================================================================
    // 0. CONFIG （単位は cm）
    // =================================================================
    const GLOBAL = {
        // ---- ゼリー本体の寸法 ---------------------------------------
        // 菊型（ゼリー型）を伏せた形。写真Aの 天面径/底径 = 0.60 に合わせた
        rBot: 4.05,          // 接地側（広いほう）の半径
        rTop: 2.50,          // 天面の平らなところの半径
        H: 5.30,          // 高さ
        filletTop: 0.72,          // 天面の肩の丸め。写真ではかなり丸い
        filletBot: 0.26,          // 底の縁の丸め
        barrel: 0.30,          // 胴のふくらみ（釣鐘に見せる）
        skirt: 0.18,          // 裾の張り出し
        skirtY: 0.42,          // 裾がいちばん張り出す高さ
        dish: 0.055,         // 天面のごく浅いへこみ（型の底）
        centerBoss: 0.10,          // 天面中心の小さな出っぱり（型の中心）

        // ---- 菊型の溝 -----------------------------------------------
        fluteN: 12,            // 溝の本数
        // 【対策】山と谷を同じ形にすると、ただの波（洗濯板）になる。
        //         実物の型は「山が広く丸く、谷が細く深い」。g^p の p を
        //         1 未満にすると谷だけが尖る
        flutePow: 0.60,
        fluteSide: 0.34,          // 側面の彫りの深さ（cm）
        fluteTop: 0.160,         // 天面の花びらの深さ
        fluteBotFade: 0.30,          // 底からこの範囲で彫りを浅くする
        fluteTwist: 0.030,         // 溝のごくわずかなねじれ（型抜きの跡）
        lobeAmp: 0.0035,        // 真円に見せないための微小な歪み

        segAxis: 92,            // 母線方向の分割
        segRound: 192,           // 周方向の分割（溝1本あたり 16）
        profileRes: 720,          // 母線の内部テーブル解像度

        // ---- 揺れ（モーダル）----------------------------------------
        // 【実測の根拠】ゼラチン 2.5% のゲルは G ≈ 3kPa、密度 1.03。
        //   せん断波速度 c = √(G/ρ) ≈ 1.7 m/s。高さ 5.3cm の片持ちなら
        //   f ≈ c/(4H) ≈ 8.0 Hz。カスタード（5.8Hz）より速い。
        //   そして何より減衰が小さい。ゼリーは 3〜4 回揺れてから止まる
        modeFreq: [8.00, 8.00, 12.60, 17.00, 17.00, 21.00],
        modeZeta: [0.055, 0.055, 0.075, 0.095, 0.095, 0.150],
        baseSlip: 0.06,          // 底も完全には固定されない（ガラスの上をよく滑る）
        driveShear: 0.34,
        driveVert: 0.30,
        driveTop: 0.13,
        jiggleGain: 2.60,
        freqScale: 0.70,          // 「やわらかさ」。小さいほどゆっくり大きく揺れる
        // 【対策】モード形状は微小変形の 1 次近似なので、振幅を上げると
        //         体積が反転して裏返る。振動子は線形のまま回し、
        //         表示に渡すところで tanh で滑らかに飽和させる
        modeMax: [1.15, 1.15, 0.66, 0.60, 0.60, 0.36],
        dampScale: 1.00,
        // 【対策】22Hz のモードを 1/240 で積分すると ωh = 0.58 まで行って
        //         振幅がじわじわ育つ。ゼリーは減衰が小さいぶん誤差が
        //         溜まりやすいので、プリンより細かく刻む
        jiggleSub: 1 / 480,
        jiggleGuard: 60,
        quietQ: 2.0e-4,
        quietQd: 2.0e-3,
        shakeVel: 9.5,
        pokeVel: 7.5,

        // ---- 物理 -----------------------------------------------------
        usePhysics: true,
        // 【対策】cm 系なので理屈では 981 だが、Havok の接触許容量と
        //         スリープ閾値はメートル系前提の絶対値。981 だと 1 ステップの
        //         めり込みが許容量を超えて押し戻され続けて震える
        gravity: 620,
        physicsHz: 120,
        dropH: 4.20,          // 器の見込みから何 cm 上で放すか
        mass: 0.62,
        friction: 0.42,         // ゼリーはガラスの上をよく滑る
        restitution: 0.06,
        linearDamping: 0.20,
        angularDamping: 0.92,
        hullSegA: 30,
        hullSegV: 22,
        settleVel: 0.9,
        settleTime: 0.45,
        settleTimeout: 4.0,

        // ---- 光学 -----------------------------------------------------
        sigmaScale: 1.00,          // GUI で色の濃さをまとめて振る
        refDepth: 4.50,          // 味プリセットの「基準の光路長」（cm）
        cloud: 0.30,          // 濁り（多重散乱）。0 で色ガラス、1 で乳白
        refraction: 0.92,          // 屈折の寄与
        ior: 1.34,          // ゼリーの屈折率（水 1.33 とほぼ同じ）
        // 【対策】溝の底は薄い。ここを厚みに反映しないと、いちばん明るく
        //         見えるはずの谷がいちばん濃くなって、菊の置物に見える
        fluteThin: 1.00,          // 溝ぶんの厚みの目減りをどれだけ効かせるか
        // 【対策】断面から測った弦長は「どの向きから見るか」を知らない。
        //   実際の照明は「明るい上半球 ＋ 暗いテーブル」なので、上を向いた
        //   面は入ってすぐ抜ける短い光路で光を集める。測った弦長をそのまま
        //   使うと、天面は −n が真下を向くぶん全高（5.2cm）が入って
        //   いちばん濃くなり、写真といちばん食い違う場所になる。
        //   【実測】写真A 天面 linear(0.463,0.571,0.168) / 胴 (0.251,0.390,0.024)。
        //   胴を基準に σ を決めたうえで天面を 0.42 だけ薄く扱うと、
        //   天面の計算値が (0.50,0.62,0.18) になって写真とほぼ重なる
        topThin: 0.42,
        // 器と敷物からの照り返しで、裾は上より明るい（写真A 裾 (0.383,0.448,0.162)）
        baseThin: 0.20,
        surfRough: 0.055,         // 表面の粗さ（型から抜いた面はほぼ鏡）
        skinBloom: 0.55,          // 離水した薄い水膜（ハイライトを滲ませる）

        // ---- 透過光だまり（器の底に落ちる色）---------------------------
        // 【対策】シャドウマップは色を持てない。ゼリーは光を通すので、
        //         器の底は「暗くなる」のではなく「色が付いて明るくなる」。
        //         影だけ落とすと、ゼリーが器から浮いて見える
        // 既定はオフ。加算の板は「無いと物足りない」より
        // 「有ると嘘くさい」に転びやすいので、要るときだけ足す
        poolOn: false,
        // 【対策】0.80 は強すぎた。透過テクスチャに二重計上されていたぶんを
        //   直したうえで、写真で見える程度まで落とす。写真2 でも器の底が
        //   緑に染まって見えるだけで、光っているわけではない
        poolGain: 0.40,
        poolSpread: 1.30,          // 接地半径の何倍まで広がるか
        poolSegR: 30,
        poolSegA: 96,
        causticN: 12,            // 溝が集光してできる明るい筋

        // ---- 透過（KHR_materials_transmission 相当）---------------------
        // 【対策】環境キューブへの屈折だけでは「実際に後ろにあるもの」が
        //   映らない。alpha ブレンドで薄く重ねる手も、参考の
        //   CompareTransmission の左半分（α合成）とまったく同じで、
        //   平板な膜にしかならない。glTF の KHR_materials_transmission は
        //   「不透明なシーンだけをいったんテクスチャへ描き、それを
        //   スクリーン空間の屈折先として引く」方式で、右半分のように
        //   後ろの像がそのまま透けて縁に強い反射が乗る。
        //   Babylon の glTF ローダも内部の TransmissionHelper が
        //   "opaqueSceneTexture" を作って同じことをしている
        // 【原因が特定できた経緯】一度これを既定にしたら器が一面
        //   すりガラスになった。GlassVaseFlowers の比較画像で、
        //   透過なし（左）が同じ乳白色になっているのを見て確定した。
        //   屈折自体は効いていて、その上に「拡散アルベドの白」が
        //   丸ごと乗っていたのが正体。glTF の透過は baseColor を
        //   透過の色づけに使うので白を入れていたが、Babylon は
        //   surfaceAlbedo を落としきってくれず、拡散として出てしまう。
        //   アルベドを黒にして、代わりに useAlbedoToTintRefraction を
        //   切れば（＝透過を色づけしない無色ガラス）両方が消える。
        //   合わせて屈折の mip を最鮮明に固定してある
        transmission: true,
        transmissionSize: 1024,
        // 【対策】不透明シーンテクスチャの色空間。ここを外すと器が
        //   白く飛ぶ。判定はテクスチャ単体ではなく「ガラス越しと
        //   その周りを見比べる」でできる。
        //     ・ガラス越しだけ白っぽく、コントラストが抜けている
        //       → 中身はガンマなのにリニアとして読んでいる（= true にする）
        //     ・ガラス越しだけ暗く沈む
        //       → 中身はリニアなのにガンマとして読んでいる（= false にする）
        //   実機では前者だったので既定を true にした。
        //   シーンに画像処理のポストプロセスが載っているかどうかで
        //   マテリアルの出力がリニアかガンマかが変わるため、
        //   一方に決め打ちできない。GUI で切り替えられるようにしてある
        transmissionGamma: true,

        // ---- 環境と背景 -----------------------------------------------
        // 【対策】平坦な灰色や真っ白の環境は、ガラスにとって最悪の条件になる。
        //   ガラスは自分の色を持たず、見えているのは映り込みだけなので、
        //   映り込む手がかりが無いと「白く濁った膜」にしかならない。
        //   ゼリー側も同じで、屈折で拾う環境が一様だと中に階調が出ず、
        //   色の付いた消しゴムに見える。明暗のある屋外 IBL と、
        //   それを映すスカイボックスを入れるだけで両方が一気に直る
        env: "country",
        // 【対策】createDefaultSkybox の箱は infiniteDistance なので、
        //   壁は常にカメラから size/2 の距離にある。不透明で深度も書くため、
        //   size/2 が「カメラから最遠のジオメトリまでの距離」を下回ると、
        //   引いたときにテーブルの遠い側が壁に切り取られて欠ける。
        //   このシーンは丸テーブル半径 32cm、カメラ最遠 70cm なので
        //   最遠点までおよそ 100cm。size/2 = 260cm で足りる。
        //   さらに camera.maxZ は箱の対角 size/2·√3 ≒ 450cm を超える必要がある
        skyboxSize: 520,
        camNear: 10,
        camFar: 520,

        // ---- 見た目 ---------------------------------------------------
        textureSize: 1024,
        thickTexSize: 512,
        vesselTexSize: 768,
        useSSAO: true,
        useDOF: true,
        // 【対策】被写体は 34cm 先の 20cm 角しかないので、この係数では
        //   卓上まで溶けてガラスの縁も甘くなる。さらに透過テクスチャは
        //   ポストプロセスを通らないので、ガラス越しだけ背景がくっきり
        //   残って「そこだけピントが合っている」ちぐはぐな絵になる。
        //   ボケは背景を沈める程度に留める
        dofRatio: 0.028,
        dofFStop: 5.6,
        // 【対策】ここはプリンと考え方が逆になる。プリンでは白飛びを
        //   避けるためアルベドを暗く作り、そのぶんを露出で戻していた。
        //   ゼリーの色は「白い背景の輝度 1.0 に透過率を掛けたもの」として
        //   写真から逆算してあるので、露出を上げるとその較正がそのまま
        //   ずれる。実測 linear(0.30,0.44,0.05) を狙って露出 1.18 で焼くと
        //   sRGB(178,207,100) まで浮いて、写真の (137,168,43) から
        //   はっきり白茶ける。1.0 近くに置いて、締めたいときは
        //   コントラストで当てる
        exposure: 1.06,
        contrast: 1.08,
        glassAlpha: 0.075,        // ガラスの被覆。写真の器はほとんど見えない
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
    // 1. プリセット
    // =================================================================
    //  味は「色」ではなく「基準の光路長 refDepth = 4.5cm を通ったあとの
    //  透過率」で持たせる。写真から拾えるのはこの値だから。
    //  σ = −ln(T0)/refDepth、1cm あたりの透過率 = T0^(1/refDepth) になる。
    //
    //  【実測】
    //    melon      写真A の胴 sRGB(142,171, 64) → linear(0.273,0.409,0.052)
    //    strawberry 写真B の胴 sRGB(197, 48, 48) → linear(0.561,0.030,0.030)
    //  どちらも「赤はほとんど素通り、青は吸収しきる」側と
    //  「緑だけ通す」側という、まったく逆のスペクトルになっている。
    const FLAVORS = {
        melon: {
            label: "メロン",
            T0: [0.300, 0.440, 0.050],   // 基準深さでの透過率（linear）
            cloud: [0.780, 0.900, 0.520],   // 濁り（多重散乱）の色
            cloudAmt: 1.00
        },
        strawberry: {
            label: "いちご",
            T0: [0.560, 0.030, 0.030],
            cloud: [0.960, 0.520, 0.520],
            cloudAmt: 1.15
        },
        grape: {
            label: "ぶどう",
            T0: [0.230, 0.045, 0.310],
            cloud: [0.720, 0.480, 0.860],
            cloudAmt: 1.05
        },
        orange: {
            label: "オレンジ",
            T0: [0.800, 0.310, 0.028],
            cloud: [1.000, 0.720, 0.400],
            cloudAmt: 0.95
        },
        coffee: {
            label: "コーヒー",
            T0: [0.400, 0.175, 0.062],
            cloud: [0.800, 0.640, 0.500],
            cloudAmt: 0.70
        },
        soda: {
            label: "サイダー",
            T0: [0.880, 0.925, 0.905],
            cloud: [0.940, 0.960, 0.980],
            cloudAmt: 0.45
        }
    };

    // ---- 器 ---------------------------------------------------------
    // 写真A は脚付きの薄いガラス、写真B は厚手の小鉢に白い受け皿。
    // 【対策】ガラスの器は「透明」にすると存在が消える。実物が見えるのは
    //         縁の厚みと、底の曲率が背景を歪めるところだけ。だから
    //         縁だけ厚くして、面はほぼ屈折だけで見せる
    const VESSELS = {
        compote: {
            label: "ガラスのコンポート", kind: "glass",
            // 【対策】口径 9.2cm はゼリー（半径 4.1cm）の 2.2 倍もあって、
            //   コンポートではなく「大きな平皿」に見えていた。写真2・3を
            //   測ると、縁の半径はゼリーの 1.4〜1.6 倍しかない。
            //   小さく深くするだけで、器がゼリーを抱えている感じになる
            rimR: 6.60, depth: 2.80, curve: 2.20, wall: 0.24,
            rimBead: 0.11, stem: true, stemR: 0.58, stemH: 4.90,
            footR: 3.40, footH: 0.40,
            // transmission = 透過率（glTF の transmissionFactor）
            // volume = 内部の厚み[cm]。0 なら薄肉（thin-walled）として扱い、
            //   屈折で像が曲がらない。参考の CompareTransmission の右球が
            //   まさにこれで、後ろの市松がほぼそのまま透ける
            // 【対策】volume を 0（薄肉）にしていたが、実機ではステム
            //   （volume あり）だけが正しく見えてボウルだけが破綻していた。
            //   壁 2.4mm でも斜めから見れば光路はその倍以上あるので、
            //   実測の肉厚ぶんは入れておく
            transmission: 1.00, volume: 0.32, attenuation: 24.0,
            tint: [0.985, 0.992, 0.988], rough: 0.030, saucer: null,
            // 【対策】ステムとフットは薄板ではなく無垢のガラス。ボウルと
            //   同じ被覆（α 0.075）で描くと、光路が 10 倍以上あるのに
            //   同じ薄さになって、脚だけ消えて器が宙に浮く。
            //   無垢の部分は別マテリアルにして、被覆・屈折・厚みを
            //   実際の光路長に見合う値へ上げる
            solidAlpha: 0.30,        // 被覆（裏表 2 パスで実効 0.51）
            solidRefract: 0.45,      // 屈折。脚はレンズのように像を曲げる
            solidVolume: 1.20,       // 光路長 cm（ステム径 1.16cm ＋ フット）
            solidAtten: 2.60,        // ガラスの緑が出る減衰距離 cm
            solidRough: 0.022
        },
        kobachi: {
            label: "ガラスの小鉢", kind: "glass",
            rimR: 6.10, depth: 1.55, curve: 1.70, wall: 0.42,
            rimBead: 0.20, stem: false, stemR: 0, stemH: 0,
            footR: 3.10, footH: 0.30,
            ribN: 26, ribAmp: 0.085,          // 押し型のリブ（写真B）
            // 厚手の押し型ガラスなので volume を入れて像を曲げる。
            // 参考の GlassHurricaneCandleHolder が近い
            transmission: 1.00, volume: 0.55, attenuation: 14.0,
            tint: [0.980, 0.988, 0.992], rough: 0.045, saucer: "white"
        },
        porcelain: {
            label: "白磁の平皿", kind: "china",
            rimR: 9.60, depth: 0.95, curve: 3.40, wall: 0.46,
            rimBead: 0.0, stem: false, stemR: 0, stemH: 0,
            footR: 5.20, footH: 0.34,
            albedo: [0.888, 0.897, 0.908], rough: 0.11, saucer: null
        }
    };

    // 受け皿（小鉢の下に敷く白い皿）
    const SAUCERS = {
        white: { label: "白磁", albedo: [0.890, 0.898, 0.906], rough: 0.11, R: 12.4 }
    };

    // ---- テーブル ---------------------------------------------------
    // 【対策】白い器を白い布の上に置いて白い背景に立てると、実測で
    //         全部が同じ明度に沈んでシルエットが読めなくなる。
    //         主役の色を変えるより、下に敷くものに色を入れるほうが速い
    const TABLES = {
        paper: {
            // 写真A の白ホリゾント。器の影だけが形を作る
            label: "白ホリゾント", kind: "cloth", tile: 1.6, sheen: 0.10,
            col: [0.930, 0.935, 0.940], contrast: 0.022
        },
        pinkCloth: {
            // 【実測】写真B の布は明部 sRGB(255,226,214)、手前 sRGB(204,160,149)
            label: "桃色の布", kind: "cloth", tile: 3.2, sheen: 0.34,
            col: [0.885, 0.700, 0.665], contrast: 0.075
        },
        oak: {
            label: "樫の板", kind: "wood", tile: 6.2, sheen: 0,
            P: {
                extent: 42, plankW: 11.5, pitch: 1.05, ringCenter: 9.0, figure: 2.10,
                lateW: 0.20, pore: 0.85, seamW: 0.16, rough: 0.52,
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
        slate: {
            label: "濃灰の石", kind: "stone", tile: 2.4, sheen: 0,
            col: [0.285, 0.288, 0.300]
        }
    };

    // ---- 環境（IBL）-------------------------------------------------
    //  ゼリーの色は「屈折で拾った環境の輝度 × 透過率」なので、環境を
    //  変えると較正がそのままずれる。モードごとに露出と各強度を持たせて、
    //  胴の色が写真と揃うところへ合わせ直せるようにしておく。
    //
    // 【対策】jelly（マテリアルの environmentIntensity）は、透過率を
    //   逆算したときの前提「背景の輝度 1.0」に対応する。ここを大きく
    //   振ると、せっかく写真から起こした σ が意味を失う
    const ENVS = {
        country: {
            label: "屋外（IBL）",
            // Playground 同梱の prefiltered IBL。明暗があるのでガラスが立つ
            url: "textures/country.env",
            rotationY: 2.10, skybox: true, skyboxBlur: 0.0,
            clear: [0.72, 0.78, 0.86],
            // 【対策】透過率は「背景の輝度 1.0」で逆算してある。屋外 IBL は
            //   半分が暗い地面なので、側面が屈折で拾う水平方向の輝度は
            //   1.0 をかなり下回る。そのままだと写真より暗いオリーブ色に
            //   沈むので、ゼリーの環境強度だけ持ち上げて較正へ戻す
            env: 1.00, jelly: 1.35, glass: 1.15, china: 1.00,
            key: 2.10, fill: 0.80, kick: 1.50, amb: 0.24,
            exposure: 0.98, contrast: 1.18
        },
        studio: {
            label: "白ホリゾント",
            url: "https://assets.babylonjs.com/environments/environmentSpecular.env",
            rotationY: 0.0, skybox: false, skyboxBlur: 0.0,
            clear: [0.955, 0.962, 0.968],
            env: 1.05, jelly: 1.00, glass: 1.15, china: 1.00,
            key: 2.70, fill: 1.05, kick: 1.85, amb: 0.42,
            exposure: 1.06, contrast: 1.08
        }
    };

    // ---- 丸テーブル ---------------------------------------------------
    // 【対策】これまで一辺 280cm の板を敷いていた。白い布のときは背景と
    //   同化して存在が消えるうえ、スカイボックスを入れると最遠点が
    //   半対角 198cm まで伸びて箱の壁に切られる。実寸の丸テーブルにすれば
    //   最遠点が 32cm に収まり、影も落ちて接地が読めるようになる
    const TABLE = { diameter: 64, thickness: 3.0, pedestal: 70, footDia: 38 };

    const START_FLAVOR = "melon";
    const START_VESSEL = "compote";
    // 【対策】既定を白い布にしていたので、器も皿も背景も同じ明度に沈んで
    //   シルエットがまったく読めなかった。下に敷くものに色を入れるのが
    //   いちばん速い
    const START_TABLE = "oak";
    const START_SEED = 20260902;

    // =================================================================
    // 2. Rng / helpers
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
    // 【対策】Node のコンストラクタは id = name を入れる。Inspector の
    //         ツリーは id で照合するので、同名の個体があると Scene Explorer の
    //         ピッカーが別の物を選ぶ。name と id の両方を明示的に振る
    const named = (node, name) => { node.name = name; node.id = name; return node; };

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
    // 3. Noise
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
        //         継ぎ目に縦一文字の線が出る。周方向は必ず周期にする
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
        // セルノイズ。ゼリーに閉じ込められた気泡に使う
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
    // 4. Mesh utils
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

    // 【対策】器の内面のような開いた面は重心基準の判定が効かない。
    //         外向きの参照方向を渡して、その内積の総和で決める
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
        named(mesh, name);
        const vd = new BABYLON.VertexData();
        vd.positions = positions; vd.indices = indices; vd.normals = normals;
        if (uvs) vd.uvs = uvs;
        if (colors) vd.colors = colors;
        vd.applyToMesh(mesh, !!updatable);
        // 【対策】頂点カラーを stride 4 で入れると hasVertexAlpha が立ち、
        //         不透明なのに透過パスへ回される。透過パスは深度書き込みが
        //         切られるので、器とゼリーの前後関係が壊れる
        mesh.hasVertexAlpha = false;
        return mesh;
    }

    // 角を円弧で丸めた折れ線。母線と器の断面の両方で使う
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
    //         入らず、シルエットに折れが出る
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
    // 5. Profile （菊型の母線）
    // =================================================================
    // v = 0 が天面の中心、v = 1 が底面の中心。刻みは弧長（＋曲率重み）。
    //
    // 【対策】制御点の添字で v を刻むと、丸めた肩だけテクスチャが詰まって
    //         縞に見える。必ず弧長で正規化する
    class Profile {
        constructor(cfg) {
            this.cfg = cfg;
            const H = cfg.H, rT = cfg.rTop, rB = cfg.rBot;

            // 角丸め前の骨格。天面 → 肩 → 胴 → 裾 → 底
            const ctrl = [
                [0, H],
                [rT, H],
                [rB * 0.985, cfg.skirtY + 0.55],
                [rB, cfg.skirtY],
                [rB * 0.955, 0],
                [0, 0]
            ];
            const rad = [0, cfg.filletTop, 0.55, 0.34, cfg.filletBot, 0];
            let poly = roundPolyline(ctrl, rad, 26);

            // 一度細かく刻み直してから変形を掛ける（変形後の弧長で刻むため）
            poly = resampleByArc(poly, 900, 0);

            for (const p of poly) {
                const r = p[0], y = p[1];
                // 天面のごく浅いへこみ（型の底の形）と、中心の小さな出っぱり
                const kTop = clamp((y - (H - cfg.filletTop)) / cfg.filletTop, 0, 1);
                const rIn = Math.min(1, r / Math.max(1e-6, rT - cfg.filletTop * 0.5));
                let yy = y - cfg.dish * (1 - rIn * rIn) * kTop;
                yy += cfg.centerBoss * Math.exp(-Math.pow(r / 0.62, 2)) * kTop;
                p[1] = yy;
                // 釣鐘のふくらみ。上下の面（sin = 0）には効かない
                let rr = r + cfg.barrel * Math.pow(Math.sin(Math.PI * clamp(y / H, 0, 1)), 0.85);
                // 裾の張り出し
                rr += cfg.skirt * Math.exp(-Math.pow((y - cfg.skirtY) / 0.60, 2))
                    * smooth(0.25, 1.2, r);
                p[0] = rr;
            }

            // 曲率重み付きで最終解像度へ。丸めた肩に点が寄る
            const fine = resampleByArc(poly, cfg.profileRes, 0.55);
            const N = fine.length;
            this.N = N;
            this.r = new Float64Array(N);
            this.y = new Float64Array(N);
            this.nr = new Float64Array(N);
            this.ny = new Float64Array(N);
            this.th = new Float64Array(N);   // 実測した弦長（＝光路長）
            for (let i = 0; i < N; i++) { this.r[i] = fine[i][0]; this.y[i] = fine[i][1]; }

            // 法線。v が増える向きの接線 t に対して (−t_y, t_r) が外向き
            for (let i = 0; i < N; i++) {
                const a = Math.max(0, i - 1), b = Math.min(N - 1, i + 1);
                const tr = this.r[b] - this.r[a], ty = this.y[b] - this.y[a];
                const l = Math.hypot(tr, ty) || 1;
                this.nr[i] = -ty / l;
                this.ny[i] = tr / l;
            }
            // 中心（r = 0）では天面が真上、底面が真下
            this.nr[0] = 0; this.ny[0] = 1;
            this.nr[N - 1] = 0; this.ny[N - 1] = -1;

            this._measureThickness();

            this.topY = this.y[0];
            this.maxR = Math.max.apply(null, Array.from(this.r));
            let L = 0;
            for (let i = 1; i < N; i++) L += Math.hypot(this.r[i] - this.r[i - 1], this.y[i] - this.y[i - 1]);
            this.arcLen = L;
        }

        // 【対策】ゼリーの色は光路長でしか決まらない。厚みを「2r」や
        //         定数で近似すると、シルエットのきわで厚みが最大になり、
        //         いちばん薄いはずの縁がいちばん濃くなる。
        //         断面多角形（母線を軸で鏡像にしたもの）に対して内向きの
        //         レイをファン状に飛ばし、実際の弦長の平均を測る。
        //         法線1本だけで測ると、肩の丸めのように「外から見れば
        //         薄いのに、法線方向には胴を斜めに貫く」場所で最大値が
        //         出てしまう
        _measureThickness() {
            const N = this.N;
            const px = [], py = [];
            for (let i = 0; i < N; i++) { px.push(this.r[i]); py.push(this.y[i]); }
            for (let i = N - 2; i >= 1; i--) { px.push(-this.r[i]); py.push(this.y[i]); }
            const M = px.length;
            const FAN = 11, SPAN = 1.31;          // ±75°
            for (let i = 0; i < N; i++) {
                const ox = this.r[i], oy = this.y[i];
                const base = Math.atan2(-this.ny[i], -this.nr[i]);
                let acc = 0, wsum = 0;
                for (let f = 0; f < FAN; f++) {
                    const off = SPAN * (f / (FAN - 1) * 2 - 1);
                    const dx = Math.cos(base + off), dy = Math.sin(base + off);
                    const wgt = Math.cos(off);      // 法線に近い向きほど重い
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
            //         乗り、ゼリーに輪切りの模様が出る。母線に沿って広く均す
            const sm = new Float64Array(N);
            for (let i = 0; i < N; i++) {
                let s = 0, w = 0;
                for (let k = -13; k <= 13; k++) {
                    const j = clamp(i + k, 0, N - 1);
                    const ww = 1 / (1 + Math.abs(k));
                    s += this.th[j] * ww; w += ww;
                }
                sm[i] = s / w;
            }
            this.thRaw = sm;

            // 【対策】ここからが「測った弦長」→「実際に効く光路長」の変換。
            //   弦長は向きを知らないので、上を向いた面は真下へ全高ぶん
            //   貫いた値が入ってしまう。照明は上半球が明るいので、
            //   上を向いた面ほど短い光路で光を集める。
            //   裾は器とテーブルからの照り返しでやはり明るい
            const cfg2 = this.cfg;
            const w = new Float64Array(N);
            for (let i = 0; i < N; i++) {
                const up = smooth(0.35, 0.95, this.ny[i]);
                const low = smooth(cfg2.H * 0.45, 0.0, this.y[i]);
                w[i] = sm[i] * (1 - cfg2.topThin * up) * (1 - cfg2.baseThin * low);
            }
            this.th = w;
            this.thMax = Math.max.apply(null, Array.from(w));
            let acc2 = 0;
            for (let i = 0; i < N; i++) acc2 += w[i];
            this.thMean = acc2 / N;
            // 味プリセットの基準点。写真A で「胴」を拾ったのと同じ高さ
            this.thRef = this.at(this.vAtY(cfg2.H * 0.60)).th;
        }

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

        // 高さ y に対応する v。
        // 【対策】天面には型の底のへこみ（dish）と中心の出っぱり（boss）が
        //   あるので、そこだけ y は単調にならない（中心 → 外周で一度
        //   下がってから上がる）。二分探索が正しいのは肩から下だけ。
        //   実際の呼び出しはすべて胴か裾なので実害は無いが、
        //   天面の y を渡すと肩側の解が返る
        vAtY(yy) {
            const N = this.N;
            if (yy >= this.y[0]) return 0;
            if (yy <= this.y[N - 1]) return 1;
            let lo = 0, hi = N - 1;
            while (hi - lo > 1) {
                const m = (lo + hi) >> 1;
                if (this.y[m] > yy) lo = m; else hi = m;
            }
            const d = (this.y[lo] - this.y[hi]) || 1e-9;
            const t = (this.y[lo] - yy) / d;
            return (lo + t) / (N - 1);
        }
    }

    // =================================================================
    // 6. Flute （菊型の彫り）
    // =================================================================
    //  型は1枚のつながった面なので、天面の花と側面の溝は同じもの。
    //  別々に作ると位相がずれて、上と横で別の型に見える。
    //
    // 【対策】母線の法線方向に彫れば、天面（法線が真上）では高さの
    //         凹凸＝花びらに、側面（法線が横）では半径の凹凸＝溝に
    //         自動的に変わる。分岐も継ぎ目の処理も要らない
    class Flute {
        constructor(cfg, prof, seed) {
            this.cfg = cfg; this.prof = prof;
            this.seed = seed;
            const rng = new Rng(seed);
            this.phase = rng.range(0, TAU);
            this.dentA = rng.range(0, TAU);
            this.dentW = rng.range(0.36, 0.55);
            this.dentY = rng.range(0.32, 0.64);
        }

        // 周方向の形。1 が山の頂点、0 が谷の底。
        // 【対策】cos をそのまま使うと山と谷が同じ形の「洗濯板」になる。
        //         g^p（p<1）にすると山が広く丸く、谷だけが細く尖る
        shape(theta, y) {
            const c = this.cfg;
            const tw = c.fluteTwist * (y / c.H);
            const g = 0.5 + 0.5 * Math.cos(c.fluteN * (theta + this.phase + tw));
            return Math.pow(clamp(g, 0, 1), c.flutePow);
        }

        // 彫りの深さ（cm）。天面と側面で振幅が違う
        amp(P) {
            const c = this.cfg;
            const ny = clamp(P.ny, -1, 1);
            // 天面ほど浅く、側面ほど深い。中心では花びらが集まりきるので 0 へ
            const upness = smooth(0.45, 0.92, ny);
            const radial = smooth(0.10, 0.62, P.r / c.rTop);
            const top = c.fluteTop * radial;
            const side = c.fluteSide;
            let a = mix(side, top, upness);
            // 底の縁では彫りを浅くする（接地面は平ら）
            a *= smooth(0.0, c.fluteBotFade, P.y);
            // 底面そのもの（法線が下向き）には彫らない
            a *= 1 - smooth(-0.45, -0.90, ny);
            return a;
        }

        // 法線方向の変位（負＝内側へ彫る）
        disp(P, theta) {
            return -this.amp(P) * (1 - this.shape(theta, P.y));
        }

        // 真円に見せないための微小な半径倍率 ＋ 型抜きのへこみ 1 箇所
        dev(theta, y) {
            const c = this.cfg, u = theta / TAU;
            let k = 1;
            k += c.lobeAmp * (Math.cos(3 * theta) * 0.6 + Math.sin(5 * theta + 1.1) * 0.4);
            k += c.lobeAmp * 1.3 * (Noise.angFbm(u, 7, this.seed + 11, 3) - 0.5) * 2;
            let da = theta - this.dentA;
            while (da > Math.PI) da -= TAU;
            while (da < -Math.PI) da += TAU;
            const az = Math.exp(-Math.pow(Math.abs(da) / this.dentW, 1.7));
            const ay = Math.exp(-Math.pow((y / c.H - this.dentY) / 0.34, 2));
            k -= (0.016 / c.rBot) * az * ay;
            return k;
        }

        // 光路長の目減り。溝の底は「両側から 1 回ずつ」削れている
        // 【対策】ここを入れないと、いちばん薄いはずの谷がいちばん濃くなり、
        //         緑に塗った菊の置物にしか見えない
        thinning(P, theta) {
            const d = this.amp(P) * (1 - this.shape(theta, P.y));
            return 2 * d * this.cfg.fluteThin;
        }
    }

    // =================================================================
    // 7. Jiggle （プルプル）
    // =================================================================
    //  Babylon の Havok プラグインが公開しているのは剛体・シェイプ・拘束
    //  までで、ソフトボディは出ていない。そこで役割を分ける。
    //
    //    Havok … 落下・着地・器との接触。つまり「剛体としての運動」
    //    自前  … 揺れそのもの。Havok が返す速度差分（＝接地の力積）を
    //            入力にした減衰調和振動子（モーダル）6 本
    //
    //  変位はすべて「静止形状の関数」なので、モード形状 Φk(p) はビルド時に
    //  頂点ごとに焼いておける。実行時は u = Σ qk Φk(p) の線形結合だけ。
    //
    //  使っているモード（すべて底面 y=0 を固定端とする）:
    //   | # | 内容             | 形状関数                     | 周波数 | 減衰比 |
    //   |---|------------------|------------------------------|--------|--------|
    //   | 0 | せん断 X（横揺れ）| ψ1 = 1.5s²−0.5s³（片持ち）  | 8.4 Hz | 0.055  |
    //   | 1 | せん断 Z         | 同上                         | 8.4 Hz | 0.055  |
    //   | 2 | 縦（つぶれ・のび）| u_y=−s / u_r=+r/2H（体積保存）|13.2 Hz | 0.075  |
    //   | 3 | 楕円 cos2θ       | φ3 = sin(0.78πs)             |17.8 Hz | 0.095  |
    //   | 4 | 楕円 sin2θ       | 同上                         |17.8 Hz | 0.095  |
    //   | 5 | 天面の膜         | τ(s)·(1−(r/rTop)²)           |22.0 Hz | 0.150  |
    //
    // 【対策】位置だけ動かして法線を放置すると、揺れているのに濡れて
    //         見えない。プルプル感の視覚的な主成分は「形の変化」ではなく
    //         「ハイライトが稜線を走ること」なので、法線の更新が本体。
    //         変形勾配 F = I + ∇u に対して n' ∝ cof(F)·n。振幅が数 mm と
    //         小さいので 1 次で十分で、n' ≈ normalize(n − (∇u)ᵀ n)
    const NMODE = 6;

    class ModeField {
        constructor(cfg, prof) {
            this.cfg = cfg;
            this.H = cfg.H;
            this.rTop = cfg.rTop;
            this.rBot = prof.maxR;
            this.slip = cfg.baseSlip;
        }
        psi1(s) { const b = this.slip; return b + (1 - b) * (1.5 * s * s - 0.5 * s * s * s); }
        phi3(s) { return Math.sin(0.78 * Math.PI * s); }
        tauTop(s) { return smooth(0.60, 1.0, s); }

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
                    // ((∇Φ)ᵀ n)_j = Σ_m n_m ∂Φ_m/∂x_j を中心差分で
                    field.vec(k, x + EPS, y, z, b); field.vec(k, x - EPS, y, z, c);
                    const w0 = ((b[0] - c[0]) * nx + (b[1] - c[1]) * ny + (b[2] - c[2]) * nz) / (2 * EPS);
                    field.vec(k, x, y + EPS, z, b); field.vec(k, x, y - EPS, z, c);
                    const w1 = ((b[0] - c[0]) * nx + (b[1] - c[1]) * ny + (b[2] - c[2]) * nz) / (2 * EPS);
                    field.vec(k, x, y, z + EPS, b); field.vec(k, x, y, z - EPS, c);
                    const w2 = ((b[0] - c[0]) * nx + (b[1] - c[1]) * ny + (b[2] - c[2]) * nz) / (2 * EPS);
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
                const nx = rn[i3] - wx, ny = rn[i3 + 1] - wy, nz = rn[i3 + 2] - wz;
                const l = Math.hypot(nx, ny, nz) || 1;
                nor[i3] = nx / l; nor[i3 + 1] = ny / l; nor[i3 + 2] = nz / l;
            }
            this.mesh.updateVerticesData(BABYLON.VertexBuffer.PositionKind, pos, false, false);
            this.mesh.updateVerticesData(BABYLON.VertexBuffer.NormalKind, nor, false, false);
        }

        dispose() { this.M = null; this.rest = null; this.restN = null; }
    }

    // 減衰調和振動子の束。
    // 【対策】60fps のデルタでそのまま積分すると、22Hz のモードは
    //         ωh = 2.3 まで行って発散する。しかもゼリーは減衰比 0.05 と
    //         小さいので、わずかな数値誤差でも振幅がじわじわ育つ。
    //         内部で 1/480 に刻む
    class Jiggle {
        constructor(cfg) {
            this.cfg = cfg;
            this.q = new Float64Array(NMODE);
            this.qd = new Float64Array(NMODE);
            this.Q = new Float64Array(NMODE);
            this.acc = 0;
            this.imp = new Float64Array(NMODE);
            this.vPrev = new V3(0, 0, 0);
            this.hasPrev = false;
            this.rng = new Rng(0x5E11ED);
            this.awake = true;
            this.peak = 0;
        }

        omega(k) { return TAU * this.cfg.modeFreq[k] * this.cfg.freqScale; }
        zeta(k) { return this.cfg.modeZeta[k] * this.cfg.dampScale; }

        // 剛体から届いた「速度の差分」を参加係数を通してモードへ渡す。
        // 【対策】加速度（＝Δv / デルタ時間）を外力として積分すると、
        //         内部ステップの端数が持ち越されるぶんだけ、2〜3 フレームで
        //         終わる衝撃の伝わり方が表示フレームレートで変わる。
        //         Δv をそのまま q̇ へ足せば、時間の刻みが一切効かなくなる
        driveImpulse(dvx, dvy, dvz) {
            const c = this.cfg, g = c.jiggleGain;
            this.imp[0] += -c.driveShear * dvx * g;
            this.imp[1] += -c.driveShear * dvz * g;
            this.imp[2] += c.driveVert * dvy * g;
            this.imp[5] += c.driveTop * dvy * g;
        }

        impact(strength) {
            const r = this.rng;
            const s = strength * this.cfg.jiggleGain;
            this.qd[3] += r.gauss(0, 0.30) * s;
            this.qd[4] += r.gauss(0, 0.30) * s;
            this.qd[0] += r.gauss(0, 0.22) * s;
            this.qd[1] += r.gauss(0, 0.22) * s;
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
                const amp = s * 0.55 * Math.hypot(dx, dz);
                this.qd[3] += -Math.cos(2 * th) * amp;
                this.qd[4] += -Math.sin(2 * th) * amp;
            }
            if (py > H * 0.80 && r < rTop) this.qd[5] += -dy * s * 0.9;
            this.awake = true;
        }

        step(dt) {
            const h = this.cfg.jiggleSub;
            let any = 0;
            for (let k = 0; k < NMODE; k++) {
                if (this.imp[k] !== 0) { this.qd[k] += this.imp[k]; this.imp[k] = 0; any = 1; }
            }
            if (any) this.awake = true;
            this.acc += Math.min(dt, 0.05);
            let guard = 0;
            while (this.acc >= h && guard++ < this.cfg.jiggleGuard) {
                for (let k = 0; k < NMODE; k++) {
                    const w = this.omega(k), z = this.zeta(k);
                    this.qd[k] += (-2 * z * w * this.qd[k] - w * w * this.q[k]) * h;
                    this.q[k] += this.qd[k] * h;
                }
                this.acc -= h;
            }
            // 【対策】guard で打ち切ったぶんの残りを持ち越すと、重い
            //         フレームのあと acc が溜まり続けて雪だるまになる
            if (guard >= this.cfg.jiggleGuard) this.acc = 0;

            let mq = 0, mqd = 0;
            for (let k = 0; k < NMODE; k++) {
                const aq = Math.abs(this.q[k]), ad = Math.abs(this.qd[k]);
                if (aq > mq) mq = aq;
                if (ad > mqd) mqd = ad;
            }
            this.peak = mq;
            const quiet = mq < this.cfg.quietQ && mqd < this.cfg.quietQd;
            if (quiet && this.awake) {
                for (let k = 0; k < NMODE; k++) { this.q[k] = 0; this.qd[k] = 0; }
                this.awake = false;
                return true;      // 最後の1回は静止形状を書き戻す
            }
            if (!quiet) this.awake = true;
            return this.awake;
        }

        // 【対策】モード形状は微小変形の 1 次近似なので、q を上げていくと
        //         体積が反転してメッシュが裏返る。振動子は線形のまま回して、
        //         表示へ渡すところだけ tanh で滑らかに頭打ちにする
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
    // 8. TextureLab
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
            // 【対策】ORM・法線・厚みは「色」ではない。既定（gammaSpace = true）
            //         のままだと厚み 0.5 が線形 0.22 として渡り、
            //         ゼリーが狙いの倍近く明るくなる
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
                        const nx = -dx, ny = -dy, nz = 1;
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

        // ---- ゼリーの肌 ----------------------------------------------
        //  型から抜いた面なので、でこぼこで写実性を出す相手ではない。
        //  効くのは「離水した薄い水膜」と「表面近くの小さな気泡」だけ。
        //
        // 【対策】ノイズを (x,z) の実寸で引くと、側面では半径がほとんど
        //         変わらないので座標が方位角しか運ばず、模様が高さ方向へ
        //         引き伸ばされる。面上の距離、すなわち（周方向の弧長,
        //         母線の弧長）で引かないといけない
        jellyFields(size, cfg, prof, seed) {
            const n = size * size;
            const F = { h: new Float32Array(n), wet: new Float32Array(n), bub: new Float32Array(n) };
            const arc = prof.arcLen, rRef = prof.maxR;
            const kOf = (P) => P / (TAU * rRef);
            const P_FINE = 160, P_MID = 52, P_BUB = 34, P_WET = 12;
            const kFine = kOf(P_FINE), kMid = kOf(P_MID), kBub = kOf(P_BUB), kWet = kOf(P_WET);
            for (let y = 0; y < size; y++) {
                const v = y / size;
                const P = prof.at(v);
                // 【対策】極（r→0）へ寄ると周方向の座標が1点に潰れて
                //         放射状の星が出る。中心付近では周方向の寄与を落とす
                const polar = smooth(0.0, 0.60, P.r);
                const mvF = v * arc * kFine, mvM = v * arc * kMid;
                const mvB = v * arc * kBub, mvW = v * arc * kWet;
                for (let x = 0; x < size; x++) {
                    const u = x / size, i = y * size + x;
                    const fine = Noise.fbm2u(u * P_FINE, mvF, P_FINE, seed + 5, 2);
                    const mid = Noise.fbm2u(u * P_MID, mvM, P_MID, seed + 17, 3);
                    // ゲルの面は鏡に近い。起伏は 0.02 相当しか入れない
                    let hgt = 0.50 + 0.020 * (fine - 0.5) * polar + 0.030 * (mid - 0.5) * polar;

                    // 離水した水膜。下へ行くほど溜まる（重力）
                    const w0 = Noise.fbm2u(u * P_WET, mvW, P_WET, seed + 33, 3);
                    const wet = clamp((w0 - 0.42) * 2.2, 0, 1)
                        * mix(0.35, 1.0, 1 - smooth(0.0, cfg.H * 0.75, P.y));
                    F.wet[i] = wet * polar;
                    hgt += 0.012 * wet;

                    // 表面近くに閉じ込められた小さな気泡
                    const c = Noise.cell2(u * P_BUB, mvB, seed + 41, P_BUB);
                    const bub = (1 - smooth(0.055, 0.16, c[0])) * polar
                        * smooth(0.20, 0.70, Noise.v2u(u * P_BUB, mvB, P_BUB, seed + 61));
                    F.bub[i] = bub;
                    hgt += 0.055 * bub;

                    F.h[i] = hgt;
                }
            }
            return F;
        },

        // R = AO, G = roughness, B = metallic
        // 【対策】一様な粗さにすると、ゼリーではなく「色付きのガラス玉」に
        //         なる。実物は離水した水膜のところだけさらに滑らかで、
        //         そこにハイライトが伸びる
        jellyORM(size, F, cfg, scene) {
            return this._tex("jellyORM", size, size, (d) => {
                const base = cfg.surfRough;
                for (let i = 0; i < size * size; i++) {
                    const ao = clamp(1 - 0.10 * F.bub[i], 0.85, 1);
                    let rough = base + 0.055 * (F.h[i] - 0.50) / 0.05
                        - cfg.skinBloom * 0.030 * F.wet[i] + 0.05 * F.bub[i];
                    rough = clamp(rough, 0.015, 0.28);
                    const o = i * 4;
                    d[o] = Math.round(ao * 255);
                    d[o + 1] = Math.round(rough * 255);
                    d[o + 2] = 0;
                    d[o + 3] = 255;
                }
            }, scene, { linear: true });
        },

        // ---- 光路長（厚み）テクスチャ ---------------------------------
        //  ゼリーの見えを決めているのは、ほぼこれ 1 枚。
        //  母線から実測した弦長から、溝の彫りぶんを引いて焼く。
        //
        // 【対策】Babylon の subSurface は、glTF 互換フラグが立っていない
        //         ときは thicknessTexture の R を、立っているときは G を
        //         読む。片方だけ埋めると、フラグ次第で厚みが 1.0 固定に
        //         なって「全面まっ黒のゼリー」か「色の付かないゼリー」に
        //         なる。R と G の両方へ同じ値を書く
        thicknessTex(size, cfg, prof, flute, scene) {
            const W = Math.max(8, Math.round(size) || 512);
            const Hh = W;
            const S = {};
            return this._tex("jellyThick", W, Hh, (d, w, h) => {
                const inv = 1 / Math.max(1e-6, prof.thMax);
                for (let y = 0; y < h; y++) {
                    const v = y / (h - 1);
                    const P = prof.at(v);
                    S.r = P.r; S.y = P.y; S.ny = P.ny;
                    for (let x = 0; x < w; x++) {
                        const theta = (x / w) * TAU;
                        const t = Math.max(0, P.th - flute.thinning(P, theta));
                        const g = Math.round(clamp(t * inv, 0, 1) * 255);
                        const o = (y * w + x) * 4;
                        d[o] = g; d[o + 1] = g; d[o + 2] = g; d[o + 3] = 255;
                    }
                }
            }, scene, { linear: true, clampV: true });
        },

        // ---- ガラス ----------------------------------------------------
        // 【対策】完全に平らなガラスは CG にしか無い。手吹きでも型でも、
        //         実物には緩いうねりと、ごく小さな気泡・脈理がある。
        //         これが無いと器の存在が消える
        glassFields(size, seed, ribN, ribAmp) {
            const n = size * size;
            const F = { h: new Float32Array(n), flaw: new Float32Array(n) };
            for (let y = 0; y < size; y++) {
                for (let x = 0; x < size; x++) {
                    const u = x / size, v = y / size, i = y * size + x;
                    const a = Noise.fbm2u(u * 6, v * 4 + 2, 6, seed + 7, 3);
                    const b = Noise.fbm2u(u * 30, v * 20 + 5, 30, seed + 23, 2);
                    let hgt = 0.5 + 0.28 * (a - 0.5) + 0.045 * (b - 0.5);
                    if (ribN > 0) {
                        // 押し型のリブ（写真B の小鉢）
                        const g = 0.5 + 0.5 * Math.cos(ribN * u * TAU);
                        hgt += ribAmp * 6.0 * (Math.pow(g, 0.7) - 0.5) * smooth(0.06, 0.55, v);
                    }
                    F.h[i] = hgt;
                    const c = Noise.v2(u * 190, v * 130, seed + 53);
                    F.flaw[i] = smooth(0.980, 0.999, c);
                }
            }
            return F;
        },

        // ---- 白磁 ------------------------------------------------------
        porcelainFields(size, seed) {
            const n = size * size;
            const F = { h: new Float32Array(n), spec: new Float32Array(n) };
            for (let y = 0; y < size; y++) {
                for (let x = 0; x < size; x++) {
                    const u = x / size, v = y / size, i = y * size + x;
                    const a = Noise.fbm2u(u * 9, v * 5 + 2, 9, seed + 7, 3);
                    const b = Noise.fbm2u(u * 40, v * 26 + 5, 40, seed + 23, 2);
                    F.h[i] = 0.5 + 0.30 * (a - 0.5) + 0.055 * (b - 0.5);
                    const c = Noise.v2(u * 220, v * 150, seed + 53);
                    F.spec[i] = smooth(0.975, 0.999, c);
                }
            }
            return F;
        },

        // ---- 布 --------------------------------------------------------
        cloth(scene, size, seed, col, contrast) {
            return this._tex("clothAlb", size, size, (d, w) => {
                for (let y = 0; y < w; y++) {
                    for (let x = 0; x < w; x++) {
                        const u = x / w, v = y / w, i = (y * w + x) * 4;
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
        // 【対策】年輪を sin(d) で描くと等間隔・等濃度の縞になり、段ボールに
        //         見える。輪の番号をハッシュして幅・濃さ・位相を個別に振る
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
                    const pi = Math.floor(Z / P.plankW);
                    const Zl = Z - pi * P.plankW;
                    const ph = hash1(pi, seed + 5);
                    const ctr = -P.ringCenter * (0.6 + 0.8 * hash1(pi, seed + 11));
                    let dd = Math.abs(Zl - ctr) + ph * P.pitch;
                    dd += P.figure * (Noise.fbm2(X * 0.085 + pi * 13, 3.1, seed + 23, 3) - 0.5);
                    dd += P.figure * 0.35 * (Noise.fbm2(X * 0.30 + 7, Zl * 0.09, seed + 37, 2) - 0.5);
                    const t = dd / P.pitch;
                    const ri = Math.floor(t);
                    const h1 = hash1(ri + pi * 977, seed + 53);
                    const h2 = hash1(ri + pi * 977, seed + 71);
                    const f = t - ri + 0.30 * (h1 - 0.5);
                    const lw = P.lateW * (0.50 + 1.00 * h1);
                    const late = smooth(1 - lw, 1 - lw * 0.22, clamp(f, 0, 1)) * (0.55 + 0.90 * h2);
                    F.late[i] = clamp(late, 0, 1);
                    const fib = Noise.fbm2(X * 3.2, Z * 46, seed + 89, 2) - 0.5;
                    const pn = Noise.v2(X * 2.6 + 31, Z * 62 + 3, seed + 101);
                    const pore = smooth(0.86, 0.99, pn) * (1 - F.late[i]) * P.pore;
                    F.pore[i] = pore;
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
                    const r = mix(P.early[0], P.late[0], k);
                    const g = mix(P.early[1], P.late[1], k);
                    const b = mix(P.early[2], P.late[2], k);
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
    // 9. Jelly （本体）
    // =================================================================
    //  味 → 光学パラメータ。写真から拾えるのは「基準の光路長を通った
    //  あとの透過率 T0」だけなので、そこから逆算する。
    //
    //      σ    = −ln(T0) / refDepth          （1cm あたりの消散係数）
    //      tint = exp(−σ · sigmaScale)        （1cm あたりの透過率）
    //
    //  Babylon の subSurface は transmittance = tint^(thickness/tintAtDistance)
    //  を計算するので、tintAtDistance = 1cm にしておけば
    //  そのまま Beer–Lambert になる。
    //
    // 【対策】tint の成分を 1.0 にすると、そのチャンネルは何 cm 通っても
    //         減らない。せっかく実測した厚みが効かなくなり、
    //         胴の厚いところまで一律に光って「発光する寒天」に見える。
    //         必ず 1.0 未満へ落とす
    function flavorOptics(fl, cfg, refDepth) {
        const d0 = Math.max(0.5, refDepth);
        const sig = [0, 0, 0], tin = [0, 0, 0];
        for (let c = 0; c < 3; c++) {
            const t0 = clamp(fl.T0[c], 1e-4, 0.999);
            sig[c] = -Math.log(t0) / d0;
            tin[c] = clamp(Math.exp(-sig[c] * cfg.sigmaScale), 0.020, 0.996);
        }
        // 濁り（多重散乱）の色。透過とは別に、面から返ってくる淡い色
        const cl = fl.cloud;
        const amt = cfg.cloud * (fl.cloudAmt || 1);
        return {
            sigma: sig,
            tint: new BABYLON.Color3(tin[0], tin[1], tin[2]),
            // 【対策】albedoColor をそのまま味の色にすると、屈折で来る色と
            //         二重になって彩度が飽和する。屈折側が主役なので、
            //         こちらは「濁りぶんの淡い色」だけを持たせる
            albedo: new BABYLON.Color3(cl[0] * amt, cl[1] * amt, cl[2] * amt),
            cloudAmt: amt,
            // 器の底に落ちる透過光の色（基準深さを 1 回通ったぶん）
            pool: [fl.T0[0], fl.T0[1], fl.T0[2]]
        };
    }

    class Jelly {
        constructor(scene, cfg, prof, flute, seed, mat) {
            this.scene = scene; this.cfg = cfg; this.prof = prof; this.flute = flute;
            this.seed = seed;
            this.body = this._build(mat);
            this.tris = this.body.getTotalIndices() / 3;
            // 器に触れている半径（透過光だまりの内径に使う）
            this.contactR = this._contactR();
        }

        // 表面点。本体も凸包も必ずこれを通す
        surf(v, theta, out) {
            const P = this.prof.at(v);
            const k = this.flute.dev(theta, P.y);
            const r = P.r * k;
            const nl = Math.hypot(P.nr, P.ny) || 1;
            const nr = P.nr / nl, ny = P.ny / nl;
            const d = this.flute.disp(P, theta);
            const cs = Math.cos(theta), sn = Math.sin(theta);
            const rr = r + nr * d;
            out.r = rr;
            out.x = cs * rr; out.y = P.y + ny * d; out.z = sn * rr;
            out.nr = nr; out.ny = ny;
            out.nx = cs * nr; out.nz = sn * nr;
            out.th = P.th;
            return out;
        }

        _build(mat) {
            const cfg = this.cfg, N = cfg.segAxis, M = cfg.segRound;
            const W = M + 1;                       // 周は継ぎ目で1点重ねる
            const total = N * W + 2;
            const positions = new Float32Array(total * 3);
            const uvs = new Float32Array(total * 2);
            const S = {};

            for (let i = 0; i < N; i++) {
                const v = mix(0.0030, 0.9970, i / (N - 1));
                for (let j = 0; j <= M; j++) {
                    const theta = (j % M) / M * TAU;
                    this.surf(v, theta, S);
                    const k = i * W + j;
                    positions[k * 3] = S.x; positions[k * 3 + 1] = S.y; positions[k * 3 + 2] = S.z;
                    // 【対策】厚みテクスチャの u は方位角そのもの。ここを
                    //         (j%M)/M で書くと最後の列だけ u=0 に戻り、
                    //         継ぎ目に溝1本ぶんの色の段が出る
                    uvs[k * 2] = j / M; uvs[k * 2 + 1] = v;
                }
            }
            // 天面・底面のキャップ中心
            const capA = N * W, capB = N * W + 1;
            const Ptop = this.prof.at(0), Pbot = this.prof.at(1);
            positions[capA * 3] = 0; positions[capA * 3 + 1] = Ptop.y; positions[capA * 3 + 2] = 0;
            positions[capB * 3] = 0; positions[capB * 3 + 1] = Pbot.y; positions[capB * 3 + 2] = 0;
            uvs[capA * 2] = 0.5; uvs[capA * 2 + 1] = 0;
            uvs[capB * 2] = 0.5; uvs[capB * 2 + 1] = 1;

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
            const mesh = makeMesh("jellyBody", positions, indices, normals, uvs, null, this.scene, true);
            mesh.material = mat;
            mesh.receiveShadows = false;   // 自分は透過体。影を受けると濁る
            this._windScore = finalize.lastScore;
            return mesh;
        }

        // 底の縁（接地するリング）の半径。溝の谷でいちばん内側になる
        _contactR() {
            const S = {};
            let mx = 0;
            const v = this.prof.vAtY(0.12);
            for (let j = 0; j < 64; j++) {
                this.surf(v, j / 64 * TAU, S);
                if (S.r > mx) mx = S.r;
            }
            return mx;
        }

        // 【対策】表示用メッシュは 1.8万頂点ある。これをそのまま
        //         PhysicsShapeConvexHull に渡すと生成のたびに固まる。
        //         同じ母線を低解像度で評価した代理から凸包を取って捨てる。
        //         溝は入れない（凸包はどのみち谷をまたいで張られるし、
        //         ほぼ同一平面の面が増えて接触が毎ステップ飛び移る）
        hullShape(scene) {
            const cfg = this.cfg, N = cfg.hullSegV, M = cfg.hullSegA;
            const pos = [];
            for (let i = 0; i < N; i++) {
                const v = mix(0.004, 0.996, i / (N - 1));
                const P = this.prof.at(v);
                // 谷ぶんだけ内側へ寄せておく。等倍だと表示面から溝の
                // 深さぶんはみ出して、器との間に隙間が空いて見える
                const rr = Math.max(0, P.r - this.flute.amp(P) * 0.55);
                for (let j = 0; j < M; j++) {
                    const th = j / M * TAU;
                    pos.push(Math.cos(th) * rr, P.y, Math.sin(th) * rr);
                }
            }
            const proxy = new BABYLON.Mesh("jellyHullProxy", scene);
            named(proxy, "jellyHullProxy");
            const vd = new BABYLON.VertexData();
            vd.positions = pos;
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

        dispose() { this.body.dispose(); }
    }

    // =================================================================
    // 10. Vessel （器）
    // =================================================================
    //  写真A は脚付きの薄いガラス、写真B は厚手の小鉢。どちらも
    //  「内面と外面を張って縁で閉じた殻」として作る。
    //
    // 【対策】厚みゼロの一枚板でガラスを作ると、屈折が「面 1 枚ぶん」に
    //         なって板ガラスに見える。ガラスらしさは縁の厚みから出る。
    //         物理の当たり判定にも一枚板は使えない（すり抜ける）
    function bowlInnerY(V, s) { return V.depth * Math.pow(clamp(s, 0, 1), V.curve); }
    function bowlSlope(V, s) {
        const e = 2e-3;
        return (bowlInnerY(V, Math.min(1, s + e)) - bowlInnerY(V, Math.max(0, s - e))) / (2 * e);
    }

    function buildBowl(scene, V, mat, seed) {
        const M = 168, K = 44, W = M + 1;
        const R = V.rimR, wall = V.wall;
        const LAY = (K + 1) * W;
        const RIMSEG = 6;
        const total = LAY * 2 + (RIMSEG + 1) * W;
        const positions = new Float32Array(total * 3);
        const uvs = new Float32Array(total * 2);
        const rng = new Rng(seed);
        const wob = rng.range(0, TAU);

        const inner = [], outer = [];
        for (let i = 0; i <= K; i++) {
            const s = i / K;
            const y = bowlInnerY(V, s), dy = bowlSlope(V, s);
            // 断面法線（r-y 平面）。内面から見て上向き
            const g = dy / Math.max(1e-6, R);
            const nl = Math.hypot(1, g) || 1;
            inner.push([R * s, y, -g / nl, 1 / nl]);
            outer.push([R * s + (g / nl) * wall, y - (1 / nl) * wall]);
        }
        // 【対策】外面の中心は、対称性から必ず軸上に来るはずだが、
        //   見込みの傾きを数値微分で取っているので s=0 でも 1e-3 程度の
        //   傾きが残り、半径 7µm の極小の円になる。ここに周方向のうねりが
        //   掛かると頂点が溶接しきれず、外面の中心に微小な穴が開いて
        //   ガラス越しに抜ける（小鉢のときだけ再現した）。軸上へ畳む
        outer[0][0] = 0;
        inner[0][0] = 0;

        for (let i = 0; i <= K; i++) {
            const s = i / K;
            const IN = inner[i], OU = outer[i];
            for (let j = 0; j <= M; j++) {
                const theta = (j % M) / M * TAU;
                const cs = Math.cos(theta), sn = Math.sin(theta);
                // 手吹き・型どちらでも、実物には緩いうねりがある
                const wv = 1 + 0.0022 * Math.sin(3 * theta + wob) + 0.0014 * Math.sin(7 * theta);
                let ro = OU[0];
                if (V.ribN) {
                    // 押し型のリブ（写真B）。外面だけ、縁へ向かって立ち上がる
                    const gg = 0.5 + 0.5 * Math.cos(V.ribN * theta);
                    ro += V.ribAmp * (Math.pow(gg, 0.7) * 2 - 1) * smooth(0.10, 0.72, s);
                }
                const a = i * W + j, b = LAY + a;
                positions[a * 3] = IN[0] * wv * cs; positions[a * 3 + 1] = IN[1];
                positions[a * 3 + 2] = IN[0] * wv * sn;
                positions[b * 3] = ro * wv * cs; positions[b * 3 + 1] = OU[1];
                positions[b * 3 + 2] = ro * wv * sn;
                uvs[a * 2] = j / M; uvs[a * 2 + 1] = s * 0.5;
                uvs[b * 2] = j / M; uvs[b * 2 + 1] = 1 - s * 0.5;
            }
        }
        // 縁の玉（リップ）。内面の縁と外面の縁をつなぐ帯。
        // 【対策】ここを「中点まわりの円弧 ＋ 玉のぶんだけ半径を足す」で
        //   作ると、両端が内面・外面の縁のリングとぴったり重ならない。
        //   結果、器のいちばん目立つ縁に幅 rimBead の穴が全周ぶん開き、
        //   ガラスなので裏側がそのまま見えて「縁が二重の輪」になる。
        //   端点は必ず実際の縁の点そのものにして、ふくらみは
        //   垂線方向の sin(πt) で足す
        // 【対策】帯の端点は、内面・外面の縁のリングと「同じ式で」
        //   計算しないといけない。うねり wv やリブを掛け忘れると、
        //   位置が μm 単位でずれて溶接に失敗し、縁が全周ぶん開く。
        //   実際、最初はここで幅 rimBead の輪が抜けていた
        const base = LAY * 2;
        const iR = inner[K], oR = outer[K];
        for (let j = 0; j <= M; j++) {
            const theta = (j % M) / M * TAU;
            const cs = Math.cos(theta), sn = Math.sin(theta);
            const wv = 1 + 0.0022 * Math.sin(3 * theta + wob) + 0.0014 * Math.sin(7 * theta);
            let roJ = oR[0];
            if (V.ribN) {
                const gg = 0.5 + 0.5 * Math.cos(V.ribN * theta);
                roJ += V.ribAmp * (Math.pow(gg, 0.7) * 2 - 1) * smooth(0.10, 0.72, 1);
            }
            const r0 = iR[0] * wv, y0 = iR[1];
            const r1 = roJ * wv, y1 = oR[1];
            let px2 = y1 - y0, py2 = -(r1 - r0);
            const pl = Math.hypot(px2, py2) || 1; px2 /= pl; py2 /= pl;
            if (px2 < 0) { px2 = -px2; py2 = -py2; }      // 外向きを選ぶ
            for (let i = 0; i <= RIMSEG; i++) {
                const t = i / RIMSEG;
                const bulge = V.rimBead * Math.sin(Math.PI * t);
                const rr = mix(r0, r1, t) + px2 * bulge;
                const yy = mix(y0, y1, t) + py2 * bulge;
                const k = base + i * W + j;
                positions[k * 3] = rr * cs;
                positions[k * 3 + 1] = yy;
                positions[k * 3 + 2] = rr * sn;
                uvs[k * 2] = j / M; uvs[k * 2 + 1] = 0.5 + t * 0.02;
            }
        }

        const indices = [];
        for (let i = 0; i < K; i++) for (let j = 0; j < M; j++) {
            const A = i * W + j, B = A + 1, C = A + W, D = C + 1;
            indices.push(A, C, B, B, C, D);
            indices.push(LAY + A, LAY + B, LAY + C, LAY + B, LAY + D, LAY + C);
        }
        for (let i = 0; i < RIMSEG; i++) for (let j = 0; j < M; j++) {
            const A = base + i * W + j, B = A + 1, C = A + W, D = C + 1;
            indices.push(A, C, B, B, C, D);
        }
        const normals = finalize(positions, indices);
        weldNormals(positions, normals);
        const mesh = makeMesh("vesselBowl", positions, indices, normals, uvs, null, scene, false);
        mesh.material = mat;
        mesh.receiveShadows = (V.kind === "china");
        return mesh;
    }

    // 脚と台（コンポート）。閉じた回転体として作る
    function buildStem(scene, V, mat) {
        const M = 88, W = M + 1;
        const yTop = -V.wall;
        const ctrl = [
            [0, yTop],
            [V.stemR * 1.55, yTop],
            [V.stemR, yTop - V.stemH * 0.28],
            [V.stemR * 1.10, yTop - V.stemH * 0.72],
            [V.footR, yTop - V.stemH],
            [V.footR * 0.96, yTop - V.stemH - V.footH],
            [0, yTop - V.stemH - V.footH]
        ];
        const rad = [0, 0.55, 0.40, 0.55, 0.30, 0.16, 0];
        let poly = roundPolyline(ctrl, rad, 14);
        poly = resampleByArc(poly, 74, 0.5);
        const N = poly.length;
        const total = N * W;
        const positions = new Float32Array(total * 3);
        const uvs = new Float32Array(total * 2);
        for (let i = 0; i < N; i++) {
            for (let j = 0; j <= M; j++) {
                const th = (j % M) / M * TAU;
                const k = i * W + j;
                positions[k * 3] = Math.cos(th) * poly[i][0];
                positions[k * 3 + 1] = poly[i][1];
                positions[k * 3 + 2] = Math.sin(th) * poly[i][0];
                uvs[k * 2] = j / M; uvs[k * 2 + 1] = i / (N - 1);
            }
        }
        const indices = [];
        for (let i = 0; i < N - 1; i++) for (let j = 0; j < M; j++) {
            const A = i * W + j, B = A + 1, C = A + W, D = C + 1;
            indices.push(A, C, B, B, C, D);
        }
        const normals = finalize(positions, indices);
        weldNormals(positions, normals);
        const mesh = makeMesh("vesselStem", positions, indices, normals, uvs, null, scene, false);
        mesh.material = mat;
        return mesh;
    }

    // 受け皿（小鉢の下の白い皿）
    function buildSaucer(scene, S, mat) {
        const M = 140, K = 26, W = M + 1, LAY = (K + 1) * W;
        const R = S.R, TH = 0.42, LIP = 0.62;
        const prof = (s) => LIP * smooth(0.62, 0.96, s);
        const slope = (s) => {
            const e = 2e-3;
            return (prof(Math.min(1, s + e)) - prof(Math.max(0, s - e))) / (2 * e);
        };
        const total = LAY * 2;
        const positions = new Float32Array(total * 3);
        const uvs = new Float32Array(total * 2);
        for (let i = 0; i <= K; i++) {
            const s = i / K, y = prof(s), g = slope(s) / R;
            const nl = Math.hypot(1, g) || 1;
            const nr = -g / nl, ny = 1 / nl;
            for (let j = 0; j <= M; j++) {
                const th = (j % M) / M * TAU;
                const cs = Math.cos(th), sn = Math.sin(th);
                const r = R * s;
                const a = i * W + j, b = LAY + a;
                positions[a * 3] = r * cs; positions[a * 3 + 1] = y; positions[a * 3 + 2] = r * sn;
                positions[b * 3] = (r - nr * TH) * cs;
                positions[b * 3 + 1] = y - ny * TH;
                positions[b * 3 + 2] = (r - nr * TH) * sn;
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
        const mesh = makeMesh("saucer", positions, indices, normals, uvs, null, scene, false);
        mesh.material = mat;
        mesh.receiveShadows = true;
        return mesh;
    }

    // 当たり判定用の器。内面 ＋ 真下へ落とした厚いスカート。
    // 【対策】薄い殻をそのまま静的トライメッシュにすると、落下速度
    //         72cm/s（1 ステップ 0.6cm）に対して壁が 0.26cm しかなく、
    //         たまに抜ける。見えないメッシュなのだから、内面から下は
    //         塞いでしまってよい
    function buildBowlCollider(scene, V) {
        const M = 56, K = 18, W = M + 1;
        const R = V.rimR;
        const rows = [];
        for (let i = 0; i <= K; i++) {
            const s = i / K;
            rows.push([R * s, bowlInnerY(V, s)]);
        }
        rows.push([R, -4.0]);
        rows.push([0, -4.0]);
        const N = rows.length;
        const positions = new Float32Array(N * W * 3);
        for (let i = 0; i < N; i++) for (let j = 0; j <= M; j++) {
            const th = (j % M) / M * TAU, k = i * W + j;
            positions[k * 3] = Math.cos(th) * rows[i][0];
            positions[k * 3 + 1] = rows[i][1];
            positions[k * 3 + 2] = Math.sin(th) * rows[i][0];
        }
        const indices = [];
        for (let i = 0; i < N - 1; i++) for (let j = 0; j < M; j++) {
            const A = i * W + j, B = A + 1, C = A + W, D = C + 1;
            indices.push(A, C, B, B, C, D);
        }
        const normals = finalize(positions, indices);
        const mesh = makeMesh("vesselCollider", positions, indices, normals, null, null, scene, false);
        mesh.isVisible = false;
        mesh.isPickable = false;
        return mesh;
    }

    // =================================================================
    //  透過光だまり（ゼリーを通った光が器の底に落ちる色）
    // =================================================================
    // 【対策】シャドウマップは色を持てない。ゼリーは光を通すので、
    //         接地のまわりは「暗くなる」のではなく「色が付いて明るくなる」。
    //         影だけ落とすと、ゼリーが器から浮いて見える。
    //         写真A でも、器の底はゼリーより明るい緑になっている。
    //
    //  焼いたテクスチャを加算で乗せるだけ。メッシュは器の内面に貼り付く。
    function buildPool(scene, cfg, V, rIn, rOut, mat) {
        const NR = cfg.poolSegR, MA = cfg.poolSegA, W = MA + 1;
        const total = NR * W;
        const positions = new Float32Array(total * 3);
        const uvs = new Float32Array(total * 2);
        for (let i = 0; i < NR; i++) {
            const t = i / (NR - 1);
            const r = mix(rIn, rOut, t);
            const s = clamp(r / V.rimR, 0, 1);
            // 器の内面に沿わせる。浮かせすぎると輪が二重に見える
            const y = bowlInnerY(V, s) + 0.014;
            for (let j = 0; j <= MA; j++) {
                const th = (j % MA) / MA * TAU;
                const k = i * W + j;
                positions[k * 3] = Math.cos(th) * r;
                positions[k * 3 + 1] = y;
                positions[k * 3 + 2] = Math.sin(th) * r;
                // テクスチャは正方形の平面投影で貼る
                uvs[k * 2] = 0.5 + 0.5 * Math.cos(th) * (r / rOut);
                uvs[k * 2 + 1] = 0.5 + 0.5 * Math.sin(th) * (r / rOut);
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
        const mesh = makeMesh("lightPool", positions, indices, normals, uvs, null, scene, false);
        mesh.material = mat;
        mesh.isPickable = false;
        mesh.receiveShadows = false;
        // 【対策】加算で乗せる板は深度を書いてはいけない。書くと、
        //         あとから描かれるガラスの縁がここで深度に負けて消える
        mesh.alphaIndex = 2;
        return mesh;
    }

    // だまりの「明るさの分布」。形は接地半径と広がりでしか変わらないので、
    // 味や濃さを振るときは焼き直さない。
    // 【対策】ここを毎回計算し直すと、256² のセルノイズと fbm で 20ms
    //         かかる。濃さスライダーのドラッグ中は毎フレーム呼ばれるので、
    //         それだけで 45fps まで落ちる
    function poolShape(cfg, rIn, rOut, seed, size) {
        const S = Math.max(8, Math.round(size) || 256);
        const K = new Float32Array(S * S);
        const fRing = clamp(rIn / rOut, 0.02, 0.95);
        const fade = Math.max(0.04, (1 - fRing) * 0.55);
        for (let y = 0; y < S; y++) {
            const py = (y / (S - 1)) * 2 - 1;
            for (let x = 0; x < S; x++) {
                const px = (x / (S - 1)) * 2 - 1;
                const rr = Math.hypot(px, py);
                const th = Math.atan2(py, px);
                // 接地の輪のすぐ外がいちばん明るい。外へ指数で落ちる
                let k = (rr <= fRing) ? 1 : Math.exp(-(rr - fRing) / fade);
                // 溝が集光してできる明るい筋
                const sp = 0.5 + 0.5 * Math.cos(cfg.causticN * th
                    + 0.9 * (Noise.ang(th / TAU, 5, seed + 3) - 0.5));
                k *= 0.62 + 0.68 * Math.pow(sp, 2.2);
                k *= 0.80 + 0.40 * Noise.fbm2(px * 6 + 3, py * 6 + 7, seed + 11, 3);
                k *= 1 - smooth(0.92, 1.0, rr);       // 外周で必ず 0 に落とす
                K[y * S + x] = k;
            }
        }
        K.size = S;
        return K;
    }

    // 分布に味の色と明るさを掛けて焼く。ここだけならスライダー中でも 1ms
    function bakePoolTexture(scene, cfg, opt, K) {
        const S = K.size;
        const gain = cfg.poolGain;
        return TextureLab._tex("poolTex", S, S, (d, w, h) => {
            for (let i = 0; i < w * h; i++) {
                const k = K[i], o = i * 4;
                d[o] = Math.round(clamp(opt.pool[0] * k * gain, 0, 1) * 255);
                d[o + 1] = Math.round(clamp(opt.pool[1] * k * gain, 0, 1) * 255);
                d[o + 2] = Math.round(clamp(opt.pool[2] * k * gain, 0, 1) * 255);
                d[o + 3] = 255;
            }
        }, scene, { clampV: true });
    }

    // =================================================================
    //  マテリアル
    // =================================================================
    // ---- ゼリー本体 --------------------------------------------------
    //  見えの 9 割は subSurface.refraction が作る。
    //    transmittance = tintColor ^ (thickness / tintColorAtDistance)
    //  tintColorAtDistance = 1cm、tintColor = exp(−σ) にしてあるので
    //  これはそのまま Beer–Lambert。thickness は母線から実測した弦長。
    //
    // 【対策】不透明パス（transparencyMode = OPAQUE）に置いたままで
    //         refraction を有効にする。alpha ブレンドにしなくても
    //         向こう側は出るし、深度を書くのでガラスの器の奥壁が
    //         正しく隠れる。ここを ALPHABLEND にすると、器・皿・
    //         テーブル・だまりと4者でソート順を争うことになり、
    //         カメラを回すたびに前後関係が入れ替わる
    function makeJellyMaterial(scene, cfg, opt, prof, tex) {
        const m = new BABYLON.PBRMaterial("jellyMat", scene);
        // 濁り（多重散乱）ぶんの淡い色。屈折で来る色と二重にしない
        m.albedoColor = opt.albedo;
        m.metallicTexture = tex.orm;
        m.useRoughnessFromMetallicTextureGreen = true;
        m.useMetallnessFromMetallicTextureBlue = true;
        m.useAmbientOcclusionFromMetallicTextureRed = true;
        m.bumpTexture = tex.nrm;
        m.bumpTexture.level = 0.30;
        m.metallic = 0; m.roughness = 1;
        m.indexOfRefraction = cfg.ior;
        m.transparencyMode = BABYLON.PBRMaterial.PBRMATERIAL_OPAQUE;
        // 型から抜いた面は鏡に近い。離水した水膜を層として乗せる
        m.clearCoat.isEnabled = true;
        m.clearCoat.intensity = 0.55 * cfg.skinBloom + 0.20;
        m.clearCoat.roughness = 0.045;
        m.clearCoat.indexOfRefraction = 1.34;

        const ss = m.subSurface;
        ss.isRefractionEnabled = true;
        // 【対策】Babylon は屈折を有効にすると surfaceAlbedo を
        //   (1 − refractionIntensity) 倍する（二重計上を避けるため）。
        //   1.0 まで上げると拡散が完全に消えるので、環境マップの読み込みが
        //   間に合わないフレームや屈折が使えない環境で真っ黒になる。
        //   0.92 に留めて、濁りぶんの淡い色を 8% だけ床として残す
        ss.refractionIntensity = cfg.refraction;
        ss.indexOfRefraction = cfg.ior;
        ss.tintColor = opt.tint;
        // 1cm あたりの透過率を渡しているので、基準距離は 1cm
        ss.tintColorAtDistance = 1.0;
        ss.thicknessTexture = tex.thick;
        ss.useMaskFromThicknessTexture = false;
        ss.minimumThickness = 0.0;
        ss.maximumThickness = prof.thMax;
        // 【対策】translucency を足すと、屈折と同じ透過をもう一度数える。
        //         濁りは albedoColor 側だけで持たせる
        ss.isTranslucencyEnabled = false;
        m.backFaceCulling = true;
        m.texs = [];
        return m;
    }

    // ---- ガラス（KHR_materials_transmission 相当）----------------------
    //  参考: CompareTransmission.glb / GlassHurricaneCandleHolder.glb
    //
    //  glTF の透過は alpha 合成ではない。
    //    ・不透明なシーンだけを先にテクスチャへ描いておく（opaqueSceneTexture）
    //    ・ガラスはそれをスクリーン空間の屈折先として引く
    //    ・ガラス自身は不透明パスで描くので、ソート問題が一切起きない
    //  CompareTransmission の左（α合成）と右（透過）の差はこれで、
    //  左は「薄い膜」、右は「後ろがそのまま見えて縁が強く光るガラス」になる。
    //
    // 【対策】volume（KHR_materials_volume）を 0 にすると薄肉として扱われ、
    //   屈折で像が曲がらない。壁 2.6mm のコンポートはこれが正しい。
    //   厚手の小鉢だけ volume を入れて像を曲げる。ここを常に厚くすると、
    //   薄いガラスなのにレンズのように歪んで水晶の塊に見える
    function makeGlassMaterial(scene, V, seed, size, refrTex) {
        const F = TextureLab.glassFields(size, seed, V.ribN || 0, V.ribAmp || 0);
        const nrm = TextureLab.normalFromHeight("glassNrm", F.h, size, size, 1.6, scene, {});
        const orm = TextureLab._tex("glassORM", size, size, (d, w, h) => {
            for (let i = 0; i < w * h; i++) {
                const rough = clamp(V.rough + 0.030 * (F.h[i] - 0.5) + 0.18 * F.flaw[i], 0.012, 0.35);
                const o = i * 4;
                d[o] = 255; d[o + 1] = Math.round(rough * 255); d[o + 2] = 0; d[o + 3] = 255;
            }
        }, scene, { linear: true });

        const m = new BABYLON.PBRMaterial("glassMat", scene);
        // 【対策】α合成のガラスではアルベドを黒にするのが正解だったが、
        //   透過では逆にアルベド（＝glTF の baseColor）が
        //   useAlbedoToTintRefraction を通して透過光の色づけに使われる。
        //   ここを黒にすると、ガラス越しが真っ黒になる
        m.albedoColor = sRGB(V.tint);
        m.metallicTexture = orm;
        m.useRoughnessFromMetallicTextureGreen = true;
        m.useMetallnessFromMetallicTextureBlue = true;
        m.useAmbientOcclusionFromMetallicTextureRed = true;
        m.bumpTexture = nrm;
        m.bumpTexture.level = 0.22;
        m.metallic = 0; m.roughness = 1;
        m.indexOfRefraction = 1.52;      // 面の反射率 F0（縁の強い映り込み）

        const ss = m.subSurface;
        ss.isRefractionEnabled = true;
        ss.refractionIntensity = (V.transmission !== undefined) ? V.transmission : 1.0;
        ss.linkRefractionWithTransparency = false;
        if ("useAlbedoToTintRefraction" in ss) ss.useAlbedoToTintRefraction = true;

        if (refrTex) {
            ss.refractionTexture = refrTex;
            // 【対策】実機で器が一面すりガラスになった件への両面の手当て。
            //   ① アルベドを黒にする。屈折を有効にすると Babylon は
            //      surfaceAlbedo を (1 − refractionIntensity) 倍して拡散を
            //      落とすはずだが、そこが効いていなければ白いアルベドが
            //      そのまま拡散反射として出て、まさに乳白色の器になる。
            //      黒にしておけば、どちらに転んでも拡散は出ない
            //   ② そのぶん useAlbedoToTintRefraction は切る。
            //      有効なままだと透過光に黒を掛けて真っ黒になる。
            //      写真の器は無色なので、色づけは要らない
            m.albedoColor = new BABYLON.Color3(0, 0, 0);
            if ("useAlbedoToTintRefraction" in ss) ss.useAlbedoToTintRefraction = false;
            // 【対策】透過は不透明パスで描く。α合成ではないので、
            //   だまり・ゼリー・皿・テーブルと描画順を争わなくてよくなる。
            //   前版で separateCullingPass や alphaIndex を積んでいたのは
            //   全部このためだったので、まとめて要らなくなる
            m.alpha = 1.0;
            m.transparencyMode = BABYLON.PBRMaterial.PBRMATERIAL_OPAQUE;
            // 巻き順は finalize() が外向きに揃えてあるので、閉じた殻として
            // 裏面を落とせる。手前の外壁 → 開口越しに奥の内壁、の順に
            // 深度で正しく解決される
            m.backFaceCulling = true;
            m.separateCullingPass = false;
        } else {
            // ---- α ブレンド方式（既定）------------------------------
            //  写真2・3の器はほとんど見えない。見えているのは
            //  縁の一本の明るい線と、シルエットのきわの映り込みだけ。
            //  それは「被覆をほぼ 0 にして、鏡面と映り込みだけ残す」で出る。
            //
            // 【対策】アルベドは黒。ガラスは入射光を反射と透過に振り分ける
            //   だけで拡散反射をほとんど持たない。白いままだと必ず
            //   乳白色のすりガラスになる
            m.albedoColor = new BABYLON.Color3(0, 0, 0);
            // 【対策】separateCullingPass で裏表 2 回描くので実効の被覆は
            //   この 2 倍。0.075 でも重ねて 0.145 になる
            m.alpha = GLOBAL.glassAlpha;
            m.transparencyMode = BABYLON.PBRMaterial.PBRMATERIAL_ALPHABLEND;
            // 【対策】これを忘れると、alpha を下げたぶん映り込みと
            //   ハイライトまで消えて、器そのものが存在しなくなる
            m.useRadianceOverAlpha = true;
            m.useSpecularOverAlpha = true;
            // 【対策】背景は alpha で既に見えているので、屈折を上げると
            //   透過光を二重に数えて「明るい膜」が乗る。歪みの手がかりを
            //   足す程度に留める
            ss.refractionIntensity = 0.14;
            ss.tintColor = sRGB(V.tint);
            ss.tintColorAtDistance = 12.0;
            m.backFaceCulling = false;
            m.separateCullingPass = true;
            m.twoSidedLighting = true;
        }

        const vol = V.volume || 0;
        if (vol > 0) {
            // 厚みのあるガラス。屈折率を入れると像が曲がる
            if ("volumeIndexOfRefraction" in ss) ss.volumeIndexOfRefraction = 1.52;
            ss.minimumThickness = 0.0;
            ss.maximumThickness = vol;
            ss.tintColor = sRGB(V.tint);
            ss.tintColorAtDistance = V.attenuation || 20.0;
        } else {
            // 薄肉。屈折率 1.0 ＝ 曲がらない（glTF の thin-walled と同じ）
            if ("volumeIndexOfRefraction" in ss) ss.volumeIndexOfRefraction = 1.0;
            ss.minimumThickness = 0.0;
            ss.maximumThickness = 0.0;
        }
        m.texs = [orm, nrm];
        return m;
    }

    // ---- 無垢ガラス（ステム・フット）------------------------------------
    //  ボウルは肉厚 2.4mm の薄板だが、ステムとフットは中身の詰まった
    //  ガラスで、光が通る距離が 10 倍以上ある。
    //
    // 【対策】同じマテリアルで描くと、脚だけ完全に消えて器が宙に浮く。
    //   薄板の見えは「縁の一本の線」で決まるが、無垢の見えは
    //   「厚みぶんの屈折と減衰」で決まるので、別物として作る。
    //   実物のワイングラスでも、いちばん存在感があるのはステムの
    //   付け根とフットの縁で、そこは光が長く通るところ
    function makeSolidGlassMaterial(scene, V, refrTex) {
        const m = new BABYLON.PBRMaterial("glassSolidMat", scene);
        m.albedoColor = new BABYLON.Color3(0, 0, 0);
        m.metallic = 0;
        m.roughness = (V.solidRough !== undefined) ? V.solidRough : 0.025;
        m.indexOfRefraction = 1.52;
        const ss = m.subSurface;
        ss.isRefractionEnabled = true;
        ss.refractionIntensity = (V.solidRefract !== undefined) ? V.solidRefract : 0.45;
        ss.linkRefractionWithTransparency = false;
        if ("useAlbedoToTintRefraction" in ss) ss.useAlbedoToTintRefraction = false;
        // 厚みを持たせて像を曲げる。ここが 1.0 のままだと、無垢なのに
        // まっすぐ透けて「空気の柱」に見える
        if ("volumeIndexOfRefraction" in ss) ss.volumeIndexOfRefraction = 1.52;
        ss.minimumThickness = 0.0;
        ss.maximumThickness = (V.solidVolume !== undefined) ? V.solidVolume : 1.2;
        // 【対策】ガラスの縁が緑がかって見えるのは、鉄分による吸収を
        //   長い光路で通るから。減衰距離を厚みと同程度まで詰めないと、
        //   数 cm の脚では色がまったく出ない
        ss.tintColor = sRGB(V.tint);
        ss.tintColorAtDistance = (V.solidAtten !== undefined) ? V.solidAtten : 2.6;

        if (refrTex) {
            ss.refractionTexture = refrTex;
            // 【対策】透過方式では refractionIntensity が glTF の
            //   transmissionFactor そのもの。アルベドを黒にしてあるので、
            //   0.45 のままだと残り 55% が黒として残って脚が暗く沈む
            ss.refractionIntensity = 1.0;
            m.alpha = 1.0;
            m.transparencyMode = BABYLON.PBRMaterial.PBRMATERIAL_OPAQUE;
            m.backFaceCulling = true;
            m.separateCullingPass = false;
        } else {
            m.alpha = (V.solidAlpha !== undefined) ? V.solidAlpha : 0.30;
            m.transparencyMode = BABYLON.PBRMaterial.PBRMATERIAL_ALPHABLEND;
            m.useRadianceOverAlpha = true;
            m.useSpecularOverAlpha = true;
            m.backFaceCulling = false;
            m.separateCullingPass = true;
            m.twoSidedLighting = true;
        }
        m.texs = [];
        return m;
    }

    // ---- 白磁 --------------------------------------------------------
    function makeChinaMaterial(scene, style, seed, size) {
        const F = TextureLab.porcelainFields(size, seed);
        const A = style.albedo;
        const alb = TextureLab._tex("chinaAlb", size, size, (d, w, h) => {
            for (let i = 0; i < w * h; i++) {
                // 【対策】「白い皿」だからと 0.97 を入れると、露出を上げた
                //         ときに真っ先に飛んで階調が消える。白磁の実反射率は
                //         0.88 前後。暗くしたぶんは露出で戻す
                const k = 1 + 0.022 * (F.h[i] - 0.5) - 0.034 * F.spec[i];
                const o = i * 4;
                d[o] = Math.round(clamp(A[0] * k, 0, 1) * 255);
                d[o + 1] = Math.round(clamp(A[1] * k, 0, 1) * 255);
                d[o + 2] = Math.round(clamp(A[2] * k, 0, 1) * 255);
                d[o + 3] = 255;
            }
        }, scene, {});
        const orm = TextureLab._tex("chinaORM", size, size, (d, w, h) => {
            for (let i = 0; i < w * h; i++) {
                const rough = clamp(style.rough + 0.055 * F.h[i] + 0.22 * F.spec[i], 0.05, 0.55);
                const o = i * 4;
                d[o] = 255; d[o + 1] = Math.round(rough * 255); d[o + 2] = 0; d[o + 3] = 255;
            }
        }, scene, { linear: true });
        const nrm = TextureLab.normalFromHeight("chinaNrm", F.h, size, size, 1.5, scene, {});

        const m = new BABYLON.PBRMaterial("chinaMat", scene);
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

    // ---- テーブル ----------------------------------------------------
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

    // 透過光だまり用。加算合成の板なので、光も影も受けない
    function makePoolMaterial(scene) {
        const m = new BABYLON.StandardMaterial("poolMat", scene);
        m.disableLighting = true;
        m.diffuseColor = new BABYLON.Color3(0, 0, 0);
        m.specularColor = new BABYLON.Color3(0, 0, 0);
        m.emissiveColor = new BABYLON.Color3(1, 1, 1);
        // 【対策】alphaMode を加算にしただけでは効かない。Babylon は
        //   needAlphaBlending() が true のメッシュしか透過パスへ回さず、
        //   StandardMaterial のそれは alpha < 1 か不透明度テクスチャで
        //   決まる。alphaMode は透過パスに入って初めて engine へ渡る。
        //   alpha を 1 未満にしておかないと、加算のつもりの板が
        //   不透明で描かれて器の底を灰色に塗りつぶす
        m.alpha = 0.999;
        const AE = BABYLON.Engine || BABYLON.Constants || {};
        m.alphaMode = (AE.ALPHA_ADD !== undefined) ? AE.ALPHA_ADD : 1;
        m.backFaceCulling = true;
        m.disableDepthWrite = true;
        m.separateCullingPass = false;
        return m;
    }

    // =================================================================
    // 11. Scene
    // =================================================================
    const scene = new BABYLON.Scene(engine);
    // 写真A は白ホリゾントのハイキー。背景 sRGB(252,252,252) を実測して合わせる
    scene.clearColor = new BABYLON.Color4(0.955, 0.962, 0.968, 1);

    const vw = (typeof window !== "undefined" && window.innerWidth) || 1024;
    if (vw < GLOBAL.compactWidth) {
        GLOBAL.textureSize = 512; GLOBAL.thickTexSize = 384;
        GLOBAL.vesselTexSize = 512; GLOBAL.segRound = 144; GLOBAL.segAxis = 76;
    }

    // ---- 環境（IBL）とスカイボックス -----------------------------------
    // 【対策】ゼリーの色は、屈折で拾った環境の明るさに透過率を掛けたもの。
    //   環境をぼかしすぎると拾う値が全方向で同じになり、中に階調が出ずに
    //   「色の付いた消しゴム」になる。屈折の解像度がそのままゼリーの
    //   中の見え方になるので、ここはボカさない
    const envCache = {};
    let currentEnv = GLOBAL.env, skybox = null;
    function getEnvTex(key) {
        if (!envCache[key]) {
            const E = ENVS[key];
            const t = BABYLON.CubeTexture.CreateFromPrefilteredData(E.url, scene);
            t.rotationY = E.rotationY;
            t.lodGenerationOffset = 0.10;
            envCache[key] = t;
        }
        return envCache[key];
    }
    // 最初の 1 枚だけ先に用意しておく（マテリアルの ready 判定が環境を見る）
    scene.environmentTexture = getEnvTex(currentEnv);
    scene.environmentIntensity = ENVS[currentEnv].env;

    // 【実測】写真A の天面は短径/長径 = 0.36 の楕円に写っている。
    //         円を仰角 e で見たときの比が sin(e) なので e = 21°、
    //         つまり真上からの角度 beta = 1.20 rad
    const camera = new BABYLON.ArcRotateCamera("cam", -1.16, 1.205, 30.0,
        new V3(0, 3.30, 0), scene);
    camera.attachControl(true);
    camera.fov = 0.50;
    camera.wheelPrecision = 12;
    // 【対策】ポストプロセスを有効にするとシーンは 16bit 深度の RT へ描かれる。
    //         minZ を 0.1 のままにすると分解能が mm 台になり、ガラスの
    //         0.26mm の壁が表と裏で勝ったり負けたりしてちらつく
    // 【対策】スカイボックスの対角が入る遠クリップが要る。近クリップを
    //   詰めておけば、被写体 34cm での 16bit 深度の分解能は 14µm 前後で、
    //   器の壁 2.6mm に対して十分（前は 12–96cm で 3µm だった）
    camera.minZ = GLOBAL.camNear;
    camera.maxZ = GLOBAL.camFar;
    camera.lowerRadiusLimit = 15;
    camera.upperRadiusLimit = 70;
    camera.lowerBetaLimit = 0.05;
    camera.upperBetaLimit = 1.54;
    camera.panningSensibility = 240;
    scene.cameraToUseForPointers = camera;

    // ---- 灯（3灯 ＋ 環境）------------------------------------------
    // 【対策】ゼリーは光を通す。キーを真横から入れると、向こう側の面から
    //         抜けてきた光が主役になって色が出る。真上から当てると
    //         天面のハイライトだけが増えて、中身が暗いままになる
    const key0 = new BABYLON.DirectionalLight("key", new V3(-0.42, -0.72, 0.55).normalize(), scene);
    key0.position = new V3(17, 26, -22);
    key0.intensity = 2.70;
    key0.diffuse = new BABYLON.Color3(1.0, 0.988, 0.962);
    key0.specular = new BABYLON.Color3(0.70, 0.68, 0.64);
    key0.shadowMinZ = 6; key0.shadowMaxZ = 88;

    const fillL = new BABYLON.DirectionalLight("fillL", new V3(0.88, -0.30, -0.42).normalize(), scene);
    fillL.intensity = 1.05;
    fillL.diffuse = new BABYLON.Color3(0.97, 0.965, 0.955);
    fillL.specular = new BABYLON.Color3(0.18, 0.175, 0.170);

    // 【対策】平行光源のハイライトは1点しか出ない。菊型の稜線 12 本に
    //         照りを走らせるには「拡散をほぼ 0 にして鏡面だけ足す灯」が要る
    const kick = new BABYLON.DirectionalLight("kick", new V3(0.26, -0.34, 0.90).normalize(), scene);
    kick.intensity = 1.85;
    kick.diffuse = new BABYLON.Color3(0.05, 0.05, 0.048);
    kick.specular = new BABYLON.Color3(1.0, 0.97, 0.92);

    const amb = new BABYLON.HemisphericLight("amb", new V3(0, 1, 0), scene);
    amb.intensity = 0.42;
    amb.diffuse = new BABYLON.Color3(1, 1, 1);
    amb.groundColor = new BABYLON.Color3(0.84, 0.83, 0.80);
    amb.specular = new BABYLON.Color3(0, 0, 0);

    const sg = new BABYLON.ShadowGenerator(2048, key0);
    sg.usePercentageCloserFiltering = true;
    sg.filteringQuality = BABYLON.ShadowGenerator.QUALITY_HIGH;
    sg.normalBias = 0.022;
    sg.bias = 0.0006;
    // 【対策】透過体の影を不透明体と同じ濃さで落とすと、ゼリーの下だけ
    //         黒く沈んで「置いた石」に見える。実物は光を通すので影は薄い。
    //         濃さを落としたぶんは、透過光だまり（加算）で取り返す
    sg.darkness = 0.70;

    const ip = scene.imageProcessingConfiguration;
    ip.toneMappingEnabled = true;
    ip.toneMappingType = BABYLON.ImageProcessingConfiguration.TONEMAPPING_ACES;
    ip.exposure = GLOBAL.exposure;
    ip.contrast = GLOBAL.contrast;
    ip.vignetteEnabled = true;
    ip.vignetteWeight = 1.4;
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
            scene.enablePhysics(new V3(0, -GLOBAL.gravity, 0), hk);
            if (hk.setTimeStep) hk.setTimeStep(1 / GLOBAL.physicsHz);
            physicsOn = true;
        } catch (e) {
            console.warn("[Jelly] Havok を初期化できませんでした。置いた状態から始めます。", e);
        }
    }

    // ---- 母線・彫り・テクスチャ ---------------------------------------
    const prof = new Profile(GLOBAL);
    const flute = new Flute(GLOBAL, prof, START_SEED + 17);
    const field = new ModeField(GLOBAL, prof);

    // 【対策】味プリセットの T0 は「基準の光路長を通ったあとの透過率」。
    //         その基準を固定値にすると、母線を触るたびに全部の味の
    //         見えがずれる。写真で色を拾ったのと同じ場所（高さ 0.6H の胴）
    //         の光路長をそのまま基準にすれば、母線をいじっても
    //         「胴が写真どおりの色になる」が保証される
    GLOBAL.refDepth = prof.thRef;

    const TEX = GLOBAL.textureSize;
    // 【対策】高さ場は形状とノイズだけで決まり、粗さスライダーには
    //         依存しない。ここを毎回作り直すと 1024² のセルノイズで
    //         0.5 秒かかり、スライダーを触ったとたんに固まる
    const jelF = TextureLab.jellyFields(TEX, GLOBAL, prof, 6151);
    const jelTex = {
        orm: TextureLab.jellyORM(TEX, jelF, GLOBAL, scene),
        nrm: TextureLab.normalFromHeight("jellyNrm", jelF.h, TEX, TEX, 2.0, scene, {}),
        thick: TextureLab.thicknessTex(GLOBAL.thickTexSize, GLOBAL, prof, flute, scene)
    };

    let currentFlavor = START_FLAVOR, currentVessel = START_VESSEL, currentTable = START_TABLE;
    let optics = flavorOptics(FLAVORS[currentFlavor], GLOBAL, GLOBAL.refDepth);

    const mats = {};
    mats.jelly = makeJellyMaterial(scene, GLOBAL, optics, prof, jelTex);
    mats.pool = makePoolMaterial(scene);

    // ---- 透過用の「不透明シーンテクスチャ」-------------------------------
    //  Babylon の glTF ローダは KHR_materials_transmission を読むと、
    //  内部の TransmissionHelper が "opaqueSceneTexture" という
    //  RenderTargetTexture を作って屈折先に差している。
    //  そのクラスは公開されていないので、同じものを公開 API だけで組む。
    let opaqueRTT = null;
    function ensureOpaqueRTT() {
        // 【対策】gammaSpace は定義（define）に効くので、切り替えたら
        //   マテリアルを作り直すだけでなくテクスチャ側にも反映が要る。
        //   食い違ったままだと、切り替えても見えが変わらない
        if (opaqueRTT && opaqueRTT.gammaSpace !== GLOBAL.transmissionGamma) {
            opaqueRTT.gammaSpace = GLOBAL.transmissionGamma;
            opaqueRTT.clearColor = opaqueRTT.__clearFor(scene.clearColor);
        }
        if (opaqueRTT) {
            if (scene.customRenderTargets.indexOf(opaqueRTT) < 0) {
                scene.customRenderTargets.push(opaqueRTT);
            }
            return opaqueRTT;
        }
        const HALF = (BABYLON.Constants && BABYLON.Constants.TEXTURETYPE_HALF_FLOAT !== undefined)
            ? BABYLON.Constants.TEXTURETYPE_HALF_FLOAT : 2;
        opaqueRTT = new BABYLON.RenderTargetTexture("opaqueSceneTexture",
            GLOBAL.transmissionSize, scene, true, undefined, HALF);
        opaqueRTT.ignoreCameraViewport = true;
        opaqueRTT.renderList = [];
        // 【対策】ここが器が白く飛んでいた原因。
        //   シェーダは gammaSpace = true なら sRGB → linear 変換を掛け、
        //   false ならそのまま使う。中身がガンマなのに false にすると、
        //   sRGB 0.5 を linear 0.5（本来 0.21）として読むので 2.4 倍に
        //   持ち上がり、ガラス越しだけ白っぽくコントラストが抜ける。
        //   実機の結果（器が白い／フットの木目が天板より明るく色が薄い）が
        //   まさにこれだった
        opaqueRTT.gammaSpace = GLOBAL.transmissionGamma;
        // 粗さに応じてぼけた像を引くための mip。すりガラスはこれで出る
        // 【対策】屈折の mip レベルは getLodFromAlphaG(サイズ, alphaG) に
        //   この scale を掛けて offset を足したもの。scale = 1 のままだと
        //   粗さが少し高いだけで一気にぼけた mip を引き、器が一面
        //   すりガラスになる（実機で再現した症状がこれに一致する）。
        //   磨いたガラスに粗さ由来のぼけは要らないので、scale を 0 にして
        //   常に最鮮明の mip を引かせる
        opaqueRTT.lodGenerationScale = 0;
        opaqueRTT.lodGenerationOffset = -4;
        try { opaqueRTT.samples = 4; } catch (e) { }
        // 消去色は、宣言した色空間に合わせて入れる
        const clearFor = (c) => GLOBAL.transmissionGamma
            ? new BABYLON.Color4(c.r, c.g, c.b, 1)
            : new BABYLON.Color4(Math.pow(c.r, 2.2), Math.pow(c.g, 2.2), Math.pow(c.b, 2.2), 1);
        opaqueRTT.clearColor = clearFor(scene.clearColor);
        opaqueRTT.__clearFor = clearFor;
        // 【対策】ここで scene.imageProcessingConfiguration.applyByPostProcess を
        //   毎フレーム書き換えて「リニアで焼かせる」ことも試したが、
        //   これは定義（define）なので値を変えるとマテリアルの再コンパイルが
        //   走る。しかもそのフレームの描画には間に合わないので、
        //   結局ガンマのまま焼かれたテクスチャをリニアとして読むことになり、
        //   毎フレーム 2 回の再コンパイルを払ってなお白飛びする。
        //   触らずに、読む側の色空間を合わせるほうが確実
        // 【対策】customRenderTargets に入れたテクスチャは、カメラの
        //   ポストプロセス（Bloom / 被写界深度 / シャープン）を通らない。
        //   だからトーンマッピングの二重掛けは起きないが、逆に
        //   「ガラス越しだけボケていない」というちぐはぐが出る。
        //   被写界深度を強く効かせないのはそのため
        scene.customRenderTargets.push(opaqueRTT);
        return opaqueRTT;
    }
    function disableOpaqueRTT() {
        if (!opaqueRTT) return;
        const i = scene.customRenderTargets.indexOf(opaqueRTT);
        // 【対策】使わないのに登録したままだと、毎フレーム 1024² を
        //   もう一枚描き続ける。外しておく
        if (i >= 0) scene.customRenderTargets.splice(i, 1);
    }

    // 透過先に映すもの＝「ガラス以外の不透明メッシュ」。
    // 【対策】ガラス自身をリストに入れると、前のフレームの自分の像を
    //   引いて無限に入れ子になる（合わせ鏡）。必ず除外する。
    // 【対策】加算や α ブレンドのメッシュも入れてはいけない。
    //   透過光だまりを入れていたせいで、
    //     ・透過テクスチャの中で 1 回（ガラスがそれを引く）
    //     ・本描画でガラスの上へもう 1 回（深度を書かないので通る）
    //   と二重に足され、器の中だけ明るさが飽和して白い円盤になっていた。
    //   Babylon の TransmissionHelper も不透明メッシュだけを集めている
    function refreshTransmissionList() {
        if (!opaqueRTT) return;
        const skip = new Set(vessel.meshes);
        if (vessel.collider) skip.add(vessel.collider);
        const list = [];
        for (const m of scene.meshes) {
            if (skip.has(m)) continue;
            if (m.isVisible === false) continue;
            if (m.isDisposed && m.isDisposed()) continue;
            const mt = m.material;
            if (mt && mt.needAlphaBlending && mt.needAlphaBlending()) continue;
            list.push(m);
        }
        opaqueRTT.renderList = list;
    }

    // 味を変えたら、透過率と濁りを差し替えるだけ。メッシュもテクスチャも
    // 焼き直さなくてよい（色素は均一で、変わるのは σ だけだから）
    function applyOptics() {
        optics = flavorOptics(FLAVORS[currentFlavor], GLOBAL, GLOBAL.refDepth);
        mats.jelly.subSurface.tintColor = optics.tint;
        mats.jelly.albedoColor = optics.albedo;
        mats.jelly.subSurface.refractionIntensity = GLOBAL.refraction;
        mats.jelly.subSurface.indexOfRefraction = GLOBAL.ior;
        mats.jelly.indexOfRefraction = GLOBAL.ior;
        repaintPool();
    }

    // ---- テーブル（丸テーブル）-----------------------------------------
    let tableTop = null, tableColumn = null, tableFoot = null, tableBody = null;
    const ironMat = (function () {
        const m = new BABYLON.PBRMaterial("ironMat", scene);
        m.albedoColor = new BABYLON.Color3(0.045, 0.045, 0.050);
        m.metallic = 0.35; m.roughness = 0.44;
        return m;
    })();

    function applyTable(key) {
        currentTable = key;
        const old = tableTop ? tableTop.material : null;
        const m = makeTableMaterial(scene, TABLES[key], 3131);
        if (tableTop) tableTop.material = m;
        if (old) {
            if (old.texs) for (const t of old.texs) t.dispose();
            old.dispose(true, false);
        }
        return m;
    }

    if (GLOBAL.showTable) {
        tableTop = BABYLON.MeshBuilder.CreateCylinder("tableTop",
            { height: TABLE.thickness, diameter: TABLE.diameter, tessellation: 96 }, scene);
        named(tableTop, "tableTop");
        tableTop.receiveShadows = true;
        tableColumn = BABYLON.MeshBuilder.CreateCylinder("tableColumn",
            { height: TABLE.pedestal, diameterTop: 7.4, diameterBottom: 9.0, tessellation: 48 }, scene);
        named(tableColumn, "tableColumn");
        tableColumn.material = ironMat;
        tableFoot = BABYLON.MeshBuilder.CreateCylinder("tableFoot",
            { height: 2.4, diameterTop: TABLE.footDia * 0.82, diameterBottom: TABLE.footDia, tessellation: 64 }, scene);
        named(tableFoot, "tableFoot");
        tableFoot.material = ironMat;
        applyTable(currentTable);
    }

    // 器の底の高さに天板の上面を合わせる。
    // 【対策】静的ボディを持ったまま親ノードで動かすと Havok 側の姿勢と
    //   食い違う。器を替えるのは稀なので、素直に作り直す
    function placeTable(surfaceY) {
        if (!tableTop) return;
        tableTop.position.y = surfaceY - TABLE.thickness / 2;
        tableColumn.position.y = surfaceY - TABLE.thickness - TABLE.pedestal / 2;
        tableFoot.position.y = surfaceY - TABLE.thickness - TABLE.pedestal + 1.2;
        if (!physicsOn) return;
        if (tableBody) { try { tableBody.dispose(); } catch (e) { } tableBody = null; }
        // 【対策】厚みゼロの床は当たり判定に使えない（すり抜ける）ので箱にする
        const shape = new BABYLON.PhysicsShapeBox(
            new V3(0, 0, 0), BABYLON.Quaternion.Identity(),
            new V3(TABLE.diameter, TABLE.thickness, TABLE.diameter), scene);
        shape.material = { friction: 0.85, restitution: 0.0 };
        tableBody = new BABYLON.PhysicsBody(tableTop, BABYLON.PhysicsMotionType.STATIC, false, scene);
        tableBody.shape = shape;
    }

    // ---- 器 ---------------------------------------------------------
    const vessel = {
        V: null, meshes: [], mat: null, solidMat: null, saucerMat: null,
        collider: null, body: null
    };

    function clearVessel() {
        for (const m of vessel.meshes) { try { m.dispose(); } catch (e) { } }
        vessel.meshes = [];
        if (vessel.body) { try { vessel.body.dispose(); } catch (e) { } vessel.body = null; }
        if (vessel.collider) { try { vessel.collider.dispose(); } catch (e) { } vessel.collider = null; }
        for (const m of [vessel.mat, vessel.solidMat, vessel.saucerMat]) {
            if (!m) continue;
            if (m.texs) for (const t of m.texs) t.dispose();
            m.dispose(true, false);
        }
        vessel.mat = null; vessel.solidMat = null; vessel.saucerMat = null;
    }

    function applyVessel(key) {
        clearVessel();
        currentVessel = key;
        const V = VESSELS[key];
        vessel.V = V;
        const SZ = GLOBAL.vesselTexSize;
        vessel.mat = (V.kind === "glass")
            ? makeGlassMaterial(scene, V, 8821, SZ,
                GLOBAL.transmission ? ensureOpaqueRTT() : (disableOpaqueRTT(), null))
            : makeChinaMaterial(scene, V, 8821, SZ);

        const bowl = buildBowl(scene, V, vessel.mat, 4409);
        vessel.meshes.push(bowl);
        if (V.kind === "glass") {
            // 【対策】透過方式のガラスは不透明パスで描かれるので alphaIndex は
            //   効かない（＝ソートを気にしなくてよい）。フォールバックの
            //   α合成に落ちたときのためだけに残しておく
            bowl.alphaIndex = 6;
            // 【対策】ガラスの影を落とさないと、器だけがテーブルから浮いて
            //   見える。シャドウマップは透過を扱えないのでシルエットの
            //   影になるが、darkness を上げて薄くしてあるので破綻しない。
            //   実物の脚付きグラスもはっきり影を落とす
            sg.addShadowCaster(bowl);
        } else {
            bowl.receiveShadows = true;
            sg.addShadowCaster(bowl);
        }
        if (V.stem) {
            // 【対策】ステムとフットは無垢のガラス。ボウルと同じ薄板の
            //   マテリアルで描くと、脚だけ消えて器が宙に浮く
            vessel.solidMat = makeSolidGlassMaterial(scene, V,
                GLOBAL.transmission ? opaqueRTT : null);
            vessel.solidMat.environmentIntensity = ENVS[currentEnv].glass;
            const st = buildStem(scene, V, vessel.solidMat);
            // 薄板のボウルより先に描く（奥にあるので）
            st.alphaIndex = 5;
            sg.addShadowCaster(st);
            vessel.meshes.push(st);
        }
        if (V.saucer) {
            vessel.saucerMat = makeChinaMaterial(scene, SAUCERS[V.saucer], 9137, SZ);
            const sc = buildSaucer(scene, SAUCERS[V.saucer], vessel.saucerMat);
            // 【対策】器のいちばん低い点は外面の中心 y = −wall。受け皿の
            //   見込みの中心をそこへ合わせる。ここを footH ぶん下げると、
            //   小鉢が皿から 1cm 近く浮いて影だけが取り残される
            sc.position.y = -V.wall - 0.01;
            vessel.meshes.push(sc);
            sg.addShadowCaster(sc);
        }

        // テーブルの高さを、いちばん下にある物の底に合わせる
        const bottomY = V.stem ? (-V.wall - V.stemH - V.footH)
            : (V.saucer ? (-V.wall - 0.01 - 0.42) : -V.wall - 0.02);
        placeTable(bottomY);

        if (physicsOn) {
            vessel.collider = buildBowlCollider(scene, V);
            const shape = new BABYLON.PhysicsShapeMesh(vessel.collider, scene);
            shape.material = { friction: GLOBAL.friction, restitution: 0.0 };
            vessel.body = new BABYLON.PhysicsBody(vessel.collider,
                BABYLON.PhysicsMotionType.STATIC, false, scene);
            vessel.body.shape = shape;
        }
        rebuildPool();
        refreshTransmissionList();
    }

    // ---- 環境モードの切替 ---------------------------------------------
    //  露出・各ライト・環境強度をまとめて一貫させる。ばらばらに触ると、
    //  背景を替えるたびにゼリーの色が写真から外れる
    function applyEnv(key) {
        currentEnv = key;
        const E = ENVS[key];
        const tex = getEnvTex(key);
        scene.environmentTexture = tex;
        scene.environmentIntensity = E.env;
        scene.clearColor = new BABYLON.Color4(E.clear[0], E.clear[1], E.clear[2], 1);

        if (skybox) { try { skybox.dispose(false, true); } catch (e) { } skybox = null; }
        if (E.skybox) {
            // 第2引数 pbr = true、最後の setGlobalEnvTexture = false
            //（環境はこちらで面倒を見るので任せない）
            skybox = scene.createDefaultSkybox(tex, true, GLOBAL.skyboxSize, E.skyboxBlur, false);
            if (skybox) {
                named(skybox, "skyBox");
                skybox.isPickable = false;
                skybox.receiveShadows = false;
            }
        }
        mats.jelly.environmentIntensity = E.jelly;
        if (vessel.mat) {
            vessel.mat.environmentIntensity =
                (vessel.V && vessel.V.kind === "glass") ? E.glass : E.china;
            // 【対策】ガラスの屈折先は環境キューブではなく不透明シーン
            //   テクスチャ。ここで環境に差し替えると、せっかくの
            //   「後ろがそのまま透ける」が消えて空だけが映る
            if (!GLOBAL.transmission && vessel.mat.subSurface
                && vessel.mat.subSurface.isRefractionEnabled) {
                vessel.mat.subSurface.refractionTexture = tex;
            }
        }
        if (vessel.solidMat) {
            vessel.solidMat.environmentIntensity = E.glass;
            if (!GLOBAL.transmission && vessel.solidMat.subSurface) {
                vessel.solidMat.subSurface.refractionTexture = tex;
            }
        }
        if (vessel.saucerMat) vessel.saucerMat.environmentIntensity = E.china;
        key0.intensity = E.key;
        fillL.intensity = E.fill;
        kick.intensity = E.kick;
        amb.intensity = E.amb;
        ip.exposure = E.exposure;
        ip.contrast = E.contrast;
        if (opaqueRTT) opaqueRTT.clearColor = opaqueRTT.__clearFor(scene.clearColor);
        refreshTransmissionList();
    }

    // ---- 透過光だまり -------------------------------------------------
    // 【対策】味や濃さを振るたびにメッシュまで作り直すと、スライダーの
    //         ドラッグ中に毎フレーム 3千頂点を生成して固まる。だまりの
    //         「形」は接地半径と広がりでしか変わらないので、色だけの
    //         変更はテクスチャ 1 枚の焼き直しで済ませる
    let pool = null, poolTex = null, poolK = null;
    function repaintPool() {
        if (!poolK) return;
        const old = poolTex;
        poolTex = bakePoolTexture(scene, GLOBAL, optics, poolK);
        mats.pool.emissiveTexture = poolTex;
        if (old) old.dispose();
    }
    function rebuildPool() {
        if (pool) { pool.dispose(); pool = null; }
        if (poolTex) { poolTex.dispose(); poolTex = null; }
        poolK = null;
        if (!GLOBAL.poolOn || !vessel.V || !state || !state.jelly) return;
        const V = vessel.V;
        const rc = state.jelly.contactR;
        const rIn = Math.max(0.3, rc * 0.55);
        const rOut = Math.min(V.rimR * 0.985, rc * GLOBAL.poolSpread);
        poolK = poolShape(GLOBAL, rc, rOut, currentSeed + 29, 256);
        poolTex = bakePoolTexture(scene, GLOBAL, optics, poolK);
        mats.pool.emissiveTexture = poolTex;
        pool = buildPool(scene, GLOBAL, V, rIn, rOut, mats.pool);
        refreshTransmissionList();
    }

    // =================================================================
    //  生成・投入・揺れ
    // =================================================================
    let state = null, onRebuilt = null;
    let currentSeed = START_SEED;

    // 【対策】rebuildPool は state と currentSeed を見る。let は巻き上げ
    //         されないので、器を作るより先に宣言だけ済ませておく
    applyVessel(currentVessel);
    // 器のマテリアルができてから環境を確定させる（強度を配るため）
    applyEnv(currentEnv);

    function clearState() {
        if (!state) return;
        if (state.body) { try { state.body.dispose(); } catch (e) { } }
        if (state.shape) { try { state.shape.dispose(); } catch (e) { } }
        if (state.def) state.def.dispose();
        if (state.jelly) state.jelly.dispose();
        state = null;
    }

    function build(seed) {
        const t0 = (typeof performance !== "undefined" ? performance.now() : Date.now());
        clearState();
        // 【対策】型は毎回同じ型なので、溝の位相 phase は動かさない。
        //         ここを個体ごとに回すと、先に焼いてある光路長テクスチャ
        //         （溝の彫りぶんを引いてある）と実際の谷の位置がずれて、
        //         山が明るく谷が暗い、逆の色になる。
        //         個体差は型抜きのへこみと表面のうねりだけで出す
        const fl = new Flute(GLOBAL, prof, seed + 17);
        flute.dentA = fl.dentA; flute.dentW = fl.dentW;
        flute.dentY = fl.dentY; flute.seed = fl.seed;
        const jelly = new Jelly(scene, GLOBAL, prof, flute, seed, mats.jelly);
        sg.addShadowCaster(jelly.body);

        const def = new Deformable(jelly.body, field);
        const jig = new Jiggle(GLOBAL);

        // 器の内面のうち、接地する半径での高さ
        const V = vessel.V;
        const restY = bowlInnerY(V, clamp(jelly.contactR / V.rimR, 0, 1));

        let body = null, shape = null;
        jelly.body.position.set(0, restY + (physicsOn ? GLOBAL.dropH : 0), 0);
        if (physicsOn) {
            // 【対策】物理で動かすメッシュは rotationQuaternion を使う。
            //         Euler の rotation のままだと Havok 側の姿勢と食い違う
            jelly.body.rotationQuaternion = BABYLON.Quaternion.Identity();
            jelly.body.computeWorldMatrix(true);
            shape = jelly.hullShape(scene);
            shape.material = { friction: GLOBAL.friction, restitution: GLOBAL.restitution };
            body = new BABYLON.PhysicsBody(jelly.body, BABYLON.PhysicsMotionType.DYNAMIC, false, scene);
            body.shape = shape;
            // 【対策】setMassProperties に mass だけ渡すと、慣性テンソルは
            //         既定値（各軸1）で上書きされる。半径 4.2 / 高さ 5.0 の
            //         塊の実際の慣性は 2.6〜3.1（mass=0.62, cm系）なので、
            //         1 のままだと接地の瞬間に不自然に起き上がる
            const k = GLOBAL.mass / 0.62;
            body.setMassProperties({
                mass: GLOBAL.mass,
                centerOfMass: new V3(0, GLOBAL.H * 0.42, 0),
                inertia: new V3(2.62 * k, 3.10 * k, 2.62 * k),
                inertiaOrientation: BABYLON.Quaternion.Identity()
            });
            // 【対策】damping は PhysicsAggregate のオプションでは効かない
            body.setLinearDamping(GLOBAL.linearDamping);
            body.setAngularDamping(GLOBAL.angularDamping);
            // 【対策】毎フレーム「メッシュ → ボディ」へ書き戻すと、物理が
            //         出した結果を読み直して押し込む往復が起きる
            body.disablePreStep = true;
        } else {
            jelly.body.rotation.set(0, 0, 0);
        }

        state = {
            jelly: jelly, def: def, jig: jig, body: body, shape: shape,
            restY: restY, settleTimer: 0, life: 0, frozen: false, impacted: false,
            ms: Math.round((typeof performance !== "undefined" ? performance.now() : Date.now()) - t0)
        };
        if (!physicsOn) {
            state.frozen = true;
            jelly.body.position.y = restY;
            jig.shake(GLOBAL.shakeVel * 0.5);
        }
        rebuildPool();
        refreshTransmissionList();
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
        const m = st.jelly.body;
        // 【対策】rotationQuaternion を持ったまま凍らせると、Inspector v2 の
        //         プロパティ表示が例外を出す。Euler へ焼いてから外す
        if (m.rotationQuaternion) {
            m.rotation = m.rotationQuaternion.toEulerAngles();
            m.rotationQuaternion = null;
        }
        st.frozen = true;
        if (onRebuilt) onRebuilt(st);
    }

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
                    //         表示フレームレート次第で変わる。上向きの Δv
                    //         （＝接地による力積）だけを拾えば、伝わる力積は
                    //         Γ·Δv になってフレームレートに依存しなくなる
                    const dvyC = Math.max(0, dvy);
                    jig.driveImpulse(dvx, dvyC, dvz);
                    if (!st.impacted && dvyC > 4 && jig.vPrev.y < -6) {
                        st.impacted = true;
                        jig.impact(Math.abs(jig.vPrev.y) * 0.30);
                    }
                }
                jig.vPrev.copyFrom(lv);
                jig.hasPrev = true;
                const speed = lv.length() + (av ? av.length() * 2 : 0);
                if (speed < GLOBAL.settleVel) st.settleTimer += dt; else st.settleTimer = 0;
                if (st.settleTimer > GLOBAL.settleTime || st.life > GLOBAL.settleTimeout) freezeBody(st);
            }
        }

        // 【対策】静止しているあいだも毎フレーム 2万頂点を書き戻すのは
        //         もったいない。振幅が閾値を切ったら 1 回だけ静止形状へ
        //         戻して更新を止める
        if (jig.step(dt)) st.def.apply(jig.current());
    });

    // ---- クリックでつつく --------------------------------------------
    scene.onPointerObservable.add((pi) => {
        if (pi.type !== BABYLON.PointerEventTypes.POINTERDOWN) return;
        if (!state) return;
        const bodyMesh = state.jelly.body;
        const pick = scene.pick(scene.pointerX, scene.pointerY, (m) => m === bodyMesh);
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
        // 【対策】ゼリーと器の接するところ、だまりの縁に影が入らないと、
        //         全部が同じ平面に貼りついて見える
        ssao = new BABYLON.SSAO2RenderingPipeline("ssao", scene,
            { ssaoRatio: 0.8, blurRatio: 1.0 }, [camera]);
        ssao.radius = 0.60;
        ssao.totalStrength = 0.80;
        ssao.samples = 16;
        ssao.expensiveBlur = true;
        // 【対策】遠クリップをスカイボックスに合わせて広げたので、SSAO の
        //   maxZ をそのままにすると天板の遠い側で AO が切れる。ただし
        //   スカイボックスまで届かせる必要は無いので、卓上の範囲に留める
        ssao.maxZ = 180;
        ssao.minZAspect = 0.20;
    }

    const dp = new BABYLON.DefaultRenderingPipeline("dp", true, scene, [camera]);
    dp.samples = 4;
    dp.fxaaEnabled = true;
    dp.bloomEnabled = true;
    // 【対策】ゼリーの照りは小さく鋭い。閾値を下げると、ゼリー全体が
    //         にじんで「発光するゼリー」になる
    dp.bloomThreshold = 0.94;
    dp.bloomWeight = 0.075;
    dp.bloomKernel = 44;
    dp.bloomScale = 0.6;
    dp.sharpenEnabled = true;
    dp.sharpen.edgeAmount = 0.20;
    // 【対策】Babylon の錯乱円は「シーン単位 × 1000 = mm」で計算される。
    //         cm 単位のシーンでカメラ距離 34cm は内部では 34m 先。
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
    // 12. GUI
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
        idle: "#242a26", active: "#3f7a4a", edge: "#414a44",
        text: "#eef4ee", sub: "#9fa9a2", accent: "#a8e0a8"
    };
    const card = new BABYLON.GUI.Rectangle("card");
    card.width = "276px";
    card.height = "90%";
    card.cornerRadius = 10;
    card.thickness = 1;
    card.color = COL.edge;
    card.background = "rgba(14,17,15,0.84)";
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
    panel.width = "236px";
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
        s.height = "18px"; s.width = "222px"; s.paddingBottom = "8px";
        s.color = COL.accent; s.background = "#2c332e"; s.borderColor = "transparent";
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

    // ---- 焼き直しはフラグに畳んでフレームに1回だけ --------------------
    // 【対策】スライダーの onValueChanged で直に焼き直すと、ドラッグ中に
    //         同じフレームで何度も呼ばれて固まる
    let opticsDirty = false, poolDirty = false, paintDirty = false,
        skinDirty = false, thickDirty = false;

    addLabel("JELLY / ゼリー", 11, COL.sub, "26px");
    addLabel("ゼリーをクリックするとつつけます", 11, COL.sub, "30px");

    addButton("drop", "落とし直す", () => { build(++currentSeed); });
    addButton("shake", "ゆらす", () => { if (state) state.jig.shake(GLOBAL.shakeVel); });

    addSpacer();
    addLabel("味（吸収スペクトル）", 13, COL.accent, "22px");
    const flavorBtns = {}, vesselBtns = {}, tableBtns = {}, envBtns = {};
    function highlightSet() {
        for (const k in flavorBtns) flavorBtns[k].background = (k === currentFlavor) ? COL.active : COL.idle;
        for (const k in vesselBtns) vesselBtns[k].background = (k === currentVessel) ? COL.active : COL.idle;
        for (const k in tableBtns) tableBtns[k].background = (k === currentTable) ? COL.active : COL.idle;
        for (const k in envBtns) envBtns[k].background = (k === currentEnv) ? COL.active : COL.idle;
    }
    for (const k of Object.keys(FLAVORS)) {
        flavorBtns[k] = addButton("f_" + k, FLAVORS[k].label, () => {
            if (k === currentFlavor) return;
            currentFlavor = k;
            opticsDirty = true;
            highlightSet();
        });
    }

    addSpacer();
    addLabel("器", 13, COL.accent, "22px");
    for (const k of Object.keys(VESSELS)) {
        vesselBtns[k] = addButton("v_" + k, VESSELS[k].label, () => {
            if (k === currentVessel) return;
            vesselBtns[k].textBlock.text = VESSELS[k].label + "（焼き直し中…）";
            // 【対策】ボタンのラベルを先に描かせてから焼く。
            //         同じフレームで焼くと「押しても反応しない」ように見える
            setTimeout(() => {
                applyVessel(k);
                build(currentSeed);
                vesselBtns[k].textBlock.text = VESSELS[k].label;
                highlightSet();
            }, 30);
        });
    }

    addSpacer();
    addLabel("背景", 13, COL.accent, "22px");
    for (const k of Object.keys(ENVS)) {
        envBtns[k] = addButton("e_" + k, ENVS[k].label, () => {
            if (k === currentEnv) return;
            envBtns[k].textBlock.text = ENVS[k].label + "（読み込み中…）";
            setTimeout(() => {
                applyEnv(k);
                envBtns[k].textBlock.text = ENVS[k].label;
                highlightSet();
                updateInfo();
            }, 30);
        });
    }

    addSpacer();
    addLabel("テーブル", 13, COL.accent, "22px");
    for (const k of Object.keys(TABLES)) {
        tableBtns[k] = addButton("t_" + k, TABLES[k].label, () => {
            if (k === currentTable) return;
            tableBtns[k].textBlock.text = TABLES[k].label + "（焼き直し中…）";
            setTimeout(() => {
                applyTable(k);
                tableBtns[k].textBlock.text = TABLES[k].label;
                highlightSet();
            }, 30);
        });
    }
    highlightSet();

    addSpacer();
    addLabel("揺れ", 13, COL.accent, "22px");
    // 【対策】「やわらかさ」を周波数で振ると、遅くなるほど振幅も大きく
    //         見える（同じ初速なら q = v/ω）。実物のゼリーも同じ挙動なので、
    //         ここは補正せずそのまま見せるのが正しい
    addSlider("かたさ（周波数 ×）", 0.40, 2.00, GLOBAL.freqScale, f2, (v) => {
        GLOBAL.freqScale = v; updateInfo();
    });
    addSlider("揺れの大きさ ×", 0.20, 4.00, GLOBAL.jiggleGain, f2, (v) => { GLOBAL.jiggleGain = v; });
    addSlider("減衰 ×", 0.25, 3.00, GLOBAL.dampScale, f2, (v) => { GLOBAL.dampScale = v; updateInfo(); });
    addSlider("落とす高さ cm", 0.0, 12.0, GLOBAL.dropH, f1, (v) => { GLOBAL.dropH = v; });

    addSpacer();
    addLabel("光学", 13, COL.accent, "22px");
    addSlider("濃さ（消散係数 ×）", 0.25, 2.50, GLOBAL.sigmaScale, f2, (v) => {
        GLOBAL.sigmaScale = v; opticsDirty = true; updateInfo();
    });
    addSlider("濁り（多重散乱）", 0.0, 1.00, GLOBAL.cloud, f2, (v) => {
        GLOBAL.cloud = v; opticsDirty = true;
    });
    addSlider("屈折の寄与", 0.0, 1.00, GLOBAL.refraction, f2, (v) => {
        GLOBAL.refraction = v; opticsDirty = true;
    });
    addSlider("屈折率", 1.05, 1.70, GLOBAL.ior, f2, (v) => {
        GLOBAL.ior = v; opticsDirty = true;
    });
    // 【対策】溝の彫りぶんを光路長から引く量。1.0 が物理的に正しい。
    //         0 にすると谷がいちばん濃くなり、緑に塗った菊の置物に見える
    addSlider("溝の薄さを効かせる", 0.0, 1.80, GLOBAL.fluteThin, f2, (v) => {
        GLOBAL.fluteThin = v; thickDirty = true;
    });
    addSlider("表面の粗さ", 0.010, 0.220, GLOBAL.surfRough, f2, (v) => {
        GLOBAL.surfRough = v; skinDirty = true;
    });
    // 【対策】透過率は「背景の輝度 1.0」を前提に写真から逆算してある。
    //   ここを動かすと較正がそのままずれるので、既定の 1.00 が正
    addSlider("環境の明るさ ×", 0.30, 2.00, 1.00, f2, (v) => {
        mats.jelly.environmentIntensity = ENVS[currentEnv].jelly * v;
    });

    addSpacer();
    addLabel("ガラスの器", 13, COL.accent, "22px");
    const trName = () => "透過方式: " + (GLOBAL.transmission ? "透過テクスチャ" : "αブレンド");
    const trBtn = addButton("tr", trName(), () => {
        GLOBAL.transmission = !GLOBAL.transmission;
        trBtn.textBlock.text = trName() + "（焼き直し中…）";
        setTimeout(() => {
            applyVessel(currentVessel);
            applyEnv(currentEnv);
            trBtn.textBlock.text = trName();
            trBtn.background = GLOBAL.transmission ? COL.active : COL.idle;
            // 方式で意味が変わるスライダーを既定値へ戻す
            refrSl.slider.value = GLOBAL.transmission ? 1.00 : 0.14;
            updateInfo();
        }, 30);
    });
    trBtn.background = GLOBAL.transmission ? COL.active : COL.idle;
    // 【対策】ガラス越しだけ白っぽくコントラストが抜けるならガンマ、
    //   ガラス越しだけ暗く沈むならリニア。1 クリックで見分けられる
    const csName = () => "透過先の色空間: " + (GLOBAL.transmissionGamma ? "ガンマ" : "リニア");
    const csBtn = addButton("cs", csName(), () => {
        GLOBAL.transmissionGamma = !GLOBAL.transmissionGamma;
        csBtn.textBlock.text = csName();
        csBtn.background = GLOBAL.transmissionGamma ? COL.active : COL.idle;
        setTimeout(() => { applyVessel(currentVessel); applyEnv(currentEnv); }, 30);
    });
    csBtn.background = GLOBAL.transmissionGamma ? COL.active : COL.idle;
    // 【対策】α ブレンドのときは被覆そのもの。写真の器はほとんど見えないので
    //   0.05〜0.10 が実物らしい。上げると煤けたガラスになる
    addSlider("ガラスの被覆（α）", 0.02, 0.40, GLOBAL.glassAlpha, f2, (v) => {
        GLOBAL.glassAlpha = v;
        if (vessel.mat && !GLOBAL.transmission) vessel.mat.alpha = v;
    });
    // 【対策】glTF の transmissionFactor そのもの。1.0 で完全な透過。
    //   下げると参考の CompareTransmission の左側（α合成）に近づいていく
    const refrSl = addSlider("屈折・透過の強さ", 0.0, 1.00,
        GLOBAL.transmission ? 1.00 : 0.14, f2, (v) => {
            if (vessel.mat && vessel.mat.subSurface) {
                vessel.mat.subSurface.refractionIntensity = v;
            }
        });
    // 【対策】ステムとフットは無垢のガラスで、光路がボウルの 10 倍ある。
    //   ここをボウルと同じにすると脚が消えて器が宙に浮く
    addSlider("脚（無垢）の被覆", 0.05, 0.60, 0.30, f2, (v) => {
        if (vessel.solidMat && !GLOBAL.transmission) vessel.solidMat.alpha = v;
    });
    // 【対策】KHR_materials_volume の厚み。0 で薄肉（像が曲がらない）。
    //   薄いガラスで上げるとレンズになって水晶の塊に見える
    addSlider("ガラスの厚み cm（0=薄肉）", 0.0, 1.20, 0.0, f2, (v) => {
        const ss = vessel.mat && vessel.mat.subSurface;
        if (!ss) return;
        if ("volumeIndexOfRefraction" in ss) ss.volumeIndexOfRefraction = (v > 0) ? 1.52 : 1.0;
        ss.minimumThickness = 0;
        ss.maximumThickness = v;
    });

    addSpacer();
    addLabel("透過光だまり", 13, COL.accent, "22px");
    addLabel("ゼリーを通った光が器の底に落ちる色。加算で乗せています",
        10, COL.sub, "30px");
    const poolName = () => "透過光だまり: " + (GLOBAL.poolOn ? "ON" : "OFF");
    const poolBtn = addButton("poolOn", poolName(), () => {
        GLOBAL.poolOn = !GLOBAL.poolOn;
        poolBtn.textBlock.text = poolName();
        poolBtn.background = GLOBAL.poolOn ? COL.active : COL.idle;
        poolDirty = true;
    });
    poolBtn.background = GLOBAL.poolOn ? COL.active : COL.idle;
    addSlider("明るさ", 0.0, 2.00, GLOBAL.poolGain, f2, (v) => {
        GLOBAL.poolGain = v; paintDirty = true;     // 絵だけ
    });
    addSlider("広がり", 1.05, 2.20, GLOBAL.poolSpread, f2, (v) => {
        GLOBAL.poolSpread = v; poolDirty = true;    // メッシュから
    });

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
    const info = addLabel("", 11, COL.sub, "190px");

    // 粗さは ORM の G にしか出ない。高さ場も法線マップも作り直さない
    function rebakeSkin() {
        const orm = TextureLab.jellyORM(TEX, jelF, GLOBAL, scene);
        const old = jelTex.orm;
        jelTex.orm = orm;
        mats.jelly.metallicTexture = orm;
        if (old) old.dispose();
    }

    function rebakeThickness() {
        const t = TextureLab.thicknessTex(GLOBAL.thickTexSize, GLOBAL, prof, flute, scene);
        const old = jelTex.thick;
        jelTex.thick = t;
        mats.jelly.subSurface.thicknessTexture = t;
        if (old) old.dispose();
    }

    function updateInfo() {
        if (!state) return;
        const fl = FLAVORS[currentFlavor];
        const f = GLOBAL.modeFreq.map((x) => (x * GLOBAL.freqScale).toFixed(1));
        const z = GLOBAL.modeZeta.map((x) => (x * GLOBAL.dampScale).toFixed(2));
        const s = optics.sigma.map((x) => (x * GLOBAL.sigmaScale).toFixed(2));
        const tt = optics.tint;
        const dMid = prof.thRef;
        const T = [tt.r, tt.g, tt.b].map((x) => Math.pow(x, dMid).toFixed(3));
        info.text =
            "三角形 " + Math.round(state.jelly.tris).toLocaleString()
            + " / 変形頂点 " + state.def.n.toLocaleString() + "\n"
            + "モード f = [" + f.join(", ") + "] Hz\n"
            + "        ζ = [" + z.join(", ") + "]\n"
            + "σ = [" + s.join(", ") + "] /cm（" + fl.label + "）\n"
            + "光路 胴 " + dMid.toFixed(2) + "cm / 最大 " + prof.thMax.toFixed(2)
            + "cm / 平均 " + prof.thMean.toFixed(2) + "cm\n"
            + "胴の透過率 [" + T.join(", ") + "]\n"
            + "振幅 " + (state.jig.peak * 10).toFixed(2) + "mm"
            + (state.frozen ? " / 剛体は静止" : " / 落下中")
            + "  seed " + currentSeed + "\n"
            + "背景 " + ENVS[currentEnv].label + " / 露出 " + ENVS[currentEnv].exposure.toFixed(2)
            + "\n器 " + (vessel.V ? vessel.V.label : "-")
            + (vessel.V && vessel.V.kind === "glass"
                ? (GLOBAL.transmission ? " / 透過テクスチャ" : " / αブレンド") : "");
    }

    onRebuilt = () => { updateInfo(); };
    updateInfo();

    let infoTick = 0;
    scene.onBeforeRenderObservable.add(() => {
        if (opticsDirty) { opticsDirty = false; applyOptics(); }
        if (poolDirty) { poolDirty = false; paintDirty = false; rebuildPool(); }
        if (paintDirty) { paintDirty = false; repaintPool(); }
        if (thickDirty) { thickDirty = false; rebakeThickness(); }
        if (skinDirty) { skinDirty = false; rebakeSkin(); }
        infoTick += engine.getDeltaTime();
        if (infoTick > 160) { infoTick = 0; updateInfo(); }
    });

    // 狭い画面ではカードを畳む
    if (vw < GLOBAL.compactWidth) {
        card.width = "236px";
        card.height = "80%";
        panel.width = "200px";
    }

    console.log("[Jelly] build jelly-2026-09-02-i",
        "| profile N=" + prof.N,
        "thMean=" + prof.thMean.toFixed(3), "thMax=" + prof.thMax.toFixed(3),
        "| verts=" + state.def.n,
        "| tris=" + Math.round(state.jelly.tris),
        "| contactR=" + state.jelly.contactR.toFixed(2),
        "| env=" + currentEnv,
        "| physics=" + physicsOn, "| build=" + state.ms + "ms");

    scene.onDisposeObservable.add(() => {
        for (const t of [jelTex.orm, jelTex.nrm, jelTex.thick, poolTex]) { if (t) t.dispose(); }
        if (tableTop && tableTop.material && tableTop.material.texs)
            for (const t of tableTop.material.texs) t.dispose();
        for (const k in envCache) { if (envCache[k]) envCache[k].dispose(); }
        for (const m of [vessel.mat, vessel.saucerMat]) {
            if (m && m.texs) for (const t of m.texs) t.dispose();
        }
    });

    return scene;
};

export default createScene;