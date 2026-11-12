"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.finishPlayerClose = finishPlayerClose;
/** Give already-requested saves a bounded opportunity to finish before disposal. */
async function finishPlayerClose(pendingSaves, actions, timeoutMs = 2000) {
    const saved = Promise.allSettled(pendingSaves);
    let timeout;
    try {
        await actions.hide();
        await Promise.race([saved, new Promise(resolve => {
                timeout = setTimeout(resolve, timeoutMs);
            })]);
    }
    finally {
        clearTimeout(timeout);
        try {
            actions.dispose();
        }
        finally {
            await actions.finish();
        }
    }
}
