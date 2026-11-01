/* =====================================================================
 *  おかしのつくりかた — ページ生成スクリプト
 *
 *  実行:  node tools/build.js   （リポジトリのどこからでも可）
 *
 *  生成するもの:
 *    ・index.html / start.html / ch01〜ch18.html /
 *      zukan.html / view.html / terms.html / play.html   … 全24ページ
 *    ・assets/src/*.src.js  … 15本のサンプルをビューア用に複製
 *                             （.gitignore 済み。再生成はこれで行う）
 *
 *  【注意】上記のファイルは毎回まるごと上書きされます。
 *          HTML を直接手で編集しても、次にこれを走らせると消えます。
 *          文章を直すときは tools/pages-1.js 〜 pages-4.js を、
 *          目次や図鑑の枠組みを直すときはこのファイルを直してください。
 *
 *  入力:
 *    ・tools/pages-1.js  … 00章と第I部（01〜05章）の本文
 *    ・tools/pages-2.js  … 第II部（06〜09章）の本文
 *    ・tools/pages-3.js  … 第III部（10〜14章）の本文
 *    ・tools/pages-4.js  … 第IV部（15〜16章）と第V部（17〜18章）の本文
 *    ・samples/*.js（15本）  … ビューア用の複製元
 *
 *  手書きで管理しているもの（このスクリプトは触りません）:
 *    ・assets/site.css / assets/labs.js / assets/play.js
 *
 *  なぜ assets/src が要るか:
 *    view.html と play.html は、まず fetch でリポジトリ直下の .js を読みます。
 *    ところが file:// でそのまま開くと fetch は必ず失敗します。
 *    そのときの控えとして、同じ中身を JS の文字列として持つ複製を用意します。
 * ===================================================================== */
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const SAMPLES = path.join(ROOT, "samples");
const SITE = "おかしのつくりかた";
const TAGLINE = "Babylon.js による、お菓子の手続き的モデリングの学習ノート";

const chapters = [].concat(require("./pages-1.js"), require("./pages-2.js"), require("./pages-3.js"), require("./pages-4.js"));

/* ---------------------------------------------------------------
   ナビゲーション
   章ページ + 資料ページ。すべてのページの上部に同じものが出る。
   --------------------------------------------------------------- */
const REF_PAGES = [
  { file: "zukan.html", nav: "図鑑" },
  { file: "view.html", nav: "ソース" },
  { file: "terms.html", nav: "用語" }
];

const NAV = [{ file: "index.html", nav: "目次" }]
  .concat(chapters.map((p) => ({ file: p.file, nav: p.nav })))
  .concat(REF_PAGES);

function nav(current) {
  return NAV.map((n) => {
    const cur = n.file === current ? ' aria-current="page"' : "";
    return '      <a href="' + n.file + '"' + cur + ">" + n.nav + "</a>";
  }).join("\n");
}

/* ---------------------------------------------------------------
   ページの外枠
   --------------------------------------------------------------- */
