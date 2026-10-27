declare const sleep: {readonly resolve: Promise<unknown>};

class RequestAnimationFrame {
  declare private _frameSkip: number;
  declare private _frameCount: number;
  declare private _callback: () => void;
  declare private _enable: boolean;
  declare private _generation: number;
  declare private _requestId: number | null;
  declare private _isOnce: boolean;
  declare private _isBusy: boolean;

  constructor(callback: () => void, frameSkip?: number) {
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
  private _onFrame(generation: number = this._generation): void {
    if (!this._enable || generation !== this._generation || this._isBusy) { return; }
    this._requestId = null;
    this._isBusy = true;
    try {
      this._frameCount++;
      if (this._frameCount % (this._frameSkip + 1) === 0) { this._callback(); }
    } finally {
      if (generation === this._generation) {
        this._isBusy = false;
        if (this._isOnce) { this.disable(); }
        else { this.callRaf(generation); }
      }
    }
  }

  async callRaf(generation: number = this._generation): Promise<void> {
    await sleep.resolve;
    if (!this._enable || generation !== this._generation || this._requestId !== null) { return; }
    this._requestId = requestAnimationFrame(() => this._onFrame(generation));
  }
  enable(): void {
    if (this._enable) { return; }
    this._enable = true;
    this._isBusy = false;
    const generation = ++this._generation;
    this._requestId = requestAnimationFrame(() => this._onFrame(generation));
  }
  disable(): void {
    ++this._generation;
    this._enable = false;
    this._isOnce = false;
    this._isBusy = false;
    if (this._requestId !== null) { cancelAnimationFrame(this._requestId); }
    this._requestId = null;
  }
  execOnce(): void {
    if (this._enable) { return; }
    this._isOnce = true;
    this.enable();
  }
}

export {RequestAnimationFrame};
