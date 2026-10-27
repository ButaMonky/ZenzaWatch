/**
 * Canonical TypeScript source for packages/lib/src/nico/StoryboardInfoLoader.js (Task646).
 * Chooses the storyboard (seek thumbnail) source for a video: domand first,
 * then dmc, otherwise rejects. Loading itself is done by VideoSessionWorker.
 */

/** The part of VideoInfoModel read here. */
export interface StoryboardVideoInfoLike {
  hasDomandStoryboard?: unknown;
  hasDmcStoryboard?: unknown;
  [key: string]: unknown;
}
declare const VideoSessionWorker: {
  storyboard(request: {type: 'domand' | 'dmc'; info: StoryboardVideoInfoLike}): Promise<unknown>;
};

export interface StoryboardInfoLoaderClient {
  /** `serverType` is ignored (Task 070); rejects with a string when no storyboard exists. */
  load(serverType: unknown, videoInfo: StoryboardVideoInfoLike): Promise<unknown>;
}

const StoryboardInfoLoader: StoryboardInfoLoaderClient = {
  load: (serverType: unknown, videoInfo: StoryboardVideoInfoLike): Promise<unknown> => {
    // Task 070: 設定の videoServerType（既定値 'dmc'）に関係なく、使える方を使う。
    // DMCは終了済みでほぼ全動画が domand のため、domand を優先する。
    if (videoInfo.hasDomandStoryboard) {
      return VideoSessionWorker.storyboard({type: 'domand', info: videoInfo});
    }
    if (videoInfo.hasDmcStoryboard) {
      return VideoSessionWorker.storyboard({type: 'dmc', info: videoInfo});
    }

    return Promise.reject('smile storyboard api not exist');
  }
};

export {StoryboardInfoLoader};
