/* =====================================================================
 *  おかしのつくりかた — 第IV部（15〜16章）と第V部（17〜18章）の本文
 *
 *  第IV部「皿にのせる」は盛り付けとトッピング。
 *  第V部「硬い面の外へ」は、揺れるものと、表面の無いもの。
 *
 *  形式は pages-1.js と同じ。
 * ===================================================================== */

module.exports = [

/* ==================================================================
   15 物理
   ================================================================== */
{
  file: "ch15.html", no: "15", tag: "Havok", nav: "15 盛る", color: "kuri",
  title: "盛り付けは、手で置かない",
  sub: "physics — 落として積むという設計",
  crumb: "第15章",
  recap: [
    "皿の上の位置を1個ずつ手で書くと、必ず「並べた」ように見えます。",
    "そこで<b>上から落として、重力と摩擦に任せます</b>。物理エンジンは Havok。クッキー・チョコレート・ドーナツ・プリン・ゼリーが使っています。",
    "ただし団子は、あえて物理を使いません。<b>積み方そのものが決まっているお菓子</b>があるからです。"
  ],
  html: `
    <p>
      クッキーを皿に盛りたい。座標を手で書くと、どうやっても不自然になります。
      隙間が均等すぎるか、めり込むか、どちらかです。実物の盛り付けは、
      <b>落ちたものが下のものに引っかかって、たまたまそこで止まった</b>結果できています。
    </p>
    <p>
      だから、そのとおりにします。皿を置いて、重力を設定して、上から1枚ずつ落とす。
      あとは物理エンジンが勝手に積んでくれます。書くのは「何を、どこから、どんな向きで落とすか」だけです。
    </p>
    <figure>
<pre><span class="c">// 8. Scene / 物理（クッキー.js を短くしたもの）</span>
<span class="k">const</span> hk = <span class="k">await</span> HavokPhysics();
scene.enablePhysics(<span class="k">new</span> V3(<span class="n">0</span>, -GLOBAL.gravity, <span class="n">0</span>), <span class="k">new</span> BABYLON.HavokPlugin(<span class="k">true</span>, hk));

<span class="c">// 【対策】cm 単位のシーンで実重力 981 を入れると、1ステップの
//         めり込みが Havok の許容量を超えて震え続ける。数百に落とす</span>
gravity: <span class="n">560</span>,
<span class="c">// 【対策】クッキーは平たいので、摩擦が低いと皿の傾斜を全部滑り落ちて
//         縁に沿ってドーナツ状に並ぶ。焼き菓子の表面はざらざらしている</span>
friction: <span class="n">0.92</span>, restitution: <span class="n">0.02</span>,</pre>
      <figcaption>クッキー.js とチョコレート.js は重力 560、プリン.js は 620。単位を cm にすると重力の値まで変わる</figcaption>
    </figure>

    <div class="lab" id="lab08">
      <p class="lab-title">実験 — 落として積む（トリュフの山）</p>
      <div class="lab-cols side">
        <div class="controls">
          <div class="ctrl">
            <label for="dropCount">個数<span class="v" id="dropCountV">18</span></label>
            <input type="range" id="dropCount" min="4" max="40" step="1" value="18">
          </div>
          <div class="ctrl">
            <label for="dropFric">摩擦<span class="v" id="dropFricV">0.58</span></label>
            <input type="range" id="dropFric" min="0" max="1" step="0.01" value="0.58">
          </div>
          <div class="ctrl">
            <label for="dropRest">跳ね返り<span class="v" id="dropRestV">0.06</span></label>
            <input type="range" id="dropRest" min="0" max="0.8" step="0.01" value="0.06">
          </div>
          <button class="chip" type="button" id="dropRun">もう一度 落とす</button>
          <div class="readout" id="dropOut">—</div>
        </div>
        <canvas id="dropCanvas" width="640" height="360" aria-label="トリュフを器に落として積む実験"></canvas>
      </div>
      <p class="hint">
        断面（横から見た2D）での実験です。初期値はチョコレート.js の摩擦 0.58・跳ね返り 0.06。
        摩擦を 0 にすると全部が器の縁まで流れて平らになり、
        1 に近づけると落ちた場所でそのまま止まって、不自然に高い塔ができます。
      </p>
    </div>

    <h3>落とし方にも、お菓子らしさがある</h3>
    <p>
      物理に任せるといっても、放すときの向きは自分で決めます。クッキー.js の記録：
      <b>「クッキーは平たいので、伏せるか仰向けるかの2択に落ち着く。全部を表向きで放すと
      『盛った』ではなく『並べた』になる。4枚に1枚は最初から裏返して放し、底の焼き色を見せる」</b>。
      10章で作った底の焼き色は、こうして初めて画面に出てきます。
    </p>

    <h3>当たり判定は、見た目のとおりでなくてよい</h3>
    <p>
      物理エンジンは、見た目の形をそのまま使うと重すぎます。
      そこで、当たり判定だけ簡単な形に置き換えます。クッキーやチョコは<b>凸包</b>
      （でっぱりだけを包んだ袋のような形）で十分です。
    </p>
    <p>
      ところがドーナツは凸包では駄目でした。ドーナツ.js の記録：
      <b>「凸包にすると穴が埋まり、ただの円盤になる。重なったときに見えない肉で浮くうえ、
      ドーナツ同士が串刺しに絡む一番の見どころが消える」</b>。
      そこで、輪に沿って<b>カプセルを何個も並べたもの</b>を当たり判定にしています。
      穴が残るので、皿の上でドーナツ同士が串刺しのように重なれます。
      ついでに摩擦も 0.90 と高めです。ドーナツは輪なので、摩擦が低いと<b>転がって皿から落ちる</b>からです。
    </p>

    <h3>あえて物理を使わない</h3>
    <p>
      月見団子は、15個を9 + 4 + 2 と三方に積みます。これを物理で落とすと、丸い団子は転がって崩れます。
      そもそも月見団子は<b>積み方が決まっている</b>お菓子で、偶然の山であってはいけません。
      だから月見団子.js は物理を使わず、
    </p>
    <ul>
      <li>段ごとに、格子や三角の並びで位置を決める</li>
      <li>大きさと位置を、正規分布で少しだけずらす（→ <a href="ch02.html">02章</a>）</li>
      <li>高さは、<b>下の段の団子だけ</b>を見て、そこに乗る位置まで持ち上げる</li>
      <li>触れ合った組を「接触面」に変換して、あとで潰す（→ <a href="ch08.html">08章</a>）</li>
    </ul>
    <p>
      という<b>決定論的な積み方</b>をしています。3つ目には【対策】があって、
      「支持に『同じ段』を入れてはいけない。互いに乗り合って段全体がじりじり浮き上がる」。
      花見団子は串に刺さっていて動かないので、これも物理は要りません。
      チョコバナナは屋台の穴あき台に1本ずつ刺して立てます。
      <b>物理を使うかどうかは、そのお菓子が皿の上でどう置かれるか</b>で決まります。
    </p>
    <div class="trap">
      <span class="label">つまずきポイント</span>
      <p><b>物理の結果は毎回変わります。</b>
      02章で「同じ種なら同じ結果」を守ってきたのに、
      物理を挟んだ瞬間に再現性が消えます（計算の順番が実行ごとに揺れるため）。
      だから物理を使うサンプルは、落とす順番・初期位置・初速をすべて種から決めて、
      揺れる余地を最小にしています。それでも完全には一致しません。</p>
    </div>`,
  tryIt: [
    "摩擦を 0 にして落とし、山ではなく1層になることを確かめる。",
    "跳ね返りを 0.8 にすると何が起きるか予想してから試す。",
    "個数を 40 にして、いちばん上の1個がどこで止まるか3回見比べる。",
    "月見団子.js で「同じ段」を検索し、なぜ下の段だけを見るのか読む。"
  ]
},

/* ==================================================================
   16 トッピング
   ================================================================== */
{
  file: "ch16.html", no: "16", tag: "Topping", nav: "16 振る", color: "sprinkle",
  title: "スプレーは、上から振ったところにだけ付く",
  sub: "instancing / scattering — 実体としてのトッピング",
  crumb: "第16章",
  recap: [
    "カラースプレー・チョコチップ・ココナッツ。<b>絵に描くと消えます</b>。1粒ずつ実体として置く必要があります。",
    "同じ粒を何百個も置くときは<b>インスタンス</b>を使い、1粒ぶんの形を使い回します。",
    "どこに付くかは<b>振った向き</b>で決まり、付いた粒は<b>半分沈む</b>。均等に並べると、振ったようには見えません。"
  ],
  html: `
    <p>
      チョコバナナにカラースプレーを振ります。テクスチャに色の点を描けばよさそうですが、
      これは失敗します。1mm の粒は、少し離れるとミップマップ（縮小版の画像）で溶けて
      <b>色のにじんだ靄</b>になります。ドーナツ.js のコメントはもっと手厳しくて、
      「テクスチャの斑点で済ませると、真上から見た1個は誤魔化せても、皿に転がった瞬間に『印刷』だとわかる」。
      粒を「振りかけた」ように見せられるのは、実体の粒だけです。
    </p>
    <p>
      そこで、チョコバナナ.js はスプレーを<b>小さなカプセル</b>（両端の丸い棒）として1本ずつ置きます。
      クッキーのチョコチップは潰れた球、ドーナツのココナッツは薄い板、レモンの皮は細い小片。
      どれも実体です。
    </p>

    <h3>インスタンス — 形は1粒ぶんだけ作る</h3>
    <p>
      500本のスプレーを1本ずつメッシュにすると、頂点の配列も描く命令も500個ぶん要ります。
      そこで、形は1本だけ作り、<b>位置・向き・大きさ・色だけを500本ぶん持つ</b>。
      これがインスタンスです。GPU 側は「同じ形を、行列を差し替えながら500回描く」だけになります。
    </p>
    <figure>
<pre><span class="c">// チョコバナナ.js : カプセルを1本だけ作って、あとは行列で配る</span>
<span class="k">const</span> sp = BABYLON.MeshBuilder.CreateCapsule(<span class="s">"sprinkle"</span>,
    { height: <span class="n">1</span>, radius: <span class="n">0.5</span>, tessellation: <span class="n">8</span> }, scene);
sp.thinInstanceSetBuffer(<span class="s">"matrix"</span>, <span class="k">new</span> Float32Array(mats), <span class="n">16</span>, <span class="k">true</span>);
<span class="c">// 1本ごとの色（ピンク・黄・白・橙…）は、インスタンスの色として渡す</span>
sp.thinInstanceSetBuffer(<span class="s">"color"</span>, <span class="k">new</span> Float32Array(colors), <span class="n">4</span>, <span class="k">true</span>);</pre>
      <figcaption>大きさ（長さと太さ）も向きも、1本ずつの行列に入っている</figcaption>
    </figure>
    <p>
      ドーナツ.js は別のやり方で、粒を全部<b>1つのメッシュにまとめて</b>います。
      「1粒ずつメッシュにするとドローコールが 90 個増える」ので、低い解像度の球を粒の数だけ
      1つの頂点配列に書き込む。粒の形を1個ずつ歪ませたいときは、こちらが向いています。
    </p>

    <h3>どこに付くかは、振った向きで決まる</h3>
    <p>
      ここがトッピングでいちばん大事なところです。チョコバナナ.js の冒頭：
      <b>「カラースプレーは全周には付かない。横にして上から振るので、上を向いていた背（凸側）と
      片側の肩にだけ密に付き、腹（凹側）はチョコの地のまま」</b>。
      全周に一様に撒くと、「スプレーをまぶした」ではなく「柄の布」になります。
    </p>
    <figure>
<pre><span class="c">// 付着確率：その場所の法線 n と、振りかけた向き d の内積</span>
<span class="k">const</span> facing = dot(n, d);                      <span class="c">// 1 なら真正面から粒が飛んでくる</span>
<span class="k">const</span> p = smooth(<span class="n">-0.28</span>, <span class="n">0.42</span>, facing) * along;  <span class="c">// along は「下 3 割は地のチョコ」</span>
<span class="k">if</span> (rng.next() &gt; p) <span class="k">continue</span>;                <span class="c">// 付かなかった</span>
<span class="c">// 乾く前のチョコに半分沈める</span>
<span class="k">const</span> sink = dia * rng.range(sinkMin, sinkMax);
position = surface + n * (dia * <span class="n">0.5</span> - sink);</pre>
      <figcaption>チョコバナナ.js の buildSprinkles を短くしたもの。04章の法線が、ここでは「粒が当たるかどうか」に使われる</figcaption>
    </figure>
    <p>
      最後の2行も大切です。<b>「スプレーは乾く前のチョコに半分沈む。表面に置いただけにすると、
      乗っているだけの粒に見える」</b>。ドーナツ.js にも同じ記録があり、
      「粒を面の上にきれいに載せると、乾いてから振りかけたように見える。実際は固まる前のグレーズに沈むので、
      半分近く埋まっている」。クッキーのチョコチップも、生地に半分ほど沈めてあります。
    </p>

    <div class="lab" id="lab09">
      <p class="lab-title">実験 — スプレーを撒いて、重なりをほぐす</p>
      <div class="lab-cols side">
        <div class="controls">
          <div class="ctrl">
            <label for="scatterN">本数<span class="v" id="scatterNV">90</span></label>
            <input type="range" id="scatterN" min="10" max="260" step="5" value="90">
          </div>
          <div class="ctrl">
            <label for="scatterIter">ほぐす回数<span class="v" id="scatterIterV">0</span></label>
            <input type="range" id="scatterIter" min="0" max="30" step="1" value="0">
          </div>
          <div class="chips" id="scatterMode">
            <button class="chip" type="button" data-v="random" aria-pressed="true">乱数で撒く</button>
            <button class="chip" type="button" data-v="grid">格子に並べる</button>
          </div>
          <div class="readout" id="scatterOut">—</div>
        </div>
        <canvas id="scatterCanvas" width="640" height="360" aria-label="チョコがけドーナツにスプレーを撒いて重なりをほぐす実験"></canvas>
      </div>
      <p class="hint">
        チョコがけドーナツを真上から見たところです。色の重みはチョコバナナ.js の「カラフル」から。
        「格子に並べる」は、重なりがゼロなのに一目で嘘と分かります。
        乱数で撒いてから少しだけほぐす、が実物に近い落としどころです。
      </p>
    </div>

    <h3>重なりをほぐす — ただし、やりすぎない</h3>
    <p>
      乱数で撒くと、必ず何本かが同じ場所に重なります。重なった粒は、
      光の当たり方が同じになるので<b>1つの濃い染みに見えます</b>。
      そこで、近すぎる組を見つけて、離れる方向に少しずつ動かす操作を何回かくり返します。
    </p>
    <p>
      ここで大事なのは<b>やりすぎないこと</b>です。ほぐしきると格子になり、
      「振りかけた」ではなく「並べた」に戻ってしまいます。
      上の実験でほぐす回数を 30 まで上げると、それが見えます。
      たい焼きの断面のつぶあんも同じで、たい焼き.js には
      「粒を等間隔に並べると水玉の布になる。大小と向きを散らし、一部は重ねて『詰まった餡』に見せる」とあります。
    </p>

    <h3>粒を、模様ではなく実体で作る判断</h3>
    <p>
      どこまでを実体で作り、どこからをテクスチャで済ませるか。
      サンプルは、だいたい次の基準で分けています。
    </p>
    <table>
      <tr><th>大きさ</th><th>やり方</th><th>例</th></tr>
      <tr><td>数 mm 以上</td><td>実体のメッシュ。シルエットに出る</td><td>チョコチップ・カラースプレー・つぶあんの粒</td></tr>
      <tr><td>1〜3mm の薄いもの</td><td>板に近い薄い実体。輪郭は要るが厚みはほとんど要らない</td><td>ドーナツのココナッツ・レモンの皮</td></tr>
      <tr><td>1mm 未満</td><td>法線マップとアルベド。凹凸だけ嘘をつく</td><td>クッキーの砂糖の細粒・気泡の穴・型押しの筋</td></tr>
    </table>
    <div class="trap">
      <span class="label">つまずきポイント</span>
      <p><b>薄い板は、裏から見ると消えます。</b>
      片面しか描かない設定のままだと、撒いたかけらの半分が見えなくなります。
      両面描画（<code>backFaceCulling = false</code>）にするか、
      裏返っているものを作るときに向きを揃えます。</p>
      <p><b>影を落とす対象に入れると、一気に重くなります。</b>
      500本の粒全部に影を計算させる必要はありません。
      大きいものだけ影を持たせ、小さい粒は外します。</p>
      <p><b>同じ名前で何個も作ると、あとで自分が困ります。</b>
      Babylon.js は <code>new BABYLON.Mesh(name)</code> のときに
      <b><code>id</code> にも同じ値を入れる</b>ので、同じ名前で何本も作ると id まで同じになります。
      画面は正しく出るので気づきません。ところが Playground の
      <b>Inspector で3本目をクリックすると、別の1本が選ばれます</b>。Inspector が id で引き当てるときに取り違えるためです。</p>
      <p>厄介なのは、<b>名前だけ直しても直らない</b>ことです。
      あとから <code>mesh.name</code> を変えても <code>id</code> は元のまま残ります。
      チョコバナナ.js とロールケーキ.js は、メッシュを作るたびに <code>named()</code> という関数を通して、
      「mesh.name と mesh.id を必ず一意にする（Inspector の選択が先頭に吸われるのを防ぐ）」ようにしています。
      同じ部品を何百個も並べる章なので、いちばん踏みやすい落とし穴です。</p>
    </div>`,
  tryIt: [
    "本数を 260 にして、ほぐす回数 0 と 10 を見比べる。",
    "「格子に並べる」に切り替え、なぜ嘘に見えるのか1行で書く。",
    "チョコバナナ.js で facing を検索し、どの向きから振ったことになっているか読む。",
    "ドーナツ.js の TOPPINGS で embed（沈み具合）の値を探し、トッピングごとに比べる。"
  ]
},

/* ==================================================================
   17 揺れ（モーダル変形）
   ================================================================== */
{
  file: "ch17.html", no: "17", tag: "Jiggle", nav: "17 揺れ", color: "purin",
  title: "プルプルは、6本のばねの重ね合わせ",
  sub: "modal deformation — 物理エンジンに無い、やわらかさの作り方",
  crumb: "第17章",
  recap: [
    "Havok には<b>ソフトボディ（やわらかい物体）が無い</b>ので、落ちる・着地するは Havok に、揺れは自前の計算に分けます。",
    "揺れは<b>減衰するばね（振動子）</b>を数本だけ回し、決まった形の変形を足し合わせて作ります。",
    "目に付くのは形の変化より<b>ハイライトが走ること</b>。だから法線も一緒に動かします。"
  ],
  html: `
    <p>
      皿の上に落としたプリンは、ぷるんと2〜3回揺れて止まります。
      15章では盛り付けを物理エンジン（Havok）に任せましたが、Havok が扱えるのは<b>硬い物体</b>だけです。
      プリン.js の冒頭にこうあります。
    </p>
    <div class="note">
      <b>「Babylon の Havok プラグインが公開しているのは剛体・シェイプ・拘束までで、
      ソフトボディは出ていない。そこで役割を分ける。
      Havok … 落下・着地・皿との接触。自前 … 揺れそのもの」</b>
    </div>
    <p>
      落ちてくる・皿に当たる・止まる、までは硬い物体として Havok が計算します。
      Havok から「いま速度がどれだけ急に変わったか」（＝着地の衝撃）を受け取り、
      それを入力にして<b>揺れだけを自分で計算</b>します。
      揺れの計算に使うのは、ばねにおもりを付けて揺らしたときと同じ式です。
    </p>
    <figure>
<pre><span class="c">// 減衰するばね。q は揺れの大きさ、qd はその速さ</span>
<span class="c">// q'' + 2ζω q' + ω² q = 0   （ω = 2π × 周波数、ζ = 減衰比）</span>
<span class="k">for</span> (<span class="k">let</span> k = <span class="n">0</span>; k &lt; NMODE; k++) {
    <span class="k">const</span> w = <span class="k">this</span>.omega(k), z = <span class="k">this</span>.zeta(k);
    <span class="k">this</span>.qd[k] += (-<span class="n">2</span> * z * w * <span class="k">this</span>.qd[k] - w * w * <span class="k">this</span>.q[k]) * h;
    <span class="k">this</span>.q[k]  += <span class="k">this</span>.qd[k] * h;
}</pre>
      <figcaption>プリン.js の Jiggle.step()。h は 1/240 秒。この数行が「プルプル」の本体</figcaption>
    </figure>

    <div class="lab" id="lab14">
      <p class="lab-title">実験 — 揺れ方は、周波数と減衰比の2つで決まる</p>
      <div class="lab-cols side">
        <div class="controls">
          <div class="chips" id="jigPreset">
            <button class="chip" type="button" data-v="purin" aria-pressed="true">プリン</button>
            <button class="chip" type="button" data-v="jelly">ゼリー</button>
            <button class="chip" type="button" data-v="kanten">寒天</button>
            <button class="chip" type="button" data-v="gomu">ゴム</button>
          </div>
          <div class="ctrl">
            <label for="jigFreq">周波数（Hz）<span class="v" id="jigFreqV">2.90</span></label>
            <input type="range" id="jigFreq" min="1" max="8" step="0.05" value="2.9">
          </div>
          <div class="ctrl">
            <label for="jigZeta">減衰比 ζ<span class="v" id="jigZetaV">0.105</span></label>
            <input type="range" id="jigZeta" min="0.01" max="0.4" step="0.005" value="0.105">
          </div>
          <label class="switch"><input type="checkbox" id="jigNormal" checked>法線も一緒に動かす</label>
          <button class="chip" type="button" id="jigShake">ゆらす</button>
          <div class="readout" id="jigOut">—</div>
        </div>
        <canvas id="jigCanvas" width="640" height="360" aria-label="プリンを横から見て、せん断と縦の2つのモードで揺らす実験"></canvas>
      </div>
      <p class="hint">
        「ゆらす」かキャンバスのクリックで揺れます。右の線は揺れの大きさ q の記録です。
        減衰比を 0.3 にすると寒天、0.03 にするとゴムになります。
        「法線も一緒に動かす」を切ると、形は揺れているのにハイライトが止まったままになります。
      </p>
    </div>

    <h3>揺れの「形」は、先に決めておける</h3>
    <p>
      やわらかい物を本気で計算すると、1万個の頂点が互いに押し合う連立方程式になります。
      それを毎フレーム解くのは重すぎます。そこで、揺れ方を<b>決まった数パターン（モード）</b>に限ります。
      プリン.js が使っているのは6つです。
    </p>
    <table>
      <tr><th>#</th><th>揺れ方</th><th>形</th><th>周波数</th><th>減衰比</th></tr>
      <tr><td>0, 1</td><td>横に首を振る（せん断 X / Z）</td><td>底を固定した片持ちのたわみ <code>1.5s² − 0.5s³</code></td><td>5.8 Hz</td><td>0.105</td></tr>
      <tr><td>2</td><td>縦につぶれる・のびる</td><td>上が沈むぶん胴が太る（体積を保つ）</td><td>9.2 Hz</td><td>0.145</td></tr>
      <tr><td>3, 4</td><td>上から見て楕円にゆがむ</td><td><code>cos 2θ</code> / <code>sin 2θ</code></td><td>12.5 Hz</td><td>0.175</td></tr>
      <tr><td>5</td><td>天面が太鼓のように上下</td><td>天面の中心ほど大きい</td><td>15.5 Hz</td><td>0.240</td></tr>
    </table>
    <p>
      s は底からの高さを 0〜1 にしたもの、θ は上から見た角度です。
      どのモードも「静止しているときの形」だけで決まる関数なので、頂点ごとの動き方 Φ<sub>k</sub> を
      <b>組み立てるときに1回だけ計算して焼いておけます</b>（焼き込み）。
      実行中にやることは、6本のばねの値 q<sub>k</sub> を掛けて足すだけです。
    </p>
    <figure>
<pre><span class="c">// 頂点の変位 u = Σ q_k Φ_k(p)。Φ はビルド時に焼いてある</span>
<span class="k">for</span> (<span class="k">let</span> k = <span class="n">0</span>; k &lt; NMODE; k++) {
    <span class="k">const</span> q = Q[k];
    <span class="k">if</span> (q === <span class="n">0</span>) <span class="k">continue</span>;
    ux += q * M[b]; uy += q * M[b + <span class="n">1</span>]; uz += q * M[b + <span class="n">2</span>];
}</pre>
      <figcaption>プリン.js の Deformable.apply()。足し算だけなので、1万頂点でも 60fps に収まる</figcaption>
    </figure>

    <h3>減衰比が、素材を決める</h3>
    <p>
      周波数は「どれだけ速く揺れるか」、減衰比 ζ は「どれだけ早く収まるか」です。
      プリン.js は周波数を実物から見積もっています。カスタードのかたさ（数 kPa）と密度から、
      揺れが伝わる速さはおよそ 1 m/s。高さ 4.3cm の片持ちなら <code>f ≈ c / (4H) ≈ 5.8 Hz</code>。
      「2〜3回揺れて1秒以内に収まる」のは、減衰比 0.10〜0.15 にあたります。
    </p>
    <ul>
      <li><b>プリン</b> — ζ = 0.105。2〜3回で止まる</li>
      <li><b>ゼリー</b> — ζ = 0.055、周波数は 8.0 Hz と高め。カスタードよりよく響き、3〜4回揺れる（ゼリー.js）</li>
      <li><b>寒天</b> — ζ を 0.3 まで上げると、ほとんど揺れずに止まる</li>
      <li><b>ゴム</b> — ζ を 0.03 まで下げると、いつまでも揺れ続ける</li>
    </ul>
    <p>
      見た目の形は同じでも、この2つの数だけで「何でできているか」が伝わります。
      どちらのサンプルにも、GUI でまとめて振れる <code>freqScale</code>（やわらかさ）があり、
      プリンは 0.50、ゼリーは 0.70 を掛けて、写真より少しゆっくり大きく揺らしています。
    </p>

    <h3>動いて見えるのは、ハイライト</h3>
    <p>
      頂点の位置だけを動かして法線を放っておくと、揺れているのに<b>濡れて見えません</b>。
      プリン.js のコメントによれば、プルプル感の主成分は形の変化ではなく
      <b>「ハイライトが表面を走ること」</b>です。04章で見たとおり、明るさを決めるのは法線です。
    </p>
    <p>
      変位 u が小さいとき、変形後の法線は <code>n' ≈ normalize(n − (∇u)ᵀ n)</code> で近似できます。
      静止時の法線 n は決まっているので、この (∇Φ<sub>k</sub>)ᵀ n も頂点ごとに焼いておける。
      結果として、頂点1つあたり「モード数 × 6個の数」を持っておけば、位置も法線も足し算だけで動きます。
    </p>
    <div class="trap">
      <span class="label">つまずきポイント</span>
      <p><b>表示のフレームごとに積分すると、速いモードが暴れます。</b>
      60fps の 1/60 秒で 15.5Hz のモードを進めると、1歩で ω×h が 1.6 になって符号が振動し、発散します。
      プリン.js は内部で 1/240 秒に刻んで回しています。</p>
      <p><b>衝撃は「力」ではなく「速度の差」で渡す。</b>
      着地の加速度を力として積分していたら、60fps と 144fps で揺れの大きさが2倍違いました。
      Havok から受け取った速度の差 Δv をそのまま q の速さに足せば、刻み幅が効かなくなります。</p>
      <p><b>大きく揺らすと裏返る。</b>
      モードの形は小さな変形を前提にした近似なので、縦モードを高さ H まで押すと潰れきって裏返ります。
      ばねは線形のまま回し、表示に渡すところで <code>tanh</code> を通して頭打ちにします。
      実物のゲルも大きく歪むと硬くなるので、挙動としても外れていません。</p>
    </div>`,
  tryIt: [
    "プリン・ゼリー・寒天・ゴムを順に押し、「ゆらす」で止まるまでの回数を数える。",
    "「法線も一緒に動かす」を切って揺らし、何が足りなく見えるかを1行で書く。",
    "プリン.js で modeZeta を全部 0.03 にして Run し、皿の上で何に見えるか確かめる。",
    "ゼリー.js の modeFreq / modeZeta をプリン.js と並べ、どのモードがどれだけ違うか表にする。"
  ]
},

/* ==================================================================
   18 糸（線で描く綿菓子）
   ================================================================== */
{
  file: "ch18.html", no: "18", tag: "Strand", nav: "18 糸", color: "wata",
  title: "綿菓子は、面ではなく3万本の線",
  sub: "strands — 表面の無いものの描き方",
  crumb: "第18章",
  recap: [
    "綿菓子には、はっきりした<b>表面がありません</b>。見えているのは、細い砂糖の糸の重なりです。",
    "形の土台は回転体の曲面。その上に<b>帯の向きに沿って</b>短い糸を3万2千本、三角形ではなく<b>線</b>で描きます。",
    "糸だけだと中が空っぽに見えるので、半透明の<b>芯</b>を置き、その<b>深度を先に書いて</b>裏側の糸を隠します。"
  ],
  html: `
    <p>
      これまでの17章は、どれも「表面」を作る話でした。点を並べて三角形を張り、法線で明るさを決める。
      綿菓子はそれが通じません。ふわふわの輪郭は、砂糖の糸が空中で重なってできています。
      綿菓子.js の冒頭です。
    </p>
    <div class="note">
      <b>「糸は曲面上を『帯に沿って』周方向に走らせる。……頂点には『表面上の点』と
      『浮かせるベクトル（法線×浮き量）』を別々に持たせ、ふわふわ度はシェーダで掛けるだけにする。
      糸だけだと中が空っぽに見えるので、少しだけ膨らませた曲面を半透明の『芯』として深度だけ先に書く」</b>
    </div>

    <h3>土台は、帯を巻いた回転体</h3>
    <p>
      割り箸に巻き取った綿菓子は、下がすぼまって上が丸い。これは06章と同じ<b>回転体の輪郭</b>で書けます。
      その上に、巻き取ったときの<b>ロープを巻いたような段々</b>を乗せます。
    </p>
    <figure>
<pre><span class="c">// 帯の番号。v は高さ（0〜1）、phi は周方向の角度</span>
<span class="k">function</span> bandK(phi, v) {
    <span class="k">return</span> v * CFG.bands + phi / TAU + <span class="n">0.22</span> * Math.sin(<span class="n">2</span> * phi + v * <span class="n">5.0</span>);
}
<span class="c">// 帯の小数部で半径を膨らませる → 螺旋状の段々</span>
<span class="k">var</span> band = Math.pow(Math.sin(Math.PI * fr), <span class="n">0.7</span>);
<span class="k">var</span> r = _pr[<span class="n">0</span>] * (<span class="n">0.84</span> + <span class="n">0.16</span> * band + lobe * sv);</pre>
      <figcaption>綿菓子.js の surf()。phi/TAU を足しているので、1周すると帯が1段ずれる＝螺旋になる</figcaption>
    </figure>
    <p>
      <code>v × 6.5 + φ/2π</code> が一定の線は、1周するあいだに高さが 1/6.5 だけ下がる螺旋です。
      この「帯の番号が一定の線」を等高線として使うのが、次の糸の工夫です。
    </p>

    <div class="lab" id="lab17">
      <p class="lab-title">実験 — 糸を帯に沿わせる / 芯で裏を隠す</p>
      <div class="lab-cols side">
        <div class="controls">
          <div class="ctrl">
            <label for="flossN">糸の本数<span class="v" id="flossNV">4000</span></label>
            <input type="range" id="flossN" min="300" max="8000" step="100" value="4000">
          </div>
          <div class="ctrl">
            <label for="flossFluff">ふわふわ度（浮き量の倍率）<span class="v" id="flossFluffV">1.00</span></label>
            <input type="range" id="flossFluff" min="0" max="2.5" step="0.01" value="1">
          </div>
          <label class="switch"><input type="checkbox" id="flossBand" checked>糸を帯に沿わせる</label>
          <label class="switch"><input type="checkbox" id="flossCore" checked>芯の深度を先に書く</label>
          <div class="chips" id="flossColor">
            <button class="chip" type="button" data-v="white" aria-pressed="true">白</button>
            <button class="chip" type="button" data-v="pink">ピンク</button>
          </div>
          <div class="readout" id="flossOut">—</div>
        </div>
        <canvas id="flossCanvas" width="640" height="360" aria-label="綿菓子を線の集まりとして描き、帯の向きと芯の有無を切り替える実験"></canvas>
      </div>
      <p class="hint">
        「帯に沿わせる」を切ると、糸がばらばらの向きを向いて毛玉になります。
        「芯の深度を先に書く」を切ると、向こう側の糸まで透けて見えて、中身の無い網のかごになります。
        ふわふわ度は、糸を作り直さずに浮き量だけを掛け直しています。
      </p>
    </div>

    <h3>糸は、帯の等高線に沿って走る</h3>
    <p>
      糸1本は 14 個の折れ線です。始点を曲面の上に選び、周方向に少しずつ進みながら、
      高さを <code>−1 / (2π × 帯の段数)</code> の傾きで下げていく。すると糸は帯の螺旋と同じ向きを向き、
      ロープの段々を<b>なぞるように</b>並びます。傾きには ±45% ほどの乱れを入れ、
      7% の糸だけは「外へ飛び出す毛羽」として、長く・高く浮かせ、端をめくれさせます。
      輪郭のふわふわは、この 7% が作っています。
    </p>
    <p>
      始点の選び方にも注意が要ります。高さ v を一様に選ぶと、細い下のほうに糸が詰まりすぎる。
      綿菓子.js は<b>その高さの半径に比例する確率</b>で受け入れて（棄却法）、面積あたりの本数を揃えています。
    </p>

    <h3>浮き量は、あとから掛ける</h3>
    <p>
      糸の頂点は「曲面の上の点」と「そこから浮かせるベクトル（法線 × 浮き量）」の2つを別々に持ちます。
      シェーダでは <code>p = position + normal * uFluff</code> と、浮かせるベクトルに倍率を掛けて足すだけ。
      だから GUI の「ふわふわ度」を動かしても、<b>3万2千本を作り直す必要がありません</b>。
      17章のプリンで揺れの形を焼いておいたのと同じ考え方で、変わらないものを先に作り、変わるものは掛け算1回にしておきます。
      ついでに、時間で少しだけ揺らして、糸が空気に浮いているように見せています。
    </p>

    <h3>線で描いて、芯で裏を隠す</h3>
    <p>
      糸は三角形ではなく、マテリアルを <code>LineListDrawMode</code> にした<b>線</b>として描きます。
      1本ずつの不透明度は 0.40、端に行くほど薄くして、重なったところだけが白く見えるようにする。
      ところが糸だけだと、向こう側の糸まで全部見えて、中身の無い網のかごになります。
    </p>
    <p>
      そこで、曲面を少しだけ膨らませた<b>芯</b>を半透明で置き、<code>needDepthPrePass = true</code> で
      <b>色より先に深度だけ書いて</b>おきます。深度が書いてあれば、芯より奥の糸は自動的に描かれません。
      芯は正面ほど不透明、縁ほど透明にしてあるので、輪郭は芯ではなく<b>糸の毛羽</b>で決まります。
    </p>
    <div class="trap">
      <span class="label">つまずきポイント</span>
      <p><b>糸に深度を書かせない。</b>
      半透明の糸が深度を書くと、先に描いた糸が後ろの糸を消してしまい、描く順番で見た目が変わります。
      糸のマテリアルは <code>disableDepthWrite = true</code>、描く順番は <code>alphaIndex</code> で「芯 → 糸」と決めています。</p>
      <p><b>線の太さは選べないと思っておく。</b>
      WebGL の線は、ほとんどの環境で太さ 1 画素に固定です。太さで表現しようとせず、
      <b>本数と不透明度</b>で密度を作ります。3万2千本はそのための数です。</p>
      <p><b>後処理に GUI まで巻き込まない。</b>
      ポストエフェクトを掛けると、右下のつまみまでにじみます。綿菓子.js は
      <code>ui.layer.applyPostProcess = false</code> で、GUI を後処理のあとに描いています。</p>
    </div>`,
  tryIt: [
    "「帯に沿わせる」を切り、何が「綿菓子らしさ」を作っていたのかを1行で書く。",
    "「芯の深度を先に書く」を切って、ふわふわ度を 0 と 2.5 にしたときの違いを見る。",
    "綿菓子.js で CFG.bands を 6.5 から 3 にして Run し、帯の段々がどう変わるか見る。",
    "綿菓子.js の buildStrands() で stray の割合（0.07）を探し、0 にすると輪郭がどうなるか試す。"
  ]
}

];
