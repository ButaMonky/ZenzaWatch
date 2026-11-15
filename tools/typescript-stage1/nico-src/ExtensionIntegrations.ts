/**
 * Canonical TypeScript source for packages/zenza/src/init/ExtensionIntegrations.js (Task1047).
 *
 * ============================================================================
 *  外部のブラウザ拡張機能との連携（ExtensionIntegrations）
 * ============================================================================
 *
 * ■ このモジュールの役割
 *   ZenzaWatch は公式の視聴ページを開かずに、検索・タグ・ランキングなどのページの上で
 *   動画を再生する。そのため「公式の視聴ページを読んで動く」タイプのブラウザ拡張機能
 *   （視聴履歴を保存するものなど）は、ZenzaWatch で見た動画に気づけないことがある。
 *   ここは、そうした拡張機能ごとの「つなぎ（アダプター）」を1か所にまとめる場所。
 *
 * ■ 仕組み（いつ呼ばれるか）
 *   WatchPageHistory（既読リンクの着色のため、動画を開くと URL を約3秒だけ
 *   /watch/動画ID に書き換える機能）から、次の2つだけが呼ばれる。
 *     - onWatchUrlPushed(video)   … URL を動画のものにした直後
 *     - onWatchUrlRestored()      … URL を元に戻すとき・ZenzaWatch を閉じたとき
 *   各アダプターはこの間だけページに手を加え、終わったら必ず元に戻す。
 *   「ブラウザの履歴への反映を利用（enablePushState）」が OFF だと URL を書き換えないので、
 *   どのアダプターも呼ばれない。
 *
 * ■ 設定（上級者設定「外部連携」）
 *   - extensionIntegration.enable          … 外部連携の全体のON/OFF（初期値ON）
 *   - extensionIntegration.<アダプターID>  … 各アダプターのON/OFF
 *   設定キーと説明文は advanced-src/Config.ts と ModernAdvancedSettingsModel.ts の
 *   「外部連携」グループにある。アダプターを追加したらそこにも1行ずつ足す。
 *
 * ■ アダプターを追加するとき（手順）
 *   1. 対応したい拡張機能のコードを読み、「何を見て動くか」を確かめる
 *      （URL・document.title・どのセレクター・どの meta/JSON-LD など）。
 *   2. 下の ADAPTERS に IntegrationAdapter を1つ足す。id は英小文字の識別子。
 *      その拡張機能のバージョンと、合わせた読み方をコメントに必ず書く。
 *   3. Config.ts に 'extensionIntegration.<id>': true を足し、上級者設定の
 *      「外部連携」グループに説明（拡張機能のストアのリンクつき）を足す。
 *   4. test/unit にアダプターの約束事（置く部品・戻し方）を確かめるテストを足す。
 *   ※ 外部へは何も送らないこと。ページに置くのは公開されている動画の情報だけにする。
 *   ※ 置いた部品は onWatchUrlRestored で必ず全部取り除くこと（MARK 属性で一括削除できる）。
 *
 * ■ 拡張機能側が変わったら
 *   アダプターが効かなくなるだけで、ZenzaWatch の動作は壊れない。
 *   その拡張機能の新しいコードを読み、アダプターの部品名・題名の形を合わせ直すか、
 *   不要ならアダプターごと削除する（設定キーと説明文も一緒に消す）。
 *
 * ■ 対応状況のメモ
 *   - ニコつべSaver 4.1（Chrome、ID aghilngeclanbmagpeacpecnpachdpbc）: 下の nicotubeSaver。
 *   - ニコ動アーカイブ 0.8.3（Chrome、ID jdaojheafkkcindcpnjkencfopeacdea）: アダプター不要。
 *     Navigation API の navigate イベントで URL の /watch/動画ID だけを見て、動画情報は自分で
 *     API から取るため、URL の書き換えだけで記録される。ただし拡張機能側の制限として
 *     ショート（ss）を記録せず、5秒以内に次の動画へ進むと前の動画を捨てる。Firefox では
 *     Navigation API が無く動かない（いずれも ZenzaWatch からは直せない）。
 */
/**
 * Raw playback models are still JS; the snapshot below is built from them with checks.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = any;

/** 再生中の動画の公開情報（アダプターに渡すのはこれだけ） */
interface WatchVideoSnapshot {
  /** sm12345 など（URL の /watch/ の後ろと同じ） */
  watchId: string;
  title: string;
  /** 投稿者名（チャンネル名）。不明なら空文字 */
  owner: string;
  /** ジャンルの表示名。未設定なら空文字 */
  genre: string;
  tags: string[];
  /** https のサムネイル URL。無ければ空文字 */
  thumbnail: string;
  /** 秒。不明なら 0 */
  duration: number;
}

