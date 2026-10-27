/**
 * Canonical TypeScript source for packages/lib/src/dom/Clipboard.js (Task785).
 * Copies text with the async Clipboard API, falling back to execCommand('copy')
 * through a hidden input (inside the fullscreen element when there is one).
 */
/** The part of Fullscreen (packages/lib/src/dom/Fullscreen.js) used here. */
declare const Fullscreen: {get(): Element | null};

const Clipboard = {
  copyText: (text: string): Promise<void> | void => {
    if (navigator.clipboard) { // httpsじゃないと動かない
      return navigator.clipboard.writeText(text);
    }
    let clip = document.createElement('input');
    clip.type = 'text';
    clip.style.position = 'fixed';
    clip.style.left = '-9999px';
    clip.value = text;
    // CLIPBOARD-FULLSCREEN-001 (Task787): Fullscreen has no `element`; use get() so the
    // input lives inside the fullscreen element, where it can be selected.
    const node = Fullscreen.get() || document.body;
    node.appendChild(clip);
    clip.select();
    document.execCommand('copy');

    window.setTimeout(() => clip.remove(), 0);
  }
};

export {Clipboard};
