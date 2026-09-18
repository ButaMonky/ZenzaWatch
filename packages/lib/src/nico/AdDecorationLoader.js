import {netUtil} from '../infra/netUtil';

//===BEGIN===
/**
 * ニコニ広告の装飾（金冠・銀冠）をまとめて取得する（Task 054）。
 *
 * 単体取得APIは以前から使っていたが、プレイリストの数百件すべてに
 * 1件ずつ問い合わせるのは非現実的なため、複数IDを一度に問い合わせる
 * 一括取得APIを使う。
 *
 *   GET https://api.nicoad.nicovideo.jp/v1/contents/video/decoration?ids=sm1,sm2,...
 *
 * 2026-09-12にブラウザで実際に通信して確認した内容:
 *
 *  - ids はカンマ区切りの文字列。ids[]=... の配列形式は 400 (NICOAD_14_1) になる。
 *  - 認証不要。www.nicovideo.jp からの credentials: 'omit' なfetchでCORSも許可される。
 *  - 応答は {meta:{status:200}, data:{contents:[{id, activePoint, totalPoint, decoration}]}}。
 *    decoration は "normal" / "silver" / "gold"。
 *  - 広告履歴が一度もないIDは contents に単純に含まれない（エラーにはならない）。
 *  - 件数はURL長に依存すると見られる。600件(URL長3556文字)は成功、
 *    700件(4156文字)は通信自体が失敗(Failed to fetch)した。
 *    （Task 066で分割方法を見直し。MAX_IDS_PER_REQUEST 付近のコメント参照）
 *
 * 詳しい実測ログは docs/design-pack (Task 054) および、Codexのニコニコ調査
 * ナレッジベースの evidence/claude-ads-decoration-bulk-traffic-20260912.md を参照。
 *
 * 【Task 057追記: sessionStorageキャッシュ(1時間TTL)を撤去した】
 * 当初はsessionStorageへ1時間キャッシュしていたが、以下の理由で単純な
 * 「毎回まとめて取得し直す」方式に変更した(2026-09-13、ユーザー指摘)。
 *  - 一括取得(最大300件/チャンク)は実測で0.3秒程度と十分速く、キャッシュで
 *    節約できる時間はごくわずかしかない。
 *  - 逆にキャッシュがあると、広告のON/OFFが切り替わってから最大1時間、
 *    Zenza側の表示が古いままになりうる（正確性の面ではむしろ無い方が良い）。
 *  - 「ページを離れずに動画を渡り歩く」というZenzaWatch自体の設計上、
 *    同じページ内でのメモリ上キャッシュ（1つ前の案）だけでも重複問い合わせは
 *    ほぼ防げるが、長時間の視聴で数万件規模までキャッシュが際限なく
 *    肥大化しうるという指摘を受け、そのメモリ上キャッシュ案も採らず、
 *    素直に毎回一括取得し直す方式にした。呼び出し側(`_onAdDecorationCheck`)
 *    の「未確認のIDだけをまとめて問い合わせる」設計自体は変わらないため、
 *    実際に問い合わせが発生するのは「表示中の一覧に、まだこのVideoList
 *    インスタンスが確認していない動画がある時」だけであり、無制限に
 *    通信が増え続けるわけではない。
 */
