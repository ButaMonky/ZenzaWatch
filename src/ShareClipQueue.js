//===BEGIN===
// The page owns reservations. A Web Lock also serializes cooperating Nico tabs.
// No media, credentials or post text is written to shared browser storage.
const ShareClipQueue = (() => {
  const lockName = 'ZenzaWatch-share-clip-output';
  const pending = [];
  const listeners = new Set();
  let active;
  function items() { return pending.map(entry => entry.ticket); }
  function notify() {
    for (const listener of listeners) {
      try { listener(items()); }
      catch (error) { console.error('ShareClipQueue listener',error); }
    }
  }
  function pump() {
    if (!active && pending[0]?.local) void pending[0].execute();
  }
  function enqueue({name,from,to,kind,run,onCancel,onError,allowRunningCancel = false}) {
    const controller = new AbortController();
    let resolveDone;
    const done = new Promise(resolve => { resolveDone = resolve; });
    const ticket = {name,from,to,kind,state:'queued',done,cancel};
    const entry = {ticket,local:false,execute};
    pending.push(entry);
    function finish(state) {
      const index = pending.indexOf(entry);
      if (index === -1) return;
      if (active === entry) active = undefined;
      pending.splice(index,1);
      ticket.state = state;
      run = onCancel = onError = undefined;
      notify();
      resolveDone();
      pump();
    }
    function cancel() {
      if (controller.signal.aborted) return false;
      if (ticket.state === 'running' && allowRunningCancel) {
        controller.abort();
        return true;
      }
      if (ticket.state !== 'queued') return false;
      controller.abort();
      try { onCancel?.('cancelled'); }
      finally { finish('cancelled'); }
      return true;
    }
    async function execute() {
      if (ticket.state !== 'queued' || controller.signal.aborted) return;
      active = entry;
      ticket.state = 'running';
      notify();
      let state = 'finished';
      try {
        if (controller.signal.aborted) onCancel?.('cancelled');
        else await run(controller.signal);
      }
      catch (_) { state = 'failed'; }
      finally { finish(controller.signal.aborted ? 'cancelled' : state); }
    }
    function lockFailed(error) {
      if (ticket.state !== 'queued' || controller.signal.aborted) return;
      controller.abort();
      try { onError?.(error); }
      finally {
        try { onCancel?.('failed'); }
        finally { finish('failed'); }
      }
    }
    try {
      const locks = typeof navigator !== 'undefined' && navigator.locks;
      if (locks?.request) {
        // Register each request on submission, preserving order even across tabs.
        locks.request(lockName,{mode:'exclusive',signal:controller.signal},execute).catch(lockFailed);
        notify();
      } else {
        entry.local = true;
        if (active) notify();
        else pump();
      }
    } catch (error) { lockFailed(error); }
    return ticket;
  }
  return {
    enqueue,
    get items() { return items(); },
    subscribe(listener) {
      listeners.add(listener);
      listener(items());
      return () => listeners.delete(listener);
    }
  };
})();
//===END===
export {ShareClipQueue};
