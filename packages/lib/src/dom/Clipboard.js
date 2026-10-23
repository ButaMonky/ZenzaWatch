import {Fullscreen} from './Fullscreen';
// GENERATED FROM tools/typescript-stage1/nico-src/Clipboard.ts (Task785). Edit the .ts and run npm run nico:sync.
//===BEGIN===
const Clipboard = {
    copyText: (text) => {
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
//===END===
export {Clipboard};
