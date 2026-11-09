// GENERATED FROM tools/typescript-stage1/nico-src/CommentSubmitLifetime.ts (Task505). Edit the .ts and run npm run nico:sync.
//===BEGIN===
const CommentSubmitLifetime = (() => {
    const submit = (panel) => {
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
        // Value equality alone is insufficient: a new draft can be edited back to
        // the same text while the earlier network POST is still outstanding.
        let draftRevision = 0;
        const onEdit = () => { draftRevision++; };
        const editEvents = 'input.zwSubmitLifetime change.zwSubmitLifetime compositionend.zwSubmitLifetime';
        panel._$commentInput.on?.(editEvents, onEdit);
        panel._$commandInput.on?.(editEvents, onEdit);
        panel._$view.addClass('updating');
        const post = new Promise((resolve, reject) => panel.emit('post', { resolve, reject }, chat, cmd));
        const settled = post.then(() => {
            // Never erase a new draft edited while the previous POST was pending.
            if (draftRevision === 0 &&
                panel._$commentInput.val() === originalChat &&
                panel._$commandInput.val() === originalCommand) {
                panel._$commentInput.val('').blur();
                panel._$commandInput.blur();
                panel._togglePopover(false);
            }
            return true;
        }, () => false // Keep the failed draft for explicit retry.
        );
        panel._submitPromise = settled.finally(() => {
            panel._$commentInput.off?.(editEvents, onEdit);
            panel._$commandInput.off?.(editEvents, onEdit);
            panel._submitPending = false;
            panel._submitPromise = null;
            panel._$view.removeClass('updating');
        });
        return panel._submitPromise;
    };
    return { submit };
})();
//===END===
export {CommentSubmitLifetime};
