/* =====================================================================
 *  おかしのつくりかた — 第II部（12〜13章）の本文
 *
 *  第I部がファイルの層（CONFIG → Rng → Noise → …）に対応していたのに対し、
 *  こちらは「お菓子だから必要になった技術」で立てた章。
 *  どちらも、もとは「たべもののつくりかた」（VirtualFoodCourt）の第II部にあった。
 *  形式は pages-1.js と同じ。
 * ===================================================================== */

module.exports = [

/* ==================================================================
   12 たれ・ソース
   ================================================================== */
{
  file: "ch12.html", no: "12", tag: "Glaze", nav: "12 たれ", color: "sauce",
  title: "たれは、色ではなく層",
  sub: "absorption — 厚みが色を決める",
  crumb: "第12章",
  recap: [
    "たれを茶色い<b>色として塗る</b>と、光沢のない茶色い卵になります。",
    "実物のたれは<b>透明な層</b>で、厚いところほど濃い。色は厚みの結果です。",
    "しかも<b>実体</b>です。垂れの輪郭・縁の厚み・たまりの膨らみがシルエットに出ます。"
  ],
  html: `
    <p>
      みたらし団子を作ります。飴色のたれを、アルベド（素の色）に茶色として塗る。
      これが最初の版でした。花見団子.js の作り直しの記録に、こうあります。
    </p>
    <div class="note">
      <b>「たれは『色』ではなく『透明な層』。飴色を albedo に塗ると、光沢の無い茶色い卵になる。
      クリアコートの着色（吸収）で持たせると、薄い所は淡い琥珀、
      厚い所は黒に近い赤褐色へ自然に分かれる」</b>
    </div>
    <p>
      透明なものを光が通ると、進んだ距離に応じて吸収されます。これがランベルト・ベールの法則で、
      残る光の量は <code>exp(−吸収係数 × 厚み)</code> です。
      吸収係数を赤・緑・青で別々にすると、<b>厚みが変わるだけで色が変わります</b>。
      たこ焼きのソースなら、単位厚みあたりの吸収が RGB で <code>[1.5, 3.2, 5.4]</code>。
      青がいちばん吸われるので、薄いところは橙、厚いところは黒に近い赤褐色になります。
    </p>
    <figure>
<pre><span class="c">// 5. TextureLab : ソースの色は「塗る」のではなく「解く」</span>
<span class="k">const</span> EXT = [<span class="n">1.5</span>, <span class="n">3.2</span>, <span class="n">5.4</span>];   <span class="c">// 単位厚みあたりの吸収（RGB）</span>
<span class="k">const</span> t = thickness(u, v);       <span class="c">// その場所のソースの厚み</span>
<span class="k">for</span> (<span class="k">let</span> c = <span class="n">0</span>; c &lt; <span class="n">3</span>; c++) {
    <span class="c">// 下地の色に、通った距離ぶんの吸収を掛ける</span>
    out[c] = base[c] * Math.exp(-EXT[c] * t);
}</pre>
      <figcaption>たこ焼き.js。Babylon のクリアコート着色は薄いところで数値的に破綻するので、CPU で解いて焼く</figcaption>
    </figure>

    <div class="lab" id="lab12">
      <p class="lab-title">実験 — 塗る / 層として解く</p>
      <div class="lab-cols side">
        <div class="controls">
          <label class="switch"><input type="checkbox" id="glazePaint">アルベドに茶色を塗る（昔の版）</label>
          <div class="ctrl">
            <label for="glazeThick">たれの厚み<span class="v" id="glazeThickV">0.45</span></label>
            <input type="range" id="glazeThick" min="0" max="1" step="0.01" value="0.45">
          </div>
          <div class="ctrl">
            <label for="glazeCover">掛かる範囲<span class="v" id="glazeCoverV">0.62</span></label>
            <input type="range" id="glazeCover" min="0" max="1" step="0.01" value="0.62">
          </div>
          <label class="switch"><input type="checkbox" id="glazeBody" checked>厚みを形にも出す</label>
          <div class="readout" id="glazeOut">—</div>
        </div>
        <canvas id="glazeCanvas" width="640" height="360" aria-label="みたらしのたれを層として解く実験"></canvas>
      </div>
      <p class="hint">
        「塗る」に切り替えると、厚みを変えても色が変わりません。
        だから、いくら濃くしても「濃い茶色に塗ったもの」にしか見えなくなります。
      </p>
    </div>

    <h3>たれは全面を覆わない</h3>
    <p>
      上から掛けたたれは、下へ流れて、途中で止まります。止まった線から下は、
      白い生地が出たままです。<b>全面を覆うと、たれではなくコーティングになります</b>。
      たこ焼きのソースも同じで、垂れの輪郭がシルエットに出て初めてソースになる。
      アルベドに茶色を描くだけだと、ハイライトが玉全体で一様のままなので、印刷したように見えます。
    </p>

    <h3>液体の面は、下の肌理を埋める</h3>
    <p>
      これも見落としやすい点です。生地の表面はざらざらしていますが、
      その上をたれが流れると、<b>細かい凹凸は埋まって平らになります</b>。
      たれの上を粗いままにしておくと、たれではなく「茶色い塗装」になります。
      12章でやることは、結局この3つに集約されます。
    </p>
    <ul>
      <li>色は<b>厚みから解く</b>（吸収）</li>
      <li>厚みを<b>形にも出す</b>（縁の盛り上がり、たまりの膨らみ）</li>
      <li>たれの下の<b>粗さと法線を上書きする</b>（平らにする）</li>
    </ul>

    <h3>艶にも、ムラが要る</h3>
    <p>
      たれを一様に光らせると、プラスチックの成型品になります。
      たこ焼き.js のコメント：<b>「乾きかけた縁はざらつき、たまりだけが鏡になる」</b>。
      同じソースの中で、粗さが場所ごとに違う。
      07章で「粗さは1つの数値ではなく1枚の画像」と言ったのは、ここに効いてきます。
    </p>
    <div class="trap">
      <span class="label">つまずきポイント</span>
      <p><b>クリアコートの着色は、厚み 0 のところで壊れます。</b>
      Babylon.js のクリアコート着色は、浅い入射角と厚み 0 の組み合わせで数値的に破綻します。
      団子シリーズ4本とも、着色をエンジンに任せず<b>CPU で吸収を解いてテクスチャに焼く</b>方針をとっています。
      「エンジンの機能があるから使う」ではなく、壊れない側を選ぶ、という判断です。</p>
    </div>`,
  tryIt: [
    "「塗る」に切り替えて厚みを動かし、色が変わらないことを確かめる。",
    "層のまま厚みを 1.0 にして、いちばん厚い所が何色になるか見る。",
    "「厚みを形にも出す」を切り、シルエットの違いを見比べる。",
    "花見団子.js で「たれ」を検索し、たれが止まる線をどう決めているか読む。"
  ]
},

/* ==================================================================
   13 接触変形
   ================================================================== */
{
  file: "ch13.html", no: "13", tag: "Contact", nav: "13 潰れ", color: "yomogi",
  title: "触れ合うと、潰れる",
  sub: "contact deformation — やわらかい物の積み方",
  crumb: "第13章",
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
}

];