const AdDecorationLoader = (() => {
  const API_BASE = 'https://api.nicoad.nicovideo.jp/v1/contents/video/decoration';
  /*
   * 【Task 066: 分割方法を「件数」から「URL長＋件数」に変更】
   * Codexのニコニコ解析（NICO-FOLLOWUP-20260913-ADS-LENGTH / NICO-WEB-20260913-ADS-BULK）で:
   *  - 「600件成功・700件失敗」は sm1〜sm600 のような短いIDでの報告だった。
   *    10文字ID(sm46783512等)だと300件で約3364文字になり、成功例(3556文字)と
   *    失敗例(4156文字)の間の未確定の境界にかなり近い。
   *  - 本家ブラウザの実通信では1回あたり最大80件（全件返却）までしか観測されていない。
   *  - サーバー側の上限（件数かURL長か）は未確定。
   * そのため、実際に観測済みの範囲に近い安全側（最大100件・URL長2000文字以内）で分割し、
   * 通信回数が増える分は同時3本までの並列で補う。
   *
   * なお、解析では「14件指定→12件返却」の例もあり、応答に含まれないIDが必ず
   * 「広告履歴なし」とは限らない（意味は未確定）。ただし表示上は冠を付けない
   * （normal）以外の扱いが無いため、従来通り normal として扱う。
   */
  const MAX_IDS_PER_REQUEST = 100;
  const MAX_URL_LENGTH = 2000;
  const CONCURRENCY = 3;

  const splitChunks = ids => {
    const chunks = [];
    let current = [];
    let length = API_BASE.length + '?ids='.length;
    for (const id of ids) {
      const add = (current.length ? 1 : 0) + id.length; // カンマ + ID
      if (current.length && (current.length >= MAX_IDS_PER_REQUEST || length + add > MAX_URL_LENGTH)) {
        chunks.push(current);
        current = [];
        length = API_BASE.length + '?ids='.length;
      }
      length += (current.length ? 1 : 0) + id.length;
      current.push(id);
    }
    if (current.length) {
      chunks.push(current);
    }
    return chunks;
  };

  class AdDecorationLoader {
    async _fetchChunk(ids) {
      // 公開APIなのでログイン情報は送らない
      const url = `${API_BASE}?ids=${ids.join(',')}`;
      const res = await netUtil.fetch(url, {credentials: 'omit'});
      if (!res.ok) {
        throw new Error(`広告装飾の取得に失敗 (${res.status})`);
      }
      const json = await res.json();
      return (json && json.data && json.data.contents) || [];
    }

    /**
     * チャンク分割・進捗通知・エラー処理を共通化した内部実装。
     * キャッシュは一切持たない（Task 057でsessionStorageキャッシュを撤去）。
     *
     * @param {string[]} watchIds
     * @param {function({checked:number,total:number}):void} [onProgress]
     * @param {string} warnPrefix 通信失敗時のconsole.warnの接頭辞（本体用/デバッグ用でログを区別するため）
     * @return {Promise<Map<string,string>>} watchId -> decoration('normal'/'silver'/'gold')
     *         取得できなかったID(通信失敗したチャンク内のID)はMapに含まれない。
     *         呼び出し側は含まれなかったIDを「今回は未確定」として扱い、
     *         必要なら後で再試行すること。
     */
    async _loadChunked(watchIds, onProgress, warnPrefix) {
      const uniqIds = [...new Set((watchIds || []).filter(Boolean).map(String))];
      const result = new Map();
      const total = uniqIds.length;
      let checked = 0;

      const chunks = splitChunks(uniqIds);
      let next = 0;
      const worker = async () => {
        while (next < chunks.length) {
          const chunk = chunks[next++];
          let contents;
          try {
            contents = await this._fetchChunk(chunk);
          } catch (e) {
            window.console.warn(`${warnPrefix}（このチャンクは今回スキップ）`, e);
            checked += chunk.length;
            if (onProgress) {
              onProgress({checked, total});
            }
            continue; // このチャンクは次回また試せるよう、結果に含めない
          }
          const byId = new Map(contents.map(c => [String(c.id), c.decoration]));
          for (const id of chunk) {
            // 応答に出てこないID = 冠なしとして表示（上記コメント参照）
            result.set(id, byId.get(id) || 'normal');
          }
          checked += chunk.length;
          if (onProgress) {
            onProgress({checked, total});
          }
        }
      };
      await Promise.all(
        Array.from({length: Math.min(CONCURRENCY, chunks.length)}, () => worker())
      );

      return result;
    }

    /**
     * @param {string[]} watchIds
     * @return {Promise<Map<string,string>>} watchId -> decoration
     */
    async load(watchIds) {
      return this._loadChunked(watchIds, null, '広告装飾の取得に失敗');
    }

    /**
     * Task 055: デバッグ用。load()との違いは無くなった（Task 057でload()自体が
     * 常にキャッシュ無しで取得するようになったため）が、デバッグ機能を
     * 独立して削除しやすくする設計を維持するため、呼び出し側からは
     * 引き続き別名で呼べるようにしている。
     *
     * @param {string[]} watchIds
     * @param {function({checked:number,total:number}):void} [onProgress]
     *   チャンク単位の進捗通知(任意)。件数が多いと時間がかかるため、
     *   呼び出し側で「N/M件」等の進捗表示に使う。
     * @return {Promise<Map<string,string>>} watchId -> decoration
     */
    async loadFresh(watchIds, onProgress) {
      return this._loadChunked(watchIds, onProgress, '[デバッグ全件チェック] 広告装飾の取得に失敗');
    }
  }

  return new AdDecorationLoader();
})();

//===END===

export {AdDecorationLoader};
