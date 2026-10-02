import {sleep} from './sleep';

//===BEGIN===
class RequestAnimationFrame {
  constructor(callback, frameSkip) {
    this._frameSkip = Math.max(0, typeof frameSkip === 'number' ? frameSkip : 0);
    this._frameCount = 0;
    this._callback = callback;
    this._enable = false;
    this._onFrame = this._onFrame.bind(this);
    this._generation = 0;
    this._requestId = null;
    this._isOnce = false;
    this._isBusy = false;
  }
  _onFrame(generation = this._generation) {
    if (!this._enable || generation !== this._generation || this._isBusy) { return; }
    this._requestId = null;
    this._isBusy = true;
    try {
      this._frameCount++;
      if (this._frameCount % (this._frameSkip + 1) === 0) { this._callback(); }
    } finally {
      // A callback may stop/restart the loop. Its old frame must not own that loop.
      if (generation === this._generation) {
        this._isBusy = false;
        if (this._isOnce) { this.disable(); }
        else { this.callRaf(generation); }
      }
    }
  }
  async callRaf(generation = this._generation) {
    await sleep.resolve;
    if (!this._enable || generation !== this._generation || this._requestId !== null) { return; }
    this._requestId = requestAnimationFrame(() => this._onFrame(generation));
  }
  enable() {
    if (this._enable) { return; }
    this._enable = true;
    this._isBusy = false;
    const generation = ++this._generation;
    this._requestId = requestAnimationFrame(() => this._onFrame(generation));
  }
  disable() {
    ++this._generation;
    this._enable = false;
    this._isOnce = false;
    this._isBusy = false;
    if (this._requestId !== null) { cancelAnimationFrame(this._requestId); }
    this._requestId = null;
  }
  execOnce() {
    if (this._enable) {
      return;
    }
    this._isOnce = true;
    this.enable();
  }
}

//===END===
export {RequestAnimationFrame};