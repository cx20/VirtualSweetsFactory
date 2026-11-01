/* =====================================================================
 *  おかしのつくりかた — 第III部（14〜17章）の本文
 *
 *  あとから加わった5本（プリン・ゼリー・アイス・飴細工・綿菓子）で初めて出てくる技術。
 *  こちらはたべもの編には無い、このサイトだけの章。
 *  形式は pages-1.js と同じ。
 * ===================================================================== */

module.exports = [

/* ==================================================================
   14 揺れ（モーダル変形）
   ================================================================== */
{
  file: "ch14.html", no: "14", tag: "Jiggle", nav: "14 揺れ", color: "purin",
  title: "プルプルは、6本のばねの重ね合わせ",
  sub: "modal deformation — 物理エンジンに無い、やわらかさの作り方",
  crumb: "第14章",
  recap: [
    "Havok には<b>ソフトボディ（やわらかい物体）が無い</b>ので、落ちる・着地するは Havok に、揺れは自前の計算に分けます。",
    "揺れは<b>減衰するばね（振動子）</b>を数本だけ回し、決まった形の変形を足し合わせて作ります。",
    "目に付くのは形の変化より<b>ハイライトが走ること</b>。だから法線も一緒に動かします。"
  ],
  html: `
    <p>
      皿の上に落としたプリンは、ぷるんと2〜3回揺れて止まります。
      08章では盛り付けを物理エンジン（Havok）に任せましたが、Havok が扱えるのは<b>硬い物体</b>だけです。
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
      <b>「ハイライトが表面を走ること」</b>です。05章で見たとおり、明るさを決めるのは法線です。
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
   15 光路長（透けるものの色）
   ================================================================== */
{
  file: "ch15.html", no: "15", tag: "Path", nav: "15 透け", color: "melon",
  title: "ゼリーの色は、中を通った距離で決まる",
  sub: "path length — 塗れない色の作り方",
  crumb: "第15章",
  recap: [
    "プリンの色は<b>表面の色</b>（アルベド）で決まります。ゼリーの色は違います。",
    "ゼリーは中身の詰まった色ガラスで、見える色は<b>光が中を何 cm 通ったか</b>だけで決まります。",
    "だから厚みを<b>測って</b>シェーダに渡す。溝の底は薄いので明るく、山は厚いので濃い。"
  ],
  html: `
    <p>
      12章で、みたらしのたれを「色」ではなく「透明な層」として扱いました。
      厚いところほど濃くなる、<code>exp(−吸収係数 × 厚み)</code> の話です。
      ゼリーはその層が<b>まるごと全部</b>になったものです。ゼリー.js の冒頭にこうあります。
    </p>
    <div class="note">
      <b>「プリンの色は『表面のアルベド』で決まる。ゼリーの色は違う。
      ゼリーは中身の詰まった色ガラスで、見えている色は
      透過光 = 背景 × exp(−σ · d) の d、つまり『その画素で光が中を何 cm 通ったか』でしか決まらない。
      ここを『濃い緑のアルベド』で塗ると、必ず緑のプラスチックになる」</b>
    </div>
    <p>
      σ（シグマ）は 1cm あたりにどれだけ光が吸われるかで、赤・緑・青で別の値を持ちます。
      ゼリー.js では、味ごとの色を σ で直接書くのではなく、
      <b>「基準の光路 4.5cm を通ったあとに何割残るか」</b>（T0）で持たせています。写真から拾えるのはこの値だからです。
    </p>
    <figure>
<pre><span class="c">// 味は「色」ではなく「4.5cm 通ったあとの透過率」で持つ</span>
melon:      { T0: [<span class="n">0.300</span>, <span class="n">0.440</span>, <span class="n">0.050</span>] },  <span class="c">// 赤は少し、緑はよく通す。青はほぼ消える</span>
strawberry: { T0: [<span class="n">0.560</span>, <span class="n">0.030</span>, <span class="n">0.030</span>] },  <span class="c">// 赤だけ通す</span>

<span class="c">// σ = −ln(T0) / 4.5  → メロンなら [0.27, 0.18, 0.67]（1cm あたり）</span>
<span class="c">// 透過率 T(d) = exp(−σ·d) = T0 ^ (d / 4.5)</span></pre>
      <figcaption>ゼリー.js のプリセット。メロンといちごは、吸うスペクトルがまったく逆</figcaption>
    </figure>

    <div class="lab" id="lab15">
      <p class="lab-title">実験 — 塗る / 光路で解く</p>
      <div class="lab-cols side">
        <div class="controls">
          <div class="chips" id="jellyFlavor">
            <button class="chip" type="button" data-v="melon" aria-pressed="true">メロン</button>
            <button class="chip" type="button" data-v="strawberry">いちご</button>
            <button class="chip" type="button" data-v="grape">ぶどう</button>
            <button class="chip" type="button" data-v="orange">オレンジ</button>
          </div>
          <label class="switch"><input type="checkbox" id="jellyPaint">アルベドに色を塗る（プラスチック）</label>
          <div class="ctrl">
            <label for="jellySigma">色の濃さ（σ の倍率）<span class="v" id="jellySigmaV">1.00</span></label>
            <input type="range" id="jellySigma" min="0.2" max="2.5" step="0.01" value="1">
          </div>
          <label class="switch"><input type="checkbox" id="jellyThin" checked>溝のぶん光路を短くする</label>
          <div class="readout" id="jellyOut">—</div>
        </div>
        <canvas id="jellyCanvas" width="640" height="360" aria-label="菊型のゼリーを正面から見て、画素ごとの光路長から色を解く実験"></canvas>
      </div>
      <p class="hint">
        右の小さい図は、その画素で光が通った距離（白いほど長い）です。
        「塗る」に切り替えると、縁と溝がいちばん濃くなるか、全体が同じ色のままになります。
        どちらも、本物のゼリーでは起きません。
      </p>
    </div>

    <h3>Babylon に、吸収の式をそのまま渡す</h3>
    <p>
      Babylon の PBR マテリアルには、屈折した光を中で色づける機能があり、その計算は
      <code>透過率 = tintColor ^ (thickness / tintColorAtDistance)</code> です。
      これはランベルト・ベールの法則そのものなので、
    </p>
    <figure>
<pre>tintColorAtDistance = <span class="n">1</span>          <span class="c">// 1cm</span>
tintColor           = exp(−σ)    <span class="c">// 1cm 通ったときの透過率</span>
thicknessTexture    = 母線から実測した弦長（＋溝のぶんの目減り）</pre>
      <figcaption>ゼリー.js の方針。式を自分で書かず、エンジンの式に正しい値を入れる</figcaption>
    </figure>
    <p>
      と入れれば、吸収の式がそのままシェーダで解かれます。
      12章のたれは「エンジンの着色は厚み 0 で壊れるので CPU で焼く」でした。
      同じ吸収の式でも、たれは表面の薄い膜で、ゼリーは中身の詰まった塊です。
      ゼリーでは屈折（向こう側が歪んで見えること）も要るので、こちらはエンジンの機能を使っています。
    </p>

    <h3>厚みは、近似せずに測る</h3>
    <p>
      難しいのは thickness のほうです。「半径の2倍」や定数で済ませると、
      <b>シルエットのきわで厚みが最大</b>になり、いちばん薄いはずの縁がいちばん濃くなります。
      ゼリー.js は、断面の形（母線）の内側へ<b>11本の光線を扇形に飛ばし</b>（±75°）、
      壁に当たるまでの長さを、法線に近い向きほど重く平均しています。
      法線1本だけで測ると、肩の丸みのような「外から見れば薄いのに、法線の向きには胴を斜めに貫く」場所で
      値が跳ねるからです。
    </p>
    <p>
      測った値にも、もうひと手間あります。照明は上半球が明るいので、上を向いた面は
      <b>短い光路で光を集めます</b>。測った弦長をそのまま使うと、天面は全高 5.2cm ぶんが入って
      いちばん濃くなり、写真といちばん食い違う場所になりました。
      そこで上向きの面は <code>topThin: 0.42</code> だけ薄く扱います。
      この値は、写真の天面と胴の色の比から逆算したものです。
    </p>

    <h3>溝の底は、両側から削れている</h3>
    <p>
      菊型の溝は、単なる波ではありません。山は広く丸く、谷は細く深い。
      <code>cos</code> をそのまま使うと洗濯板になるので、<code>g<sup>0.6</sup></code> にして谷だけを尖らせます。
      さらに、彫った深さ d のぶん、溝の底の光路は <b>2d</b> 短くなります（手前と奥で1回ずつ）。
      ここを入れないと、いちばん明るいはずの谷がいちばん濃くなり、
      ゼリー.js の言葉でいえば<b>「緑に塗った菊の置物」</b>になります。
    </p>
    <p>
      溝を彫る向きにも工夫があります。<b>母線の法線方向に彫る</b>と、
      天面（法線が真上）では高さの凹凸＝花びらに、側面（法線が横）では半径の凹凸＝溝に、自動的に変わる。
      型は1枚のつながった面なので、天面と側面を別々に作ると位相がずれて、上と横で別の型に見えてしまいます。
    </p>
    <div class="trap">
      <span class="label">つまずきポイント</span>
      <p><b>ガラスの器を白く塗らない。</b>
      ガラスは光を反射と透過に振り分けるだけで、拡散反射をほとんど持ちません。
      アルベドを白にすると乳白色のすりガラスになり、中のゼリーを覆ってしまいます。
      無色のガラスはアルベドを黒にして、見えるものは映り込みと屈折だけにします。</p>
      <p><b>プリンのカラメルは、そのままだと暗すぎる。</b>
      プリン.js のカラメルも同じ吸収の式で解いていますが、0.5mm の膜を往復するだけで橙、1.5mm で赤黒になるほど濃い。
      ランベルト・ベールだけだと薄い縁まで濁った茶になるので、
      膜の中で跳ね返る光を足す <b>Saunderson の補正</b>（内部反射率 0.45）を入れています。</p>
      <p><b>透けるのに、不透明のパスで描く。</b>
      屈折は透明（アルファ）と独立に効くので、ゼリーは不透明メッシュのままにしてあります。
      深度を書くので、ガラスの器の奥の壁が正しく隠れ、前後のソートにも悩みません。</p>
    </div>`,
  tryIt: [
    "「塗る」に切り替え、溝の谷と山のどちらが濃く見えるかを光路モードと見比べる。",
    "いちごにして σ の倍率を 2.5 まで上げ、縁と胴の色がどう分かれるか見る。",
    "メロンの T0 から σ を自分で計算し、本文の [0.27, 0.18, 0.67] と合うか確かめる。",
    "ゼリー.js で topThin を 0 にして Run し、天面の色がどう変わるか見る。"
  ]
},

/* ==================================================================
   16 距離場とサーフェスネット
   ================================================================== */
{
  file: "ch16.html", no: "16", tag: "SDF", nav: "16 塊", color: "ame",
  title: "ひとつの塊は、距離の場から削り出す",
  sub: "signed distance field + surface nets — 継ぎ目の無い形",
  crumb: "第16章",
  recap: [
    "飴細工のウサギは、回しても掃引しても作れません。<b>胴・頭・耳・脚が一つの塊</b>だからです。",
    "部品を<b>距離関数</b>で書き、なめらかな最小値（smin）で溶かし合わせると、継ぎ目が消えます。",
    "格子で距離を測り、<b>サーフェスネット</b>で面を張る。格子の段は、ぼかすか面へ射影して消します。"
  ],
  html: `
    <p>
      04章では、断面を回して団子を作り、外形×縦断面でチョコを作りました。10章では軸に沿って断面を並べました。
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
      そして13章の団子で使った smin（なめらかな最小値）を使えば、つなぎ目が丸く溶けます。
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
      05章の「裏返ると消える」がそのまま起きるので、飴細工.js は辺の符号から外向きを決めて、
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
},
/* ==================================================================
   17 糸（線で描く綿菓子）
   ================================================================== */
{
  file: "ch17.html", no: "17", tag: "Strand", nav: "17 糸", color: "wata",
  title: "綿菓子は、面ではなく3万本の線",
  sub: "strands — 表面の無いものの描き方",
  crumb: "第17章",
  recap: [
    "綿菓子には、はっきりした<b>表面がありません</b>。見えているのは、細い砂糖の糸の重なりです。",
    "形の土台は回転体の曲面。その上に<b>帯の向きに沿って</b>短い糸を3万2千本、三角形ではなく<b>線</b>で描きます。",
    "糸だけだと中が空っぽに見えるので、半透明の<b>芯</b>を置き、その<b>深度を先に書いて</b>裏側の糸を隠します。"
  ],
  html: `
    <p>
      これまでの16章は、どれも「表面」を作る話でした。点を並べて三角形を張り、法線で明るさを決める。
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
      割り箸に巻き取った綿菓子は、下がすぼまって上が丸い。これは04章と同じ<b>回転体の輪郭</b>で書けます。
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
      14章のプリンで揺れの形を焼いておいたのと同じ考え方で、変わらないものを先に作り、変わるものは掛け算1回にしておきます。
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
