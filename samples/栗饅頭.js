// =====================================================
// Babylon.js Playground 用 createScene 関数
// テーマ：栗饅頭（くりまんじゅう）- 日本の和菓子
//
// ポイント：
//  1. updatable: true で頂点バッファを更新可能にする
//  2. mesh.scaling で楕円形にした後、
//     bakeCurrentTransformIntoVertices() で頂点に焼き込む
//  3. その後に底面平坦化などの頂点編集を行う
//  → Playground表示 と glTFエクスポート の両方で一致する
// =====================================================
var createScene = function () {
    var scene = new BABYLON.Scene(engine);

    // 背景を白に設定
    scene.clearColor = new BABYLON.Color4(1, 1, 1, 1);

    // -----------------------------------------------
    // カメラ設定
    // -----------------------------------------------
    var camera = new BABYLON.ArcRotateCamera(
        "camera",
        -Math.PI / 3.5,
        Math.PI / 3.2,
        3.8,
        new BABYLON.Vector3(0, -0.05, 0),
        scene
    );
    camera.attachControl(canvas, true);
    camera.lowerRadiusLimit = 2;
    camera.upperRadiusLimit = 8;
    camera.wheelDeltaPercentage = 0.02;

    const cubeTexture = new BABYLON.CubeTexture("textures/Studio_Softbox_2Umbrellas_cube_specular.env", scene);
    const currentSkybox = scene.createDefaultSkybox(cubeTexture, true);

    // -----------------------------------------------
    // ライティング
    // -----------------------------------------------
    var hemiLight = new BABYLON.HemisphericLight(
        "hemiLight",
        new BABYLON.Vector3(0, 1, 0),
        scene
    );
    hemiLight.intensity = 0.7;
    hemiLight.diffuse = new BABYLON.Color3(1.0, 0.97, 0.93);
    hemiLight.groundColor = new BABYLON.Color3(0.4, 0.35, 0.30);

    var dirLight = new BABYLON.DirectionalLight(
        "dirLight",
        new BABYLON.Vector3(-0.4, -0.9, -0.3),
        scene
    );
    dirLight.intensity = 0.6;
    dirLight.diffuse = new BABYLON.Color3(1.0, 0.92, 0.80);

    var pointLight = new BABYLON.PointLight(
        "pointLight",
        new BABYLON.Vector3(1.2, 2.0, 0.6),
        scene
    );
    pointLight.intensity = 0.3;
    pointLight.diffuse = new BABYLON.Color3(1.0, 0.96, 0.88);

    var fillLight = new BABYLON.PointLight(
        "fillLight",
        new BABYLON.Vector3(-0.8, 0.5, 1.0),
        scene
    );
    fillLight.intensity = 0.15;
    fillLight.diffuse = new BABYLON.Color3(1.0, 0.98, 0.95);

    // -----------------------------------------------
    // 栗饅頭のベースメッシュ作成
    // updatable: true にすることで頂点バッファの更新を保証
    // -----------------------------------------------
    var manju = BABYLON.MeshBuilder.CreateSphere("manju", {
        diameter: 2,
        segments: 64,
        updatable: true
    }, scene);

    // -----------------------------------------------
    // ステップ1：mesh.scaling で楕円形にする
    // -----------------------------------------------
    manju.scaling = new BABYLON.Vector3(1.6, 0.85, 1.2);

    // -----------------------------------------------
    // ステップ2：スケーリングを頂点座標にベイク
    // これにより mesh.scaling は (1,1,1) にリセットされ、
    // 頂点座標自体が楕円形になる
    // -----------------------------------------------
    manju.bakeCurrentTransformIntoVertices();

    // -----------------------------------------------
    // ステップ3：頂点位置を編集（底面平坦化＋上面ふっくら）
    // bake後なので、座標はスケーリング済みの楕円空間
    // -----------------------------------------------
    var positions = manju.getVerticesData(BABYLON.VertexBuffer.PositionKind);

    // Y座標の範囲を事前に取得
    var minY = Infinity, maxY = -Infinity;
    for (var i = 0; i < positions.length; i += 3) {
        if (positions[i + 1] < minY) minY = positions[i + 1];
        if (positions[i + 1] > maxY) maxY = positions[i + 1];
    }
    // bake後: minY ≈ -0.85, maxY ≈ 0.85

    // 底面の平坦化しきい値（楕円のY座標で下から15%付近）
    var flattenThreshold = minY + (maxY - minY) * 0.15;
    var flatY = flattenThreshold;

    for (var i = 0; i < positions.length; i += 3) {
        var y = positions[i + 1];

        // 底面を平坦化：しきい値以下の頂点を一定のYに揃える
        if (y < flattenThreshold) {
            // 完全に平らにするのではなく、少し残して自然な底面に
            var blend = (flattenThreshold - y) / (flattenThreshold - minY);
            positions[i + 1] = flattenThreshold - blend * 0.02;
        }

        // 上面をふっくら盛り上げる
        var nyLocal = (y - minY) / (maxY - minY);
        if (nyLocal > 0.6) {
            var factor = (nyLocal - 0.6) / 0.4;
            factor = factor * factor;
            positions[i + 1] += factor * 0.08;
        }
    }

    manju.updateVerticesData(BABYLON.VertexBuffer.PositionKind, positions);

    // 法線を再計算
    var normals = manju.getVerticesData(BABYLON.VertexBuffer.NormalKind);
    var indices = manju.getIndices();
    BABYLON.VertexData.ComputeNormals(positions, indices, normals);
    manju.updateVerticesData(BABYLON.VertexBuffer.NormalKind, normals);

    // -----------------------------------------------
    // 頂点カラー：焼き色を上1/3に集中
    // -----------------------------------------------
    var colors = [];

    // 色パレット
    var deepBrown   = { r: 0.45, g: 0.18, b: 0.06 };
    var redBrown    = { r: 0.60, g: 0.25, b: 0.10 };
    var warmBrown   = { r: 0.72, g: 0.38, b: 0.15 };
    var lightBrown  = { r: 0.78, g: 0.52, b: 0.25 };
    var transition  = { r: 0.88, g: 0.72, b: 0.50 };
    var paleCream   = { r: 0.96, g: 0.91, b: 0.83 };
    var paleBottom  = { r: 0.97, g: 0.94, b: 0.88 };

    var noise = function(x, z, freq) {
        return Math.sin(x * freq + 0.5) * Math.cos(z * freq * 0.7 + 0.3) +
                Math.sin(x * freq * 1.3 + 2.1) * Math.cos(z * freq * 0.9 + 1.7) * 0.5;
    };

    var lerpColor = function(c1, c2, t) {
        t = Math.max(0, Math.min(1, t));
        return {
            r: c1.r + (c2.r - c1.r) * t,
            g: c1.g + (c2.g - c1.g) * t,
            b: c1.b + (c2.b - c1.b) * t
        };
    };

    // 編集後のY座標の範囲を再取得
    minY = Infinity; maxY = -Infinity;
    for (var i = 0; i < positions.length; i += 3) {
        if (positions[i + 1] < minY) minY = positions[i + 1];
        if (positions[i + 1] > maxY) maxY = positions[i + 1];
    }

    for (var i = 0; i < positions.length; i += 3) {
        var x = positions[i];
        var y = positions[i + 1];
        var z = positions[i + 2];

        var ny = (y - minY) / (maxY - minY);

        var totalNoise = noise(x, z, 3.5) * 0.06 +
                            noise(x, z, 7.5) * 0.03 +
                            noise(x, z, 13.0) * 0.015;

        var col;

        if (ny > 0.90) {
            var t = (ny - 0.90) / 0.10;
            col = lerpColor(redBrown, deepBrown, t + totalNoise * 1.5);
        } else if (ny > 0.80) {
            var t = (ny - 0.80) / 0.10;
            col = lerpColor(warmBrown, redBrown, t + totalNoise);
        } else if (ny > 0.72) {
            var t = (ny - 0.72) / 0.08;
            col = lerpColor(lightBrown, warmBrown, t + totalNoise * 0.8);
        } else if (ny > 0.66) {
            var t = (ny - 0.66) / 0.06;
            t = t * t * (3.0 - 2.0 * t);
            col = lerpColor(transition, lightBrown, t + totalNoise * 0.5);
        } else if (ny > 0.62) {
            var t = (ny - 0.62) / 0.04;
            t = t * t * (3.0 - 2.0 * t);
            col = lerpColor(paleCream, transition, t + totalNoise * 0.3);
        } else {
            var t = ny / 0.62;
            col = lerpColor(paleBottom, paleCream, t);
            var powderNoise = Math.abs(noise(x, z, 10.0)) * 0.025;
            col.r = Math.min(1, col.r + powderNoise);
            col.g = Math.min(1, col.g + powderNoise);
            col.b = Math.min(1, col.b + powderNoise);
        }

        colors.push(
            Math.max(0, Math.min(1, col.r)),
            Math.max(0, Math.min(1, col.g)),
            Math.max(0, Math.min(1, col.b)),
            1.0
        );
    }

    manju.setVerticesData(BABYLON.VertexBuffer.ColorKind, colors);

    // -----------------------------------------------
    // マテリアル設定
    // -----------------------------------------------
    var mat = new BABYLON.StandardMaterial("manjuMat", scene);
    mat.diffuseColor = new BABYLON.Color3(1, 1, 1);
    mat.specularColor = new BABYLON.Color3(0.35, 0.28, 0.15);
    mat.specularPower = 24;
    mat.ambientColor = new BABYLON.Color3(0.3, 0.28, 0.22);
    manju.material = mat;

    // -----------------------------------------------
    // シーンの環境設定
    // -----------------------------------------------
    scene.ambientColor = new BABYLON.Color3(0.25, 0.22, 0.18);

    return scene;
};

export default createScene;