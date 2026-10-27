import {util} from '../../../../src/util';
import {VideoSessionWorker} from './VideoSessionWorker';
//===BEGIN===

const StoryboardInfoLoader = {
  load: (serverType, videoInfo) => {
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


//===END===
//
export {
  StoryboardInfoLoader,
};


