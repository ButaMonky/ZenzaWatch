/** Independent of DOM, GM APIs, and the external launcher. */
export interface PlayerCloseActions {
  hide(): void | PromiseLike<void>;
  dispose(): void;
  finish(): void | PromiseLike<void>;
}

/** Give already-requested saves a bounded opportunity to finish before disposal. */
export async function finishPlayerClose(
  pendingSaves: readonly PromiseLike<unknown>[],
  actions: PlayerCloseActions,
  timeoutMs = 2000
): Promise<void> {
  const saved = Promise.allSettled(pendingSaves);
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    await actions.hide();
    await Promise.race([saved, new Promise<void>(resolve => {
      timeout = setTimeout(resolve, timeoutMs);
    })]);
  } finally {
    clearTimeout(timeout);
    try { actions.dispose(); } finally { await actions.finish(); }
  }
}
