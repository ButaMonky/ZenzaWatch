import {netUtil} from '../infra/netUtil';

//===BEGIN===
/**
 * ニコニ・コモンズのコンテンツツリー（親作品・子作品）を取得する。
 *
 * Task 043で全面的に書き直した。
 *
 * 旧実装は https://api.commons.nicovideo.jp/tree/summary/get をJSONPで
 * 呼んでいたが、このAPIはホストごと消滅している（名前解決もできない）。
 * また、ツリーの表示先だった commons.nicovideo.jp/tree/{id} も廃止され、
 * 現在は commons.nicovideo.jp/works/{id} に変わっている。
 *
 * 現行のページが実際に何を呼んでいるかをブラウザで確認したところ、
 * 次の公開APIを使っていた（www.nicovideo.jp からのCORSも許可されている
 * ことを実際に確認済み。そのため隠しiframe等の回避策は不要）。
 *
 *   https://public-api.commons.nicovideo.jp/v1/tree/{globalId}/relatives/parents
 *   https://public-api.commons.nicovideo.jp/v1/tree/{globalId}/relatives/children
 *
 * 応答の形（2026-09時点で実際に確認）:
 *
 *   {
 *     "meta": {"status": 200},
 *     "data": {
 *       "parents": {              // childrenの時は "children"
 *         "total": 6,
 *         "contents": [
 *           {
 *             "kind": "external",       // commons: コモンズ素材 / external: 外部(動画等)
 *             "contentId": 33416354,    // 数字だけのID
 *             "globalId": "sm33416354", // 実際に使えるID
 *             "contentKind": "video",   // video / commons / ...
 *             "visibleStatus": "visible",
 *             "created": ..., "updated": ...
 *           }, ...
 *         ]
 *       }
 *     }
 *   }
 *
 * タイトルは含まれないが、プレイリスト側が動画IDから動画情報を取り直す
 * 作りになっているため問題にならない。
 *
 * ページング（Task 044で追加）:
 * このAPIは _offset / _limit を受け付ける。指定しないと**既定20件で打ち切られる**
 * ため、子作品が54件ある動画で20件しか取れていなかった。
 * _limit=100 までは1回で返ることを実測で確認したので、100件ずつ、
 * data.{kind}.total に達するまで繰り返し取得する。
 */
const CommonsTreeLoader = (() => {
  const API_BASE = 'https://public-api.commons.nicovideo.jp/v1/tree';

  // 1回のリクエストで取る件数。
  // 指定しないと既定20件で打ち切られる（Task 044で判明。子作品54件の動画で
  // 20件しか取れていなかった）。100件までは返ることを実測で確認済み。
  const PAGE_SIZE = 100;
  // 取得件数の上限。ツリーが巨大な動画で無制限に取ると、この後に控えている
  // 「1件ずつ動画情報を取り直す処理」が重くなりすぎるため歯止めを入れる。
  const DEFAULT_MAX_ITEMS = 300;

  const fetchPage = async (globalId, kind, offset, limit) => {
    // _sort=-id はコモンズのページ自身が使っているのと同じ並び順
    const url = `${API_BASE}/${globalId}/relatives/${kind}` +
      `?_offset=${offset}&_limit=${limit}&_sort=-id`;
    // 公開APIなのでログイン情報は送らない
    const res = await netUtil.fetch(url, {credentials: 'omit'});
    // Task 074: コンテンツツリーに登録されていない動画は404を返す。
    // これは「取得失敗」ではなく「0件」なので、エラーにせず空で返す
    if (res.status === 404) {
      return {total: 0, contents: [], notFound: true};
    }
    if (!res.ok) {
      throw new Error(`コンテンツツリーの取得に失敗 (${kind}: ${res.status})`);
    }
    const json = await res.json();
    const box = (json && json.data && json.data[kind]) || {};
    return {
      total: typeof box.total === 'number' ? box.total : 0,
      contents: Array.isArray(box.contents) ? box.contents : []
    };
  };

  /**
   * @param {string} globalId 動画ID(sm～等)
   * @param {string} kind 'parents' または 'children'
   * @param {number} maxItems 取得する最大件数
   * @return {Promise<{total: number, works: Array}>}
   *         total はAPIが申告する総数（取得できた件数とは限らない）
   */
  const loadRelatives = async (globalId, kind, maxItems = DEFAULT_MAX_ITEMS) => {
    const contents = [];
    let total = 0;
    let notFound = false;
    // 総数に達するか、上限に達するまでページを繰り返し取る
    for (let offset = 0; offset < maxItems; offset += PAGE_SIZE) {
      const limit = Math.min(PAGE_SIZE, maxItems - offset);
      const page = await fetchPage(globalId, kind, offset, limit);
      total = page.total;
      notFound = notFound || !!page.notFound;
      contents.push(...page.contents);
      // 返ってきた件数が要求より少ない＝最後のページ
      if (page.contents.length < limit || contents.length >= total) {
        break;
      }
    }
    const works = contents.map(c => ({
      // 実際に開けるIDはglobalId（sm～/so～/nc～）。contentIdは数字だけなので使わない
      contentId: c.globalId,
      // 再生できるのは動画かつ公開中のものだけ。
      // 素材(commons)や非公開・削除済みは除外できるようにフラグで返す
      isVideo: c.contentKind === 'video' && c.visibleStatus === 'visible',
      contentKind: c.contentKind,
      visibleStatus: c.visibleStatus
    }));
    return {total: total || works.length, works, notFound};
  };

  /**
   * 親作品・子作品をまとめて取得する（直接の親子のみ。孫以降は辿らない）。
   * 片方が失敗しても、もう片方は返す。
   */
  const load = async (globalId, maxItems = DEFAULT_MAX_ITEMS) => {
    const [parents, children] = await Promise.all([
      loadRelatives(globalId, 'parents', maxItems).catch(e => {
        window.console.warn('親作品の取得に失敗', e);
        return {total: 0, works: [], failed: true};
      }),
      loadRelatives(globalId, 'children', maxItems).catch(e => {
        window.console.warn('子作品の取得に失敗', e);
        return {total: 0, works: [], failed: true};
      })
    ]);
    if (parents.failed && children.failed) {
      throw new Error('コンテンツツリーの取得に失敗しました');
    }
    return {parents, children};
  };

  return {load, loadRelatives};
})();

//===END===

export {CommonsTreeLoader};
