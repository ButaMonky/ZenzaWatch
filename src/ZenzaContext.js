// Task1067（ES モジュール化 第3段階の1）: 起動の関数（_template.js の monkey）の中で作っていた ZenzaWatch と global を、
// ここで「空の入れ物」として先に作る。中身は今までどおり monkey の中の同じ場所で Object.assign で入れる。
// 各部品はこの2つを import すれば、ES モジュールのままでも同じ入れ物を受け取れる（第4段階で import 先をここへ移す）。
// 入れ物の同一性だけが大事なので、ここで新しい値を足したり、作り直したりしないこと。
// Task1068: NICORU（ニコるの画像）・dll（後で lit を入れる）・util（中身は src/util.js などが入れる）もここで作る。
// monkey の先頭（コンソールへの起動表示より前）で読み込まれる。util.js などは読み込んですぐ util を使うため、この位置のままにすること。
// Task1074: startup は「部品を読み込んだ時に動かしていた処理」を登録する所。startup.add(名前, 関数) で登録する。
// 今の配布物（//@require でつなぐビルド）では、登録したその場ですぐ呼ぶ（今までと同じ順番・同じ時機）。
// バンドラでまとめた物では、先に startup.defer() してから部品を読み込み、設定を読み込んだ後で startup.run() で順に呼ぶ。
// 作り直しの手順: docs/handoff/CODEX_STARTUP_REFACTOR.md
// Task1070: PRODUCT（製品名。今までは monkey の引数）と TOKEN（起動ごとの乱数。今までは monkey の中の let）もここで作る。
// 値は今までどおり monkey の引数（名前を _product に変えた。同じ名前を本文で const にすると構文エラーになるため）から受け取る。
// 外部サイト再生の配布物では、引数が 'ZenzaWatchExternalTrial' になることがある（packages/external-playback/runtime-adapter.cjs）。
// ES モジュールにする時（第5段階）は、起動の関数からこの値を渡す形にする。
//===BEGIN===
const PRODUCT = typeof _product === 'string' ? _product : 'ZenzaWatch';
const TOKEN = 'r:' + (Math.random());
const NICORU = 'data:image/png;base64,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';
const dll = {};
const util = {};
const ZenzaWatch = {};
const global = {};
const startup = (() => {
  const queue = [];
  let deferred = false;
  return {
    add(name, fn) {
      if (deferred) { queue.push([name, fn]); } else { fn(); }
    },
    defer() { deferred = true; },
    run() {
      deferred = false;
      while (queue.length) { queue.shift()[1](); }
    },
    get pending() { return queue.map(([name]) => name); }
  };
})();
//===END===
export {ZenzaWatch, global, NICORU, dll, util, PRODUCT, TOKEN, startup};
