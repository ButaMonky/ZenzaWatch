import {PlaybackStartupTrace} from './PlaybackStartupTrace';
import {NotificationJournal} from './NotificationJournal';
import {RequestDiagnostics} from '../packages/lib/src/infra/RequestDiagnostics';
// GENERATED FROM tools/typescript-stage1/nico-src/NotificationHistoryPanel.ts (TaskNLOG20261023). Edit the .ts and run npm run nico:sync.
//===BEGIN===
//@require PlaybackStartupTrace
//@require NotificationJournal
//@require RequestDiagnostics
const NotificationHistoryPanel = (() => {
    const STYLE_ID = 'zenzaNotificationHistoryStyle';
    const docks = new WeakMap();
    let nextDockId = 0;
    const labels = {
        general: '通知', comment: 'コメント', like: 'いいね',
        network: '通信', player: '再生', system: '内部処理'
    };
    // Share the floating-panel layer with bookmarks, above the video corner controls.
    const style = [
        '.zenzaNotificationDock{position:absolute;left:8px;bottom:48px;z-index:150000;width:min(460px,calc(100% - 16px));max-height:calc(100% - 56px);display:flex;flex-direction:column;overflow:hidden;background:#202020;color:#eee;border:1px solid #777;border-radius:6px;box-shadow:0 4px 20px #0009;text-align:left;user-select:text;}',
        '.zenzaNotificationDock[hidden]{display:none!important;}',
        '.zenzaNotificationDock .znh-dock-header{display:flex;flex-shrink:0;align-items:center;justify-content:space-between;gap:8px;padding:8px 12px;border-bottom:1px solid #555;}',
        // Scroll the complete history view on short players: shrinking only the list
        // lets the toolbar consume its entire height and makes stored entries unreadable.
        '.zenzaNotificationDock .zenzaNotificationHistory{max-height:none;min-height:0;flex:1 1 auto;display:block;overflow:auto;overscroll-behavior:contain;}',
        '.zenzaNotificationHistory{box-sizing:border-box;padding:12px;color:inherit;font-size:13px;overflow:auto;max-height:min(70vh,640px);}',
        '.zenzaNotificationHistory *{box-sizing:border-box;}',
        '.zenzaNotificationHistory .znh-toolbar{display:flex;gap:7px;align-items:center;flex-wrap:wrap;margin-bottom:9px;}',
        '.zenzaNotificationHistory input,.zenzaNotificationHistory select,.zenzaNotificationHistory button{font:inherit;}',
        '.zenzaNotificationHistory input,.zenzaNotificationHistory select{color:#eee;background:#222;border:1px solid #777;border-radius:4px;padding:6px;}',
        '.zenzaNotificationHistory input{flex:2 1 140px;min-width:80px;}',
        '.zenzaNotificationHistory select{flex:1 1 105px;max-width:160px;}',
        '.zenzaNotificationHistory button{background:#333;color:#eee;border:1px solid #777;border-radius:4px;padding:5px 9px;cursor:pointer;}',
        '.zenzaNotificationHistory button:hover{background:#555;}',
        '.zenzaNotificationHistory button:focus-visible,.zenzaNotificationHistory input:focus-visible,.zenzaNotificationHistory select:focus-visible{outline:2px solid #9cf;outline-offset:1px;}',
        '.zenzaNotificationHistory .znh-status{font-size:12px;color:#bbb;min-height:18px;margin-bottom:6px;}',
        '.zenzaNotificationHistory .znh-list{overflow:visible;}',
        '.zenzaNotificationHistory .znh-entry{padding:9px 4px;border-bottom:1px solid #555;overflow-wrap:anywhere;}',
        '.zenzaNotificationHistory .znh-head{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}',
        '.zenzaNotificationHistory .znh-tag{font-size:11px;border-radius:3px;background:#444;padding:2px 5px;}',
        '.zenzaNotificationHistory .znh-entry[data-level="error"] .znh-tag{background:#713434;color:#fff;}',
        '.zenzaNotificationHistory .znh-entry[data-level="warning"] .znh-tag{background:#67512b;color:#fff;}',
        '.zenzaNotificationHistory .znh-entry[data-level="success"] .znh-tag{background:#245b40;color:#fff;}',
        '.zenzaNotificationHistory .znh-date{font-size:11px;color:#aaa;}',
        '.zenzaNotificationHistory .znh-message{white-space:pre-wrap;word-break:break-word;margin:6px 0;}',
        '.zenzaNotificationHistory .znh-activity-preview{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden;white-space:pre-wrap;margin:3px 0;color:#ddd;font-size:12px;}',
        '.zenzaNotificationHistory .znh-activity-text{white-space:pre-wrap;overflow-wrap:anywhere;user-select:text;border-left:2px solid #6ba58b;padding-left:10px;}',
        '.zenzaNotificationHistory .znh-activity a{color:#9cf;overflow-wrap:anywhere;}.zenzaNotificationHistory .znh-private-note{font-size:11px;color:#bbb;}',
        '.zenzaNotificationHistory details{color:#bbb;font-size:11px;}',
        '.zenzaNotificationHistory details pre{white-space:pre-wrap;word-break:break-word;user-select:text;color:#ddd;}',
        '.zenzaNotificationHistory [hidden]{display:none!important;}',
        '.zenzaNotificationHistory .znh-entry-open{display:block;width:100%;text-align:left;border:0;background:transparent;padding:5px 0;overflow-wrap:anywhere;}',
        '.zenzaNotificationHistory .znh-detail dl{display:grid;grid-template-columns:95px minmax(0,1fr);gap:7px 10px;margin:14px 0;}',
        '.zenzaNotificationHistory .znh-detail dt{color:#bbb;}.zenzaNotificationHistory .znh-detail dd{margin:0;overflow-wrap:anywhere;}',
        '.zenzaNotificationHistory .znh-detail h3{font-size:15px;margin:12px 0 6px;}.zenzaNotificationHistory .znh-detail p{white-space:pre-wrap;overflow-wrap:anywhere;}',
        '.zenzaNotificationHistory .znh-report{width:100%;min-height:150px;background:#292929;color:#eee;white-space:pre-wrap;}',
        '.zenzaNotificationHistory .znh-management{margin-left:auto;}.zenzaNotificationHistory summary{cursor:pointer;}',
        '.zenzaNotificationHistory .znh-actions{display:flex;gap:8px;align-items:center;justify-content:flex-end;margin-top:9px;}'
    ].join('\n');
    const element = (tag, className = '', content) => {
        const node = document.createElement(tag);
        if (className) {
            node.className = className;
        }
        if (content !== undefined) {
            node.textContent = String(content);
        }
        return node;
    };
    const featureLabel = (entry) => {
        const operation = String(entry.details?.operation || entry.source);
        if (operation === 'script-error')
            return 'スクリプトエラー';
        if (operation === 'external-playback')
            return '外部サイトからの再生';
        return (typeof RequestDiagnostics !== 'undefined' && RequestDiagnostics.labelFor(operation)) ||
            labels[entry.category] || '通知';
    };
    const modulePath = (module) => module.startsWith('nico-src/') ? 'tools/typescript-stage1/' + module : module;
    const formatTime = (value) => typeof value === 'number' && Number.isFinite(value) &&
        Math.abs(value) <= 8640000000000000 ? new Date(value).toLocaleString('ja-JP') : '記録なし（旧版など）';
    const stateLabel = (entry) => entry.details?.reason === 'spec-change' ? '仕様変更の疑い' :
        entry.details?.reason === 'script' ? 'スクリプトエラー' :
            entry.details?.outcome === 'recovered' ? '復旧済み' :
                entry.details?.reason === 'not-found' ? '対象なし・要確認' :
                    entry.details?.outcome === 'failed' ? '復旧未確認' : labels[entry.category] || '通知';
    const phaseLabels = new Map([
        ['transport', '通信'], ['response', '応答の確認'], ['session', '処理'], ['dialog-precheck', '投稿前の確認'], ['startup', '再生開始']
    ]);
    const explanations = {
        schema: '受け取った情報を想定した形式で読み取れませんでした。APIの仕様変更と断定はできません。',
        'startup-wait': '再生操作の後、進行を待っています。遅延の原因はまだ判別できません。',
        'startup-error': '最初の映像の確認前に、再生処理がエラーを返しました。',
        'play-blocked': 'ブラウザが再生開始を許可しませんでした。',
        timeout: '制限時間内に処理が完了しませんでした。',
        permission: 'アクセス権限またはログイン状態の確認が必要な応答です。',
        'not-found': '要求した対象が見つからないという応答です。対象の状態やAPIの変更などが考えられます。',
        http: 'サーバーからエラー応答が返りました。HTTP状態を確認できます。',
        network: '通信または処理が完了しませんでした。回線障害など原因の特定まではできていません。',
        // Task1036
        'spec-change': '同じ機能で同じ種類の失敗が、別々の対象で続けて起きています。動画ごとの事情ではなく、ニコニコ側の仕様変更の可能性が高い状態です。「修正箇所の目安」のファイルと「読めなかった項目」から直す場所を探せます。',
        script: 'ZenzaWatch のプログラム内で想定外のエラーが起きました。通信の問題ではありません。「エラーの種類」「発生箇所」「読めなかった項目」が手がかりになります。',
        'session-closed': '再生セッションが終了しました。',
        unavailable: 'この動画の再生方式には未対応です。', service: 'サービス側の処理に失敗しました。',
        integrity: '配布ファイルの照合に失敗しました。', 'module-load': '変換ライブラリを読み込めませんでした。',
        external: '外部サイトからの再生に失敗しました。'
    };
    const reasonText = (reason) => typeof reason === 'string' && Object.prototype.hasOwnProperty.call(explanations, reason) ? explanations[reason] : undefined;
    const description = (entry) => {
        const d = entry.details || {};
        if (d.outcome === 'recovered')
            return 'その後の処理成功を確認しました。下の失敗理由とステータスは最後の失敗時の記録です。';
        if (d.reason === 'not-found' && (entry.source === 'advertising' || d.operation === 'advertising'))
            return '広告APIが対象なしを返しました。広告なし・対象外・API変更などの可能性があり、この応答だけでは判別できません。調査できるよう記録を残しています。';
        return reasonText(d.reason) || 'この通知について記録された情報を表示しています。';
    };
    // Stored notification text and arbitrary identifiers are for local viewing only.
    // Reports can quote a field name or code only when the entire value is known.
    const reportFields = new Set([
        'meta.status', 'data.threads', 'data.threadKey', 'data.contentUrl', 'data.session.content_uri', 'missing-thread-key', 'invalid-thread-envelope', 'invalid-global-count',
        'invalid-thread-target', 'invalid-api-meta', 'msgInfo.threadInfo', 'threadInfo', 'videoId', 'data', 'data.client',
        'data.client.watchId', 'data.client.watchTrackId', 'data.video', 'data.video.id', 'data.video.title',
        'data.video.duration', 'data.video.count', 'data.video.thumbnail', 'data.player', 'data.genre', 'data.tags',
        'data.tags.items', 'data.nicoads', 'data.isLogin', 'data.twitterLinkage.isLinked', 'data.isClipTweetAllowed',
        'data.isUseLicensedMusic', 'data.clipId', 'data.status', 'data.clipUri', 'json', 'response.json',
        'data.items', 'data.totalCount', 'data.items.essential', 'data.items.id', 'data.contentId', 'meta.totalCount', 'last_modified',
        'data.items.content', 'data.items[].watchId', 'data.items[].essential.id', 'data.watchLater.items', 'data.mylist.items',
        'data.mylists', 'data.hasNext', 'data.watchLater.hasNext', 'data.mylist.hasNext', 'data.additionals', 'storyboard',
        'articles', 'articles[].request_title', 'articles[].title', 'data.tags', 'data.tags[].name', 'data.tag.edit.editKey', 'candidates', 'candidates[]',
        'meta.errorCode', 'data.postKey', 'data.no', 'data.challenge', 'data.nicoruKey', 'data.deleteKey', 'data.nicoruId'
    ]);
    const validStatus = (value) => typeof value === 'number' && Number.isInteger(value) && value >= 100 && value <= 599;
    const repairGuide = 'docs/maintenance/REPAIR_GUIDE.md';
    const repairReport = (entry) => {
        const d = entry.details || {};
        const unknown = '記録なし（旧版・未分類など）';
        const operation = String(d.operation || entry.source || '');
        const registeredLabel = typeof RequestDiagnostics !== 'undefined' && RequestDiagnostics.labelFor(operation);
        let feature = Object.prototype.hasOwnProperty.call(labels, entry.category) ? labels[entry.category] : '通知';
        let location = '修復ガイドの症状別の案内を参照';
        const startup = d.phase === 'startup' && typeof PlaybackStartupTrace !== 'undefined';
        const lastStage = startup && PlaybackStartupTrace.describe(d.lastStage);
        const nextStage = startup && PlaybackStartupTrace.describe(d.nextStage);
        if (startup) {
            feature = '動画の再生開始';
            if (nextStage)
                location = nextStage.file;
        }
        else if (registeredLabel) {
            feature = registeredLabel + '（' + operation + '）';
            location = modulePath(RequestDiagnostics.moduleFor(operation));
        }
        else if (operation === 'script-error') {
            feature = 'スクリプトエラー（script-error）';
        }
        else if (operation === 'external-playback') {
            feature = '外部サイトからの再生（external-playback）';
            location = 'packages/external-playback/launcher.cjs';
        }
        else if (entry.source === 'comment') {
            location = 'tools/typescript-stage1/nico-src/NicoVideoPlayerDialogComments.ts';
        }
        const version = typeof entry.version === 'string' && /^\d{1,3}\.\d{1,3}\.\d{1,5}(?:-task\d{1,6})?$/.test(entry.version) ? entry.version : unknown;
        const reason = reasonText(d.reason);
        const lines = ['ZenzaWatch 修復レポート', '発生時の版　' + version, '機能　' + feature,
            '段階　' + (phaseLabels.get(String(d.phase)) || unknown),
            '理由　' + (reason ? reason + '（' + d.reason + '）' : unknown)];
        if (startup) {
            lines.push('最後に成功した処理　' + (lastStage ? lastStage.label : unknown), '次に待っていた処理　' + (nextStage ? nextStage.label : unknown));
            if (typeof d.elapsedMs === 'number' && Number.isSafeInteger(d.elapsedMs) && d.elapsedMs >= 0)
                lines.push('操作からの経過　' + (d.elapsedMs / 1000).toFixed(1) + '秒');
        }
        if (d.outcome === 'recovered')
            lines.push('状態　復旧済み（理由は最後の失敗時の記録）');
        if (validStatus(d.statusCode))
            lines.push('HTTP状態　' + d.statusCode);
        if (validStatus(d.apiStatus))
            lines.push('API状態（meta.status）　' + d.apiStatus);
        if (typeof RequestDiagnostics !== 'undefined' && RequestDiagnostics.isKnownErrorCode(d.errorCode))
            lines.push('エラーコード　' + d.errorCode);
        if (typeof d.errorName === 'string' && ['TypeError', 'ReferenceError', 'RangeError', 'SyntaxError', 'Error'].includes(d.errorName))
            lines.push('エラーの種類　' + d.errorName);
        lines.push('読めなかった項目　' + (typeof d.missing === 'string' && reportFields.has(d.missing) ? d.missing : unknown), '修正箇所の目安　' + location, '修復ガイド（開発リポジトリ内）　' + repairGuide);
        return lines.join('\n');
    };
    const mount = (root, events, isVisible = () => !!root?.classList.contains('activeTab')) => {
        if (!root || root.querySelector('.zenzaNotificationHistory')) {
            return;
        }
        if (!document.getElementById(STYLE_ID)) {
            const sheet = element('style');
            sheet.id = STYLE_ID;
            sheet.textContent = style;
            (document.head || document.documentElement).append(sheet);
        }
        const view = element('section', 'zenzaNotificationHistory');
        view.setAttribute('aria-label', 'ZenzaWatch 通知・エラー履歴');
        const toolbar = element('div', 'znh-toolbar');
        const query = element('input');
        query.type = 'search';
        query.placeholder = 'ログを検索';
        query.setAttribute('aria-label', '通知履歴を検索');
        const filter = element('select');
        filter.setAttribute('aria-label', '通知履歴の分類');
        for (const [value, label] of [
            ['all', 'すべて'], ['error', 'エラー・警告'], ['comment', 'コメント'],
            ['like', 'いいね'], ['network', '通信'], ['player', '再生'], ['system', '内部処理']
        ]) {
            const option = element('option', '', label);
            option.value = value;
            filter.append(option);
        }
        const refresh = element('button', '', '更新');
        refresh.type = 'button';
        const save = element('button', '', 'JSON保存');
        save.type = 'button';
        save.title = '診断情報だけを保存します。投稿コメント本文・動画タイトルは含みません。';
        const clear = element('button', '', '全件削除');
        clear.type = 'button';
        const management = element('details', 'znh-management');
        management.append(element('summary', '', '履歴の管理'), refresh, save, clear);
        toolbar.append(query, filter, management);
        const status = element('div', 'znh-status');
        status.setAttribute('role', 'status');
        const listNode = element('div', 'znh-list');
        const actions = element('div', 'znh-actions');
        const more = element('button', '', 'さらに表示');
        more.type = 'button';
        actions.append(more);
        const detailNode = element('div', 'znh-detail');
        detailNode.hidden = true;
        view.append(toolbar, status, listNode, actions, detailNode);
        root.append(view);
        let shown = 100;
        let selectedId = null;
        let lastOpenedId = null;
        let listScroll = 0;
        let restoreListFocus = false;
        let detailSignature = '';
        let currentEntries = [];
        const returnToList = () => {
            selectedId = null;
            detailSignature = '';
            toolbar.hidden = status.hidden = listNode.hidden = actions.hidden = false;
            detailNode.hidden = true;
            restoreListFocus = true;
            view.scrollTop = listScroll;
        };
        const showDetail = (entry) => {
            const signature = JSON.stringify(entry);
            toolbar.hidden = status.hidden = listNode.hidden = actions.hidden = true;
            detailNode.hidden = false;
            if (signature === detailSignature)
                return;
            detailSignature = signature;
            const wasOpen = !!detailNode.querySelector('details[open]');
            const focused = document.activeElement && detailNode.contains(document.activeElement) ?
                document.activeElement.dataset.historyAction : undefined;
            detailNode.replaceChildren();
            const back = element('button', '', '‹ 一覧へ戻る');
            back.type = 'button';
            back.dataset.historyBack = '';
            back.dataset.historyAction = 'back';
            back.addEventListener('click', () => { returnToList(); schedule(); });
            detailNode.append(back, element('p', 'znh-tag', stateLabel(entry)), element('h3', '', entry.message), element('p', '', description(entry)));
            const pairs = [
                ['機能', featureLabel(entry)],
                ['段階', phaseLabels.get(String(entry.details?.phase)) || '記録なし'],
                ['発生回数', typeof entry.details?.count === 'number' ? entry.details.count + '回' : '1回'],
                // Task1036: 直す場所の手がかり（記録があるときだけ）。
                ...(entry.details?.module ? [['修正箇所の目安', modulePath(String(entry.details.module))]] : []),
                ...(entry.details?.missing ? [['読めなかった項目', String(entry.details.missing)]] : []),
                ...(entry.details?.errorName ? [['エラーの種類', String(entry.details.errorName)]] : []),
                ...(entry.details?.where ? [['発生箇所', String(entry.details.where)]] : []),
                ...(typeof entry.details?.distinctTargets === 'number' ? [['同じ失敗が起きた対象', entry.details.distinctTargets + '件（30分以内）']] : []),
                ...(validStatus(entry.details?.statusCode) ? [['HTTP状態', String(entry.details.statusCode)]] : []),
                ...(validStatus(entry.details?.apiStatus) ? [['API状態（meta.status）', String(entry.details.apiStatus)]] : []),
                ...(entry.details?.errorCode ? [['エラーコード', String(entry.details.errorCode)]] : []),
                ['発生時の版', entry.version || '記録なし（旧版など）'], ['ビルド', entry.build || '記録なし（旧版など）'],
                ['初回発生', formatTime(entry.firstOccurredAt)], ['最終発生', formatTime(entry.lastOccurredAt)],
                ['復旧時刻', entry.recoveredAt === undefined ? (entry.details?.outcome === 'recovered' ? '記録なし（旧版など）' : '復旧の記録なし') : formatTime(entry.recoveredAt)]
            ];
            if (entry.firstOccurredAt === undefined)
                pairs.push(['従来の記録時刻', formatTime(entry.timestamp)]);
            const grid = element('dl');
            for (const [name, value] of pairs)
                grid.append(element('dt', '', name), element('dd', '', value));
            detailNode.append(grid);
            if (entry.activity) {
                const kind = entry.activity.kind;
                const activity = element('section', 'znh-activity');
                activity.append(element('h3', '', kind === 'like' ? 'いいね！した動画' : kind === 'nicoru' ? 'ニコったコメント' : '投稿したコメント'));
                if (kind !== 'like' || entry.activity.text)
                    activity.append(element('p', 'znh-activity-text', kind === 'like' ? 'お礼のメッセージ: ' + entry.activity.text : entry.activity.text));
                if (/^(?:(?:sm|nm|so|ss)\d{1,16}|\d{1,16})$/i.test(entry.videoId)) {
                    const link = element('a', '', entry.activity.videoTitle ? entry.activity.videoTitle + ' (' + entry.videoId + ')' : entry.videoId);
                    link.href = 'https://www.nicovideo.jp/watch/' + entry.videoId;
                    link.target = '_blank';
                    link.rel = 'noopener noreferrer';
                    activity.append(link);
                }
                else if (entry.activity.videoTitle)
                    activity.append(element('p', '', entry.activity.videoTitle));
                activity.append(element('p', '', (kind === 'like' ? 'いいね！した日時: ' : kind === 'nicoru' ? 'ニコった日時: ' : '投稿日時: ') + formatTime(entry.timestamp)));
                const ms = entry.activity.positionMs;
                if (typeof ms === 'number' && Number.isFinite(ms) && ms >= 0) {
                    const seconds = Math.floor(ms / 1000);
                    activity.append(element('p', '', (kind === 'nicoru' ? 'コメントの再生位置: ' : '動画内の位置: ') + Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0')));
                }
                activity.append(element('p', 'znh-private-note', '自分用の履歴です。コメント本文と動画タイトルは、診断情報のコピー・JSON保存には含みません。'));
                detailNode.append(activity);
            }
            if (entry.details?.phase === 'startup' && typeof PlaybackStartupTrace !== 'undefined') {
                const last = PlaybackStartupTrace.describe(entry.details?.lastStage);
                const next = PlaybackStartupTrace.describe(entry.details?.nextStage);
                if (last && next)
                    detailNode.append(element('p', '', '最後に成功した処理　' + last.label + '　／　次に待っていた処理　' + next.label), element('p', '', '修正箇所の目安　' + next.file));
            }
            const isProblem = entry.level === 'error' || entry.level === 'warning' ||
                entry.details?.outcome === 'failed' || entry.details?.outcome === 'recovered' || !!entry.details?.reason;
            if (entry.details?.outcome === 'recovered')
                detailNode.append(element('p', '', 'この記録について追加の操作は不要です。'));
            const technical = element('details');
            technical.open = wasOpen;
            technical.append(element('summary', '', '技術的な詳細'), element('pre', '', JSON.stringify({ ...entry.details, source: entry.source }, null, 2)));
            const copy = element('button', '', isProblem ? '修復レポートをコピー' : 'この記録をコピー');
            copy.type = 'button';
            copy.dataset.historyAction = 'copy';
            const copyStatus = element('p', 'znh-status');
            copyStatus.setAttribute('role', 'status');
            let report;
            if (isProblem) {
                report = repairReport(entry);
            }
            else {
                const diagnostic = NotificationJournal.toDiagnosticEntry(entry);
                report = [diagnostic.message, description(diagnostic), ...pairs.map(([key, value]) => key + ': ' + value),
                    '診断情報: ' + JSON.stringify({ ...diagnostic.details, source: diagnostic.source })].join('\n');
            }
            copy.addEventListener('click', async () => {
                try {
                    if (!window.navigator.clipboard?.writeText)
                        throw new Error('unavailable');
                    await window.navigator.clipboard.writeText(report);
                    if (!disposed && selectedId === entry.id && copyStatus.isConnected)
                        copyStatus.textContent = isProblem ? '修復レポートをコピーしました。相談先に貼り付けてください。' : 'この記録をコピーしました';
                }
                catch {
                    if (disposed || selectedId !== entry.id || !copyStatus.isConnected)
                        return;
                    copyStatus.textContent = '自動コピーできませんでした。下の報告文を選択してコピーできます。';
                    let text = detailNode.querySelector('textarea');
                    if (!text) {
                        text = element('textarea', 'znh-report');
                        text.readOnly = true;
                        text.setAttribute('aria-label', '報告文');
                        copyStatus.after(text);
                    }
                    text.value = report;
                    text.focus();
                    text.select();
                }
            });
            detailNode.append(technical);
            if (isProblem)
                grid.before(copy, copyStatus);
            else
                detailNode.append(copy, copyStatus);
            if (focused)
                detailNode.querySelector('[data-history-action="' + focused + '"]')?.focus({ preventScroll: true });
        };
        let revision = 0;
        let scheduled = false;
        let dirty = false;
        let disposed = false;
        // Task1038: 上級者設定の上限件数まで読み込む（以前は2,000件固定で、それより古い記録は検索できなかった）。
        const snapshot = async () => NotificationJournal.list(Number.MAX_SAFE_INTEGER);
        const matches = (entry) => {
            if (filter.value === 'error') {
                if (entry.level !== 'error' && entry.level !== 'warning') {
                    return false;
                }
            }
            else if (filter.value !== 'all' && entry.category !== filter.value) {
                return false;
            }
            const needle = query.value.toLocaleLowerCase();
            if (!needle) {
                return true;
            }
            const kindLabel = entry.activity?.kind === 'like' ? 'いいね' : entry.activity?.kind === 'nicoru' ? 'ニコる ニコった' :
                entry.activity?.kind === 'comment-post' ? 'コメント投稿' : entry.category === 'like' ? 'いいね' : '';
            return [kindLabel, entry.message, entry.videoId, entry.source, entry.category, entry.activity?.text, entry.activity?.videoTitle,
                JSON.stringify(entry.details || {})].join(' ').toLocaleLowerCase().includes(needle);
        };
        const render = async (version) => {
            if (disposed || !isVisible()) {
                return;
            }
            const all = await snapshot();
            if (disposed || !isVisible() || version !== revision) {
                return;
            }
            currentEntries = all;
            if (selectedId) {
                const selected = all.find(entry => entry.id === selectedId);
                if (selected) {
                    showDetail(selected);
                    return;
                }
                returnToList();
            }
            const entries = all.filter(matches);
            listNode.replaceChildren();
            const fragment = document.createDocumentFragment();
            for (const entry of entries.slice(0, shown)) {
                const item = element('article', 'znh-entry');
                item.dataset.level = entry.level;
                const head = element('div', 'znh-head');
                head.append(element('span', 'znh-tag', featureLabel(entry)), element('span', 'znh-date', formatTime(entry.timestamp)));
                if (entry.videoId) {
                    head.append(element('span', 'znh-date', entry.videoId));
                }
                const entryButton = element('button', 'znh-message znh-entry-open', entry.message + ' ›');
                entryButton.type = 'button';
                entryButton.dataset.entryId = entry.id;
                entryButton.addEventListener('click', () => {
                    listScroll = view.scrollTop;
                    selectedId = lastOpenedId = entry.id;
                    detailSignature = '';
                    showDetail(currentEntries.find(item => item.id === entry.id) || entry);
                    view.scrollTop = 0;
                    detailNode.querySelector('[data-history-back]')?.focus({ preventScroll: true });
                });
                item.append(head, entryButton);
                if (entry.activity?.kind === 'comment-post' || entry.activity?.kind === 'nicoru')
                    entryButton.append(element('span', 'znh-activity-preview', entry.activity.text));
                else if (entry.activity?.kind === 'like' && entry.activity.videoTitle)
                    entryButton.append(element('span', 'znh-activity-preview', entry.activity.videoTitle));
                const meta = entry.details || {};
                if (typeof meta.count === 'number' && meta.count > 0) {
                    head.append(element('span', 'znh-tag', '発生 ' + meta.count + '回' +
                        (meta.outcome === 'recovered' ? '・復旧済み' : '')));
                }
                if (meta.outcome !== 'recovered' && (meta.outcome === 'failed' || meta.reason === 'not-found')) {
                    head.append(element('span', 'znh-tag', stateLabel(entry)));
                }
                fragment.append(item);
            }
            listNode.append(fragment);
            status.textContent = entries.length + '件表示対象 / 履歴' + all.length + '件';
            more.hidden = entries.length <= shown;
            if (restoreListFocus) {
                restoreListFocus = false;
                const row = Array.from(listNode.querySelectorAll('[data-entry-id]')).find(node => node.dataset.entryId === lastOpenedId);
                (row || query).focus({ preventScroll: true });
                view.scrollTop = listScroll;
            }
        };
        const schedule = () => {
            if (disposed || !isVisible()) {
                return;
            }
            ++revision;
            if (scheduled) {
                dirty = true;
                return;
            }
            scheduled = true;
            void Promise.resolve().then(async () => {
                try {
                    do {
                        dirty = false;
                        const version = revision;
                        try {
                            await render(version);
                        }
                        catch (_) {
                            if (!disposed && isVisible() && version === revision) {
                                status.hidden = false;
                                status.textContent = '履歴の読み込みに失敗しました';
                            }
                        }
                    } while (dirty && !disposed && isVisible());
                }
                finally {
                    scheduled = false;
                }
            });
        };
        query.addEventListener('input', () => { shown = 100; schedule(); });
        filter.addEventListener('change', () => { shown = 100; schedule(); });
        refresh.addEventListener('click', schedule);
        more.addEventListener('click', () => { shown += 100; schedule(); });
        save.addEventListener('click', async () => {
            if (disposed || !isVisible()) {
                return;
            }
            let url = null;
            try {
                const entries = await snapshot();
                if (disposed || !isVisible()) {
                    return;
                }
                const blob = new Blob([JSON.stringify(entries.map(entry => NotificationJournal.toDiagnosticEntry(entry)), null, 2)], { type: 'application/json' });
                url = URL.createObjectURL(blob);
                const link = element('a');
                link.href = url;
                link.download = 'zenzawatch-notifications-' +
                    new Date().toISOString().slice(0, 10) + '.json';
                document.body.append(link);
                try {
                    link.click();
                }
                finally {
                    link.remove();
                }
                status.textContent = 'JSON保存を開始しました（' + entries.length + '件）';
            }
            catch (_) {
                status.textContent = 'JSON保存に失敗しました';
            }
            finally {
                if (url) {
                    const exportUrl = url;
                    window.setTimeout(() => URL.revokeObjectURL(exportUrl), 1000);
                }
            }
        });
        clear.addEventListener('click', async () => {
            if (disposed || !isVisible()) {
                return;
            }
            if (!window.confirm('通知・エラー履歴をすべて削除しますか？')) {
                return;
            }
            const ok = await NotificationJournal.clear();
            if (disposed || !isVisible())
                return;
            returnToList();
            status.textContent = ok ? '履歴を削除しました' :
                'セッション履歴を削除しました。保存領域は削除できていない可能性があります';
            schedule();
        });
        const unsubscribe = NotificationJournal.subscribe(schedule);
        if (events && typeof events.on === 'function') {
            events.on('tabChange', schedule);
        }
        schedule();
        return () => {
            disposed = true;
            unsubscribe();
            if (events && typeof events.off === 'function') {
                events.off('tabChange', schedule);
            }
            view.remove();
        };
    };
    const mountDock = ({ container, button }) => {
        const existing = docks.get(container);
        if (existing) {
            return existing;
        }
        const dock = element('section', 'zenzaNotificationDock');
        dock.id = 'zenzaNotificationDock-' + ++nextDockId;
        dock.hidden = true;
        dock.setAttribute('role', 'dialog');
        dock.setAttribute('aria-label', '通知・エラー履歴');
        const header = element('div', 'znh-dock-header');
        header.append(element('strong', '', '通知・エラー履歴'));
        dock.append(header);
        container.append(dock);
        let open = false;
        let disposed = false;
        let layoutPending = false;
        const updateLayout = () => {
            layoutPending = false;
            if (disposed || !open) {
                return;
            }
            const host = container.getBoundingClientRect();
            const scale = container.offsetHeight > 0 && host.height > 0 ? host.height / container.offsetHeight : 1;
            const launcher = container.querySelector('.commentHistorySwitch') || document.querySelector('.commentHistorySwitch');
            const anchor = launcher?.getBoundingClientRect();
            const viewport = window.innerHeight;
            const inset = anchor && anchor.width > 0 && anchor.height > 0 ?
                Math.max(16, Math.min(viewport - 120, viewport - anchor.top + 10)) : 50;
            const top = Math.max(16, host.top + 16);
            const bottom = Math.max(top, viewport - inset);
            // Absolute coordinates are in the host's unscaled padding box, not viewport pixels.
            const origin = host.top + container.clientTop * scale;
            dock.style.top = ((top - origin) / scale + container.scrollTop) + 'px';
            dock.style.bottom = 'auto';
            dock.style.height = ((bottom - top) / scale) + 'px';
            dock.style.maxHeight = 'none';
            dock.style.boxSizing = 'border-box';
        };
        const scheduleLayout = () => {
            if (disposed || !open || layoutPending) {
                return;
            }
            layoutPending = true;
            void Promise.resolve().then(updateLayout);
        };
        const resizeObserver = typeof window.ResizeObserver === 'function' ? new window.ResizeObserver(scheduleLayout) : null;
        resizeObserver?.observe(container);
        resizeObserver?.observe(button);
        const layoutObserver = typeof window.MutationObserver === 'function' ? new window.MutationObserver(scheduleLayout) : null;
        const observeLayoutChain = (start) => {
            for (let node = start; node; node = node.parentElement) {
                layoutObserver?.observe(node, { attributes: true, attributeFilter: ['class', 'style'] });
            }
        };
        observeLayoutChain(container);
        observeLayoutChain(button);
        window.addEventListener('resize', scheduleLayout);
        document.addEventListener('scroll', scheduleLayout, true);
        document.addEventListener('fullscreenchange', scheduleLayout);
        document.addEventListener('webkitfullscreenchange', scheduleLayout);
        container.addEventListener('transitionend', scheduleLayout);
        let animation = null;
        const cancelAnimation = () => {
            if (animation) {
                animation.onfinish = null;
                animation.cancel();
                animation = null;
            }
        };
        const animate = (opening, done = () => { }) => {
            cancelAnimation();
            if (typeof dock.animate !== 'function' || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
                done();
                return;
            }
            const frames = opening ?
                [{ opacity: 0, transform: 'translate(12px,18px) scale(.86)' }, { opacity: 1, transform: 'none' }] :
                [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translate(8px,12px) scale(.92)' }];
            try {
                const current = animation = dock.animate(frames, { duration: opening ? 220 : 160, easing: opening ? 'cubic-bezier(.2,.9,.3,1.15)' : 'ease-in', fill: 'both' });
                current.onfinish = () => { if (animation !== current) {
                    return;
                } cancelAnimation(); done(); };
            }
            catch {
                cancelAnimation();
                done();
            }
        };
        let previousFocus = null;
        let addedContainerTabIndex = false;
        let refresh = () => { };
        const oldControls = button.getAttribute('aria-controls');
        const oldExpanded = button.getAttribute('aria-expanded');
        const oldPopup = button.getAttribute('aria-haspopup');
        button.setAttribute('aria-controls', dock.id);
        button.setAttribute('aria-haspopup', 'dialog');
        button.setAttribute('aria-expanded', 'false');
        const disposeView = mount(dock, {
            on: (_event, listener) => { refresh = listener; },
            off: () => { refresh = () => { }; }
        }, () => open);
        const close = (restoreFocus = true) => {
            if (!open) {
                return;
            }
            open = false;
            dock.inert = true;
            animate(false, () => { dock.hidden = true; dock.inert = false; });
            button.setAttribute('aria-expanded', 'false');
            if (!restoreFocus) {
                return;
            }
            const canFocus = (target) => {
                if (!target?.isConnected || target === document.body || target === document.documentElement ||
                    target.closest('[hidden], [inert]') || target.matches(':disabled')) {
                    return false;
                }
                for (let node = target; node; node = node.parentElement) {
                    const css = window.getComputedStyle(node);
                    if (css.display === 'none' || css.visibility === 'hidden' || css.visibility === 'collapse') {
                        return false;
                    }
                }
                return true;
            };
            const target = canFocus(button) ? button : canFocus(previousFocus) ? previousFocus : null;
            if (target) {
                target.focus();
            }
            if (!target || document.activeElement !== target) {
                if (!container.hasAttribute('tabindex')) {
                    container.tabIndex = -1;
                    addedContainerTabIndex = true;
                }
                container.focus();
            }
        };
        const onKeyDown = (event) => {
            if (!open || event.key !== 'Escape') {
                return;
            }
            event.preventDefault();
            event.stopImmediatePropagation();
            close();
        };
        // Capture before the player's document-level shortcut handler can close playback.
        window.addEventListener('keydown', onKeyDown, true);
        const onOutside = (event) => {
            if (!open) {
                return;
            }
            const path = event.composedPath();
            if (path.includes(dock) || path.includes(button)) {
                return;
            }
            close(false);
        };
        document.addEventListener('pointerdown', onOutside, true);
        document.addEventListener('click', onOutside, true);
        // The player cancels all bubbled clicks and maps button key presses to playback.
        // Keep native summary/button/select behavior inside this independent surface.
        const stopPlayerEvent = (event) => { event.stopPropagation(); };
        const localEvents = ['click', 'dblclick', 'keydown', 'keyup', 'wheel'];
        for (const name of localEvents) {
            dock.addEventListener(name, stopPlayerEvent);
        }
        const controller = {
            get isOpen() { return open; },
            toggle() {
                if (disposed) {
                    return;
                }
                if (open) {
                    close();
                    return;
                }
                previousFocus = document.activeElement;
                cancelAnimation();
                open = true;
                dock.inert = false;
                dock.hidden = false;
                updateLayout();
                const commentButton = container.querySelector('.commentHistorySwitch') || document.querySelector('.commentHistorySwitch');
                if (commentButton) {
                    resizeObserver?.observe(commentButton);
                    observeLayoutChain(commentButton);
                }
                button.setAttribute('aria-expanded', 'true');
                refresh();
                dock.querySelector('.znh-detail:not([hidden]) [data-history-back], .znh-toolbar:not([hidden]) input')?.focus();
                animate(true);
            },
            close,
            dispose() {
                if (disposed) {
                    return;
                }
                close();
                disposed = true;
                resizeObserver?.disconnect();
                layoutObserver?.disconnect();
                window.removeEventListener('resize', scheduleLayout);
                document.removeEventListener('scroll', scheduleLayout, true);
                document.removeEventListener('fullscreenchange', scheduleLayout);
                document.removeEventListener('webkitfullscreenchange', scheduleLayout);
                container.removeEventListener('transitionend', scheduleLayout);
                cancelAnimation();
                window.removeEventListener('keydown', onKeyDown, true);
                document.removeEventListener('pointerdown', onOutside, true);
                document.removeEventListener('click', onOutside, true);
                for (const name of localEvents) {
                    dock.removeEventListener(name, stopPlayerEvent);
                }
                if (addedContainerTabIndex && container.getAttribute('tabindex') === '-1') {
                    container.removeAttribute('tabindex');
                }
                if (disposeView) {
                    disposeView();
                }
                dock.remove();
                docks.delete(container);
                for (const [name, value] of [
                    ['aria-controls', oldControls], ['aria-expanded', oldExpanded], ['aria-haspopup', oldPopup]
                ]) {
                    if (value === null) {
                        button.removeAttribute(name);
                    }
                    else {
                        button.setAttribute(name, value);
                    }
                }
            }
        };
        docks.set(container, controller);
        return controller;
    };
    return { mount, mountDock };
})();
//===END===
export {NotificationHistoryPanel};
