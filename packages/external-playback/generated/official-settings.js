"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectOfficialExternalSettings = connectOfficialExternalSettings;
const settings_1 = require("./settings");
/** Synchronize only public external-launch preferences, never account/runtime data. */
function connectOfficialExternalSettings(w, gm) {
    const slot = 'external-links-v1', prefix = 'ZenzaWatch_', keys = Object.keys(settings_1.externalDefaults);
    let syncing = false;
    const readLocal = () => Object.fromEntries(keys.flatMap(key => { try {
        const raw = w.localStorage.getItem(prefix + key);
        return raw === null ? [] : [[key, JSON.parse(raw)]];
    }
    catch {
        return [];
    } }));
    const publish = (changed) => {
        const local = readLocal(), patch = Object.fromEntries(changed.filter(key => keys.includes(key) && Object.prototype.hasOwnProperty.call(local, key)).map(key => [key, local[key]]));
        if (Object.keys(patch).length)
            gm.set(slot, (0, settings_1.sanitizeExternal)({ ...(0, settings_1.sanitizeExternal)(gm.get(slot)), ...patch }));
    };
    const pull = () => {
        if (syncing)
            return;
        syncing = true;
        try {
            if (!gm.get(slot))
                publish(Object.keys(readLocal()));
            const values = (0, settings_1.sanitizeExternal)(gm.get(slot));
            for (const key of keys)
                w.localStorage.setItem(prefix + key, JSON.stringify(values[key]));
            w.dispatchEvent(new w.CustomEvent('ZenzaWatch-advanced-settings-saved', { detail: { keys } }));
        }
        finally {
            syncing = false;
        }
    };
    const onSave = (event) => {
        if (syncing)
            return;
        const changed = event.detail?.keys;
        if (Array.isArray(changed))
            publish(changed.filter((key) => typeof key === 'string'));
    };
    w.addEventListener('ZenzaWatch-advanced-settings-saved', onSave);
    const subscription = gm.listen?.(slot, pull);
    pull();
    return () => { w.removeEventListener('ZenzaWatch-advanced-settings-saved', onSave); if (subscription !== undefined)
        gm.unlisten?.(subscription); };
}
