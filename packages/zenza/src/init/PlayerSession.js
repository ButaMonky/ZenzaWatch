import {PRODUCT} from '../../../../src/ZenzaWatchIndex';
// GENERATED FROM tools/typescript-stage1/nico-src/PlayerSession.ts (Task851). Edit the .ts and run npm run nico:sync.
//===BEGIN===
const PlayerSession = {
    session: {},
    init(storage) {
        this.storage = storage;
        return this;
    },
    save(playingStatus) {
        this.storage[this.KEY] = JSON.stringify(playingStatus);
    },
    restore() {
        let ss = {};
        try {
            const data = this.storage[this.KEY];
            if (!data) {
                return ss;
            }
            ss = JSON.parse(data);
            this.storage.removeItem(this.KEY);
        }
        catch (e) {
            window.console.error('PlayerSession restore fail: ', this.KEY, e);
        }
        console.log('lastSession', ss);
        return ss;
    },
    clear() { this.storage.removeItem(this.KEY); },
    hasRecord() { return this.storage.hasOwnProperty(this.KEY); }
};
PlayerSession.KEY = `ZenzaWatch_PlayingStatus`;
//===END===
export {
  PlayerSession
};
