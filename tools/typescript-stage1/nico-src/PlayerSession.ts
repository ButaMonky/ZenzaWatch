/**
 * Canonical TypeScript source for packages/zenza/src/init/PlayerSession.js (Task851).
 */
export interface PlayerSessionStore {
  session: Record<string, unknown>;
  storage: Storage;
  KEY: string;
  init(storage: Storage): PlayerSessionStore;
  save(playingStatus: unknown): void;
  restore(): Record<string, unknown>;
  clear(): void;
  hasRecord(): boolean;
}

const PlayerSession = {
  session: {},
  init(storage: Storage) {
    this.storage = storage;
    return this;
  },
  save(playingStatus: unknown) {
    this.storage[this.KEY] = JSON.stringify(playingStatus);
  },
  restore() {
    let ss: Record<string, unknown> = {};
    try {
      const data = this.storage[this.KEY];
      if (!data) {return ss;}
      ss = JSON.parse(data);
      this.storage.removeItem(this.KEY);
    } catch (e) {
      window.console.error('PlayerSession restore fail: ', this.KEY, e);
    }
    console.log('lastSession', ss);
    return ss;
  },
  clear() { this.storage.removeItem(this.KEY); },
  hasRecord() { return this.storage.hasOwnProperty(this.KEY); }
} as PlayerSessionStore;
PlayerSession.KEY = `ZenzaWatch_PlayingStatus`;

export {PlayerSession};
