import {VideoListModel} from './VideoListModel';
// GENERATED FROM tools/typescript-stage1/nico-src/PlayListModel.ts (Task851). Edit the .ts and run npm run nico:sync.
//===BEGIN===
class PlayListModel extends VideoListModel {
    initialize(params) {
        super.initialize(params);
        this.maxItems = 10000;
        this.items = [];
        this.isUniq = true;
        // this._boundOnItemUpdate = this.onItemUpdate.bind(this);
    }
}
//===END===
export {
  PlayListModel
};