/** 1つの拡張機能向けのつなぎ */
interface IntegrationAdapter {
  /** 識別子。設定キー extensionIntegration.<id> に使う */
  id: string;
  /** 説明・ログ用の表示名 */
  label: string;
  /**
   * URL を動画のものにした直後に呼ばれる。ページに部品を置くならここで置く。
   * documentTitle を返すと、URL を書き換えている間のタブの題名をその文字列にする
   * （複数のアダプターが返したときは先のものを使う）。
   */
  onWatchUrlPushed(video: WatchVideoSnapshot): {documentTitle?: string} | void;
}

/** 設定の読み取り口。WatchPageHistory から ZenzaWatch の設定（PlayerConfig.getValue）を渡す */
type SettingReader = (key: string) => unknown;

const ExtensionIntegrations = (() => {
  /** このモジュールがページに置いた要素の目印。onWatchUrlRestored でまとめて取り除く */
  const MARK = 'data-zenza-extension-integration';

  const removeAllMarkedElements = () => {
    for (const el of Array.from(document.querySelectorAll(`[${MARK}]`))) { el.remove(); }
  };

  /** 秒 → ISO 8601 の長さ（例 680 → PT11M20S） */
  const isoDuration = (seconds: number): string => {
    const n = Math.max(0, Math.floor(Number(seconds) || 0));
    const h = Math.floor(n / 3600), m = Math.floor(n % 3600 / 60), s = n % 60;
    return `PT${h ? h + 'H' : ''}${m}M${s}S`;
  };

  /* ------------------------------------------------------------------------
   * アダプター: ニコつべSaver
   *   ストア: https://chromewebstore.google.com/detail/%E3%83%8B%E3%82%B3%E3%81%A4%E3%81%B9saver/aghilngeclanbmagpeacpecnpachdpbc
   *   合わせたバージョン: 4.1（2026-11 時点。content.js を読んで確認）
   *
   *   拡張機能の読み方（content.js extractNicoData）:
   *     - きっかけ: document.body の変化を MutationObserver で見て、URL が変わったら
   *       題名の変化を最大6秒待ち、0.5秒後から約0.5秒おきに最大10回読み取りを試す。
   *       URL が nicovideo.jp/watch/… でなくなっていたら何もしない。
   *     - 題名: document.title から「 - ニコニコ動画」を取り除いたもの
   *     - 投稿者: '.VideoOwnerInfo-pageLink, .ProgramProvider-name, [data-name="username"], .link_name'
   *       の最初の1つ → 無ければ script[type="application/ld+json"] の author.name
   *       （「不明」のままだと読み込み途中とみなして待つ）
   *     - 長さ: 最初の JSON-LD の duration（PT…）
   *     - サムネイル: 最初の meta[property="og:image"]
   *     - ジャンル: '.GenreRankLabel' ほか（「その他」だと読み込み途中とみなして待つ）
   *     - タグ: '.TagItem-name' の全部 → 無ければ meta[name="keywords"]
   *   ZenzaWatch の URL 書き換えは約3秒なので、検索ページなどではこれらの部品が無いまま
   *   待つうちに URL が戻り、記録されなかった。そこで同じ名前の部品を見えない形で置く。
   *   - 「最初の1つ」が使われるので、ページ側の要素より前（head・body の先頭）に置く。
   *   - 拡張機能は body の変化をきっかけに URL を確かめるので、URL と題名を変えた後に置く
   *     （WatchPageHistory がその順で呼ぶ）。
   * ---------------------------------------------------------------------- */
  const nicotubeSaver: IntegrationAdapter = {
    id: 'nicotubeSaver',
    label: 'ニコつべSaver',
    onWatchUrlPushed(video) {
      const head = document.head, body = document.body;
      if (!head || !body) { return; }
      const ld = document.createElement('script');
      ld.type = 'application/ld+json';
      ld.setAttribute(MARK, this.id);
      ld.textContent = JSON.stringify({
        '@context': 'https://schema.org', '@type': 'VideoObject', name: video.title,
        url: `https://www.nicovideo.jp/watch/${video.watchId}`,
        ...(video.thumbnail ? {thumbnailUrl: [video.thumbnail]} : {}),
        ...(video.duration > 0 ? {duration: isoDuration(video.duration)} : {}),
        ...(video.owner ? {author: {'@type': 'Person', name: video.owner}} : {})
      });
      const og = document.createElement('meta');
      og.setAttribute('property', 'og:image');
      og.setAttribute('content', video.thumbnail || '');
      og.setAttribute(MARK, this.id);
      head.prepend(og, ld);

      const box = document.createElement('div');
      box.setAttribute(MARK, this.id);
      box.hidden = true;
      box.setAttribute('aria-hidden', 'true');
      box.style.display = 'none';
      const add = (className: string, text: string) => {
        const el = document.createElement('span');
        el.className = className;
        el.textContent = text;
        box.append(el);
      };
      if (video.owner) { add('VideoOwnerInfo-pageLink', video.owner); }
      // ジャンルが無い動画は「未設定」。「その他」だと拡張機能が読み込み途中とみなして待ってしまう
      add('GenreRankLabel', video.genre || '未設定');
      for (const tag of video.tags) { add('TagItem-name', tag); }
      body.prepend(box);
      // 拡張機能は題名の末尾「 - ニコニコ動画」を取り除いて保存するので、公式と同じ形にする
      return {documentTitle: `${video.title} - ニコニコ動画`};
    }
  };

  /** 対応しているアダプターの一覧。追加するときはここに足す（先頭ほど題名の指定が優先） */
  const ADAPTERS: readonly IntegrationAdapter[] = Object.freeze([nicotubeSaver]);


  /**
   * そのアダプターを使ってよいか。全体の設定と、アダプター個別の設定の両方が OFF でないこと。
   * Task1046 で公開した旧キー historyExtension.enable を OFF にしていた人は、ニコつべSaver も OFF のまま。
   */
  const isEnabled = (read: SettingReader, adapter: IntegrationAdapter): boolean => {
    if (read('extensionIntegration.enable') === false) { return false; }
    if (read(`extensionIntegration.${adapter.id}`) === false) { return false; }
    if (adapter.id === 'nicotubeSaver' && read('historyExtension.enable') === false) { return false; }
    return true;
  };

  /**
   * VideoInfoModel（JS）から公開情報だけを取り出す。読めない項目は空にする。
   * VideoInfoModel の値は prototype の getter なので、分割代入ではなく1つずつ読む。
   */
  const snapshotFromVideoInfo = (info: Loose): WatchVideoSnapshot | null => {
    try {
      const watchId = info?.watchId;
      if (!watchId) { return null; }
      const tags = (Array.isArray(info.tagList) ? info.tagList : [])
        .map((t: Loose) => typeof t === 'string' ? t : (t?.tag || t?.name || ''))
        .filter((t: unknown): t is string => typeof t === 'string' && t.length > 0)
        .slice(0, 100);
      const thumbnail = [info.betterThumbnail, info.thumbnail]
        .find((u: unknown): u is string => typeof u === 'string' && /^https:\/\//.test(u)) || '';
      const owner = info.owner?.name;
      const genre = info.genre?.label;
      return {
        watchId: String(watchId),
        title: String(info.title || ''),
        owner: typeof owner === 'string' ? owner : '',
        genre: typeof genre === 'string' ? genre : '',
        tags,
        thumbnail,
        duration: Number(info.duration) || 0
      };
    } catch (_e) {
      return null;
    }
  };

  /**
   * URL を動画のものにした直後に呼ぶ。有効なアダプターに順に知らせ、
   * タブの題名の指定があれば返す（無ければ null。呼び出し側は従来の題名を使う）。
   * アダプターの失敗は ZenzaWatch の動作を止めない（コンソールに出すだけ）。
   */
  const onWatchUrlPushed = (video: WatchVideoSnapshot | null, read: SettingReader): string | null => {
    removeAllMarkedElements();
    if (!video) { return null; }
    let documentTitle: string | null = null;
    for (const adapter of ADAPTERS) {
      if (!isEnabled(read, adapter)) { continue; }
      try {
        const result = adapter.onWatchUrlPushed(video);
        if (!documentTitle && result && typeof result.documentTitle === 'string') {
          documentTitle = result.documentTitle;
        }
      } catch (e) {
        window.console.warn?.('[ZenzaWatch] 外部連携の処理に失敗しました', adapter.label, e);
      }
    }
    return documentTitle;
  };

  /** URL を元に戻すとき・ZenzaWatch を閉じたときに呼ぶ。置いた部品を全部取り除く */
  const onWatchUrlRestored = () => {
    removeAllMarkedElements();
  };

  return Object.freeze({
    MARK,
    adapters: () => ADAPTERS.map(({id, label}) => ({id, label})),
    snapshotFromVideoInfo,
    onWatchUrlPushed,
    onWatchUrlRestored
  });
})();

export { ExtensionIntegrations };