function shell(o) {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${o.title}</title>
<meta name="description" content="${o.desc}">
<link rel="stylesheet" href="assets/site.css">
${o.head || ""}<script src="assets/labs.js" defer></script>
</head>
<body>
<header class="topbar">
  <div class="topbar-in">
    <a class="brand" href="index.html">${SITE}<span class="dot">.</span></a>
    <nav class="navlinks" aria-label="章">
${nav(o.current)}
    </nav>
  </div>
</header>

${o.main}

<footer>
  <div class="wrap">
    <div><b>${SITE}</b> — ${TAGLINE}</div>
    <div><a href="index.html">目次へ戻る</a></div>
  </div>
</footer>
</body>
</html>
`;
}

/* ---------------------------------------------------------------
   章ページの部品
   --------------------------------------------------------------- */
function recapBox(items) {
  if (!items || !items.length) return "";
  return (
    '    <div class="recap">\n' +
    '      <span class="label">この章の3行まとめ</span>\n' +
    "      <ul>\n" +
    items.map((s) => "        <li>" + s + "</li>").join("\n") +
    "\n      </ul>\n    </div>\n"
  );
}

function tryBox(items) {
  if (!items || !items.length) return "";
  return (
    '\n    <div class="try">\n' +
    '      <span class="label">やってみよう</span>\n' +
    "      <ol>\n" +
    items.map((s) => "        <li>" + s + "</li>").join("\n") +
    "\n      </ol>\n    </div>\n"
  );
}

/* 前後の章。無い側は破線の空箱にして、左右の幅を保つ */
function pager(i) {
  const prev = i > 0 ? chapters[i - 1] : null;
  const next = i < chapters.length - 1 ? chapters[i + 1] : REF_PAGES[0];
  const nextTitle = next === REF_PAGES[0] ? "図鑑 どのファイルで、何が学べるか" : next.no + " " + next.title;
  const left = prev
    ? '    <a class="prev" href="' + prev.file + '"><span class="dir">← まえの章</span>' +
      '<span class="ttl">' + prev.no + " " + prev.title + "</span></a>"
    : '    <span class="prev none"></span>';
  return (
    '  <div class="pager">\n' + left + "\n" +
    '    <a class="next" href="' + next.file + '"><span class="dir">つぎの章 →</span>' +
    '<span class="ttl">' + nextTitle + "</span></a>\n" +
    "  </div>"
  );
}

function chapterPage(p, i) {
  const ch = "var(--p-" + p.color + ")";
  const main = `<main id="top" class="page">
<div class="wrap" style="--ch:${ch}">
  <p class="crumbs"><a href="index.html">目次</a><span class="sep">/</span>${p.crumb}</p>
<section class="chapter" id="${p.file.replace(".html", "")}" style="--ch:${ch}">
  <div class="chapter-head">
    <div class="chnum">${p.no}<small>${p.tag}</small></div>
    <div>
      <h2>${p.title}</h2>
      <p class="sub">${p.sub}</p>
    </div>
  </div>
  <div class="body">
${recapBox(p.recap)}${p.html}
${tryBox(p.tryIt)}
  </div>
</section>
${pager(i)}
</div>
</main>`;
  return shell({
    title: p.title + " — " + SITE,
    desc: p.title,
    current: p.file,
    main: main
  });
}

/* ---------------------------------------------------------------
   トップページ
   --------------------------------------------------------------- */
function hubCard(p) {
  return `      <a class="hubcard" href="${p.file}" style="--ch:var(--p-${p.color})">
        <span class="no">${p.no}<span style="opacity:.55;margin-left:8px">${p.tag}</span></span>
        <h3>${p.title}</h3>
        <p>${p.lede}</p>
      </a>`;
}

/* トップの各カードに出す1行。章の見出しだけでは中身が分からないので別に持つ */
const LEDE = {
  "start.html": "インストールなし。ブラウザだけで15本を動かす手順。まずここから。",
  "ch01.html": "モデルファイルも写真も読み込まず、実行した瞬間に座標と模様を計算で作る。章はお菓子の作り方の順。",
  "ch02.html": "Math.random() を使わない理由。型で焼くクッキーと1本ずつ違うバナナでは、揺らす幅も違う。",
  "ch03.html": "となり合う値がなめらかにつながる乱数。重ねると焼きムラや生地の肌理になる。",
  "ch04.html": "3Dモデルの正体は座標の配列と三角形の番号表。裏返ると立体が消える理由。",
  "ch05.html": "UVで立体と画像を対応させ、模様を1ピクセルずつ計算で描く。色・光り方・凹凸の3枚。",
  "ch06.html": "団子もプリンもドーナツも、断面を1枚描いて回す。クッキー7種は外形と断面の数値だけで作り分ける。",
  "ch07.html": "チョコバナナは弓なり。先に軸を決めて断面を並べる。軸を閉じればロールケーキ、螺旋にすれば絞り出し。",
  "ch08.html": "団子は真球では積めない。潰した体積の行き先と、接触の縁の土手。",
  "ch09.html": "飴細工のウサギは回しても作れない。距離関数を溶かし合わせ、格子から面を張る。",
  "ch10.html": "焼き色は塗らない。鉄板に触れた所、薄い所、出っぱった所。熱の届き方を足して地図にする。",
  "ch11.html": "「照っている」「粉をふいている」を数値で書く。チョコの照りは粗さではなく膜。",
  "ch12.html": "たれを茶色く塗ると光沢のない卵になる。みたらしもシロップも、色は厚みから解くもの。",
  "ch13.html": "ゼリーを緑に塗るとプラスチックになる。色は、光が中を通った距離から解く。",
  "ch14.html": "同じお菓子でも光で別物になる。白い皿は 0.88、透けるものは映すものまで含めて光。",
  "ch15.html": "皿への盛り付けは手で置かない。クッキーは落とし、ドーナツは穴を残し、月見団子は物理を使わずに積む。",
  "ch16.html": "スプレーはテクスチャに描くと消える。振った向きの側にだけ付けて、半分沈める。",
  "ch17.html": "Havok にやわらかい物体は無い。減衰するばね6本の重ね合わせで、プリンを揺らす。",
  "ch18.html": "綿菓子には表面が無い。帯に沿った3万本の糸を線で描き、芯の深度で裏を隠す。"
};

/* 目次の部立て。章番号の範囲と見出し */
const PARTS = [
  { from: 1, to: 5, no: "第I部", en: "PART I", color: "donut", id: "chapters",
    title: "道具をそろえる（01〜05）",
    sub: "どのお菓子のファイルにも、同じ場所に入っているもの",
    text: "乱数・ノイズ・面と法線・テクスチャ。お菓子の種類に関係なく、15本すべての土台になっている道具です。" +
          "ここだけはファイルの層（CONFIG → Rng → Noise → Mesh utils → TextureLab）の順に並んでいます。" },
  { from: 6, to: 9, no: "第II部", en: "PART II", color: "sakura", id: "chapters2",
    title: "かたちをつくる（06〜09）",
    sub: "回す・型で抜く・曲げる・潰す・溶かす",
    text: "お菓子の形は、作り方についてきます。ろくろのように回すもの（団子・プリン・ドーナツ）、" +
          "型で抜くもの（クッキー・チョコレート・たい焼き）、曲げて巻いて絞るもの（チョコバナナ・ロールケーキ）、" +
          "押されて潰れるもの（月見団子）、練って継ぎ目なく溶かし合わせるもの（飴細工・アイス）。" },
  { from: 10, to: 14, no: "第III部", en: "PART III", color: "taiyaki", id: "chapters3",
    title: "焼いて、掛けて、透かす（10〜14）",
    sub: "形が同じでも、質感で別のお菓子になる",
    text: "焼き色は熱の届き方、照りは膜、たれとシロップの色は厚み、ゼリーの色は光が通った距離。" +
          "どれも<b>色を塗らずに、理由から計算する</b>のが共通の方針です。最後に、それを撮る光を決めます。" },
  { from: 15, to: 16, no: "第IV部", en: "PART IV", color: "kuri", id: "chapters4",
    title: "皿にのせる（15〜16）",
    sub: "盛り付けと、トッピング",
    text: "クッキーは落として積み、ドーナツは穴を残して重ね、月見団子は決まった形に積む。" +
          "仕上げのスプレーやチョコチップは、振った向きの側にだけ付いて、半分沈みます。" },
  { from: 17, to: 18, no: "第V部", en: "PART V", color: "melon", id: "chapters5",
    title: "硬い面の外へ（17〜18）",
    sub: "揺れるものと、表面の無いもの",
    text: "プリンとゼリーは<b>揺れる</b>のに、物理エンジンには硬い物体しかない。" +
          "綿菓子には、そもそも<b>表面が無い</b>。点を並べて三角形を張る、というここまでの前提の外側です。" }
];

function indexPage() {
  const cards = (list) =>
    list.map((p) => hubCard(Object.assign({}, p, { lede: LEDE[p.file] || p.sub }))).join("\n");
  const partSection = (pt) => `<section class="chapter" id="${pt.id}" style="--ch:var(--p-${pt.color})">
  <div class="chapter-head">
    <div class="chnum" style="font-size:15px">${pt.no}<small style="opacity:.7">${pt.en}</small></div>
    <div>
      <h2>${pt.title}</h2>
      <p class="sub">${pt.sub}</p>
    </div>
  </div>
  <div class="body">
    <p>
      ${pt.text}
    </p>
  </div>
  <div class="body" style="max-width:none">
    <div class="hub">
${cards(chapters.filter((p) => Number(p.no) >= pt.from && Number(p.no) <= pt.to))}
    </div>
  </div>
</section>`;

  const main = `<main id="top" class="page">
<section class="hero">
  <div class="hero-grid">
    <div>
      <p class="eyebrow">Babylon.js / procedural sweets</p>
      <h1>3Dのお菓子は、<br><span class="accent">数式から焼ける</span>。</h1>
      <p class="lede">
        このサイトで扱う15本のプログラムは、3Dモデルも写真も1枚も読み込みません。
        点の座標を計算で並べ、焼き色をその場で描き、たれの濃さを厚みから解く。
        絵を描く技術ではなく、形と質感を組み立てる技術です。
        中学・高校の数学で追えるところから順に見ていきます。
      </p>
      <div class="hero-cta">
        <a class="btn" href="start.html">まず動かしてみる</a>
        <a class="btn ghost" href="ch01.html">01章から読む</a>
        <button class="btn ghost" id="heroReplay" type="button">もう一度焼く</button>
      </div>
    </div>
    <div class="stage">
      <canvas id="heroCanvas" width="640" height="480" aria-label="ドーナツが断面から立体へ組み上がり、焼き色がついて、チョコに浸かる様子"></canvas>
      <div class="stage-caption">
        <b id="heroStage">準備中</b>
        <span id="heroCount">0 頂点</span>
      </div>
    </div>
  </div>
</section>

<div class="wrap">

<section class="chapter" id="howto" style="--ch:var(--p-kitsune);border-top:0;padding-top:34px">
  <div class="chapter-head">
    <div class="chnum" style="font-size:15px">読み方<small style="opacity:.7">HOW TO</small></div>
    <div>
      <h2>このサイトの使い方</h2>
      <p class="sub">上から順でも、気になる章からでも</p>
    </div>
  </div>
  <div class="body">
    <p>
      各章には<b>その場で動かせる実験</b>がついています。スライダーを動かすと、
      文章で説明していることが目の前で起きます。読むより先に、まず動かしてください。
      むずかしい言葉は<a href="terms.html">用語集</a>にまとめてあります。
    </p>
    <ul class="roadmap">
      <li><span class="rn">A</span><span class="rt"><b>とにかく動かしたい人</b><span><a href="zukan.html">図鑑</a>の写真を押す → そのお菓子がこのサイトの中で動きます</span></span></li>
      <li><span class="rn">B</span><span class="rt"><b>順番に理解したい人</b><span>01 → 02 → 03 …… と上から。お菓子作りと同じ順番で、道具 → 形 → 焼き・掛け → 盛り付け → 揺れと糸、と進みます。04章（面と法線）と06章（回す・型で抜く）がこの教材の背骨です。</span></span></li>
      <li><span class="rn">C</span><span class="rt"><b>作りたいお菓子が決まっている人</b><span><a href="ch01.html">01章</a>の表で、そのお菓子の作り方（回す・型で抜く・焼く・掛ける……）から章を引いてください。たとえばドーナツなら <a href="ch06.html">06</a> → <a href="ch10.html">10</a> → <a href="ch15.html">15</a> → <a href="ch16.html">16</a>。</span></span></li>
      <li><span class="rn">D</span><span class="rt"><b>コードを読みたい人</b><span><a href="view.html">ソース</a>でファイルを選ぶ → 対応する章に戻る</span></span></li>
    </ul>
    <div class="note">
      <b>必要な数学。</b>
      sin・cos（三角関数）、座標、比例、指数関数（<code>exp</code>）、
      それに少しだけベクトル（内積・外積）。
      高校1年までの内容でだいたい追えます。出てきたところで、そのつど説明します。
    </div>
    <div class="note">
      <b>姉妹編があります。</b>
      このサイトは、料理30本を扱った<a href="https://cx20.github.io/VirtualFoodCourt/"><b>「たべもののつくりかた」</b></a>（VirtualFoodCourt）から、
      甘いものだけを別腹として切り出したものです。野菜と果物を扱った<b>「やさいのつくりかた」</b>（VirtualVegetablePlant）もあります。
      乱数・ノイズ・面と法線のような道具は3つとも共通ですが、このサイトの章立てと例は、すべてお菓子の15本から取っています。
    </div>
  </div>
</section>

${PARTS.map(partSection).join("\n\n")}

<section class="chapter" id="refs" style="--ch:var(--p-karaage)">
  <div class="chapter-head">
    <div class="chnum" style="font-size:15px">資料<small style="opacity:.7">REFERENCE</small></div>
    <div>
      <h2>15本を引く</h2>
      <p class="sub">ファイルから逆に読みたいとき</p>
    </div>
  </div>
  <div class="body" style="max-width:none">
    <div class="hub">
      <a class="hubcard" href="zukan.html" style="--ch:var(--p-koge)">
        <span class="no">15<span style="opacity:.55;margin-left:8px">FILES</span></span>
        <h3>どのファイルで、何が学べるか</h3>
        <p>15本それぞれの「そこでしか出てこない技術」の一覧。カードから、その場で動かせます。</p>
      </a>
      <a class="hubcard" href="view.html" style="--ch:var(--p-karaage)">
        <span class="no">SRC<span style="opacity:.55;margin-left:8px">SOURCE</span></span>
        <h3>サンプルのソースを読む</h3>
        <p>15本の .js をその場で表示。コピーすれば、そのまま Playground に貼れます。</p>
      </a>
      <a class="hubcard" href="terms.html" style="--ch:var(--p-choco)">
        <span class="no">用語<span style="opacity:.55;margin-left:8px">GLOSSARY</span></span>
        <h3>コードに出てくる言葉</h3>
        <p>法線、UV、巻き順、ORM、メイラード……最初の1周で引っかかる言葉だけ。検索できます。</p>
      </a>
    </div>
  </div>
</section>

</div>
</main>`;

  return shell({
    title: SITE + " — コードでお菓子をつくる技術ノート",
    desc: "Babylon.js でお菓子を手続き的に生成する15本のサンプルを、中学生・高校生向けに解説する学習ポータル",
    current: "index.html",
    main: main
  });
}

/* ---------------------------------------------------------------
   図鑑 / ソースビューア / 用語集 / 実行ページ
   --------------------------------------------------------------- */
function zukanPage() {
  const LAST = chapters[chapters.length - 1];
  const main = `<main id="top" class="page">
<div class="wrap" style="--ch:var(--p-koge)">
  <p class="crumbs"><a href="index.html">目次</a><span class="sep">/</span>図鑑</p>
<section class="chapter" id="zukan" style="--ch:var(--p-koge)">
  <div class="chapter-head">
    <div class="chnum">15<small>FILES</small></div>
    <div>
      <h2>どのファイルで、何が学べるか</h2>
      <p class="sub">15本それぞれに、そこでしか出てこない技術がある</p>
    </div>
  </div>
  <div class="body" style="max-width:none">
    <p style="max-width:70ch">
      写真は<b>実際に動かした結果</b>です。1枚も画像を読み込まず、
      すべてその場で計算して描かれています。
      <b>写真を押すと、そのサンプルがこのサイトの中で動きます</b>
      （形も模様もその場で作るので、出てくるまで数秒〜十数秒かかります）。
      左の色帯は、そのファイルのコードに実際に書かれている色。
      同じ枠組みなのに、担当する「難所」が1本ずつ違います。
    </p>
  </div>
  <div class="catalog" id="catalog"></div>
</section>
  <div class="pager">
    <a class="prev" href="${LAST.file}"><span class="dir">← まえの章</span><span class="ttl">${LAST.no} ${LAST.title}</span></a>
    <a class="next" href="view.html"><span class="dir">つぎへ →</span><span class="ttl">SRC サンプルのソースを読む</span></a>
  </div>
</div>
</main>`;
  return shell({
    title: "どのファイルで、何が学べるか — " + SITE,
    desc: "15本の一覧と、それぞれの難所",
    current: "zukan.html",
    // tools/shoot.js が書き出したサムネイル一覧。無ければカードだけ出る
    head: '<script src="assets/thumbs/thumbs.js" defer></script>\n',
    main: main
  });
}

function viewPage() {
  const main = `<main id="top" class="page">
<div class="wrap" style="--ch:var(--p-karaage)">
  <p class="crumbs"><a href="index.html">目次</a><span class="sep">/</span>ソースを読む</p>
<section class="chapter" id="view" style="--ch:var(--p-karaage)">
  <div class="chapter-head">
    <div class="chnum" style="font-size:13px">src<small style="opacity:.7">SOURCE</small></div>
    <div>
      <h2>サンプルのソースを読む</h2>
      <p class="sub">15本の .js を、そのまま表示します</p>
    </div>
  </div>
  <div class="body" style="max-width:none">
    <p style="max-width:70ch">
      読みたいファイルを選んでください。行番号つきで全文が出ます。
      <b>「コードをコピー」</b>を押せばファイルまるごとがクリップボードに入るので、
      そのまま <a href="https://playground.babylonjs.com/" target="_blank" rel="noopener">Babylon.js Playground</a>
      に貼れば動きます（→ <a href="start.html">00 まず動かしてみる</a>）。
      行番号はコピーに含まれません。
    </p>

    <div class="filechips" id="viewChips"></div>

    <div class="viewer">
      <div class="viewer-bar">
        <b id="viewTitle">—</b>
        <span class="d" id="viewDesc"></span>
        <span class="meta" id="viewMeta"></span>
        <button class="chip" type="button" id="viewCopy">コードをコピー</button>
        <a id="viewPlay" href="play.html">▶ 動かす</a>
        <a id="viewRaw" href="#" target="_blank" rel="noopener">別のタブで開く ↗</a>
      </div>
      <div class="codewrap" id="viewWrap">
        <pre class="gutter" id="viewGutter" aria-hidden="true"></pre>
        <pre class="code"><code id="viewCode"></code></pre>
      </div>
    </div>

    <div class="body" style="margin-top:34px">
      <h3>どこを読めばいいか</h3>
      <p>
        どのファイルも、先頭に「構成」というコメントがあります。
        並びはだいたい共通なので、番号とこのサイトの章を対応させておきます。
      </p>
      <table>
        <tr><th>ファイル内の番号</th><th>中身</th><th>対応する章</th></tr>
        <tr><td>0. CONFIG</td><td>種類プリセット。焼き加減や寸法の数値</td><td><a href="ch01.html">01 手続き生成</a></td></tr>
        <tr><td>1. Rng</td><td>シード付き擬似乱数</td><td><a href="ch02.html">02 乱数</a></td></tr>
        <tr><td>2. Noise</td><td>値ノイズ / 周期ノイズ / fBm / セルノイズ</td><td><a href="ch03.html">03 ノイズ</a></td></tr>
        <tr><td>3. Mesh utils</td><td>巻き順の判定・法線の溶接・掃引</td><td><a href="ch04.html">04 面と法線</a> / <a href="ch07.html">07 曲がり</a></td></tr>
        <tr><td>4. Profile / Section / Shape / Outline</td><td>断面のテーブル、外形、閉じた輪郭</td><td><a href="ch06.html">06 回す・型で抜く</a> / <a href="ch07.html">07 曲がり</a></td></tr>
        <tr><td>（Profile のあと）Jiggle / Flute</td><td>揺れのモード、菊型の溝と光路長（プリン・ゼリー）</td><td><a href="ch17.html">17 揺れ</a> / <a href="ch13.html">13 透け</a></td></tr>
        <tr><td>距離関数 / サーフェスネット</td><td>部品を溶かし合わせた形と、格子からの面張り（アイス・飴細工）</td><td><a href="ch09.html">09 塊</a></td></tr>
        <tr><td>乱数・曲面 / 芯と糸 / シェーダ</td><td>帯を巻いた回転体と、その上に並べる糸（綿菓子）</td><td><a href="ch18.html">18 糸</a></td></tr>
        <tr><td>5. TextureLab</td><td>アルベド・ORM・法線・厚みの生成。焼き色の場とたれの吸収もここ</td><td><a href="ch05.html">05 模様</a> / <a href="ch10.html">10 焼き色</a> / <a href="ch12.html">12 たれ</a></td></tr>
        <tr><td>6〜7. 本体 / トッピング</td><td>そのお菓子そのものの組み立てと、上に乗るもの</td><td><a href="ch16.html">16 トッピング</a></td></tr>
        <tr><td>7〜8. 皿 / 板 / トレイ / 盛り付け</td><td>器と、その上への配置</td><td><a href="ch15.html">15 盛り付け</a> / <a href="ch08.html">08 潰れ</a></td></tr>
        <tr><td>8〜9. Scene</td><td>光・影・露出・被写界深度</td><td><a href="ch14.html">14 光</a></td></tr>
        <tr><td>9〜10. GUI</td><td>右下のスライダー</td><td>—</td></tr>
      </table>
      <div class="note">
        <b>コメントの【対策】を探してみてください。</b>
        これは「一度失敗して直した記録」です。なぜその数値なのか、なぜその順番なのかが、
        たいていそこに書いてあります。このサイトの各章にある「つまずきポイント」は、
        ほとんどがここから拾ってきたものです。
        クッキー.js のように、cookie-A → A2 → A3 と直してきた記録がそのまま残っているファイルもあります。
      </div>
    </div>
  </div>
</section>
  <div class="pager">
    <a class="prev" href="zukan.html"><span class="dir">← まえへ</span><span class="ttl">15 どのファイルで、何が学べるか</span></a>
    <a class="next" href="terms.html"><span class="dir">つぎへ →</span><span class="ttl">用語 コードに出てくる言葉</span></a>
  </div>
</div>
</main>`;
  return shell({ title: "サンプルのソースを読む — " + SITE, desc: "15本の .js を行番号つきで表示します", current: "view.html", main: main });
}

/* 用語。左が語、右が意味。labs.js が絞り込みを付ける */
const TERMS = [
  ["メッシュ", "頂点と三角形でできた立体そのもの。"],
  ["頂点 / positions", "点の座標。x,y,z の3つずつ一列に並べる。"],
  ["indices", "どの点とどの点で三角形を作るかの番号表。"],
  ["法線 / normal", "面がどちらを向いているかの矢印。明るさを決める（<a href=\"ch04.html\">04章</a>）。"],
  ["巻き順", "三角形の頂点を並べる向き。表裏を決める。裏返ると立体が消える。"],
  ["溶接 / weld", "同じ場所にある頂点の法線を平均して揃えること。つなぎ目の線が消える。"],
  ["UV", "立体の表面と画像の座標の対応。u=横、v=縦（<a href=\"ch05.html\">05章</a>）。"],
  ["掃引 / sweep", "断面を軸に沿って並べてつなぎ、立体にすること（<a href=\"ch07.html\">07章</a>）。"],
  ["スパイン / 軸", "掃引するときの背骨になる曲線。チョコバナナの弓なりはこれ（<a href=\"ch07.html\">07章</a>）。"],
  ["プロファイル / 断面", "形の横顔。半径や高さの表（<a href=\"ch06.html\">06章</a>）。"],
  ["回転体", "断面を軸のまわりに1周させて作る立体。団子・プリン・ドーナツ（<a href=\"ch06.html\">06章</a>）。"],
  ["スーパー楕円", "指数 n で丸から四角まで連続に変わる輪郭。チョコとクッキーの外形に使う（<a href=\"ch06.html\">06章</a>）。"],
  ["SDF", "その点が形の内か外か、境界からどれだけ離れているかを返す関数。たい焼きの外形、飴細工のウサギ（<a href=\"ch09.html\">09章</a>）。"],
  ["サーフェスネット", "格子で測った距離の場から面を張る手法。符号が変わるセルに頂点を1つ置き、四角形でつなぐ（<a href=\"ch09.html\">09章</a>）。"],
  ["シード", "乱数の出発点になる整数。同じなら同じ結果（<a href=\"ch02.html\">02章</a>）。"],
  ["擬似乱数", "計算で作る、規則があるのに規則が見えない数列。mulberry32 を使っている。"],
  ["ノイズ", "となり合う値がなめらかにつながる乱数。自然な模様のもと（<a href=\"ch03.html\">03章</a>）。"],
  ["fBm / オクターブ", "細かさを半分ずつにしたノイズを重ねる手法。枚数をオクターブという。"],
  ["セルノイズ", "空間を細胞状に区切るノイズ。クッキーの割れ目に使う。"],
  ["アルベド", "影も光沢もない、素の色。"],
  ["ORM", "陰り・粗さ・金属度を R,G,B に詰めた1枚の画像。"],
  ["粗さ / roughness", "表面のざらつき。0 で鏡、1 で完全なつや消し。"],
  ["PBR", "現実の光の法則に沿った質感の表し方（<a href=\"ch11.html\">11章</a>）。"],
  ["クリアコート", "表面にかかった透明な膜。チョコの照り・アイシング・団子の濡れ艶。焼き菓子の生地には付けない（<a href=\"ch11.html\">11章</a>）。"],
  ["SSS / subSurface", "光が中に入って散る現象。薄い部分が透ける。プリンらしさの大半はこれ（<a href=\"ch11.html\">11章</a>）。"],
  ["thickness テクスチャ", "その点の厚みを焼いておいた画像。透け具合を決める。"],
  ["sheen", "布のように、縁がふわっと光る反射。団子の粉っぽさや、ドーナツの乾いた面。"],
  ["法線マップ", "細かい凹凸を、頂点を増やさず法線だけで表す画像。"],
  ["視差 / parallax", "法線マップより一歩進んで、見る角度で凹凸がずれて見える手法。"],
  ["メイラード反応", "焼き色がつく化学反応。熱が届いた所ほど濃い（<a href=\"ch10.html\">10章</a>）。"],
  ["吸収 / extinction", "透明なものを光が通るとき、距離に応じて減る量。たれの色を決める（<a href=\"ch12.html\">12章</a>）。"],
  ["AO / アンビエントオクルージョン", "狭い所や谷が暗くなる効果。"],
  ["SSAO", "画面上で隣り合う面から AO を推定する後処理。細かい谷には効かない。"],
  ["焼き込み / bake", "実行時に計算せず、あらかじめ求めてテクスチャや頂点色に入れておくこと。"],
  ["インスタンス", "同じ形を1個だけ作り、位置・向き・色を配って何百個も描く仕組み（<a href=\"ch16.html\">16章</a>）。"],
  ["頂点カラー", "頂点そのものが持つ色。栗饅頭の焼き色はこれだけで付けてある（<a href=\"ch10.html\">10章</a>）。"],
  ["smin", "なめらかな最小値。角を作らずに2つの形をつなぐ（<a href=\"ch08.html\">08章</a>・<a href=\"ch09.html\">09章</a>）。"],
  ["ソフトボディ", "押すと形が変わる物体の物理。Havok には無いので、プリンの揺れは自前で計算する（<a href=\"ch17.html\">17章</a>）。"],
  ["モード / モーダル変形", "揺れ方を決まった数パターンに限り、その重ね合わせで変形を表す方法（<a href=\"ch17.html\">17章</a>）。"],
  ["減衰比 ζ", "揺れがどれだけ早く収まるか。プリン 0.105、ゼリー 0.055。大きいと寒天、小さいとゴム（<a href=\"ch17.html\">17章</a>）。"],
  ["深度プリパス", "色を描く前に深度だけ書いておくこと。半透明の芯の奥にある糸が描かれなくなる（<a href=\"ch18.html\">18章</a>）。"],
  ["光路長", "光が物の中を通った距離。ゼリーの色はこれで決まる（<a href=\"ch13.html\">13章</a>）。"],
  ["屈折 / refraction", "透明な物を通る光が曲がること。ゼリーやガラスの向こうが歪んで見える。"],
  ["凸包 / convex hull", "でっぱりだけを包んだ袋のような形。物理の当たり判定に使う。"],
  ["Havok", "Babylon.js が使う物理エンジンの名前（<a href=\"ch15.html\">15章</a>）。"],
  ["緩和 / relaxation", "重なりを少しずつ押し離す反復計算。物理を使わない配置に使う。"],
  ["IBL", "まわりの環境そのものを光として当てる方法（<a href=\"ch14.html\">14章</a>）。"],
  ["露出 / exposure", "画面全体の明るさ。カメラの露出と同じ意味。"],
  ["トーンマッピング", "1 を超えた明るさを、切り落とさずになめらかに畳む変換。ACES を使う。"],
  ["被写界深度", "ピントの合う範囲。単位が m で計算されるので cm 系では 1000 を掛ける。"],
  ["Playground", "ブラウザ上で Babylon.js のコードを試せる公式サイト。"],
  ["Inspector", "Playground の右上から開くデバッグ画面。シーンの中身を一覧して、値をその場で変えられる。"],
  ["Scene Explorer", "Inspector の左側。シーンにあるメッシュ・材質・テクスチャの木。"],
  ["Picker", "Scene Explorer の照準ボタン。画面をクリックして、そこにある物を選ぶ機能。"],
  ["pick / レイキャスト", "画面の座標からシーンへ光線を飛ばして、最初に当たった面を調べること。Picker の中身。"],
  ["name と id", "メッシュにつく2つの名前。<code>new BABYLON.Mesh(name)</code> は id にも同じ値を入れるので、名前を変えるだけでは id が残る（<a href=\"ch16.html\">16章</a>）。"],
  ["layerMask", "カメラとメッシュに付ける印。合わない組み合わせは描かれない。GUI を分けるのに使う。"],
  ["ギズモ", "Inspector で選んだ物に出る、動かすための矢印や輪。"],
  ["ポストプロセス", "描き終えた絵にあとから掛ける処理。Bloom（にじみ）や被写界深度（ぼけ）など（<a href=\"ch14.html\">14章</a>）。"],
  ["焼き色の場", "場所ごとに「どれだけ焼けたか」を表す数値。色・粗さ・凹凸の3枚に同じ値を配る（<a href=\"ch10.html\">10章</a>）。"],
  ["付着確率", "トッピングがそこに付くかどうか。面の法線と振りかけた向きの内積で決める（<a href=\"ch16.html\">16章</a>）。"],
  ["実反射率", "白い物が本当に返す光の割合。白磁で 0.88 前後。1.0 に近づけると露出を上げたとき真っ先に飛ぶ（<a href=\"ch14.html\">14章</a>）。"]
];

function termsPage() {
  const rows = TERMS.map((t) => "      <tr><td>" + t[0] + "</td><td>" + t[1] + "</td></tr>").join("\n");
  const main = `<main id="top" class="page">
<div class="wrap" style="--ch:var(--p-choco)">
  <p class="crumbs"><a href="index.html">目次</a><span class="sep">/</span>用語集</p>
<section class="chapter" id="terms" style="--ch:var(--p-choco)">
  <div class="chapter-head">
    <div class="chnum">用語<small>GLOSSARY</small></div>
    <div>
      <h2>コードに出てくる言葉</h2>
      <p class="sub">最初の1周で引っかかりやすいものだけ</p>
    </div>
  </div>
  <div class="body">
    <input type="search" class="termsearch" id="termFilter" placeholder="言葉で絞り込む（例：法線、シード、焼き）">
    <table id="termTable">
      <tr><th>語</th><th>意味</th></tr>
${rows}
    </table>
    <div class="note">
      ここに無い言葉は、たいていサンプルのコメントに説明があります。
      <a href="view.html">ソースを読む</a>のページで、その語を含む行を探してみてください。
    </div>
  </div>
</section>
  <div class="pager">
    <a class="prev" href="view.html"><span class="dir">← まえへ</span><span class="ttl">SRC サンプルのソースを読む</span></a>
    <a class="next" href="index.html"><span class="dir">つぎへ →</span><span class="ttl">目次へ戻る</span></a>
  </div>
</div>
</main>`;
  return shell({ title: "コードに出てくる言葉 — " + SITE, desc: "用語集", current: "terms.html", main: main });
}

function playPage() {
  const main = `<main id="top" class="page">
<div class="wrap" style="--ch:var(--p-kitsune)">
  <p class="crumbs"><a href="index.html">目次</a><span class="sep">/</span><a href="zukan.html">図鑑</a><span class="sep">/</span>実行</p>
  <section class="chapter" id="play" style="--ch:var(--p-kitsune);padding-top:26px">
    <div class="chapter-head">
      <div class="chnum" style="font-size:13px">RUN<small style="opacity:.7">PLAY</small></div>
      <div>
        <h2 id="playTitle">—</h2>
        <p class="sub">このページで、サンプルがそのまま動いています</p>
      </div>
    </div>
    <div class="body" style="max-width:none">
      <div class="playbar">
        <span id="playState">準備中…</span>
        <a id="playSrc" href="view.html">ソースを読む →</a>
        <a id="playRaw" href="#" target="_blank" rel="noopener">.js を直接開く ↗</a>
        <a href="zukan.html">図鑑へ戻る</a>
      </div>
      <div class="playstage" id="playStage">
        <canvas id="playCanvas" touch-action="none"></canvas>
      </div>
      <p class="hint" style="margin-top:10px">
        3Dモデルも写真も読み込んでいません。このページを開いた瞬間に、
        座標も焼き色も計算で作られています。1024×1024 のテクスチャを何枚も焼くので、
        出てくるまで十数秒かかることがあります。
        右下のつまみで種類や焼き加減を変えると、その場で作り直されます。
      </p>
    </div>
  </section>
</div>
</main>`;
  return shell({
    title: "サンプルを動かす — " + SITE,
    desc: "選んだサンプルをその場で実行します",
    current: "zukan.html",
    head: '<script src="assets/play.js" defer></script>\n',
    main: main
  });
}

/* ---------------------------------------------------------------
   ビューア用の複製（assets/src/*.src.js）
   file:// で開いたときは fetch が使えないので、
   同じ中身を JS の文字列として持つ控えを作っておく。
   --------------------------------------------------------------- */
function buildSrc() {
  const outDir = path.join(ROOT, "assets", "src");
  fs.mkdirSync(outDir, { recursive: true });

  const samples = fs.readdirSync(SAMPLES)
    .filter((f) => f.endsWith(".js"))
    .sort();

  // 前回の残り（消したサンプルの控え）を掃除する
  fs.readdirSync(outDir).forEach((f) => {
    if (f.endsWith(".src.js") && samples.indexOf(f.replace(/\.src\.js$/, ".js")) < 0) {
      fs.unlinkSync(path.join(outDir, f));
    }
  });

  samples.forEach((f) => {
    const text = fs.readFileSync(path.join(SAMPLES, f), "utf8");
    const body =
      "/* tools/build.js が作った複製。手で直さないこと（元は ../../samples/" + f + "） */\n" +
      "window.__SRC = window.__SRC || {};\n" +
      "window.__SRC[" + JSON.stringify(f) + "] = " + JSON.stringify(text) + ";\n";
    fs.writeFileSync(path.join(outDir, f.replace(/\.js$/, ".src.js")), body);
  });
  return samples;
}

/* ---------------------------------------------------------------
   実行
   --------------------------------------------------------------- */
/* 姉妹編「たべもののつくりかた」のサンプル。本文に「○○.js」と出てきたら、そちらのソースビューアへつなぐ。
   本文の例はすべてお菓子の15本から取っているので、いまは使われていない。
   たべもの編のファイルを引き合いに出したくなったときのために残してある。
   <pre> の中・既にあるリンクの中・タグの属性は触らない */
const SISTER = {
  base: "https://cx20.github.io/VirtualFoodCourt/",
  files: ["うどん", "おでん", "お味噌汁", "お寿司", "ご飯", "そば", "たこ焼き", "とんかつ",
          "ウィンナー", "エッグトースト", "エビフライ", "カレー", "コロッケ",
          "スパゲッティ（カルボナーラ）", "スパゲッティ（トマトソース）", "スパゲッティ（ナポリタン）",
          "チャーハン", "トースト", "ハンバーガー", "フランスパン", "ラーメン", "唐揚げ", "天ぷら",
          "焼きそば", "焼き魚（サンマ）", "焼き魚（鮭）", "牛丼", "生姜焼き", "肉じゃが", "餃子"]
};
const SISTER_RE = new RegExp("(" + SISTER.files.map((f) => f.replace(/[()（）]/g, "\\$&")).join("|") + ")\\.js", "g");

function linkSister(html) {
  let skip = 0;
  return html.split(/(<[^>]+>)/).map((t) => {
    if (t.startsWith("<")) {
      if (/^<(pre|a|script|textarea)[\s>]/i.test(t)) skip++;
      else if (/^<\/(pre|a|script|textarea)>/i.test(t)) skip--;
      return t;
    }
    if (skip > 0) return t;
    return t.replace(SISTER_RE, (all) =>
      '<a href="' + SISTER.base + "view.html?f=" + encodeURIComponent(all) + '" title="姉妹編「たべもののつくりかた」のソース">' + all + "</a>");
  }).join("");
}

function write(file, html) {
  html = linkSister(html);
  fs.writeFileSync(path.join(ROOT, file), html);
  console.log("  " + file);
}

console.log("ページを書き出します:");
write("index.html", indexPage());
chapters.forEach((p, i) => write(p.file, chapterPage(p, i)));
write("zukan.html", zukanPage());
write("view.html", viewPage());
write("terms.html", termsPage());
write("play.html", playPage());

console.log("ビューア用の複製を作ります:");
const samples = buildSrc();
console.log("  assets/src/*.src.js … " + samples.length + " 本");

console.log("\n完了。" + (chapters.length + 5) + " ページ / サンプル " + samples.length + " 本");
