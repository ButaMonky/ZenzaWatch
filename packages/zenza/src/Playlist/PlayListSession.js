//===BEGIN===
const PlayListSession = (storage => {
  const KEY = 'ZenzaWatchPlaylist';
  let lastJson = '';

  const isQuotaError = e =>
    e && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED' || e.code === 22);

  // 再生中の位置(index)を中心に、最大max件だけを切り出す。indexは切り出し後の位置に直す。
  const trim = (data, max) => {
    const items = data.items;
    if (items.length <= max) {
      return data;
    }
    const index = Math.min(Math.max(parseInt(data.index, 10) || 0, 0), items.length - 1);
    const start = Math.max(0, Math.min(index - Math.floor(max / 2), items.length - max));
    return Object.assign({}, data, {
      items: items.slice(start, start + max),
      index: index - start
    });
  };

  return {
    isExist() {
      const data = storage.getItem(KEY);
      if (!data) {
        return false;
      }
      try {
        JSON.parse(data);
        return true;
      } catch (e) {
        return false;
      }
    },
    save(data) {
      // Task 073: プレイリストの件数を設定で増やせるようにしたため、sessionStorageの
      // 容量（ブラウザにより約5MB）を超えやすくなった。以前は容量超過時に
      // storage.clear() で「他の機能のキャッシュも含めて全部」消していたが、
      // 検索結果キャッシュ等まで巻き込んで消えるので廃止した。
      //  1. 件数が多い時は、再生中の動画の前後だけ（最大 MAX_ITEMS 件）を保存する
      //  2. それでも容量超過なら、自分のキーだけを消し、件数を半分にして再試行する
      //  3. 最小件数でも入らなければ保存を諦める（プレイリスト本体には影響しない）
      if (!data || !Array.isArray(data.items)) { return; }
      let max = PlayListSession.MAX_ITEMS;
      let saveData = trim(data, max);
      for (;;) {
        const json = JSON.stringify(saveData);
        if (lastJson === json) { return; }
        try {
          storage.setItem(KEY, json);
          lastJson = json;
          return;
        } catch(e) {
          if (!isQuotaError(e)) {
            window.console.error(e);
            return;
          }
          try { storage.removeItem(KEY); } catch (e2) { /* noop */ }
          lastJson = '';
          if (max <= PlayListSession.MIN_ITEMS) {
            window.console.warn('プレイリストをsessionStorageへ保存できませんでした（容量不足）');
            return;
          }
          max = Math.max(PlayListSession.MIN_ITEMS, Math.floor(max / 2));
          saveData = trim(data, max);
          window.console.warn('sessionStorageの容量が足りないため、保存するプレイリストを%d件に減らします', max);
        }
      }
    },
    restore() {
      const data = storage.getItem(KEY);
      if (!data) {
        return null;
      }
      try {
        lastJson = data;
        return JSON.parse(data);
      } catch (e) {
        return null;
      }
    }
  };
})(sessionStorage);
// Task 073: セッション（リロード後の復元）に保存するプレイリストの最大件数
PlayListSession.MAX_ITEMS = 1000;
PlayListSession.MIN_ITEMS = 100;
const PlaylistSession = PlayListSession;


//===END===

export {PlayListSession};