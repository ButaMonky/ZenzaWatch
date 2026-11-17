/**
 * Canonical TypeScript source for src/NicoVideoPlayerDialogNotifications.js (Task1060: NicoVideoPlayerDialog.ts から役割ごとに分割).
 * 通知と通知履歴パネル。
 * NicoVideoPlayerDialog.prototype へそのまま取り付ける（クラスのメソッドと同じく列挙されない）。
 */
/**
 * Values that come from raw API/DOM records or from modules that are still JS; this one
 * documented loose alias covers them.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = any;
// Task1060: 本体のクラス（実行時は同じスコープにある）。
type Dialog = import('./NicoVideoPlayerDialog').NicoVideoPlayerDialog;
declare const NicoVideoPlayerDialog: typeof import('./NicoVideoPlayerDialog').NicoVideoPlayerDialog;
// legacy-to-ts: names provided by other bundled modules
declare const NotificationHistoryPanel: typeof import('./NotificationHistoryPanel').NotificationHistoryPanel;
declare const NotificationJournal: typeof import('./NotificationJournal').NotificationJournal;
declare const _: import('./shared-types/Lodash').LodashSubset;

/** 通知と通知履歴パネル。 */
const NicoVideoPlayerDialogNotifications = {
  _recordDiagnostic(this: Dialog, entry?: Loose) {
    try {
      if (typeof NotificationJournal !== 'undefined') {
        NotificationJournal.record(entry);
      }
    } catch (_) { /* diagnostics must never interrupt player operations */ }
  },
  _toggleNotificationHistory(this: Dialog) {
    if (!this._state.isOpen || typeof NotificationHistoryPanel === 'undefined') { return; }
    const container = this._$playerContainer && this._$playerContainer[0];
    const button = container && container.querySelector('.notificationHistorySwitch');
    if (!button) { return; }
    if (!this._notificationHistoryDock) {
      this._notificationHistoryDock = NotificationHistoryPanel.mountDock({container, button});
    }
    this._notificationHistoryDock.toggle();
  },
  _closeNotificationHistory(this: Dialog) {
    this._notificationHistoryDock?.dispose();
    this._notificationHistoryDock = null;
  },
};

export {NicoVideoPlayerDialogNotifications};
