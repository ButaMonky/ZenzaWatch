/** Notification facade: session fallback, duplicate suppression and subscriptions. */
import type {JournalInput, JournalEntry} from './NotificationJournalPolicy';
export type {JournalLevel, JournalCategory, JournalDetails, JournalInput, JournalEntry} from './NotificationJournalPolicy';
declare const NotificationJournalPolicy: typeof import('./NotificationJournalPolicy').NotificationJournalPolicy;
declare const NotificationJournalStore: typeof import('./NotificationJournalStore').NotificationJournalStore;

const NotificationJournal = (() => {
  const MAX_RECORDS = 2000;
  const MAX_SESSION = 2000;
  const listeners = new Set<() => void>();
  const session: JournalEntry[] = [];
  const recent: JournalEntry[] = [];
  const diagnosticGroups = new Map<string, JournalEntry>();
  let sequence = 0;
  const store = NotificationJournalStore.create(typeof indexedDB === 'undefined' ? undefined : indexedDB);
  const announce = (): void => {
    for (const listener of listeners) {
      try { listener(); } catch (_) { /* listeners may not break logging */ }
    }
  };
  const record = (input: JournalInput | null | undefined): JournalEntry | null => {
    if (!input || typeof input !== 'object') { return null; }
    const now = Date.now();
    const entry = NotificationJournalPolicy.normalize(input, {
      id: now.toString(36) + '-' + (++sequence).toString(36) + '-' +
        Math.random().toString(36).slice(2, 10),
      timestamp: now
    });
    if (!entry || !entry.message) { return null; }
    // An explicitly classified event is emitted just before its generic popup.
    // Save only the richer event; do not lose two legitimate repeated notifications.
    if (entry.category === 'general') {
      const duplicate = recent.some(previous =>
        previous.category !== 'general' &&
        previous.message === entry.message &&
        // PopupMessage has no video ownership at this low-level boundary.
        // A classified event immediately preceding the same popup already
        // carries the original video ID; suppress only that generic echo.
        // Do not suppress unrelated unclassified entries without a video ID.
        (previous.videoId === entry.videoId ||
          (entry.source === 'popup' && entry.videoId === '')) &&
        entry.timestamp - previous.timestamp <= 2000);
      if (duplicate) { return null; }
    }
    session.unshift(entry);
    if (session.length > MAX_SESSION) { session.length = MAX_SESSION; }
    recent.unshift(entry);
    if (recent.length > 8) { recent.length = 8; }
    store.append(entry, () => {
      // Retain fallback data only until commit, so a different tab can clear it.
      const index = session.indexOf(entry);
      if (index !== -1) { session.splice(index, 1); }
    });
    announce();
    return entry;
  };
  const list = async (limit = 300): Promise<JournalEntry[]> => {
    const count = Number.isSafeInteger(limit) ? Math.max(1, Math.min(limit, MAX_RECORDS)) : 300;
    const stored = await store.list();
    const map = new Map<string, JournalEntry>();
    for (const entry of stored) {
      if (entry && typeof entry.id === 'string') { map.set(entry.id, entry); }
    }
    for (const entry of session) { map.set(entry.id, entry); }
    return Array.from(map.values())
      .sort((a, b) => b.timestamp - a.timestamp || (a.id < b.id ? 1 : -1))
      .slice(0, count);
  };
  const recordDiagnostic = (key: string, input: JournalInput): JournalEntry | null => {
    if (!/^diag-[a-z0-9-]{1,150}$/.test(key)) { return null; }
    const previous = diagnosticGroups.get(key);
    const fields = input.details && typeof input.details === 'object' ? input.details as Record<string, unknown> : {};
    const recovered = fields.outcome === 'recovered';
    if (recovered && !previous) { return null; }
    const count = Math.min(1e12, Number(previous?.details.count || 0) + (recovered ? 0 : 1));
    const data = {...input, details: {...(recovered ? previous?.details : {}), ...fields, count,
      ...(recovered && previous?.details.reason ? {reason: previous.details.reason} : {})}};
    const now = Date.now();
    const entry = NotificationJournalPolicy.normalize(data, {
      id: previous?.id || now.toString(36) + '-' + (++sequence).toString(36) + '-' + Math.random().toString(36).slice(2, 10),
      timestamp: now
    });
    if (!entry || !entry.message) { return null; }
    // Commit all synchronous state before notifying listeners: clear() or a
    // nested report must not be overwritten when the outer notification returns.
    diagnosticGroups.delete(key);
    if (!recovered) { diagnosticGroups.set(key, entry); }
    while (diagnosticGroups.size > 100) { diagnosticGroups.delete(diagnosticGroups.keys().next().value!); }
    const old = session.findIndex(item => item.id === entry.id);
    if (old !== -1) { session.splice(old, 1); }
    session.unshift(entry);
    if (session.length > MAX_SESSION) { session.length = MAX_SESSION; }
    store.append(entry, () => {
      // An older transaction must not discard a newer pending update.
      const index = session.indexOf(entry);
      if (index !== -1) { session.splice(index, 1); }
    });
    announce();
    return entry;
  };
  const clear = (): Promise<boolean> => {
    // Queue deletion before announcing: subscribers may record new events,
    // which belong after this clear and must survive it.
    const clearing = store.clear();
    session.length = 0;
    recent.length = 0;
    diagnosticGroups.clear();
    announce();
    return clearing;
  };
  const subscribe = (listener: () => void): (() => void) => {
    if (typeof listener !== 'function') { return () => {}; }
    listeners.add(listener);
    return () => listeners.delete(listener);
  };
  return {record, recordDiagnostic, list, clear, subscribe};
})();
export { NotificationJournal };
