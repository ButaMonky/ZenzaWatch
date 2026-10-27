/**
 * Canonical TypeScript source for packages/zenza/src/Playlist/PlayListModel.js (Task851).
 */
/** The part of VideoListModel (./VideoListModel.js) used here. */
declare class VideoListModel {
  initialize(params: unknown): void;
  maxItems: number;
  items: unknown[];
  isUniq: boolean;
}

class PlayListModel extends VideoListModel {

  initialize(params: unknown) {
    super.initialize(params);
    this.maxItems = 3000;
    this.items = [];
    this.isUniq = true;

    // this._boundOnItemUpdate = this.onItemUpdate.bind(this);
  }
}

export {PlayListModel};
