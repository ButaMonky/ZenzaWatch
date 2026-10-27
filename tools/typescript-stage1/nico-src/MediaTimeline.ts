/**
 * アニメーション基準用の時間ゲッターとしてはperformance.now()よりWeb Animations APIのほうが優れている。
 * Canonical TypeScript source for packages/lib/src/dom/MediaTimeline.js (Task786).
 * Shares media time/duration/rate/paused through a (Shared)ArrayBuffer and keeps a
 * Web Animations clock in step with the media element for interpolation.
 */
/** The parts of objUtil and sleep (packages/lib/src/infra) used here. */
declare const objUtil: {toMap<V>(obj: Record<string, V>): Map<string, V>};
declare const sleep: {resolve: Promise<void>};

/** Media element (or the VideoPlayer Emitter) observed by the timeline. */
export interface TimelineMedia {
  currentTime: number;
  duration: number;
  playbackRate: number;
  paused: boolean;
  addEventListener(name: string, handler: (e?: unknown) => void, options?: unknown): void;
  removeEventListener(name: string, handler: (e?: unknown) => void): void;
}
/** Web Animations clock, or a plain stand-in when animate() is unavailable. */
interface Clock {currentTime: number | null; playbackRate: number; paused?: boolean; pause(): void; play(): void}

class MediaTimeline {
  declare static MAP: {currentTime: number; duration: number; playbackRate: number; paused: number; timestamp: number};
  declare static isSharable: boolean;
  declare static register: (name?: string, media?: TimelineMedia | null) => MediaTimeline;
  declare static get: (name?: string) => MediaTimeline;
  declare buffer: ArrayBuffer | SharedArrayBuffer;
  declare fview: Float32Array;
  declare iview: Int32Array;
  declare anime: Clock;
  declare isWAAvailable: boolean;
  declare interval: number;
  declare eventMap: Map<string, (e?: unknown) => void>;
  declare _isBusy: boolean;
  declare media: TimelineMedia | null | undefined;
  declare timer: ReturnType<typeof setInterval>;
  declare raf: number | null | undefined | void;

