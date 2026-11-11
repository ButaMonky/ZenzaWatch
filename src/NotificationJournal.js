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
    const diagnosticGroups = new Map();
    const confirmedGroups = new Map();
    const confirmedRecent = [];
    const epochs = new WeakMap();
    let knownEpoch = null;
    let sequence = 0;
    let buildIdentity = {};
    const configureBuild = (version, build) => { buildIdentity = { version, build }; };
    const store = NotificationJournalStore.create(typeof indexedDB === 'undefined' ? undefined : indexedDB);
    const announce = () => {
        for (const listener of listeners) {
            try {
                listener();
            }
            catch (_) { /* listeners may not break logging */ }
        }
    };
    const removeSession = (entry) => {
        const index = session.indexOf(entry);
        if (index !== -1) {
            session.splice(index, 1);
        }
    };
    const acceptEpoch = (epoch) => {
        if (epoch === null || knownEpoch !== null && epoch <= knownEpoch)
            return;
        knownEpoch = epoch;
        const old = (entry) => { const owned = epochs.get(entry); return typeof owned === 'number' && owned < epoch; };
        const before = session.length;
        for (let i = session.length - 1; i >= 0; i--)
            if (old(session[i]))
                session.splice(i, 1);
        for (let i = recent.length - 1; i >= 0; i--)
            if (old(recent[i]))
                recent.splice(i, 1);
        for (const [key, entry] of diagnosticGroups)
            if (old(entry))
                diagnosticGroups.delete(key);
        confirmedGroups.clear();
        confirmedRecent.length = 0;
        if (before !== session.length)
            announce();
    };
    let channel = null;
    try {
        if (typeof BroadcastChannel !== 'undefined') {
            channel = new BroadcastChannel('zenza-notification-journal-clear');
            channel.onmessage = event => {
                const epoch = event.data?.clearEpoch;
                if (Number.isSafeInteger(epoch) && epoch >= 0)
                    acceptEpoch(epoch);
            };
        }
    }
    catch { /* durable list checks remain available */ }
    const isDuplicate = (entry, items) => entry.category === 'general' && items.some(previous => previous.category !== 'general' && previous.message === entry.message &&
        (previous.videoId === entry.videoId || (entry.source === 'popup' && entry.videoId === '')) &&
        entry.timestamp - previous.timestamp <= 2000);
    const record = (input) => {
        if (!input || typeof input !== 'object') {
            return null;
        }
        const now = Date.now();
        const entry = NotificationJournalPolicy.normalize({ ...input, ...buildIdentity, firstOccurredAt: now, lastOccurredAt: now, recoveredAt: undefined }, {
            id: now.toString(36) + '-' + (++sequence).toString(36) + '-' +
                Math.random().toString(36).slice(2, 10),
            timestamp: now
        });
        if (!entry || !entry.message) {
            return null;
        }
        // An explicitly classified event is emitted just before its generic popup.
        // Save only the richer event; do not lose two legitimate repeated notifications.
        const duplicate = isDuplicate(entry, recent);
        if (!duplicate) {
            session.unshift(entry);
            if (session.length > MAX_SESSION)
                session.length = MAX_SESSION;
            recent.unshift(entry);
            if (recent.length > 8)
                recent.length = 8;
        }
        // Even a provisional duplicate remains an operation: a delayed peer clear
        // can invalidate the classified event that caused the synchronous verdict.
        store.append(epoch => {
            acceptEpoch(epoch);
            epochs.set(entry, epoch);
            if (isDuplicate(entry, confirmedRecent)) {
                removeSession(entry);
                return null;
            }
            confirmedRecent.unshift(entry);
            if (confirmedRecent.length > 8)
                confirmedRecent.length = 8;
            if (duplicate) {
                session.unshift(entry);
                if (session.length > MAX_SESSION)
                    session.length = MAX_SESSION;
                announce();
            }
            return entry;
        }, () => removeSession(entry));
        if (!duplicate)
            announce();
        return duplicate ? null : entry;
    };
    const list = async (limit = 300) => {
        const count = Number.isSafeInteger(limit) ? Math.max(1, Math.min(limit, MAX_RECORDS)) : 300;
        const snapshot = await store.snapshot();
        acceptEpoch(snapshot.epoch);
        const stored = knownEpoch !== null && snapshot.epoch !== null && snapshot.epoch < knownEpoch ? [] : snapshot.entries;
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
    const recordDiagnostic = (key, input) => {
        if (!/^diag-[a-z0-9-]{1,150}$/.test(key)) {
            return null;
        }
        const previous = diagnosticGroups.get(key);
        const fields = input.details && typeof input.details === 'object' ? input.details : {};
        const recovered = fields.outcome === 'recovered';
        if (recovered && !previous) {
            return null;
        }
        const count = Math.min(1e12, Number(previous?.details.count || 0) + (recovered ? 0 : 1));
        const now = Date.now();
        const freshId = now.toString(36) + '-' + (++sequence).toString(36) + '-' + Math.random().toString(36).slice(2, 10);
        const fresh = NotificationJournalPolicy.normalize({ ...input, ...buildIdentity }, { id: freshId, timestamp: now });
        if (!fresh || !fresh.message)
            return null;
        const data = { ...input, ...buildIdentity,
            version: previous?.version ?? buildIdentity.version, build: previous?.build ?? buildIdentity.build,
            firstOccurredAt: previous?.firstOccurredAt ?? now,
            lastOccurredAt: recovered ? previous?.lastOccurredAt : Math.max(now, previous?.lastOccurredAt ?? now),
            recoveredAt: recovered ? Math.max(now, previous?.lastOccurredAt ?? now) : undefined,
            details: { ...(recovered ? previous?.details : {}), ...fields, count,
                ...(recovered && previous?.details.reason ? { reason: previous.details.reason } : {}) } };
        const entry = NotificationJournalPolicy.normalize(data, {
            id: previous?.id || freshId,
            timestamp: now
        });
        if (!entry || !entry.message) {
            return null;
        }
        // Commit all synchronous state before notifying listeners: clear() or a
        // nested report must not be overwritten when the outer notification returns.
        diagnosticGroups.delete(key);
        if (!recovered) {
            diagnosticGroups.set(key, entry);
        }
        while (diagnosticGroups.size > 100) {
            diagnosticGroups.delete(diagnosticGroups.keys().next().value);
        }
        const old = session.findIndex(item => item.id === entry.id);
        if (old !== -1) {
            session.splice(old, 1);
        }
        session.unshift(entry);
        if (session.length > MAX_SESSION) {
            session.length = MAX_SESSION;
        }
        store.append(epoch => {
            acceptEpoch(epoch);
            epochs.set(entry, epoch);
            const prior = confirmedGroups.get(key);
            if (recovered && !prior) {
                removeSession(entry);
                if (diagnosticGroups.get(key) === entry)
                    diagnosticGroups.delete(key);
                announce();
                return null;
            }
            const normalized = NotificationJournalPolicy.normalize({ ...fresh,
                version: prior?.version ?? fresh.version, build: prior?.build ?? fresh.build,
                firstOccurredAt: prior?.firstOccurredAt ?? now,
                lastOccurredAt: recovered ? prior?.lastOccurredAt : Math.max(now, prior?.lastOccurredAt ?? now),
                recoveredAt: recovered ? Math.max(now, prior?.lastOccurredAt ?? now) : undefined,
                details: { ...(recovered ? prior?.details : {}), ...fresh.details,
                    count: Math.min(1e12, Number(prior?.details.count || 0) + (recovered ? 0 : 1)),
                    ...(recovered && prior?.details.reason ? { reason: prior.details.reason } : {}) } }, { id: prior?.id || freshId, timestamp: now });
            if (!normalized) {
                removeSession(entry);
                return null;
            }
            const changed = JSON.stringify(entry) !== JSON.stringify(normalized);
            Object.assign(entry, normalized);
            if (normalized.recoveredAt === undefined)
                delete entry.recoveredAt;
            // Replace the provisional same-group fallback while retaining a newer
            // queued revision. A commit later removes only this exact object.
            for (let i = session.length - 1; i >= 0; i--)
                if (session[i] !== entry && session[i] === prior)
                    session.splice(i, 1);
            confirmedGroups.delete(key);
            if (!recovered)
                confirmedGroups.set(key, entry);
            while (confirmedGroups.size > 100)
                confirmedGroups.delete(confirmedGroups.keys().next().value);
            if (changed)
                announce();
            return entry;
        }, () => removeSession(entry));
        announce();
        return entry;
    };
    const clear = () => {
        // Queue deletion before announcing: subscribers may record new events,
        // which belong after this clear and must survive it.
        const clearing = store.clear(epoch => {
            acceptEpoch(epoch);
            try {
                channel?.postMessage({ clearEpoch: epoch });
            }
            catch { }
        });
        session.length = 0;
        recent.length = 0;
        diagnosticGroups.clear();
        confirmedGroups.clear();
        confirmedRecent.length = 0;
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
    const toDiagnosticEntry = (entry) => NotificationJournalPolicy.toDiagnosticEntry(entry);
    return { record, recordDiagnostic, list, clear, subscribe, configureBuild, toDiagnosticEntry };
})();
//===END===
export {NotificationJournal};
