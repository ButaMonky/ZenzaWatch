import {util} from '../../../../src/util';
import {VideoSessionWorker} from './VideoSessionWorker';
// GENERATED FROM tools/typescript-stage1/nico-src/StoryboardInfoLoader.ts (Task646). Edit the .ts and run npm run nico:sync.
//===BEGIN===
/**
 * Canonical TypeScript source for packages/lib/src/nico/StoryboardInfoLoader.js (Task646).
 * Chooses the storyboard (seek thumbnail) source for a video: domand first,
 * then dmc, otherwise rejects. Loading itself is done by VideoSessionWorker.
 */
const StoryboardInfoLoader = {
    load: (serverType, videoInfo) => {
        // Task 070: 設定の videoServerType（既定値 'dmc'）に関係なく、使える方を使う。
        // DMCは終了済みでほぼ全動画が domand のため、domand を優先する。
        if (videoInfo.hasDomandStoryboard) {
            return VideoSessionWorker.storyboard({ type: 'domand', info: videoInfo });
        }
        if (videoInfo.hasDmcStoryboard) {
            return VideoSessionWorker.storyboard({ type: 'dmc', info: videoInfo });
        }
        return Promise.reject('smile storyboard api not exist');
    }
};
//===END===
export {StoryboardInfoLoader};
