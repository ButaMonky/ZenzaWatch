import {NotificationJournal} from '../nico-src/NotificationJournal';
import {NotificationHistoryPanel} from '../nico-src/NotificationHistoryPanel';
import type {JournalInput, JournalEntry, JournalLevel, JournalCategory} from '../nico-src/NotificationJournal';

const valid: JournalInput = {
  level: 'error', category: 'network', message: 'HTTP error',
  videoId: 'sm9', details: {statusCode: 400}
};
const result: JournalEntry | null = NotificationJournal.record(valid);
const history: Promise<JournalEntry[]> = NotificationJournal.list(100);
const category: JournalCategory = result?.category ?? 'general';
const level: JournalLevel = result?.level ?? 'info';
const unsubscribe: () => void = NotificationJournal.subscribe(() => {});
const mounted: (() => void) | void = NotificationHistoryPanel.mount(document.body);
void history; void category; void level; void unsubscribe; void mounted;

// @ts-expect-error: unknown severities are rejected by canonical typed API
const badSeverity: JournalInput = {level: 'fatal', message:'no'};
// @ts-expect-error: callers must use a supported category
const badCategory: JournalInput = {category:'arbitrary', message:'no'};
void badSeverity;void badCategory;
