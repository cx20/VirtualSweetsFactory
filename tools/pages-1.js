/* =====================================================================
 *  おかしのつくりかた — 00章と第I部（01〜05章）の本文
 *
 *  第I部「道具をそろえる」は、どのお菓子のファイルにも共通して入っている道具。
 *  乱数・ノイズ・面と法線・テクスチャ。お菓子の種類に関係なく、最初に要るもの。
 *
 *  tools/build.js から読み込まれる。HTML を直接手で直しても
 *  build.js を走らせると消えるので、文章はここを直すこと。
 *
 *  1ページぶんの形:
 *    file   … 出力するファイル名
 *    no     … 章番号（左上の四角に出る）
 *    tag    … その下の小さい英字
 *    nav    … ヘッダのナビに出る短い名前
 *    color  … site.css の顔料名（--p-XXX の XXX）
 *    title  … 見出し
 *    sub    … 見出しの下の1行
 *    recap  … 章のはじめの「3行まとめ」
 *    html   … 本文（<div class="body"> の中身）
 *    tryIt  … 章のおわりの「やってみよう」
 * ===================================================================== */

module.exports = [

/* ==================================================================
   00 まず動かしてみる
   ================================================================== */
{
  file: "start.html", no: "00", tag: "START", nav: "00 はじめ", color: "kitsune",
  title: "まず動かしてみる",
  sub: "読む前に、動かす。5分で終わります",
  crumb: "はじめに",
  recap: [
    "この15本は、<b>ブラウザだけ</b>で動きます。インストールは何も要りません。",
    "Babylon.js Playground という公式サイトに、ファイルの中身を<b>まるごと貼って実行</b>するだけです。",
    "先に動かして、数字をひとつ壊してみる。<b>説明を読むのはそのあと</b>のほうが、ずっと早く分かります。"
  ],
  html: `
    <p>
      このプロジェクトの .js ファイルは、ふつうの Web ページに読み込んで使うものではありません。
      <b>Babylon.js Playground</b>（バビロン・ジェイエス・プレイグラウンド）という、
      ブラウザの中で3Dのプログラムを書いて即座に実行できる公式サイトのための形になっています。
    </p>
    <div class="note">
      <b>いきなり動かしたいだけなら。</b>
      <a href="zukan.html">図鑑</a>の写真を押すと、このサイトの中でそのまま動きます。
      貼り付けの手順を踏むのは、<b>数字を書き換えて遊びたくなってから</b>で十分です。
    </div>

    <ol class="steps">
      <li>
        <h3>Playground を開く</h3>
        <p><a href="https://playground.babylonjs.com/" target="_blank" rel="noopener">playground.babylonjs.com</a>
        をブラウザで開きます。左が入力欄、右が3Dの画面です。
        パソコンのほうがやりやすいですが、スマホでも動きます。</p>
      </li>
      <li>
        <h3>もとから入っているコードを全部消す</h3>
        <p>左側をクリックして、<code>Ctrl</code>+<code>A</code>（Mac は <code>⌘</code>+<code>A</code>）で全選択 → <code>Delete</code>。
        まっさらにしてから貼るのがコツです。混ざると動きません。</p>
      </li>
      <li>
        <h3><b>花見団子.js</b> の中身を全部コピーして貼る</h3>
        <p>最初の1本は <b>花見団子.js</b> がおすすめです。いちばん素直な作りで、物理エンジンも使いません。
        「球を串の方向に少し潰して、竹串に刺す」だけでできています。
        <a href="view.html?f=%E8%8A%B1%E8%A6%8B%E5%9B%A3%E5%AD%90.js">ソースを読む</a>のページに
        「コードをコピー」ボタンがあるので、それを押して Playground の左側に貼り付けます。</p>
      </li>
      <li>
        <h3>実行する</h3>
        <p>上の <b>Run</b> ボタン（または <code>Alt</code>+<code>Enter</code>）。
        数秒〜十数秒待つと、皿の上に団子の串が出てきます。
        右下にスライダーが出るので、動かしてみてください。</p>
        <div class="trap">
          <span class="label">うまくいかないとき</span>
          <p><b>真っ黒のまま／なかなか出てこない</b> — このプロジェクトは模様を画像として読み込まず、
          実行するたびに <b>1ピクセルずつ計算して描いて</b>います。1024×1024 を何枚も焼くので、
          出るまでに十数秒かかるサンプルがあります（チョコレートとパンケーキが特に長い）。まず待ってみてください。</p>
          <p><b>エラーが出る</b> — 貼り付けたときに古いコードが残っていないか確認してください。
          物理エンジン（Havok）を使うサンプルは、その読み込みにも数秒かかります。</p>
          <p><b>動きがカクカクする</b> — 3Dの計算をパソコンが全部やっています。
          ブラウザの他のタブを閉じると軽くなります。</p>
        </div>
      </li>
      <li>
        <h3>数字をひとつ、わざと壊す</h3>
        <p>ファイルの上のほうにある <code>PRESETS</code> の中から <code>glaze</code>（たれの量）や
        <code>scorch</code>（焼き目）を探して、思いきり大きな値に書き換えて Run。
        <b>どの数字が何に効くかは、壊すといちばん早く分かります。</b>
        壊してしまっても、もう一度コピーして貼り直せば元どおりです。</p>
      </li>
      <li>
        <h3>中身を覗いてみる（Inspector）</h3>
        <p>Playground の右上にある <b>Inspector</b> を開くと、いま動いているシーンの中身が全部見えます。
        左の <b>Scene Explorer</b> がメッシュ・材質・テクスチャの一覧、右がその設定です。
        <b>照準のボタン（Picker）</b>を押してから画面のお菓子をクリックすると、
        いま押したものがツリーのどれなのかを教えてくれます。</p>
        <p>ここで値を触ると、コードを書き換えなくてもその場で結果が変わります。
        「この茶色はどのテクスチャなのか」「この面はどのメッシュなのか」を確かめるのに、
        いちばん手っ取り早い道具です。</p>
      </li>
      <li>
        <h3>次の1本へ</h3>
        <p>花見団子の次は <b>月見団子.js</b>（団子を積んで、触れ合う所を潰す）、
        <b>クッキー.js</b>（皿に落として積む）あたりが読みやすい順です。
        <b>チョコレート.js</b> と <b>パンケーキ.js</b> は分量が多いので後回しでかまいません。</p>
      </li>
    </ol>

    <h3>15本は、こんなお菓子です</h3>
    <p>
      和菓子（花見団子・月見団子・たい焼き・栗饅頭）、焼き菓子（クッキー・パンケーキ・ドーナツ・ロールケーキ）、
      チョコレート（チョコレート・チョコバナナ）、冷やし固める・引いて作るもの（プリン・ゼリー・アイス・飴細工・綿菓子）。
      焼いたもの、蒸したり茹でたりしたもの、溶かして固めたもの、冷やしたもの、飴を引いて形にしたものが混ざっています。
      <b>作り方が全部ちがうから</b>です。一覧は<a href="zukan.html">図鑑</a>にあります。
      料理30本は、姉妹編の<a href="https://cx20.github.io/VirtualFoodCourt/">「たべもののつくりかた」</a>にあります。
    </p>`,
  tryIt: [
    "花見団子.js を Playground で動かし、右下のボタンで三色・みたらし・焼きを切り替えてみる。",
    "みたらしに切り替えたとき、色以外に何が変わるか（艶・たれの垂れ・形）を観察して1行で書く。",
    "図鑑から好きなお菓子を3つ選んで、このサイトの中で動かしてみる。",
    "いくつかのファイルの先頭のコメントだけを読み比べて、共通する見出しを探す。"
  ]
},

/* ==================================================================
   01 手続き的生成
   ================================================================== */
{
  file: "ch01.html", no: "01", tag: "CONFIG", nav: "01 生成", color: "donut",
  title: "「作る」と「読み込む」はどう違うのか",
  sub: "procedural generation — 手続き的生成",
  crumb: "第01章",
  recap: [
    "ふつうの3Dは、誰かが作った<b>モデルファイルを読み込んで</b>表示します。",
    "このプロジェクトは逆で、<b>実行した瞬間に座標も模様も計算で作ります</b>。これを手続き的生成といいます。",
    "だから1個ずつ形が違い、焼き加減をあとから変えられ、しかもデータが軽い。"
  ],
  html: `
    <p>
      ゲームや映画に出てくるお菓子の3Dは、ふつう誰かが専用ソフトで作ったモデルファイルを読み込んで表示します。
      ファイルの中には「頂点1番は(3.2, 1.1, 0.4)」といった座標が何万個も保存されていて、
      表面の模様も写真として一緒に入っています。プログラムはそれを並べて画面に出すだけです。
    </p>
    <p>
      このプロジェクトは逆のことをしています。ファイルも写真も読まず、
      <b>プログラムを実行した瞬間に座標を計算で作り、模様も1ピクセルずつ計算で描く</b>。
      これを手続き的生成（プロシージャル生成）と呼びます。
      お菓子と相性がよく、いいことが3つあります。
    </p>
    <ul>
      <li><b>1個も同じにならない</b> — 数値を少し揺らすだけで、形の違う個体がいくらでも出てきます。
      皿のクッキー8枚が全部同じ形だと、その瞬間に嘘に見えます。</li>
      <li><b>あとから変えられる</b> — 「もう少し焼く」がスライダー1本で通ります。
      写真を貼る方式なら、焼き加減の数だけ写真を用意することになります。</li>
      <li><b>軽い</b> — 15本ぜんぶ合わせて 1.3MB ほどのテキストだけです。
      モデルファイルも、模様の写真も、1枚もありません。</li>
    </ul>
    <p>
      その代わり、形や色を言葉ではなく<b>数式で説明できないと作れません</b>。
      「焼きドーナツってどんな形?」に
      「1個の中に肌が2種類ある。型に接した面は滑らかで色が濃く、わずかに照る。
      空気に膨れた面はざらついて色が浅く、割れている」と
      答えられるかどうかが勝負になります（ドーナツ.js の冒頭のコメント）。
      だからこのプロジェクトのコードは、コメントの半分がお菓子の観察記録です。
    </p>

    <h3>ほとんどのファイルが、同じ層でできている</h3>
    <p>
      クッキーもチョコレートもドーナツも、ファイルの構造はほとんど同じです。上から順に読めば、
      どのお菓子でも同じ場所に同じ役割のコードがあります。
    </p>
    <figure>
<pre><span class="c">// 構成:
//    0. CONFIG      … 種類プリセット（サブレ / 市松 / うずまき / チョコチップ /
//                     型押しビスケット / クラッカー / 絞り出し）と皿・物理
//    1. Rng         … シード付き擬似乱数
//    2. Noise       … 2D値ノイズ / 周期ノイズ / セルノイズ（割れ目用）
//    3. Mesh utils  … 巻き順の自動判定・法線の溶接・掃引
//    4. Section     … 断面（上面→縁→底面）と外形。丸・角丸四角・長方形・菊型
//    5. TextureLab  … 焼き色・割れ・型押し・ピケ穴・砂糖粒、リネンと釉薬
//    6. Cookie      … 円盤系（1メッシュ）＋ チョコチップ / 絞り出し系（螺旋掃引）
//    7. Plate       … 玉縁の皿
//    8. Scene / 物理（Havok で1枚ずつ落とす）
//    9. GUI</span></pre>
      <figcaption>クッキー.js の冒頭。お菓子の名前のところが入れ替わるだけで、ほとんどのファイルがこの並び</figcaption>
    </figure>
    <p>
      層の順番には理由があります。<b>下の層は上の層を知らなくても動く</b>ように積んであるからです。
      乱数（1）はノイズ（2）を知らないし、ノイズは形（4）を知らない。
      だから途中の1層だけ差し替えれば、別のお菓子になります。
      クッキー.js の7種類は、まさにそれです。4. Section に渡す外形と断面の数値を変えるだけで、
      サブレがクラッカーになり、型押しビスケットになる（→ <a href="ch06.html">06章</a>）。
    </p>

    <h3>章は、お菓子の作り方の順に並んでいる</h3>
    <p>
      このサイトの章立ては、ファイルの層ではなく<b>お菓子を作るときに必要になる技術</b>で分けてあります。
      第I部で全部のファイルに共通する道具をそろえたら、あとは実際のお菓子作りと同じ順番です。
      生地を<b>形にして</b>、<b>焼いたり掛けたりして</b>、<b>皿に盛って</b>、最後に<b>硬い面では作れないもの</b>へ。
    </p>
    <table>
      <tr><th>お菓子作りでいうと</th><th>コードでやること</th><th>お菓子</th><th>章</th></tr>
      <tr><td>道具をそろえる</td><td>乱数・ノイズ・面と法線・テクスチャ</td><td>全部</td><td><a href="ch02.html">02</a>〜<a href="ch05.html">05</a></td></tr>
      <tr><td>ろくろで回す・型で抜く</td><td>回転体 / 外形 × 縦断面</td><td>団子・プリン・ドーナツ・クッキー・チョコレート</td><td><a href="ch06.html">06</a></td></tr>
      <tr><td>曲げる・巻く・絞る</td><td>軸に沿った掃引</td><td>チョコバナナ・ロールケーキ・絞り出しクッキー</td><td><a href="ch07.html">07</a></td></tr>
      <tr><td>押されて潰れる</td><td>接触変形・smin</td><td>月見団子・花見団子</td><td><a href="ch08.html">08</a></td></tr>
      <tr><td>練って溶かし合わせる</td><td>距離関数・サーフェスネット</td><td>飴細工・アイス</td><td><a href="ch09.html">09</a></td></tr>
      <tr><td>焼く</td><td>焼き色の場（熱の届き方）</td><td>パンケーキ・クッキー・たい焼き・ドーナツ・栗饅頭</td><td><a href="ch10.html">10</a></td></tr>
      <tr><td>艶を出す</td><td>PBR（粗さ・膜・透け）</td><td>チョコレート・プリン・団子</td><td><a href="ch11.html">11</a></td></tr>
      <tr><td>たれ・シロップを掛ける</td><td>吸収で色を解く</td><td>みたらし・パンケーキ・チョコバナナ</td><td><a href="ch12.html">12</a></td></tr>
      <tr><td>寒天・ゼラチンで固める</td><td>光路長で色を解く</td><td>ゼリー</td><td><a href="ch13.html">13</a></td></tr>
      <tr><td>撮る</td><td>光・露出・トーンマッピング</td><td>全部</td><td><a href="ch14.html">14</a></td></tr>
      <tr><td>皿に盛る</td><td>物理エンジン / 緩和</td><td>クッキー・チョコレート・ドーナツ・月見団子</td><td><a href="ch15.html">15</a></td></tr>
      <tr><td>スプレーを振る</td><td>インスタンス・付着の向き</td><td>チョコバナナ・ドーナツ・クッキー</td><td><a href="ch16.html">16</a></td></tr>
      <tr><td>ぷるぷる揺れる</td><td>モーダル変形</td><td>プリン・ゼリー</td><td><a href="ch17.html">17</a></td></tr>
      <tr><td>糸を引いて巻き取る</td><td>線の集まり・深度プリパス</td><td>綿菓子</td><td><a href="ch18.html">18</a></td></tr>
    </table>

    <div class="trap">
      <span class="label">野菜のときと変わったところ</span>
      <p>この教材には姉妹編（<b>やさいのつくりかた</b>）があり、そちらでは
      <b>4. Profile</b>（横顔の折れ線）が形の中心にありました。
      お菓子では、そこが <b>4. Fields</b> や <b>4. Section</b> という名前に変わっているファイルが多い。
      野菜は「軸のまわりに回せば作れる」ものが多いのに対し、
      お菓子は<b>型で抜いてあったり、潰してあったり、垂れていたり、巻いてあったり</b>して、
      回転体ではないものが増えるためです。</p>
    </div>

    <h3>「焼く」と「固める」が、そのままコードにある</h3>
    <p>
      野菜とお菓子のいちばん大きな違いはここです。お菓子の多くには<b>火が通っている</b>。
      その結果として、表面の色が場所ごとに違い、水分が飛び、艶が出て、形が変わる。
      クッキー・パンケーキ・たい焼きには <code>bake</code>（焼き加減）という名前の変数があり、
      たい焼きは焦げぎわを <code>char</code> / <code>burn</code> として、焼き団子は焦げ目を
      <code>scorch</code> として持っています。
      焼き色は最後に上から塗る飾りではなく、<b>形と一緒に決まるもの</b>です。
      それを扱うのが<a href="ch10.html">10章</a>です。
    </p>
    <p>
      一方で、チョコレートとチョコバナナには火が通っていません。溶かして、型に流すか浸して、固めたものです。
      そこでは焼き色の代わりに、<b>ブルーム（表面の白い粉）や、垂れて止まった滴</b>が手がかりになります。
    </p>
    <div class="note">
      <b>読む順番のおすすめ。</b>
      最初の1本は<b>花見団子.js</b>がいちばん素直です（球を少し潰して串に刺すだけ）。
      次に<b>月見団子.js</b>、慣れたら<b>クッキー.js</b>。
      <b>チョコレート.js</b>と<b>パンケーキ.js</b>は分量が多いので後回しでかまいません。
      章の例は、すべてこの15本から取っています。
    </div>`,
  tryIt: [
    "クッキー.js の先頭のコメント（構成 0〜9）を読んで、他のファイルにも同じ並びがあるか確かめる。",
    "手続き的生成のいいところ3つを、自分の言葉で1行ずつ書いてみる。",
    "15本のファイルを検索して、bake / char / burn / scorch という語がどのファイルに出てくるか調べ、「焼いたお菓子」と一致するか確かめる。",
    "身のまわりのお菓子で「数式で説明できそうな形」を3つ探し、上の表のどの章の作り方になるか当てはめる（例：バウムクーヘン、マカロン、板チョコ）。"
  ]
},

/* ==================================================================
   02 乱数
   ================================================================== */
{
  file: "ch02.html", no: "02", tag: "Rng", nav: "02 乱数", color: "cookie",
  title: "同じ種からは、同じお菓子が焼ける",
  sub: "seeded pseudo random — シード付き擬似乱数",
  crumb: "第02章",
  recap: [
    "形を作るところでは <code>Math.random()</code> を使っていません。代わりに<b>自分で乱数を書いて</b>います。",
    "「種（シード）」という整数をひとつ渡すと、<b>何度実行しても同じ並びの数</b>が出てきます。",
    "同じ形が二度と作れないと、直すことも、比べることもできないからです。"
  ],
  html: `
    <p>
      クッキーを8枚焼くとします。8枚とも同じ大きさ・同じ輪郭・同じ焼きムラなら、
      それは焼き菓子ではなくコピー＆ペーストに見えます。だから乱数で揺らします。
      ここまではふつうです。問題はその次で、<b>ふつうの乱数だと二度と同じ8枚が作れません</b>。
    </p>
    <p>
      3枚目だけ焼き色が変で直したい。ところが Run するたびに全部変わるので、
      直したのか、たまたま別の個体が出ただけなのか分かりません。
      だからこのプロジェクトは形を作るところで <code>Math.random()</code> を使わず、
      <b>種を渡すと毎回同じ数列を返す乱数</b>を自分で書いています。
      例外はアイス.js の「盛り直す」ボタンだけで、そこでは<b>新しい種を1つ選ぶ</b>ためだけに使っています。
      選んだ種から先は、やはり毎回同じ形になります。
    </p>
    <figure>
<pre><span class="c">// 1. Rng : シード付き擬似乱数（mulberry32）</span>
<span class="k">const</span> Rng = (seed) =&gt; {
    <span class="k">let</span> s = seed &gt;&gt;&gt; <span class="n">0</span>;
    <span class="k">return</span> () =&gt; {
        s = (s + <span class="n">0x6D2B79F5</span>) | <span class="n">0</span>;
        <span class="k">let</span> t = Math.imul(s ^ (s &gt;&gt;&gt; <span class="n">15</span>), <span class="n">1</span> | s);
        t = (t + Math.imul(t ^ (t &gt;&gt;&gt; <span class="n">7</span>), <span class="n">61</span> | t)) ^ t;
        <span class="k">return</span> ((t ^ (t &gt;&gt;&gt; <span class="n">14</span>)) &gt;&gt;&gt; <span class="n">0</span>) / <span class="n">4294967296</span>;
    };
};</pre>
      <figcaption>15本のうち13本に、ほぼこの形で入っている。名前は mulberry32（飴細工.js と栗饅頭.js は乱数を使わず、ノイズだけで済ませている）</figcaption>
    </figure>
    <p>
      中身は「かき混ぜて、上の桁と下の桁をぶつけて、また混ぜる」だけです。
      規則はあるのに、出てくる数の並びに規則が見えない。だから<b>擬似</b>乱数といいます。
      大事なのは仕組みより性質のほうで、<b>入れた種が同じなら、出てくる数列も同じ</b>。
      これが「同じお菓子をもう一度焼ける」ということです。
    </p>

    <div class="lab" id="lab02">
      <p class="lab-title">実験 — 種を変える / 種を固定したまま作り直す</p>
      <div class="lab-cols side">
        <div class="controls">
          <div class="ctrl">
            <label for="seedRange">種（シード）<span class="v" id="seedRangeV">7</span></label>
            <input type="range" id="seedRange" min="1" max="60" step="1" value="7">
          </div>
          <div class="chips" id="seedFn">
            <button class="chip" type="button" data-v="rng" aria-pressed="true">Rng(種)</button>
            <button class="chip" type="button" data-v="rand">Math.random()</button>
          </div>
          <button class="chip" type="button" id="seedRedraw">もう一度、同じ設定で作る</button>
          <div class="readout" id="seedOut">—</div>
        </div>
        <canvas id="seedCanvas" width="640" height="330" aria-label="種を変えるとクッキー8枚の個体差が変わる"></canvas>
      </div>
      <p class="hint">
        クッキー8枚の直径・輪郭のゆがみ・焼き色・チョコチップの位置を、乱数から作っています。
        「もう一度作る」を押したとき、Rng なら同じ8枚、Math.random() なら毎回別の8枚になります。
      </p>
    </div>

    <h3>種は、1個ではなく何個も要る</h3>
    <p>
      実際のコードでは、種をひとつだけ持つのではなく<b>用途ごとに分けて</b>います。
      チョコバナナ.js なら、長さ・太さ・曲がりといった個体差は <code>Rng(seed)</code> から引き、
      チョコの塗り厚のムラや先端の垂れ筋は、別の種 <code>nseed</code> を渡したノイズから引きます。
      分けておかないと、「垂れ筋の具合を直したらバナナの曲がりまで変わってしまった」ということが起きるからです。
    </p>
    <figure>
<pre><span class="c">// 個体ごとに種をずらす。同じ列でも i が違えば別の個体になる</span>
<span class="k">const</span> rnd  = Rng(seed + i * <span class="n">1013</span>);      <span class="c">// 形</span>
<span class="k">const</span> rndB = Rng(seed + i * <span class="n">1013</span> + <span class="n">77</span>); <span class="c">// 焼き色</span></pre>
      <figcaption>種に「ずらす数」を足して枝分かれさせる。サンプルに共通のやり方</figcaption>
    </figure>
    <div class="trap">
      <span class="label">つまずきポイント</span>
      <p><b>種を足し算だけで作ると、ぶつかることがあります。</b>
      <code>seed + i</code> と <code>seed + j + 1</code> のような作り方をすると、
      別々のはずの個体がたまたま同じ種になり、双子が生まれます。
      掛ける数を大きめの素数（1013 や 9176 など）にしておくのはそのためです。</p>
    </div>

    <h3>揺らす幅は、お菓子の作られ方で決まる</h3>
    <p>
      乱数で揺らすと決めたら、次は<b>どれだけ揺らすか</b>です。ここにお菓子ごとの個性が出ます。
      クッキーとドーナツは型や絞り袋で形をそろえて焼く、いわば工業製品です。
      野菜や手で丸めたものと同じ幅で揺らすと、<b>手びねりの粘土</b>になります。
    </p>
    <table>
      <tr><th>お菓子</th><th>揺らす幅</th><th>理由（コメントより）</th></tr>
      <tr><td>ドーナツ.js</td><td>外形 ±3%、厚み ±7%</td><td>型で焼いた工業製品。単調さは焼きムラと膨れ方の偏りで消す</td></tr>
      <tr><td>クッキー.js</td><td>半径 ±5.5%、厚み −8〜+10%</td><td>個体差は小さい。代わりに焼きムラと反りで単調さを消す</td></tr>
      <tr><td>チョコバナナ.js</td><td>長さ −10〜+8%、曲がり −22〜+18%</td><td>バナナは1本ずつ太さも曲がりもかなり違う</td></tr>
    </table>
    <p>
      形をそろえて作るものは<b>形を少し、焼き色を大きく</b>揺らす。自然のものは形そのものを大きく揺らす。
      揺らす量は、そのお菓子がどうやって作られるかを数字にしたものです。
    </p>

    <h3>正規分布のほうが「らしい」ことがある</h3>
    <p>
      <code>rnd()</code> は 0〜1 のあいだを平らに出します。長さを ±10% 振りたいときはこれでよいのですが、
      「たいていは真ん中くらい、たまに極端」という揺れ方をさせたいときは、
      平らな乱数だと極端なものが多すぎます。そこで <b>ガウス（正規分布）</b>を使います。
      月見団子の1個ずつの大きさと置き位置のずれや、チョコバナナの横方向のわずかな曲がりがこれです。
    </p>
    <figure>
<pre><span class="c">// Box-Muller 法。平らな乱数2つから、釣鐘型の乱数を作る</span>
<span class="k">const</span> gauss = (m, sd) =&gt;
    m + sd * Math.sqrt(<span class="n">-2</span> * Math.log(Math.max(<span class="n">1e-9</span>, rnd())))
          * Math.cos(<span class="n">6.28318</span> * rnd());</pre>
      <figcaption>月見団子.js の大きさと位置のずれ、チョコバナナ.js の sideBend はこちらを使う</figcaption>
    </figure>`,
  tryIt: [
    "上の実験で種を 7 から 8 に変え、8枚すべてが変わることを確かめる。",
    "Math.random() に切り替えて「もう一度作る」を3回押し、毎回変わることを確かめる。",
    "チョコバナナ.js を開いて rng.range を検索し、1本ごとの個体差に何項目を振っているか数える。",
    "ドーナツ.js とチョコバナナ.js で、形を揺らす幅がなぜこれだけ違うのかを1行で説明する。"
  ]
},

/* ==================================================================
   03 ノイズ
   ================================================================== */
{
  file: "ch03.html", no: "03", tag: "Noise", nav: "03 ノイズ", color: "pancake",
  title: "焼きムラは、なめらかな乱数でできている",
  sub: "value noise / fBm — 値ノイズと重ね合わせ",
  crumb: "第03章",
  recap: [
    "ふつうの乱数は<b>となりと無関係</b>なので、そのまま模様にすると砂嵐になります。",
    "格子の点にだけ乱数を置いて、あいだをなめらかにつなぐ。これが<b>値ノイズ</b>です。",
    "細かさを半分ずつにして何枚も重ねると（<b>fBm</b>）、焼きムラや生地の肌理になります。"
  ],
  html: `
    <p>
      パンケーキの焼き色を、1ピクセルごとに <code>rnd()</code> で決めたらどうなるか。
      白と茶色の点が入り乱れた砂嵐になります。実物の焼きムラは、
      <b>濃いところの隣はだいたい濃い</b>。となり合う値がつながっていないといけません。
    </p>
    <p>
      そこで、まず大きな格子を用意し、<b>格子の交点にだけ乱数を置きます</b>。
      あいだの場所は、四隅の値を混ぜて求める。ただの直線で混ぜると格子が四角く見えてしまうので、
      混ぜ具合を <code>t·t·(3−2t)</code> というなめらかな曲線（スムーズステップ）に通します。
      これで、格子の形が見えない、なめらかな乱数の面ができます。
    </p>
    <figure>
<pre><span class="c">// 2. Noise : 2D値ノイズ</span>
<span class="k">const</span> v2 = (x, y, seed) =&gt; {
    <span class="k">const</span> xi = Math.floor(x), yi = Math.floor(y);
    <span class="k">const</span> xf = x - xi,        yf = y - yi;
    <span class="c">// 直線ではなく S 字で混ぜる。格子の目が見えなくなる</span>
    <span class="k">const</span> u = xf * xf * (<span class="n">3</span> - <span class="n">2</span> * xf);
    <span class="k">const</span> v = yf * yf * (<span class="n">3</span> - <span class="n">2</span> * yf);
    <span class="k">const</span> a = h2(xi, yi, seed),     b = h2(xi + <span class="n">1</span>, yi, seed);
    <span class="k">const</span> c = h2(xi, yi + <span class="n">1</span>, seed), d = h2(xi + <span class="n">1</span>, yi + <span class="n">1</span>, seed);
    <span class="k">return</span> mix(mix(a, b, u), mix(c, d, u), v);
};</pre>
      <figcaption>ほとんどのサンプルに、ほぼこの形で入っている</figcaption>
    </figure>

    <h3>1枚では足りない。だから重ねる</h3>
    <p>
      値ノイズを1枚だけ使うと、雲のようにぼんやりしたムラにしかなりません。
      実物の焼きムラは、<b>大きな濃淡の中に細かい斑があって、その中にもっと細かい粒がある</b>。
      そこで、細かさを2倍にして高さを半分にしたものを何枚も足します。
      これを <b>fBm</b>（fractional Brownian motion／非整数ブラウン運動）と呼びます。
      枚数のことを<b>オクターブ</b>といいます。
    </p>
    <figure>
<pre><span class="k">const</span> fbm = (x, y, seed, oct) =&gt; {
    <span class="k">let</span> s = <span class="n">0</span>, a = <span class="n">0.5</span>, f = <span class="n">1</span>, n = <span class="n">0</span>;
    <span class="k">for</span> (<span class="k">let</span> o = <span class="n">0</span>; o &lt; oct; o++) {
        s += a * v2(x * f, y * f, seed + o * <span class="n">131</span>);
        n += a;
        f *= <span class="n">2</span>;    <span class="c">// 細かさは2倍</span>
        a *= <span class="n">0.5</span>;  <span class="c">// 効き目は半分</span>
    }
    <span class="k">return</span> s / n;
};</pre>
      <figcaption>オクターブを増やすほど細かい粒が乗る。4〜6枚でだいたい足りる</figcaption>
    </figure>

    <div class="lab" id="lab03">
      <p class="lab-title">実験 — オクターブを重ねる</p>
      <div class="lab-cols side">
        <div class="controls">
          <div class="ctrl">
            <label for="noiseScale">大きさ（格子の粗さ）<span class="v" id="noiseScaleV">4.0</span></label>
            <input type="range" id="noiseScale" min="1" max="14" step="0.5" value="4">
          </div>
          <div class="ctrl">
            <label for="noiseOct">オクターブ（重ねる枚数）<span class="v" id="noiseOctV">1</span></label>
            <input type="range" id="noiseOct" min="1" max="6" step="1" value="1">
          </div>
          <div class="ctrl">
            <label for="noiseGain">減り方（次の枚の効き目）<span class="v" id="noiseGainV">0.50</span></label>
            <input type="range" id="noiseGain" min="0.2" max="0.85" step="0.01" value="0.5">
          </div>
          <div class="chips" id="noiseUse">
            <button class="chip" type="button" data-v="raw" aria-pressed="true">生の値</button>
            <button class="chip" type="button" data-v="bake">焼き色にする</button>
            <button class="chip" type="button" data-v="pore">生地の肌理にする</button>
          </div>
        </div>
        <canvas id="noiseCanvas" width="640" height="330" aria-label="ノイズのオクターブを重ねる実験"></canvas>
      </div>
      <p class="hint">
        左が乱数そのもの（となりと無関係）、右が値ノイズ。
        「焼き色にする」を押すと、同じノイズがパンケーキの焼きムラに化けます。
      </p>
    </div>

    <h3>ぐるっと一周してつながるノイズ</h3>
    <p>
      団子やパンケーキの側面のように<b>ぐるりと一周する面に模様を巻く</b>とき、
      ふつうのノイズを使うと、一周して戻ってきたところで模様が切れて縦の線が入ります。
      そこで、横方向（u）だけ格子の番号を周期で折り返した専用のノイズを使います。
      月見団子.js の Noise には「x 方向だけ period で巻く。テクスチャの継ぎ目が出ないのはこのため」とあり、
      パンケーキ.js の側面の帯も、同じ折り返しのノイズ <code>fbm2u</code> で描いています。
    </p>
    <p>
      ドーナツとチョコバナナは、それでも足りません。どちらも<b>閉じた立体</b>で、
      ドーナツは u も v も一周する輪、バナナは両端が点に閉じる筒です。
      ドーナツ.js のコメントによれば、UV で引くと継ぎ目に線が出るうえ、
      <b>外周と穴とで周長が3倍違う</b>ので模様の大きさもそろいません。
      そこで2つとも、UV ではなく<b>3Dの位置から直接ノイズを引いて</b>、継ぎ目そのものを作らないようにしています。
    </p>
    <div class="trap">
      <span class="label">つまずきポイント</span>
      <p><b>fBm の平均は 0.5 のあたりに集まります。</b>
      オクターブを重ねるほど、極端な値（0 に近い／1 に近い）は出にくくなります。
      「しきい値 0.8 以上を焦げにする」と書いたのに焦げが1点も出ない、というのはこれが原因です。
      クッキー.js の修正記録には、クラッカーの気泡の膨れ（blister）のしきい値を
      「fbm の実分布に合わせる」と直した跡が残っています。</p>
      <p><b>気泡は、fBm のしきい値で作らないでください。</b>
      ドーナツ.js のコメント：<b>「fbm のしきい値で気泡を作るとテラゾー（人造大理石）の模様になる。
      実際の気泡は独立した球なので、球冠の深さで作るのが唯一それらしくなる方法」</b>。
      パンケーキ.js も天面と側面の穴を、1個ずつの球冠（<code>Noise.cap</code>）で彫っています。</p>
    </div>`,
  tryIt: [
    "オクターブを1から6まで動かし、どこから「焼きムラらしく」見えるか決める。",
    "減り方を 0.85 にすると何が起きるか観察する（細かい粒が消えないので砂っぽくなる）。",
    "「焼き色にする」で、大きさを 1 と 14 にしたときの見え方の違いを言葉にする。",
    "パンケーキ.js の sample() の中で fbm2 を呼んでいる箇所を全部探し、それぞれ何に使っているか（焼き色・高さ・縁）書き出す。"
  ]
},

/* ==================================================================
   04 面と法線
   ================================================================== */
{
  file: "ch04.html", no: "04", tag: "Mesh", nav: "04 面", color: "yomogi",
  title: "三角形の向きと、面の傾き",
  sub: "winding order / normals — 巻き順と法線",
  crumb: "第04章",
  recap: [
    "3Dモデルの正体は、<b>座標の配列</b>と<b>三角形の番号表</b>の2つだけです。",
    "三角形には表と裏があり、頂点を並べる向き（<b>巻き順</b>）で決まります。裏返ると消えます。",
    "面がどちらを向いているかの矢印を<b>法線</b>といい、明るさはこれだけで決まります。"
  ],
  html: `
    <p>
      団子もクッキーもチョコレートも、画面に出るときは同じものになります。
      どんな形でも、最後にやることは2つだけです。
      <b>点を並べる</b>ことと、<b>どの3点で三角形を張るかを番号で書く</b>こと。
      Babylon.js では前者を <code>positions</code>、後者を <code>indices</code> と呼びます。
    </p>
    <figure>
<pre><span class="c">// 断面を N 段 × M 分割で回して、格子状に点を並べる</span>
<span class="k">for</span> (<span class="k">let</span> i = <span class="n">0</span>; i &lt; N; i++) {
    <span class="k">const</span> t = i / (N - <span class="n">1</span>);
    <span class="k">for</span> (<span class="k">let</span> j = <span class="n">0</span>; j &lt;= M; j++) {
        <span class="k">const</span> a = j / M * TAU;
        <span class="k">const</span> r = radius(t, a);
        positions.push(r * Math.cos(a), yAt(t), r * Math.sin(a));
        uvs.push(j / M, t);
    }
}</pre>
      <figcaption>団子のように「断面を回す」形の場合。radius(t, a) の作り方は<a href="ch06.html">06章</a>。j が M で終わらず M まで回るのは、継ぎ目の列を2重に持つため（05章で効いてくる）</figcaption>
    </figure>

    <h3>巻き順 — 裏返ると、立体が消える</h3>
    <p>
      三角形には表と裏があります。どちらが表かは、<b>3つの頂点を並べた向き</b>で決まります。
      外から見て反時計回りなら表。3Dの世界では、裏側の面は描くのを省略します
      （見えないところを描いても無駄なので）。だから<b>間違えると立体がまるごと消えます</b>。
      正確には、内側だけが見えて、風船の内壁を見ているような妙な絵になります。
    </p>
    <p>
      ほとんどのサンプルは、この間違いを<b>実行時に自分で検出して直します</b>。
      作った直後にすべての面の法線を合計し、重心から外へ向いているかを調べる。
      向いていなければ番号表を入れ替える。「気をつける」ではなく「測って直す」という方針です。
    </p>
    <figure>
<pre><span class="c">// 3. Mesh utils : 巻き順の自動判定</span>
<span class="c">// 【対策】1頂点で判定すると、たまたま凹んだ所に当たって全体が裏返る。
//         全頂点ぶんの内積の総和で決める（クッキー.js の修正記録より）</span>
<span class="k">let</span> dot = <span class="n">0</span>;
<span class="k">for</span> (<span class="k">let</span> k = <span class="n">0</span>; k &lt; nv; k++) {
    dot += nx[k] * (px[k] - cx) + ny[k] * (py[k] - cy) + nz[k] * (pz[k] - cz);
}
<span class="k">if</span> (dot &lt; <span class="n">0</span>) flipIndices(indices);</pre>
      <figcaption>クッキー.js の cookie-A → A2 で直った箇所。1点で決めるとクラッカーが裏返っていた</figcaption>
    </figure>

    <h3>法線 — 明るさは、これだけで決まる</h3>
    <p>
      面がどちらを向いているかを表す矢印が<b>法線</b>です。
      光の向きとの角度で明るさが決まるので、
      <b>形は正しいのに法線が変だと、お菓子が金属や紙に見えます</b>。
    </p>
    <p>
      法線には2通りの出し方があります。三角形ごとに1本持つ（フラット）と、
      頂点ごとに、その頂点を囲む面の平均を持つ（スムーズ）。
      団子はスムーズ、板チョコの角はフラットであってほしい。
      お菓子によって、また同じお菓子でも場所によって使い分けます。
    </p>

    <div class="lab" id="lab05">
      <p class="lab-title">実験 — 巻き順と法線を切り替える</p>
      <div class="lab-cols side">
        <div class="controls">
          <div class="chips" id="meshMode">
            <button class="chip" type="button" data-v="solid" aria-pressed="true">ふつうに描く</button>
            <button class="chip" type="button" data-v="wire">面の格子</button>
            <button class="chip" type="button" data-v="normal">法線の向き</button>
            <button class="chip" type="button" data-v="facing">表と裏</button>
          </div>
          <label class="switch"><input type="checkbox" id="meshSmooth" checked>法線をなめらかにする</label>
          <label class="switch"><input type="checkbox" id="meshFlip">巻き順を裏返す</label>
          <div class="ctrl">
            <label for="meshN">段の数<span class="v" id="meshNV">40</span></label>
            <input type="range" id="meshN" min="5" max="64" step="1" value="40">
          </div>
          <div class="ctrl">
            <label for="meshM">分割数<span class="v" id="meshMV">40</span></label>
            <input type="range" id="meshM" min="4" max="64" step="1" value="40">
          </div>
        </div>
        <canvas id="meshCanvas" width="640" height="360" aria-label="団子のメッシュを巻き順・法線・分割数で切り替える"></canvas>
      </div>
      <p class="hint">
        「表と裏」では、裏を向いた面が赤くなります。「巻き順を裏返す」を押すと全部赤くなり、
        ふつうに描いたときは中身が透けて見えます。<br><b>立体はドラッグで回せます</b>（触ると自動回転は止まります。ダブルクリックで戻ります）。
        上から覗くと、裏返した面がどこにあるかがよく分かります。
      </p>
    </div>

    <h3>法線を「溶接」する</h3>
    <p>
      いくつかの部品をくっつけて1つのお菓子にすると、つなぎ目に線が入ることがあります。
      同じ場所に頂点が2つあり、それぞれが別の法線を持っているからです。
      そこで、<b>ごく近い頂点どうしの法線を平均して揃える</b>処理を入れます。これを溶接といいます。
      多くのサンプルに <code>weldNormals</code> という関数が入っているのはそのためです。
    </p>

    <h3>見た目の変形と、頂点の変形は別もの</h3>
    <p>
      いちばん短いサンプルの栗饅頭.js は、球を1つ作って楕円に伸ばし、底を平らにして上をふっくらさせるだけです。
      ところが冒頭のコメントは、形ではなく<b>順番</b>の話をしています。
    </p>
    <div class="note">
      <b>「mesh.scaling で楕円形にした後、bakeCurrentTransformIntoVertices() で頂点に焼き込む。
      その後に底面平坦化などの頂点編集を行う → Playground表示 と glTFエクスポート の両方で一致する」</b>
    </div>
    <p>
      <code>mesh.scaling</code> は、描くときに掛ける<b>拡大率</b>で、頂点の座標そのものは球のままです。
      この状態で頂点を編集すると、「下から 15% を平らに」の 15% が<b>伸ばす前の球</b>に対して決まり、
      あとから拡大率が掛かります。画面では合って見えても、拡大率を持たない形式へ書き出すとずれる。
      <code>bakeCurrentTransformIntoVertices()</code> は拡大率を頂点に掛けて (1, 1, 1) に戻すので、
      そのあとの編集は<b>見えている形</b>に対して効きます。
      編集のあとに <code>ComputeNormals</code> で法線を計算し直すのも忘れずに。
      頂点を動かしても、法線は勝手には付いてきません。
    </p>
    <div class="trap">
      <span class="label">つまずきポイント</span>
      <p><b>分割数を上げれば良くなるわけではありません。</b>
      上の実験で分割数を 64 にしても、団子はほとんど変わりません。
      逆に細かくしすぎると、法線マップ（05章）で作った細かい凹凸と干渉してモアレます。
      クッキー.js には「型押しや格子は 0.3mm しかないので、幾何は低周波だけ、
      細かい起伏は法線マップに回す」と書いてあります。</p>
    </div>`,
  tryIt: [
    "「表と裏」に切り替えてから「巻き順を裏返す」を押し、色がどう変わるか見る。",
    "分割数を 4 まで下げて、団子が何角形になるか数える。",
    "「法線をなめらかにする」を切って、同じ形でも印象がどれだけ変わるか観察する。",
    "クッキー.js の中で「巻き順」という語を検索し、なぜ実測しているのか読む。"
  ]
},

/* ==================================================================
   05 テクスチャ
   ================================================================== */
{
  file: "ch05.html", no: "05", tag: "Texture", nav: "05 模様", color: "kitsune",
  title: "模様も、その場で描く",
  sub: "procedural texture — UV とテクスチャ生成",
  crumb: "第05章",
  recap: [
    "立体の表面と画像を対応づける座標を <b>UV</b> といいます。u が横、v が縦。",
    "このプロジェクトは画像を1枚も読み込まず、<b>1ピクセルずつ計算して描いて</b>います。",
    "描くのは色（アルベド）だけではありません。<b>光り方</b>と<b>凹凸</b>も別の画像として描きます。"
  ],
  html: `
    <p>
      立体ができたら、表面に模様を貼ります。そのために、
      立体の表面のどの点が画像のどの点に対応するかを決めておきます。これが <b>UV</b> です。
      回転体なら簡単で、<b>u は一周した角度、v は下から上への位置</b>にすればよい。
      04章で <code>uvs.push(j / M, t)</code> と書いていたのがそれです。
    </p>
    <p>
      次に画像を用意します。ふつうは写真を読み込みますが、このプロジェクトは
      <code>RawTexture</code> という「生の数値の配列」を作って、
      <b>1ピクセルずつ色を計算して詰めます</b>。パンケーキの焼き色なら、
      その位置のノイズを見て、焼けていれば茶色、焼けていなければ生地の淡い色、というふうに。
    </p>
    <figure>
<pre><span class="c">// 5. TextureLab : 焼き色を1ピクセルずつ描く（考え方だけを抜き出したもの）</span>
<span class="k">const</span> data = <span class="k">new</span> Uint8Array(S * S * <span class="n">4</span>);
<span class="k">for</span> (<span class="k">let</span> y = <span class="n">0</span>; y &lt; S; y++) <span class="k">for</span> (<span class="k">let</span> x = <span class="n">0</span>; x &lt; S; x++) {
    <span class="k">const</span> u = x / S, v = y / S;
    <span class="k">const</span> n = fbm(u * <span class="n">6</span>, v * <span class="n">6</span>, <span class="n">21</span>, <span class="n">5</span>);        <span class="c">// 焼きムラ</span>
    <span class="k">const</span> heat = clamp(bake * <span class="n">1.4</span> + (n - <span class="n">0.5</span>) * <span class="n">0.6</span>, <span class="n">0</span>, <span class="n">1</span>);
    <span class="k">const</span> c = heat &lt; <span class="n">0.5</span> ? mix3(DOUGH, GOLD,  heat * <span class="n">2</span>)
                        : mix3(GOLD,  BROWN, heat * <span class="n">2</span> - <span class="n">1</span>);
    <span class="k">const</span> i = (y * S + x) * <span class="n">4</span>;
    data[i] = c[<span class="n">0</span>] * <span class="n">255</span>; data[i+<span class="n">1</span>] = c[<span class="n">1</span>] * <span class="n">255</span>;
    data[i+<span class="n">2</span>] = c[<span class="n">2</span>] * <span class="n">255</span>; data[i+<span class="n">3</span>] = <span class="n">255</span>;
}</pre>
      <figcaption>1024×1024 なら100万回まわる。実行に数秒かかるのはこのため</figcaption>
    </figure>

    <h3>1枚では足りない。3枚要る</h3>
    <p>
      色の画像（<b>アルベド</b>）だけを貼っても、まだ紙に印刷したように見えます。
      同じ焼き菓子でも、焼けていない生地はざらついて光を散らし、型に押しつけられて焼けた面は少し光る。
      その差を伝えるのが2枚目の <b>ORM</b> です。
      R に陰り（AO）、G に粗さ（Roughness）、B に金属度（Metallic）を詰めた1枚の画像で、
      3つの情報を3つの色チャンネルに同居させています。
    </p>
    <p>
      3枚目が<b>法線マップ</b>。細かい凹凸を、頂点を増やさずに表現します。
      本当は平らなのに、法線だけを傾けて「でこぼこしている」と光に嘘をつく。
      パンケーキの気泡の穴も、クッキーの型押しも、これでやっています。
      クッキー.js には「型押しや格子は 0.3mm ほどしかない。頂点で出すとモアレるので、
      細かい起伏は法線マップに回す」とあります。
    </p>

    <div class="lab" id="lab06">
      <p class="lab-title">実験 — 3枚の画像を描き分ける</p>
      <div class="lab-cols side">
        <div class="controls">
          <div class="chips" id="texMap">
            <button class="chip" type="button" data-v="albedo" aria-pressed="true">色（アルベド）</button>
            <button class="chip" type="button" data-v="rough">粗さ（ORM の G）</button>
            <button class="chip" type="button" data-v="normal">凹凸（法線マップ）</button>
          </div>
          <div class="ctrl">
            <label for="texBake">焼き加減<span class="v" id="texBakeV">0.45</span></label>
            <input type="range" id="texBake" min="0" max="1" step="0.01" value="0.45">
          </div>
          <div class="ctrl">
            <label for="texPore">す（気泡）の多さ<span class="v" id="texPoreV">0.50</span></label>
            <input type="range" id="texPore" min="0" max="1" step="0.01" value="0.5">
          </div>
          <label class="switch"><input type="checkbox" id="texApplyOn" checked>立体に貼ってみる</label>
        </div>
        <canvas id="texCanvas" width="640" height="340" aria-label="パンケーキの天面のテクスチャ3枚と、それを貼った結果"></canvas>
      </div>
      <p class="hint">
        左が焼いている画像そのもの、右がそれを貼った結果。
        「粗さ」の画像は、白いほどざらざら（光らない）という意味です。
      </p>
    </div>

    <h3>継ぎ目をなくす</h3>
    <p>
      筒に模様を巻くと、一周して戻ったところで模様がぶつかります。
      03章で出てきた「u 方向に折り返すノイズ」はこのためのものです。
      さらに、04章で分割の列を M+1 本にしていたのも同じ理由で、
      <b>u=0 の頂点と u=1 の頂点を別々に持たせないと、継ぎ目の面で模様が逆走します</b>。
    </p>

    <h3>1cm あたりの画素の数をそろえる</h3>
    <p>
      ドーナツは、外周が約 22cm、穴のまわりが約 7cm です。
      ここに正方形の画像を貼ると、同じ1枚の画像が外周では3倍に引き伸ばされ、
      <b>気泡が外周でだけ横に伸びます</b>。ドーナツ.js はテクスチャを 2:1（u が長い）にして、
      1cm あたりの画素の数をなるべくそろえています。
      パンケーキ.js の側面も同じ考え方で、周長を約 5.8cm ごとのタイルに割り、
      1枚ぶんの実寸から画像の縦横比を決めています。
      画像の大きさは「何枚ぶんの細かさが要るか」ではなく、<b>その面の実際の寸法</b>から決めます。
    </p>
    <div class="trap">
      <span class="label">つまずきポイント</span>
      <p><b>法線マップの上下の符号は、環境によって逆です。</b>
      高さの画像から法線を作るとき、縦方向の差を <code>(hd - hu)</code> と書くか
      <code>(hu - hd)</code> と書くかで、凸が凹に化けます。
      Babylon.js は V が下向きなので前者。いくつものサンプルのコメントに、
      この符号を間違えて直した記録が残っています。</p>
      <p><b>1mm の粒は、テクスチャでは描けません。</b>
      ドーナツのカラースプレーを色の点として描くと、遠くから見たときミップマップで溶けて
      「色のにじんだ靄」になります。チョコバナナ.js やドーナツ.js が粒を1個ずつ実体として置いているのは、
      それが理由です（→ <a href="ch16.html">16章</a>）。</p>
      <p><b>気泡と割れ目を、暗い色で描かないでください。</b>
      ドーナツ.js とクッキー.js が同じことを書いています。割れ目の中や気泡の底は<b>焼けていない生地</b>なので、
      むしろ周囲より明るい。暗く見えるのは窪みの陰りのぶんで、それは ORM の R（AO）と法線マップの担当です。
      アルベドを暗く塗ると、カビか焦げ穴になります。</p>
    </div>`,
  tryIt: [
    "焼き加減を 0 から 1 まで動かし、3枚の画像がそれぞれどう変わるか見比べる。",
    "「粗さ」だけを見て、焦げた部分と白い部分のどちらが明るいか確かめ、その理由を考える。",
    "「立体に貼ってみる」を切り、画像だけを見たときに何の模様か分かるか試す。",
    "ドーナツ.js の doughOrm を開き、型に接した面と膨れた面で粗さがいくつからいくつまで変わるか読む。"
  ]
}

];
