// GENERATED FROM tools/typescript-stage1/nico-src/ExtensionIntegrations.ts (Task1047). Edit the .ts and run npm run nico:sync.
//===BEGIN===
const ExtensionIntegrations = (() => {
    /** このモジュールがページに置いた要素の目印。onWatchUrlRestored でまとめて取り除く */
    const MARK = 'data-zenza-extension-integration';
    const removeAllMarkedElements = () => {
        for (const el of Array.from(document.querySelectorAll(`[${MARK}]`))) {
            el.remove();
        }
    };
    /** 秒 → ISO 8601 の長さ（例 680 → PT11M20S） */
    const isoDuration = (seconds) => {
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
    const nicotubeSaver = {
        id: 'nicotubeSaver',
        label: 'ニコつべSaver',
        onWatchUrlPushed(video) {
            const head = document.head, body = document.body;
            if (!head || !body) {
                return;
            }
            const ld = document.createElement('script');
            ld.type = 'application/ld+json';
            ld.setAttribute(MARK, this.id);
            ld.textContent = JSON.stringify({
                '@context': 'https://schema.org', '@type': 'VideoObject', name: video.title,
                url: `https://www.nicovideo.jp/watch/${video.watchId}`,
                ...(video.thumbnail ? { thumbnailUrl: [video.thumbnail] } : {}),
                ...(video.duration > 0 ? { duration: isoDuration(video.duration) } : {}),
                ...(video.owner ? { author: { '@type': 'Person', name: video.owner } } : {})
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
            const add = (className, text) => {
                const el = document.createElement('span');
                el.className = className;
                el.textContent = text;
                box.append(el);
            };
            if (video.owner) {
                add('VideoOwnerInfo-pageLink', video.owner);
            }
            // ジャンルが無い動画は「未設定」。「その他」だと拡張機能が読み込み途中とみなして待ってしまう
            add('GenreRankLabel', video.genre || '未設定');
            for (const tag of video.tags) {
                add('TagItem-name', tag);
            }
            body.prepend(box);
            // 拡張機能は題名の末尾「 - ニコニコ動画」を取り除いて保存するので、公式と同じ形にする
            return { documentTitle: `${video.title} - ニコニコ動画` };
        }
    };
    /** 対応しているアダプターの一覧。追加するときはここに足す（先頭ほど題名の指定が優先） */
    const ADAPTERS = Object.freeze([nicotubeSaver]);
    /**
     * そのアダプターを使ってよいか。全体の設定と、アダプター個別の設定の両方が OFF でないこと。
     * Task1046 で公開した旧キー historyExtension.enable を OFF にしていた人は、ニコつべSaver も OFF のまま。
     */
    const isEnabled = (read, adapter) => {
        if (read('extensionIntegration.enable') === false) {
            return false;
        }
        if (read(`extensionIntegration.${adapter.id}`) === false) {
            return false;
        }
        if (adapter.id === 'nicotubeSaver' && read('historyExtension.enable') === false) {
            return false;
        }
        return true;
    };
    /**
     * VideoInfoModel（JS）から公開情報だけを取り出す。読めない項目は空にする。
     * VideoInfoModel の値は prototype の getter なので、分割代入ではなく1つずつ読む。
     */
    const snapshotFromVideoInfo = (info) => {
        try {
            const watchId = info?.watchId;
            if (!watchId) {
                return null;
            }
            const tags = (Array.isArray(info.tagList) ? info.tagList : [])
                .map((t) => typeof t === 'string' ? t : (t?.tag || t?.name || ''))
                .filter((t) => typeof t === 'string' && t.length > 0)
                .slice(0, 100);
            const thumbnail = [info.betterThumbnail, info.thumbnail]
                .find((u) => typeof u === 'string' && /^https:\/\//.test(u)) || '';
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
        }
        catch (_e) {
            return null;
        }
    };
    /**
     * URL を動画のものにした直後に呼ぶ。有効なアダプターに順に知らせ、
     * タブの題名の指定があれば返す（無ければ null。呼び出し側は従来の題名を使う）。
     * アダプターの失敗は ZenzaWatch の動作を止めない（コンソールに出すだけ）。
     */
    const onWatchUrlPushed = (video, read) => {
        removeAllMarkedElements();
        if (!video) {
            return null;
        }
        let documentTitle = null;
        for (const adapter of ADAPTERS) {
            if (!isEnabled(read, adapter)) {
                continue;
            }
            try {
                const result = adapter.onWatchUrlPushed(video);
                if (!documentTitle && result && typeof result.documentTitle === 'string') {
                    documentTitle = result.documentTitle;
                }
            }
            catch (e) {
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
        adapters: () => ADAPTERS.map(({ id, label }) => ({ id, label })),
        snapshotFromVideoInfo,
        onWatchUrlPushed,
        onWatchUrlRestored
    });
})();
//===END===
export {ExtensionIntegrations};
