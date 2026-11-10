import {NotificationJournalPolicy} from '../packages/zenza/src/notification/NotificationJournalPolicy';
import {NotificationJournalStore} from '../packages/zenza/src/notification/NotificationJournalStore';
// GENERATED FROM tools/typescript-stage1/nico-src/NotificationJournal.ts (TaskNLOG20261023). Edit the .ts and run npm run nico:sync.
//===BEGIN===
//@require NotificationJournalPolicy
//@require NotificationJournalStore
const NotificationJournal = (() => {
    const MAX_RECORDS = 2000;
    const MAX_SESSION = 2000;
    const listeners = new Set();
    const session = [];
    const recent = [];
    let sequence = 0;
    const store = NotificationJournalStore.create(typeof indexedDB === 'undefined' ? undefined : indexedDB);
    const announce = () => {
        for (const listener of listeners) {
            try {
                listener();
            }
            catch (_) { /* listeners may not break logging */ }
        }
    };
    const record = (input) => {
        if (!input || typeof input !== 'object') {
            return null;
        }
        const now = Date.now();
        const entry = NotificationJournalPolicy.normalize(input, {
            id: now.toString(36) + '-' + (++sequence).toString(36) + '-' +
                Math.random().toString(36).slice(2, 10),
            timestamp: now
        });
        if (!entry || !entry.message) {
            return null;
        }
        // An explicitly classified event is emitted just before its generic popup.
        // Save only the richer event; do not lose two legitimate repeated notifications.
        if (entry.category === 'general') {
            const duplicate = recent.some(previous => previous.category !== 'general' &&
                previous.message === entry.message &&
                // PopupMessage has no video ownership at this low-level boundary.
                // A classified event immediately preceding the same popup already
                // carries the original video ID; suppress only that generic echo.
                // Do not suppress unrelated unclassified entries without a video ID.
                (previous.videoId === entry.videoId ||
                    (entry.source === 'popup' && entry.videoId === '')) &&
                entry.timestamp - previous.timestamp <= 2000);
            if (duplicate) {
                return null;
            }
        }
        session.unshift(entry);
        if (session.length > MAX_SESSION) {
            session.length = MAX_SESSION;
        }
        recent.unshift(entry);
        if (recent.length > 8) {
            recent.length = 8;
        }
        store.append(entry, () => {
            // Retain fallback data only until commit, so a different tab can clear it.
            const index = session.findIndex(item => item.id === entry.id);
            if (index !== -1) {
                session.splice(index, 1);
            }
        });
        announce();
        return entry;
    };
    const list = async (limit = 300) => {
        const count = Number.isSafeInteger(limit) ? Math.max(1, Math.min(limit, MAX_RECORDS)) : 300;
        const stored = await store.list();
        const map = new Map();
        for (const entry of stored) {
            if (entry && typeof entry.id === 'string') {
                map.set(entry.id, entry);
            }
        }
        for (const entry of session) {
            map.set(entry.id, entry);
        }
        return Array.from(map.values())
            .sort((a, b) => b.timestamp - a.timestamp || (a.id < b.id ? 1 : -1))
            .slice(0, count);
    };
    const clear = () => {
        // Queue deletion before announcing: subscribers may record new events,
        // which belong after this clear and must survive it.
        const clearing = store.clear();
        session.length = 0;
        recent.length = 0;
        announce();
        return clearing;
    };
    const subscribe = (listener) => {
        if (typeof listener !== 'function') {
            return () => { };
        }
        listeners.add(listener);
        return () => listeners.delete(listener);
    };
    return { record, list, clear, subscribe };
})();
//===END===
export {NotificationJournal};
