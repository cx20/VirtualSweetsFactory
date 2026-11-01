/* =====================================================================
 *  おかしのつくりかた — 第II部（06〜09章）の本文
 *
 *  第II部「かたちをつくる」は、お菓子の作り方そのままの4つの形の作り方。
 *  回す（ろくろ・型抜き）、曲げる（掃引）、押されて潰れる、溶かし合わせる。
 *
 *  形式は pages-1.js と同じ。
 * ===================================================================== */

module.exports = [

/* ==================================================================
   06 かたち
   ================================================================== */
{
  file: "ch06.html", no: "06", tag: "Shape", nav: "06 かたち", color: "sakura",
  title: "回す、型で抜く",
  sub: "profile / outline × section — 断面と外形",
  crumb: "第06章",
  recap: [
    "団子もプリンもドーナツも、<b>横顔の折れ線を1本</b>描いて、軸のまわりに回すだけで作れます。ろくろと同じです。",
    "回すのではなく<b>外形（抜き型）と縦断面を掛け合わせる</b>やり方もあります。チョコレートとクッキーがそれです。",
    "どちらも、形を作る関数は1つ。お菓子の種類の違いは<b>数値の表</b>に入っています。"
  ],
  html: `
    <p>
      団子を作りたいとします。3Dの球を置いて潰す、ではありません。
      まず紙に<b>縦に切った断面の右半分</b>を描きます。下から上へ、
      中心からの距離（半径）が場所ごとにいくつになるかを並べた表です。
      これを軸のまわりに1周ぶん回せば、立体ができます。これを<b>回転体</b>といいます。
    </p>
    <p>
      型から抜いたプリンも同じです。プリン.js の母線（回す前の横顔）は、
      骨格がたった<b>4つの点</b>でできています。上面の中心、上の縁、下の縁、底の中心。
      つまり台形です。そこに角の丸めと、3つの小さな変形を足します。
    </p>
    <figure>
<pre><span class="c">// 4. Profile : プリンの母線（プリン.js を短くしたもの）。単位は cm
//    点は [中心からの距離 r, 高さ y]。上面 → 側面 → 底面の順</span>
<span class="k">const</span> ctrl = [[<span class="n">0</span>, H], [rTop, H], [rBot, <span class="n">0</span>], [<span class="n">0</span>, <span class="n">0</span>]];   <span class="c">// rTop 2.30 / rBot 3.30 / H 4.30</span>
<span class="k">const</span> rad  = [<span class="n">0</span>, filletTop, filletBot, <span class="n">0</span>];            <span class="c">// 角の丸め 0.44 / 0.30</span>
<span class="k">let</span> poly = roundPolyline(ctrl, rad, <span class="n">26</span>);
<span class="k">for</span> (<span class="k">const</span> p <span class="k">of</span> poly) {
    p[<span class="n">1</span>] -= dish * (<span class="n">1</span> - rIn * rIn) * kTop;          <span class="c">// 上面のへこみ（型の底の形。カラメルがたまる） 0.060</span>
    p[<span class="n">0</span>] += barrel * Math.sin(Math.PI * y / H);     <span class="c">// 自重で樽型に膨らむぶん 0.048</span>
    p[<span class="n">0</span>] += bottomSpread * Math.exp(-(y / <span class="n">0.55</span>) ** <span class="n">2</span>); <span class="c">// 座ったところが少し広がる 0.055</span>
}</pre>
      <figcaption>変形の3つは、どれも 1mm に満たない。それでも「型の内側の形」と「型から出して置いたプリン」はここで分かれる</figcaption>
    </figure>
    <p>
      点と点のあいだは直線でつなぐと角ばるので、なめらかな曲線で補います。
      下の実験では <b>Catmull-Rom スプライン</b>を使っています。
      「4つの点を見て、真ん中の2点のあいだをなめらかに通る」曲線です。
      これで、10個前後の数字から曲面ができます。
    </p>

    <div class="lab" id="lab04">
      <p class="lab-title">実験 — 断面を引っぱると、立体が変わる</p>
      <div class="lab-cols two">
        <div>
          <canvas id="profCanvas" width="330" height="330" aria-label="断面の制御点をドラッグして形を変える"></canvas>
          <p class="hint">白い点を左右にドラッグ。これが半径の表です。</p>
        </div>
        <div>
          <canvas id="revCanvas" width="330" height="330" aria-label="断面を回転させた立体のプレビュー"></canvas>
          <p class="hint">その断面を1周ぶん回した結果。ドラッグで回せます。</p>
        </div>
      </div>
      <div class="chips" id="profPreset" style="margin-top:14px">
        <button class="chip" type="button" data-v="dango" aria-pressed="true">団子</button>
        <button class="chip" type="button" data-v="purin">プリン</button>
        <button class="chip" type="button" data-v="cookie">クッキー</button>
        <button class="chip" type="button" data-v="kuri">栗饅頭</button>
      </div>
      <div class="ctrl" style="margin-top:12px;max-width:320px">
        <label for="profBump">手のあとの凹凸<span class="v" id="profBumpV">0.10</span></label>
        <input type="range" id="profBump" min="0" max="0.4" step="0.01" value="0.1">
      </div>
      <p class="hint">
        凹凸を 0 にすると工業製品、上げすぎると手びねりの粘土になります。
        お菓子を切り替えると、そのお菓子の初期値に戻ります。手で丸める団子は 0.10、型から抜くプリンは 0.01。
        プリンを 0.10 にすると、型抜きではなく積み重ねた輪に見えてきます。
        栗饅頭は、本物は上から見ると楕円です。回転体を作ってから横に伸ばしています（→ <a href="ch04.html">04章</a>）。
      </p>
    </div>

    <h3>断面は、円とは限らない — ドーナツ</h3>
    <p>
      回すのは、半径の表でなくてもかまいません。<b>閉じた輪郭</b>を回すと、穴のあいた輪になります。
      ドーナツです。ただし、その輪郭を円にすると失敗します。ドーナツ.js のコメント：
    </p>
    <div class="note">
      <b>「断面を単なる円（＝トーラス）にすると、それはドーナツではなく浮き輪になる。」</b>
      焼きドーナツの断面には、型の縁を越えて溢れた跡（外側面の水平な筋）、
      膨れた面の外土手・谷・内土手、型の底に沿った平たい底、の3つが必ず出る。
      ここを省くと上下をひっくり返しても同じに見え、焼き物に見えなくなる。
    </div>
    <p>
      ドーナツ.js の断面は20個の点でできていて、1点ごとに「横・高さ」に加えて
      <b>その点が型に接していたかどうか</b>（0 = 型の面、1 = 膨れた面）を持っています。
      この3つ目の数字が、そのまま焼き色と粗さの塗り分けに使われます（→ <a href="ch10.html">10章</a>）。
      トップページで組み上がっていくドーナツが、この断面です。
    </p>

    <h3>型で抜く — 外形 × 縦断面</h3>
    <p>
      チョコレートのボンボンは、上から見ると丸や四角やハート、横から見るとドームです。
      これは回転体ではありません。チョコレート.js は
      <b>外形（上から見た輪郭）</b>と<b>縦断面（横から見た形）</b>を別々に定義して、掛け合わせています。
      外形が抜き型、縦断面が生地の膨らみ方、と考えると分かりやすい。
    </p>
    <figure>
<pre><span class="c">// 4. Shape : 外形（スーパー楕円）× 縦断面（赤道式）</span>
<span class="c">// 上から見た輪郭。n を上げると四角に、下げると星形に近づく</span>
<span class="k">const</span> outline = (a) =&gt; <span class="n">1</span> / Math.pow(
    Math.pow(Math.abs(Math.cos(a)), n) + Math.pow(Math.abs(Math.sin(a)), n),
    <span class="n">1</span> / n);
<span class="c">// 高さ v での「赤道からの縮み」。1 なら外形そのまま</span>
<span class="k">const</span> shrink = (v) =&gt; Math.sqrt(Math.max(<span class="n">0</span>, <span class="n">1</span> - v * v));
<span class="k">const</span> radius = (a, v) =&gt; outline(a) * shrink(v);</pre>
      <figcaption>チョコレート.js のやり方。輪郭と断面を掛けるだけで、丸も角丸四角もハートも作れる</figcaption>
    </figure>

    <h3>7種類のクッキーは、1本の式と7行の数値</h3>
    <p>
      クッキー.js は同じ考え方をもう一歩進めて、<b>丸・角丸四角・長方形・菊型を1本の式</b>で扱います。
      スーパー楕円に縦横比 <code>aspect</code> を掛け、菊型のときだけ周方向に波 <code>cos(K·φ)</code> を乗せる。
      縦断面のほうは、上面のドーム <code>dome</code> と縁のふくらみ <code>rimBulge</code> の2つで決まります。
    </p>
    <table>
      <tr><th>種類</th><th>外形</th><th>縦断面</th></tr>
      <tr><td>サブレ</td><td>半径 2.55、<code>nExp</code> 2（丸）</td><td>厚み 0.98、<code>dome</code> 0.20</td></tr>
      <tr><td>型押し</td><td>半径 2.80、丸に 22 の波（<code>scallopAmp</code> 0.020）＝菊型</td><td>厚み 0.70、<code>dome</code> 0.06（ほぼ平ら）</td></tr>
      <tr><td>クラッカー</td><td>半径 2.05、<code>aspect</code> 1.60、<code>nExp</code> 7（長方形）</td><td>厚み 0.52、<code>dome</code> 0.02</td></tr>
    </table>
    <p>
      形を作るコードは7種類で1つしかありません。違いは <code>TYPES</code> という表の数値だけです。
      01章で「途中の1層だけ差し替えれば別のお菓子になる」と書いたのは、こういうことです。
      新しいクッキーを足したいときは、関数を書かずに<b>表に1行</b>足します。
    </p>
    <p>
      たい焼きも型で抜くお菓子ですが、外形は魚なのでスーパー楕円では書けません。
      たい焼き.js は魚の輪郭を <b>2. Outline</b> で引き、そこから<b>輪郭までの距離</b>を格子に焼いておき、
      <b>3. Relief</b> で型の浮き彫り（鱗やヒレの筋）の高さを足しています。
      外形が関数で書けないときは、「輪郭からどれだけ内側か」を表にしてしまえばよい。
      この「距離」の考え方は、<a href="ch09.html">09章</a>でもう一度出てきます。
    </p>
    <div class="trap">
      <span class="label">つまずきポイント</span>
      <p><b>断面の両端は、きちんと 0 まで絞ってください。</b>
      団子の上下を半径 0.2 で止めると、そこが穴になって中が見えます。
      回転体には自動でフタが付かないからです。</p>
      <p><b>同じ高さに半径を2つ置けません。</b>
      「t → r」の表は、ひとつの高さにひとつの半径しか持てません。
      ドーナツの断面のように<b>ぐるっと閉じた輪郭</b>や、クッキーの縁のように<b>外へ膨らんでから戻る</b>形は、
      (t, r) の2列ではなく (r, y) の2列で持つ必要があります。
      プリン.js の <code>ctrl</code> も、ドーナツ.js の <code>PROFILE_PTS</code> も、この形です。</p>
      <p><b>縁を直角にしないでください。</b>
      クッキー.js のコメント：「上面をそのまま垂直に落として底へつなぐと、縁が直角の
      『削り出したプラスチック板』になる。実物の生地は焼成中に広がって縁が膨らむので、
      最大径は側面の中ほどに来る」。</p>
      <p><b>点の番号で刻まず、長さで刻んでください。</b>
      制御点の添字で v を割り振ると、丸めた縁のように点が密な所だけテクスチャが詰まって縞に見えます。
      プリン.js とドーナツ.js は、輪郭を<b>弧長</b>（輪郭に沿った長さ）で等分し直しています。</p>
    </div>`,
  tryIt: [
    "「団子」の真ん中の点を外へ引っぱって、月見団子のように横に広い形にしてみる。",
    "「プリン」のいちばん上の点を外へ出して、型から抜く前（上が広い）の形にしてみる。",
    "凹凸を 0.4 にしたとき、どのお菓子なら許せてどれが嘘に見えるか決める。",
    "クッキー.js の TYPES から型押しとクラッカーの数値を探し、外形がどう違うか上の表と照らし合わせる。"
  ]
},

/* ==================================================================
   07 曲がり
   ================================================================== */
{
  file: "ch07.html", no: "07", tag: "Sweep", nav: "07 曲がり", color: "banana",
  title: "曲げる、巻く、絞る",
  sub: "sweep along a spine — 軸に沿った掃引",
  crumb: "第07章",
  recap: [
    "バナナはまっすぐではありません。中ほどがいちばん強く<b>弓なり</b>に曲がっています。",
    "回転体では作れないので、先に<b>軸（背骨）</b>を決め、断面を軸に垂直に置いていきます。これを<b>掃引</b>といいます。",
    "軸を円にすればロールケーキの側面、螺旋にすれば絞り出しクッキー。<b>軸と断面の組み合わせ</b>で、曲げる・巻く・絞るが全部書けます。"
  ],
  html: `
    <p>
      チョコバナナを作ります。バナナを回転体で作ると、まっすぐな棒になります。
      実物はまっすぐではありません。しかも、むいた実の断面は丸ではなく、
      <b>4〜5本のゆるい稜</b>が残っています。チョコバナナ.js の冒頭のコメントにこうあります。
    </p>
    <div class="note">
      <b>「バナナは真っ直ぐではなく弧。しかも断面は丸ではなく、むいた実でも 4〜5 本のゆるい稜が残る。
      コーティングで稜は鈍るが消えはしない。チョコは『先端を下にして』引き上げて垂らすので、
      先端側ほど厚く、先端に滴が溜まり、先端へ向かって縦の垂れ筋が残る」</b>
    </div>
    <p>
      そこで作り方を変えます。まず<b>軸（スパイン、中心線）</b>を1本決めます。
      次に、軸上の各点で「そこでの断面」を作り、<b>軸に垂直な平面の上に</b>置きます。
      これを軸に沿って何十枚も並べ、隣どうしをつなげば立体になります。これを<b>掃引</b>といいます。
    </p>
    <figure>
<pre><span class="c">// 4. Banana : 中心線（弧）× 断面（五角気味）× コーティングの厚み（チョコバナナ.js を短くしたもの）</span>
<span class="k">for</span> (<span class="k">let</span> i = <span class="n">0</span>; i &lt; N; i++) {
    <span class="k">const</span> s = i / (N - <span class="n">1</span>);
    <span class="k">const</span> F = frame(s);                <span class="c">// 軸の上の点と、そこでの断面の平面（N と B）</span>
    <span class="k">for</span> (<span class="k">let</span> j = <span class="n">0</span>; j &lt;= M; j++) {
        <span class="k">const</span> th = j / M * TAU;
        <span class="c">// 太さの形 × むいた実の稜（5本）</span>
        <span class="k">let</span> r = R * profile(s) * (<span class="n">1</span> + ridgeAmp * Math.cos(<span class="n">5</span> * th + ridgePh));
        <span class="c">// チョコの塗り厚。先端へ向かうほど垂れ筋のぶん厚くなる</span>
        r += coat(s, th);
        push(F.p + (F.b * Math.cos(th) + F.n * Math.sin(th)) * r);
    }
}</pre>
      <figcaption>断面は円とは限らない。バナナは「5本の稜がある円」に、場所ごとのチョコの厚みを足したもの</figcaption>
    </figure>

    <div class="lab" id="lab10">
      <p class="lab-title">実験 — 軸を曲げて、断面を並べる</p>
      <div class="lab-cols side">
        <div class="controls">
          <div class="chips" id="sweepShape">
            <button class="chip" type="button" data-v="peeled" aria-pressed="true">むいた実</button>
            <button class="chip" type="button" data-v="coated">チョコを掛けた</button>
          </div>
          <div class="ctrl">
            <label for="sweepBend">曲がり bend（rad）<span class="v" id="sweepBendV">1.85</span></label>
            <input type="range" id="sweepBend" min="0" max="2.6" step="0.05" value="1.85">
          </div>
          <div class="ctrl">
            <label for="sweepRidge">稜（5本）の強さ<span class="v" id="sweepRidgeV">0.030</span></label>
            <input type="range" id="sweepRidge" min="0" max="0.12" step="0.002" value="0.03">
          </div>
          <div class="ctrl">
            <label for="sweepCoat">先端の垂れ<span class="v" id="sweepCoatV">0.50</span></label>
            <input type="range" id="sweepCoat" min="0" max="1" step="0.01" value="0.5">
          </div>
          <label class="switch"><input type="checkbox" id="sweepRing">断面の輪を描く</label>
        </div>
        <canvas id="sweepCanvas" width="640" height="360" aria-label="軸を曲げて断面を掃引する実験（チョコバナナ）"></canvas>
      </div>
      <p class="hint">
        「断面の輪を描く」を押すと、軸に垂直な平面が何枚も並んでいるのが見えます。
        曲がりの初期値 1.85 はチョコバナナ.js の値です。0.95 まで下げると「太いきゅうり」に戻ります。
        「先端の垂れ」は「チョコを掛けた」のときだけ効きます。右（先端）ほどチョコが厚くなります。<br><b>立体はドラッグで回せます</b>（触ると自動回転は止まります。ダブルクリックで戻ります）。
        真上から見ると、軸の曲がりがそのまま輪郭に出ているのが分かります。
      </p>
    </div>

    <h3>曲がりは、一定ではない</h3>
    <p>
      最初に思いつくのは、円の一部（一定の曲がりの弧）を軸にすることです。チョコバナナ.js の記録：
      <b>「一定曲率の弧だと定規で曲げたパイプに見える。実物は中ほどが最も曲がり、両端は比較的まっすぐ」</b>。
      そこで、軸の向きの角度を位置 s の関数にして、真ん中で変化が速くなるようにしています。
      曲がりの量そのものにも記録があり、<b>「0.95 では全体で 40° しか曲がらず、太いきゅうりに見えた」</b>ので、
      いまは 1.85 です。掃引で作る形は、<b>軸のどこがどれだけ曲がっているか</b>がほとんどすべてです。
    </p>

    <h3>両端と、塗り厚の閉じ方</h3>
    <p>
      掃引で作った筒は、両端が開いています。バナナは端で半径を 0 まで絞って閉じますが、
      そこにチョコの厚みを「一定のまま」足すと、<b>半径 0 のはずの端に厚みだけが残って穴があきます</b>。
      チョコバナナ.js は塗り厚に、太さの形の平方根 <code>√env</code> を掛けて、端では必ず 0 に落としています。
      さらに、端は曲がりが急なので、断面の輪を等間隔に並べると先端が角ばる。
      そこだけ<b>輪の間隔を詰めて</b>います。
    </p>

    <h3>軸を閉じると「巻く」、螺旋にすると「絞る」</h3>
    <p>
      軸は開いた弧である必要はありません。
    </p>
    <ul>
      <li><b>ロールケーキ</b> — 切り分けた1切れを、「断面 → 面取り → 側面 → 面取り → 断面」と<b>1枚の格子で</b>掃引しています。
      ロールケーキ.js の記録：「断面と側面を別メッシュにすると、隙間・蓋の欠け・片側だけの裏返りが同時に起きる」。
      断面の渦巻きは、線ではなく<b>巻いたシート</b>として断面関数に書いてあり、形とテクスチャが同じ関数を引きます。</li>
      <li><b>絞り出しクッキー</b> — 星口金から出た生地は、<b>星形の断面</b>（山が8つ）を<b>螺旋の軸</b>に沿って掃引したものです。
      クッキー.js には、巻きどうしが必ずくっつく条件が書いてあります。「半径方向のピッチ &lt; 縄の太さ」。
      ピッチ 0.70cm に対して太さ 1.20cm で、重なったところが深さ約1mmの螺旋の溝として残ります。</li>
    </ul>
    <p>
      曲げる・巻く・絞るは、お菓子作りでは別の作業ですが、コードでは同じ掃引です。
      違うのは<b>軸の形と断面の形</b>だけです。
    </p>
    <div class="trap">
      <span class="label">つまずきポイント</span>
      <p><b>断面の向きは、勝手に決まってくれません。</b>
      軸に垂直な平面は、軸のまわりに無数の回り方ができます。
      よくある「毎回、真上（UP）との外積で決める」やり方は簡単ですが、
      軸が真上を向いた瞬間に外積が 0 になって破綻し、断面がねじれます。</p>
      <p>チョコバナナ.js は、この問題を<b>形の側で避けて</b>います。中心線はいつも YZ 平面の中にあるので、
      X 軸は必ず軸に垂直です。そこで断面の向きを <code>N = X × T</code>（T は軸の向き）で決めれば、
      どれだけ曲げても破綻しません。螺旋のように平面に収まらない軸では、
      前の断面の向きを少しずつ引き継ぐ方法（平行移動枠）を使います。</p>
    </div>`,
  tryIt: [
    "曲がりを 0 にして、チョコバナナが何に見えるか判定する。",
    "稜の強さを 0 と 0.12 にして、むいた実に見える範囲を探す。",
    "「チョコを掛けた」で先端の垂れを 1 にし、輪を描いて、先端側の断面が太っていることを確かめる。",
    "チョコバナナ.js で「√env」の近くを読み、塗り厚が端でどう 0 に落ちているか確かめる。"
  ]
},

/* ==================================================================
   08 接触変形
   ================================================================== */
{
  file: "ch08.html", no: "08", tag: "Contact", nav: "08 潰れ", color: "yomogi",
  title: "触れ合うと、潰れる",
  sub: "contact deformation — やわらかい物の積み方",
  crumb: "第08章",
  recap: [
    "団子を真球のまま積むと、<b>発泡スチロールの球</b>に見えます。",
    "自重と押し合いで、接するところが平らになる。下の段ほど潰れます。",
    "潰した<b>体積の行き先</b>と、接触の縁にできる<b>丸い土手</b>が、やわらかさの正体です。"
  ],
  html: `
    <p>
      月見団子は15個を三方に積みます（9 + 4 + 2）。
      球を15個並べて終わり、にはなりません。月見団子.js の冒頭にこうあります。
    </p>
    <div class="note">
      <b>「月見団子は球ではない。自重と隣どうしの押し合いで、接する所が平らになる。
      下の段ほど潰れ、上へ行くほど丸い。真球のまま積むと発泡スチロールに見える」</b>
    </div>
    <p>
      平らにするだけなら簡単です。接触面の側を切り落とせばよい。
      ところが、それだけでは<b>やせた球</b>になります。餅は非圧縮なので、
      押されて減った体積はどこかへ行かなければいけません。
      行き先は、押されていない自由な面です。つまり<b>他の方向がその分ふくらむ</b>。
    </p>
    <figure>
<pre><span class="c">// 方向ごとの半径を smin で丸める（＝縁に土手のある柔らかい接触）</span>
<span class="k">let</span> r = R;
<span class="k">for</span> (<span class="k">const</span> c of contacts) {
    <span class="k">const</span> d = dot(dir, c.n);
    <span class="k">if</span> (d &gt; <span class="n">0</span>) r = smin(r, c.dist / d, R * <span class="n">0.090</span>);  <span class="c">// なめらかな最小値</span>
}
<span class="c">// 切り取った球冠の体積ぶんだけ全体を膨らませる（餅は非圧縮）</span>
r *= Math.cbrt(<span class="n">1</span> + volumeLoss / sphereVolume);</pre>
      <figcaption>月見団子.js。smin（多項式スムーズ最小値）が「丸い土手」を作る</figcaption>
    </figure>

    <div class="lab" id="lab13">
      <p class="lab-title">実験 — 潰す / 体積を戻す / 土手をつける</p>
      <div class="lab-cols side">
        <div class="controls">
          <div class="ctrl">
            <label for="squashAmt">潰し量<span class="v" id="squashAmtV">0.30</span></label>
            <input type="range" id="squashAmt" min="0" max="0.6" step="0.01" value="0.3">
          </div>
          <label class="switch"><input type="checkbox" id="squashVol" checked>減った体積を戻す</label>
          <label class="switch"><input type="checkbox" id="squashRim" checked>接触の縁を丸める（土手）</label>
          <label class="switch"><input type="checkbox" id="squashStack" checked>下の段ほど強く潰す</label>
          <div class="readout" id="squashOut">—</div>
        </div>
        <canvas id="squashCanvas" width="640" height="360" aria-label="団子を積んで接触面で潰す実験"></canvas>
      </div>
      <p class="hint">
        3つのスイッチを全部切ると、ただの球の山になります。
        1つずつ入れていくと、どれがどれだけ効いているかが分かります。
      </p>
    </div>

    <h3>なめらかな最小値（smin）</h3>
    <p>
      接触面を作るには「球の半径」と「接触面までの距離」の小さいほうを取ればよい。
      ただし <code>Math.min</code> をそのまま使うと、境目に<b>鋭い角</b>ができます。
      実物の団子には角がありません。わずかに丸い土手ができて、そこに細い影の線が入ります。
    </p>
    <figure>
<pre><span class="c">// 多項式スムーズ最小値。k のぶんだけ、境目が丸くつながる</span>
<span class="k">const</span> smin = (a, b, k) =&gt; {
    <span class="k">const</span> h = Math.max(<span class="n">0</span>, k - Math.abs(a - b)) / k;
    <span class="k">return</span> Math.min(a, b) - h * h * k * <span class="n">0.25</span>;
};</pre>
      <figcaption>この1行が、硬い球とやわらかい餅を分ける</figcaption>
    </figure>

    <h3>串は、団子の中心を通っていない</h3>
    <p>
      花見団子は同じ問題を、別の向きで扱っています。
      串の方向に押しつぶされ、隣と接する両端が平らになる。
      直径 3.0cm に対して串方向は約 2.4cm、接触面の直径は約 1.2cm。
      さらに、
    </p>
    <ul>
      <li>串の入口は生地が引き込まれて<b>すり鉢状にへこむ</b>（平らだと刺さって見えない）</li>
      <li>団子は串の<b>中心に乗っていない</b>。わずかに偏心している</li>
      <li>隣どうしは「めり込む」のではなく、<b>平らな面が触れて細い影の線</b>ができる</li>
    </ul>
    <p>
      どれも数ミリの話です。ところが、この数ミリを入れるかどうかで、
      「色つきの球に棒」か「団子」かが決まります。
    </p>
    <div class="trap">
      <span class="label">つまずきポイント</span>
      <p><b>潰す方向を1つに決めないでください。</b>
      下の段の団子は、下から（台）・横から（隣）・上から（上の段）の3方向に押されています。
      「上下だけ潰す」と、上から見たときに真円のままなので嘘が見えます。
      月見団子.js は接触を全部集めてから、方向ごとに半径を決めています。</p>
      <p><b>体積を戻しすぎると、風船になります。</b>
      係数 0.33 は「戻しすぎない」ための値です。実際の餅は多少水分が逃げるので、
      きっちり保存するより少なめのほうが自然に見えます。</p>
    </div>`,
  tryIt: [
    "3つのスイッチを全部切って、球の山に戻してみる。",
    "「減った体積を戻す」だけを入れて、シルエットがどう変わるか見る。",
    "潰し量を 0.6 にすると、どこから餅でなくなるか探す。",
    "月見団子.js で smin を検索し、k の値がいくつになっているか調べる。"
  ]
},

/* ==================================================================
   09 距離場とサーフェスネット
   ================================================================== */
{
  file: "ch09.html", no: "09", tag: "SDF", nav: "09 塊", color: "ame",
  title: "ひとつの塊は、距離の場から削り出す",
  sub: "signed distance field + surface nets — 継ぎ目の無い形",
  crumb: "第09章",
  recap: [
    "飴細工のウサギは、回しても掃引しても作れません。<b>胴・頭・耳・脚が一つの塊</b>だからです。",
    "部品を<b>距離関数</b>で書き、なめらかな最小値（smin）で溶かし合わせると、継ぎ目が消えます。",
    "格子で距離を測り、<b>サーフェスネット</b>で面を張る。格子の段は、ぼかすか面へ射影して消します。"
  ],
  html: `
    <p>
      06章では、断面を回して団子を作り、外形×縦断面でチョコを作りました。07章では軸に沿って断面を並べました。
      ところが飴細工のウサギは、どちらでも作れません。飴細工.js の冒頭です。
    </p>
    <div class="note">
      <b>「ウサギは距離関数（SDF）。胴・頭・耳・脚・尾・棒の付け根を楕円体と先細りカプセルで置き、
      smooth min で一つの塊に溶かす（飴は一つの塊を引いて切って作るので、継ぎ目が無いのが本物らしい）」</b>
    </div>
    <p>
      距離関数（SDF）は、空間の点を渡すと「形の表面までどれだけ離れているか」を返す関数です。
      外なら正、中なら負、ちょうど表面で 0。
      球なら <code>|p − 中心| − 半径</code> の1行です。
      この形の良いところは、<b>2つの形を足すのが「小さいほうを取る」だけ</b>で済むことです。
      そして08章の団子で使った smin（なめらかな最小値）を使えば、つなぎ目が丸く溶けます。
    </p>
    <figure>
<pre><span class="k">function</span> sdf(x, y, z) {
    <span class="k">var</span> d = sdEll(x, y, z, body[<span class="n">0</span>]);
    d = smin(d, sdEll(x, y, z, body[<span class="n">1</span>]), <span class="n">0.9</span>);   <span class="c">// 胴は大きく溶かす</span>
    d = smin(d, sdRC(x, y, z, stem), <span class="n">0.6</span>);       <span class="c">// 棒を包む飴</span>
    ...
    d = smin(d, hd, <span class="n">0.7</span>);                        <span class="c">// 頭</span>
    g = smin(g, sdRC(x, y, z, hinds[h].foot), <span class="n">0.12</span>); <span class="c">// 足先は小さく＝鋏の段が残る</span>
    <span class="k">return</span> d;
}</pre>
      <figcaption>飴細工.js の makeRabbit()。smin の3つ目の数 k が「どれだけ溶かすか」</figcaption>
    </figure>
    <p>
      k の値がそのまま作り方の記録になっています。胴どうしは 0.9 で大きく溶かし、
      脚の付け根や足先は 0.12〜0.35 と小さくして、<b>鋏で切り分けた段</b>を残す。
      耳の内側のくぼみは、楕円体を<b>引き算</b>（<code>smax(外, −内)</code>）して彫っています。
    </p>

    <div class="lab" id="lab16">
      <p class="lab-title">実験 — 距離の場から輪郭を拾う（2次元のサーフェスネット）</p>
      <div class="lab-cols side">
        <div class="controls">
          <div class="ctrl">
            <label for="sdfK">溶かす量 k<span class="v" id="sdfKV">0.60</span></label>
            <input type="range" id="sdfK" min="0" max="1.4" step="0.01" value="0.6">
          </div>
          <div class="ctrl">
            <label for="sdfGrid">格子の間隔<span class="v" id="sdfGridV">0.36</span></label>
            <input type="range" id="sdfGrid" min="0.12" max="0.8" step="0.01" value="0.36">
          </div>
          <div class="chips" id="sdfMode">
            <button class="chip" type="button" data-v="raw">格子のまま</button>
            <button class="chip" type="button" data-v="blur">場を1回ぼかす</button>
            <button class="chip" type="button" data-v="proj" aria-pressed="true">面へ射影する</button>
          </div>
          <label class="switch"><input type="checkbox" id="sdfField" checked>距離の等高線を見せる</label>
          <div class="readout" id="sdfOut">—</div>
        </div>
        <canvas id="sdfCanvas" width="640" height="360" aria-label="ウサギの横顔を距離関数で書き、格子から輪郭を拾う実験"></canvas>
      </div>
      <p class="hint">
        k を 0 にすると、耳・頭・胴のつなぎ目に角が出ます。
        格子を粗くして「格子のまま」にすると輪郭がガタつき、
        「場を1回ぼかす」（アイス.js）や「面へ射影する」（飴細工.js）で、それがどう消えるかが分かります。
      </p>
    </div>

    <h3>格子で測って、面を張る</h3>
    <p>
      距離関数は「どの点でも測れる」だけで、三角形は持っていません。
      そこで空間を格子に区切り、全部の格子点で距離を測ります。
      隣り合う格子点で符号が変わる（外と中にまたがる）ところに、表面が通っている。
    </p>
    <ol>
      <li>8つの角の符号が揃っていない<b>セルにだけ</b>、頂点を1つ置く。
      位置は、符号の変わる辺の上の交点（距離が 0 になる所を直線で補間）の<b>平均</b></li>
      <li>符号が変わる辺1本ごとに、その辺を囲む4つのセルの頂点を<b>四角形でつなぐ</b></li>
    </ol>
    <p>
      これがサーフェスネット（Surface Nets）です。マーチングキューブより手順が短く、
      セル1つに頂点1つなので、三角形がつぶれにくい。アイス.js も飴細工.js も、これを自前で書いています。
    </p>

    <h3>格子の段を消す、2つのやり方</h3>
    <p>
      セルの中の平均を取るだけだと、格子の向きにそった細かい段が出ます。
      2本のサンプルは、これを別々のやり方で消しています。
    </p>
    <ul>
      <li><b>アイス.js</b> — 格子の距離の値を、軸ごとに 1:2:1 で<b>1回ぼかして</b>から面を張る。
      細部も少し丸まりますが、アイスはどうせあとで<b>ディッシャーの筋・めくれ・気泡</b>を頂点に焼き込むので、
      下地はなめらかなほうが都合がいい</li>
      <li><b>飴細工.js</b> — 面を張ったあと、各頂点を<b>距離の勾配に沿って表面へ押し戻す</b>（2回）。
      法線も勾配から取る。飴は手で引いたつるつるの面なので、元の距離関数の形をそのまま出したい</li>
    </ul>
    <figure>
<pre><span class="c">// 頂点 p を、距離 d と勾配 g から表面（d = 0）へ寄せる</span>
<span class="k">var</span> d = sdf(x, y, z);
<span class="k">var</span> g = gradAt(sdf, x, y, z, <span class="n">0.005</span>);   <span class="c">// 中心差分</span>
x -= g.x * d / |g|²;  ...              <span class="c">// 1歩で表面までの距離ぶん戻る</span></pre>
      <figcaption>飴細工.js の projectToSurface() を短くしたもの。1歩の長さは格子の 0.6 倍で頭打ちにする</figcaption>
    </figure>

    <h3>距離の場は、細部を焼く座標にもなる</h3>
    <p>
      アイス.js は、玉（少しつぶした球）と裾（外へ行くほど持ち上がる円盤）を smin でつないだ距離関数から始めます。
      そのうえで、ディッシャーを<b>引いた向き D・横 S・上 U</b> の座標系を作り、
      頂点ごとに「引いた筋」「削ぎ終わりのめくれ」「千切れた肌」「気泡の穴」を法線方向の変位として焼き込みます。
      溶けは「下ほど細部が消えて沈み、裾が広がる」として、同じ頂点を書き直すだけです。
    </p>
    <div class="trap">
      <span class="label">つまずきポイント</span>
      <p><b>格子の全部の点を測ると遅い。</b>
      格子の間隔 0.065cm でウサギを包むと、測る点は150万を超えます。
      飴細工.js は 4×4×4 のブロックの中心で1回だけ測り、表面から十分遠いブロックはその値で埋めます。
      表面の近くだけ全部の点を測るので、手間はおよそ 1/10 です。</p>
      <p><b>四角形の向きを決め打ちしない。</b>
      サーフェスネットの四角形は、外と中のどちら側から見ても作れてしまいます。
      04章の「裏返ると消える」がそのまま起きるので、飴細工.js は辺の符号から外向きを決めて、
      三角形ごとに外積で向きを確かめています。</p>
      <p><b>距離関数は、smin を重ねると正しい距離ではなくなる。</b>
      符号（中か外か）は正しいままですが、値は「だいたいの距離」になります。
      だから飴細工.js の射影は、1回で表面に届くとは考えず、2回繰り返して1歩の長さも制限しています。</p>
    </div>`,
  tryIt: [
    "k を 0 → 0.3 → 1.4 と動かし、耳の付け根がどこから溶けすぎに見えるか探す。",
    "格子の間隔を 0.8 にして、3つのモードの輪郭を見比べる。",
    "飴細工.js で GRID を 0.065 から 0.15 にして Run し、組み立ての時間と見た目を比べる。",
    "アイス.js の makeScoopSDF() を読み、玉と裾をつなぐ smin の k（SCOOP.blend）を探す。"
  ]
}

];
