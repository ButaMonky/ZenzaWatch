/**
 * Task505 canonical TypeScript: comment editor submission lock + draft lifetime.
 * Retain draft if posting fails and never send twice while a post is in flight.
 */
export interface CommentSubmitField {
  val(): string;
  val(value: string): CommentSubmitField;
  blur(): CommentSubmitField;
}
export interface CommentSubmitView {
  addClass(name: string): unknown;
  removeClass(name: string): unknown;
}
export interface CommentSubmitControl {
  resolve(value?: void | PromiseLike<void>): void;
  reject(reason?: unknown): void;
}
export interface CommentSubmitPanel {
  _submitPending?: boolean;
  _submitPromise?: Promise<boolean> | null;
  _$commentInput: CommentSubmitField;
  _$commandInput: CommentSubmitField;
  _$view: CommentSubmitView;
  _togglePopover(open: boolean): void;
  emit(event: 'post', control: CommentSubmitControl, chat: string, cmd: string): void;
}
const CommentSubmitLifetime = (() => {
  const submit = (panel: CommentSubmitPanel): Promise<boolean> | null | undefined => {
    // Keep the lock for the full POST promise, not merely the click event.
    if (panel._submitPending) {
      return panel._submitPromise;
    }
    const originalChat = panel._$commentInput.val();
    const originalCommand = panel._$commandInput.val();
    const chat = originalChat.trim();
    const cmd = originalCommand.trim();
    if (!chat.length) {
      return;
    }
    panel._submitPending = true;
    panel._$view.addClass('updating');
    const post = new Promise<void>((resolve, reject) =>
      panel.emit('post', {resolve, reject}, chat, cmd));
    const settled = post.then(
      () => {
        // Never erase a new draft edited while the previous POST was pending.
        if (panel._$commentInput.val() === originalChat &&
            panel._$commandInput.val() === originalCommand) {
          panel._$commentInput.val('').blur();
          panel._$commandInput.blur();
          panel._togglePopover(false);
        }
        return true;
      },
      () => false // Keep the failed draft for explicit retry.
    );
    panel._submitPromise = settled.finally(() => {
      panel._submitPending = false;
      panel._submitPromise = null;
      panel._$view.removeClass('updating');
    });
    return panel._submitPromise;
  };
  return {submit};
})();
export {CommentSubmitLifetime};
