//===BEGIN===
// Task505: submit-lock and draft lifetime, isolated before TypeScript migration.
const CommentSubmitLifetime = (() => {
  const submit = panel => {
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
    const post = new Promise((resolve, reject) =>
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
//===END===
export {CommentSubmitLifetime};