  constructor(options: {interval?: number; media?: TimelineMedia | null} = {}) {
    this.buffer = new (MediaTimeline.isSharable ? self.SharedArrayBuffer : ArrayBuffer)(Float32Array.BYTES_PER_ELEMENT * 100);
    this.fview = new Float32Array(this.buffer);
    this.iview = new Int32Array(this.buffer);
    const span = document.createElement('span');
    this.anime = (span.animate ?
      span.animate([], {duration: 3 * 24 * 60 * 60 * 1000}) :
      {currentTime: 0, playbackRate: 1, paused: true}) as unknown as Clock;
    this.isWAAvailable = !!span.animate;
    this.interval = options.interval || 200;
    this.onTimer = this.onTimer.bind(this);
    this.onRaf = this.onRaf.bind(this);
    this.eventMap = this.initEventMap();
    this._isBusy = false;
    if (options.media) {
      this.attach(options.media);
    }
  }
  /**
   * Task 090（監査v2 ZW-022）: 動画の時刻へ、共有の時刻と補間の時計（Web Animations）の両方を必ず合わせる。
   * currentTime の setter は「差が1秒を超える時」しか時計を合わせないため、シーク等ではこちらを使う
   * （以前は 0.5秒のシークの後の onRaf で、時刻が古い時計の値へ戻っていた）。
   */
  syncClock(v: number): void {
    v = isNaN(v) ? 0 : v;
    this.currentTime = v;
    this.anime.currentTime = v * 1000;
  }
  initEventMap(): Map<string, (e?: unknown) => void> {
    const map: Record<string, (e?: unknown) => void> = {
      'pause': e => {
        // console.nicoru('paused', this.paused, this.media.paused, this.currentTime, this.media.currentTime);
        this.paused = true;
        this.syncClock((this.media as TimelineMedia).currentTime);
      },
      'play': e => {
        // console.nicoru('play');
        this.syncClock((this.media as TimelineMedia).currentTime);
        this.paused = false;
      },
      'seeking': e => {
        this.syncClock((this.media as TimelineMedia).currentTime);
      },
      'seeked': e => {
        // console.nicoru('seeked');
        this.syncClock((this.media as TimelineMedia).currentTime);
      },
      'ratechange': e => {
        // console.nicoru('ratechange');
        this.playbackRate = (this.media as TimelineMedia).playbackRate;
        this.syncClock((this.media as TimelineMedia).currentTime);
      },
      'durationchange': e => {
        this.duration = (this.media as TimelineMedia).duration;
      },
      // 本体の VideoPlayer（Emitter）は durationChange の名前で知らせる
      'durationChange': e => {
        this.duration = (this.media as TimelineMedia).duration;
      }
    };
    return objUtil.toMap(map);
  }
  attach(media: TimelineMedia): void {
    if (this.media) {
      this.detach();
    }
    this.media = media;
    this.syncClock(media.currentTime);
    this.playbackRate = media.playbackRate;
    this.duration     = media.duration;
    this.paused       = media.paused;
    this.timer = setInterval(this.onTimer, this.interval);
    for (const [eventName, handler] of this.eventMap) {
      media.addEventListener(eventName, handler, {passive: true});
    }
  }
  detach(): void {
    const media = this.media as TimelineMedia;
    for (const [eventName, handler] of this.eventMap) {
      media.removeEventListener(eventName, handler);
    }
    this.media = null;
    clearInterval(this.timer);
    // Task 090（ZW-022）: 予約中の rAF も取り消す（外した後に onRaf が動画を読みにいかないように）
    this.raf && cancelAnimationFrame(this.raf);
    this.raf = null;
    this._isBusy = false;
  }
  onTimer(): void {
    const media = this.media as TimelineMedia;
    const ac = (this.anime.currentTime as number) / 1000;
    const mc = media.currentTime;
    const diffMs = Math.abs(mc - ac) * 1000;
    if (!this.isWAAvailable || diffMs >= this.interval * 3 || media.paused !== this.paused) {
      // console.warn('fix diff', diff);
      this.syncClock(mc);
      this.playbackRate = media.playbackRate;
      this.paused       = media.paused;
    }
  }
  onRaf(): void {
    if (!this.media) {
      this.raf = null;
      return;
    }
    if (this._isBusy) {
      this.raf = null;
      return;
    }
    this._isBusy = true;
    this.currentTime = Math.min((this.anime.currentTime as number) / 1000, this.media.duration);
    this.timestamp = Math.round(performance.now() * 1000);
    if (!this.media.paused) {
      this.callRaf();
      // sleep.resolve.then(this.callRaf);
    } else {
      this.raf = null;
      this._isBusy = false;
    }
  }
  async callRaf(): Promise<void> {
    await sleep.resolve;
    if (!this.media) {
      this._isBusy = false;
      return;
    }
    this.raf = requestAnimationFrame(this.onRaf);
    this._isBusy = false;
  }
  get timestamp(): number {
    // if (MediaTimeline.isSharable) {
    //   return Atomics.load(this.iview, MediaTimeline.MAP.timestamp);
    // }
    return this.iview[MediaTimeline.MAP.timestamp] as number;
  }
  set timestamp(v: number) {
    if (this.iview[MediaTimeline.MAP.timestamp] === v) { return; }
    if (MediaTimeline.isSharable) {
      Atomics.store(this.iview, MediaTimeline.MAP.timestamp, v);
      Atomics.notify(this.iview, MediaTimeline.MAP.timestamp);
    } else {
      this.iview[MediaTimeline.MAP.timestamp] = v;
    }
  }
  get currentTime(): number {
    return this.fview[MediaTimeline.MAP.currentTime] as number;
  }
  set currentTime(v: number) {
    v = isNaN(v) ? 0 : v;
    if (this.fview[MediaTimeline.MAP.currentTime] !== v) {
      this.fview[MediaTimeline.MAP.currentTime] = v;
    }
    const ac = (this.anime.currentTime as number) / 1000;
    const diffMs = Math.abs(ac - v) * 1000;
    if (v === 0 || diffMs > 1000) {
      this.anime.currentTime = v * 1000;
    }
  }
  get duration(): number {
    return this.fview[MediaTimeline.MAP.duration] as number;
  }
  set duration(v: number) {
    this.fview[MediaTimeline.MAP.duration] = v;
  }
  get playbackRate(): number {
    return this.fview[MediaTimeline.MAP.playbackRate] as number;
  }
  set playbackRate(v: number) {
    this.fview[MediaTimeline.MAP.playbackRate] = v;
    (this.anime.playbackRate !== v) && (this.anime.playbackRate = v);
  }
  get paused(): boolean {
    return this.iview[MediaTimeline.MAP.paused] !== 0;
  }
  set paused(v: boolean) {
    this.iview[MediaTimeline.MAP.paused] = v ? 1 : 0;
    if (!this.isWAAvailable) { return; }
    if (v) {
      this.anime.pause();
      this.raf = cancelAnimationFrame(this.raf as number);
      this.timestamp = 0;
    } else {
      this.anime.play();
      if (!this.raf) {
        this.raf = requestAnimationFrame(this.onRaf);
      }
    }
  }
}
MediaTimeline.MAP = {
  currentTime: 0,
  duration: 1,
  playbackRate: 2,
  paused: 3,
  timestamp: 10
};
MediaTimeline.isSharable = ('SharedArrayBuffer' in self) && ('animate' in document.documentElement);
MediaTimeline.register = function(this: {map: Map<string, MediaTimeline>}, name = 'main', media: TimelineMedia | null = null) {
  if (!this.map.has(name)) {
    const mt = new MediaTimeline({media});
    this.map.set(name, mt);
    return mt;
  }
  const mt = this.map.get(name) as MediaTimeline;
  media && mt.attach(media);
  return mt;
}.bind({map: new Map()});

MediaTimeline.get = name => MediaTimeline.register(name);

export {MediaTimeline};
