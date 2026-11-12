"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMainPlayerClient = createMainPlayerClient;
exports.installMainPlayerProvider = installMainPlayerProvider;
const targets_1 = require("./targets");
// This channel exists only inside the static Nico player frame. External
// parents never receive API responses, credentials, fetch methods or ports.
const protocol = 'zenza-main-player-v1';
function eligible(w) {
    return w !== w.top && w.name === 'ZenzaWatchExternalTrialPlayer' &&
        w.location.origin === 'https://www.nicovideo.jp' && w.location.pathname === '/robots.txt';
}
function accepts(w, event) {
    return event.source === w && event.origin === w.location.origin &&
        event.data?.protocol === protocol;
}
function createMainPlayerClient(w, options = {}) {
    let disposed = false, closing = false, connected = false, seq = 0, stageListener = (_) => { };
    const channel = w.crypto.randomUUID();
    let pending;
    const send = (data) => w.postMessage({ protocol, channel, ...data }, w.location.origin);
    function settle(error) {
        if (!pending)
            return;
        const task = pending;
        pending = undefined;
        w.clearTimeout(task.timer);
        w.clearTimeout(task.retry);
        if (error)
            task.reject(error);
        else
            task.resolve();
    }
    const receive = (event) => {
        if (disposed || !accepts(w, event) || event.data.channel !== channel)
            return;
        const message = event.data;
        if (closing && message.type !== 'stage')
            return;
        if (message.type === 'ready' && pending) {
            connected = true;
            w.clearTimeout(pending.retry);
            if (!pending.ready) {
                pending.ready = true;
                w.clearTimeout(pending.timer);
                pending.timer = w.setTimeout(() => settle(Error('PLAYER_TIMEOUT')), 60000);
            }
            send({ type: 'open', id: pending.id, requestId: pending.seq });
        }
        else if (message.type === 'opened' && message.requestId === pending?.seq)
            settle();
        else if (message.type === 'error' && message.requestId === pending?.seq) {
            const allowed = ['LOGIN_REQUIRED', 'AUTH_FORBIDDEN', 'AUTH_TIMEOUT', 'GM_NETWORK_ERROR', 'PLAYER_CLOSED'];
            const error = Object.assign(Error(allowed.includes(message.code) ? message.code : 'PLAYER_START_FAILED'), { stage: ['BOOT', 'SETTINGS', 'AUTH', 'UI', 'VIDEO'].includes(message.stage) ? message.stage : 'BOOT' });
            settle(error);
        }
        else if (message.type === 'settings')
            options.onSettings?.(message.values);
        else if (message.type === 'stage' && typeof message.stage === 'string') {
            if (message.stage === 'CLOSING') {
                closing = true;
                settle(Error('PLAYER_CLOSED'));
                options.onClosing?.();
            }
            else if (message.stage === 'CLOSED') {
                settle(Error('PLAYER_CLOSED'));
                options.onClosed?.();
            }
            else if (['BOOT', 'SETTINGS', 'AUTH', 'UI', 'VIDEO', 'OPEN'].includes(message.stage))
                stageListener(message.stage);
        }
    };
    w.addEventListener('message', receive);
    const dispose = () => {
        if (disposed)
            return;
        disposed = true;
        settle(Error('PLAYER_CLOSED'));
        w.removeEventListener('message', receive);
    };
    w.addEventListener('pagehide', dispose, { once: true });
    return {
        async open(id, event) {
            if (!event?.isTrusted)
                throw Error('USER_CLICK_REQUIRED');
            if (!eligible(w) || !(0, targets_1.validVideoId)(id))
                throw Error('INVALID_VIDEO_ID');
            if (disposed || closing)
                throw Error('PLAYER_CLOSED');
            if (pending)
                throw Error('PLAYER_BUSY');
            return new Promise((resolve, reject) => {
                const task = pending = { id, seq: ++seq, resolve, reject,
                    timer: w.setTimeout(() => settle(Error('MAIN_PLAYER_UNAVAILABLE')), options.timeoutMs ?? 15000),
                    retry: undefined };
                const hello = () => {
                    if (pending !== task || disposed)
                        return;
                    send({ type: 'hello', snapshot: options.snapshot?.() });
                    task.retry = w.setTimeout(hello, options.retryMs ?? 250);
                };
                hello();
            });
        },
        updateSettings(values) { if (!disposed)
            send({ type: 'settings', values }); },
        close() {
            if (disposed)
                return false;
            if (closing)
                return true;
            closing = true;
            settle(Error('PLAYER_CLOSED'));
            if (connected)
                send({ type: 'close' });
            else {
                options.onClosing?.();
                options.onClosed?.();
            }
            return true;
        },
        setStageListener(listener) { stageListener = listener; },
        dispose
    };
}
function installMainPlayerProvider(w, session, options = {}) {
    if (!eligible(w))
        return () => { };
    let channel = '', last = 0, busy = false, disposed = false, closing = false;
    const send = (data) => {
        if (!disposed && channel)
            w.postMessage({ protocol, channel, ...data }, w.location.origin);
    };
    session.setStageListener(stage => { if (stage === 'CLOSING' || stage === 'CLOSED')
        closing = true; send({ type: 'stage', stage }); });
    options.subscribeSettings?.(values => send({ type: 'settings', values }));
    const receive = async (event) => {
        if (disposed || !accepts(w, event))
            return;
        const m = event.data;
        if (typeof m.channel !== 'string' || !/^[a-f0-9-]{36}$/i.test(m.channel))
            return;
        if (m.type === 'hello') {
            if (channel && channel !== m.channel)
                return;
            if (!channel)
                options.setup?.(m.snapshot);
            channel = m.channel;
            send({ type: 'ready' });
            return;
        }
        if (!channel || m.channel !== channel)
            return;
        if (m.type === 'settings') {
            options.onSettings?.(m.values);
            return;
        }
        if (m.type === 'close') {
            closing = true;
            if (!session.close()) {
                send({ type: 'stage', stage: 'CLOSING' });
                send({ type: 'stage', stage: 'CLOSED' });
            }
            return;
        }
        if (m.type !== 'open' || closing || busy || !Number.isSafeInteger(m.requestId) ||
            m.requestId <= last || !(0, targets_1.validVideoId)(m.id))
            return;
        last = m.requestId;
        busy = true;
        try {
            await session.open(m.id, { isTrusted: true });
            if (!closing)
                send({ type: 'opened', requestId: m.requestId });
        }
        catch (e) {
            const error = e;
            send({ type: 'error', requestId: m.requestId, code: error.message, stage: error.stage });
        }
        finally {
            busy = false;
        }
    };
    w.addEventListener('message', receive);
    const dispose = () => { disposed = true; w.removeEventListener('message', receive); };
    w.addEventListener('pagehide', dispose, { once: true });
    return dispose;
}
