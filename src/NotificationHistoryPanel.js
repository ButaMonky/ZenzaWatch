import {NotificationJournal} from './NotificationJournal';
// GENERATED FROM tools/typescript-stage1/nico-src/NotificationHistoryPanel.ts (TaskNLOG20261023). Edit the .ts and run npm run nico:sync.
//===BEGIN===
//@require NotificationJournal
const NotificationHistoryPanel = (() => {
    const STYLE_ID = 'zenzaNotificationHistoryStyle';
    const docks = new WeakMap();
    let nextDockId = 0;
    const labels = {
        general: '通知', comment: 'コメント', like: 'いいね',
        network: '通信', player: '再生', system: '内部処理'
    };
    const style = [
        '.zenzaNotificationDock{position:absolute;left:8px;bottom:48px;z-index:10000;width:min(460px,calc(100% - 16px));max-height:calc(100% - 56px);display:flex;flex-direction:column;overflow:auto;background:#202020;color:#eee;border:1px solid #777;border-radius:6px;box-shadow:0 4px 20px #0009;text-align:left;user-select:text;}',
        '.zenzaNotificationDock[hidden]{display:none!important;}',
        '.zenzaNotificationDock .znh-dock-header{display:flex;flex-shrink:0;align-items:center;justify-content:space-between;gap:8px;padding:8px 12px;border-bottom:1px solid #555;}',
        '.zenzaNotificationDock .znh-close{font:inherit;background:#333;color:#eee;border:1px solid #777;border-radius:4px;cursor:pointer;padding:4px 10px;}',
        '.zenzaNotificationDock .znh-close:focus-visible{outline:2px solid #9cf;}',
        // Scroll the complete history view on short players: shrinking only the list
        // lets the toolbar consume its entire height and makes stored entries unreadable.
        '.zenzaNotificationDock .zenzaNotificationHistory{min-height:0;display:block;overflow:auto;overscroll-behavior:contain;}',
        '.zenzaNotificationHistory{box-sizing:border-box;padding:12px;color:inherit;font-size:13px;}',
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
        '.zenzaNotificationHistory .znh-list{overflow:auto;max-height:min(60vh,640px);overscroll-behavior:contain;}',
        '.zenzaNotificationHistory .znh-entry{padding:9px 4px;border-bottom:1px solid #555;overflow-wrap:anywhere;}',
        '.zenzaNotificationHistory .znh-head{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}',
        '.zenzaNotificationHistory .znh-tag{font-size:11px;border-radius:3px;background:#444;padding:2px 5px;}',
        '.zenzaNotificationHistory .znh-entry[data-level="error"] .znh-tag{background:#713434;color:#fff;}',
        '.zenzaNotificationHistory .znh-entry[data-level="warning"] .znh-tag{background:#67512b;color:#fff;}',
        '.zenzaNotificationHistory .znh-entry[data-level="success"] .znh-tag{background:#245b40;color:#fff;}',
        '.zenzaNotificationHistory .znh-date{font-size:11px;color:#aaa;}',
        '.zenzaNotificationHistory .znh-message{white-space:pre-wrap;word-break:break-word;margin:6px 0;}',
        '.zenzaNotificationHistory details{color:#bbb;font-size:11px;}',
        '.zenzaNotificationHistory details pre{white-space:pre-wrap;word-break:break-word;user-select:text;color:#ddd;}',
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
        const clear = element('button', '', '全件削除');
        clear.type = 'button';
        toolbar.append(query, filter, refresh, save, clear);
        const status = element('div', 'znh-status');
        status.setAttribute('role', 'status');
        const listNode = element('div', 'znh-list');
        const actions = element('div', 'znh-actions');
        const more = element('button', '', 'さらに表示');
        more.type = 'button';
        actions.append(more);
        view.append(toolbar, status, listNode, actions);
        root.append(view);
        let shown = 100;
        let revision = 0;
        let scheduled = false;
        let disposed = false;
        const snapshot = async () => NotificationJournal.list(2000);
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
            return [entry.message, entry.videoId, entry.source, entry.category,
                JSON.stringify(entry.details || {})].join(' ').toLocaleLowerCase().includes(needle);
        };
        const render = async () => {
            if (disposed || !isVisible()) {
                return;
            }
            const version = ++revision;
            const all = await snapshot();
            if (disposed || !isVisible() || version !== revision) {
                return;
            }
            const entries = all.filter(matches);
            listNode.replaceChildren();
            const fragment = document.createDocumentFragment();
            for (const entry of entries.slice(0, shown)) {
                const item = element('article', 'znh-entry');
                item.dataset.level = entry.level;
                const head = element('div', 'znh-head');
                head.append(element('span', 'znh-tag', labels[entry.category] || '通知'), element('span', 'znh-date', new Date(entry.timestamp).toLocaleString('ja-JP')));
                if (entry.videoId) {
                    head.append(element('span', 'znh-date', entry.videoId));
                }
                item.append(head, element('div', 'znh-message', entry.message));
                const meta = entry.details || {};
                if (Object.keys(meta).length || entry.source) {
                    const moreDetails = element('details');
                    moreDetails.append(element('summary', '', '診断情報'));
                    const payload = Object.assign({}, meta);
                    if (entry.source) {
                        payload.source = entry.source;
                    }
                    moreDetails.append(element('pre', '', JSON.stringify(payload, null, 2)));
                    item.append(moreDetails);
                }
                fragment.append(item);
            }
            listNode.append(fragment);
            status.textContent = entries.length + '件表示対象 / 履歴' + all.length + '件';
            more.hidden = entries.length <= shown;
        };
        const schedule = () => {
            if (scheduled || disposed || !isVisible()) {
                return;
            }
            scheduled = true;
            Promise.resolve().then(() => {
                scheduled = false;
                void render().catch(() => {
                    if (!disposed && isVisible()) {
                        status.textContent = '履歴の読み込みに失敗しました';
                    }
                });
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
                const blob = new Blob([JSON.stringify(entries, null, 2)], { type: 'application/json' });
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
        const closeButton = element('button', 'znh-close', '閉じる');
        closeButton.type = 'button';
        header.append(element('strong', '', '通知・エラー履歴'), closeButton);
        dock.append(header);
        container.append(dock);
        let open = false;
        let disposed = false;
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
        const close = () => {
            if (!open) {
                return;
            }
            open = false;
            dock.hidden = true;
            button.setAttribute('aria-expanded', 'false');
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
        closeButton.addEventListener('click', close);
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
                open = true;
                dock.hidden = false;
                button.setAttribute('aria-expanded', 'true');
                refresh();
                dock.querySelector('input')?.focus();
            },
            close,
            dispose() {
                if (disposed) {
                    return;
                }
                close();
                disposed = true;
                window.removeEventListener('keydown', onKeyDown, true);
                closeButton.removeEventListener('click', close);
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
