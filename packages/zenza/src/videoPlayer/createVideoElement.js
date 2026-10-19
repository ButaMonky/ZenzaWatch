import {ZenzaWatch} from '../../../../src/ZenzaWatchIndex';
// GENERATED FROM tools/typescript-stage1/nico-src/createVideoElement.ts (Task851). Edit the .ts and run npm run nico:sync.
//===BEGIN===
const createVideoElement = (...args) => {
    if (window.ZenzaHLS && window.ZenzaHLS.createVideoElement) {
        return window.ZenzaHLS.createVideoElement(...args);
    }
    else if (ZenzaWatch.debug.createVideoElement) {
        return ZenzaWatch.debug.createVideoElement(...args);
    }
    return document.createElement('video');
};
//===END===
export {
  createVideoElement
};
