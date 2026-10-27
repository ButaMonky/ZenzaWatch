/**
 * Canonical TypeScript source for packages/zenza/src/heatMap/HeatMapWorker.js (Task962).
 */
/**
 * Values that come from raw API/DOM records or from modules that are still JS; this one
 * documented loose alias covers them.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = any;
// legacy-to-ts: names provided by other bundled modules
declare const global: Loose;
declare const workerUtil: Loose;

function HeatMapInitFunc(self?: Loose) {
class HeatMapModel {
  declare static RESOLUTION: Loose;
  declare _chat: Loose;
  declare _chatReady: Loose;
  declare _duration: Loose;
  declare map: Loose;
  declare resolution: Loose;
  constructor(params?: Loose) {
    this.resolution = params.resolution || HeatMapModel.RESOLUTION;
    this.reset();
  }
  reset() {
    this._duration = -1;
    this._chatReady = false;
    this._chat = null;
    this.map = [];
  }
  set duration(duration: Loose) {
    if (this._duration === duration) { return; }
    this._duration = duration;
    this.update();
  }
  get duration() {
    return this._duration;
  }
  set chatList(comment: Loose) {
    this._chat = comment;
    this._chatReady = true;
    this.update();
  }
  update() {
    if (!Number.isFinite(this._duration) || this._duration < 1 || !this._chatReady) {
      this.map = [];
      return false;
    }
    const map = this.map = this.getHeatMap();
    return !!map.length;
  }
  getHeatMap() {
    const duration = this._duration;
    if (!Number.isFinite(duration) || duration < 1) { return []; }
    const map = new Array(Math.max(Math.min(this.resolution, Math.floor(duration)), 1));
    const length = map.length;
    let i = length;
    while(i > 0) map[--i] = 0;

    const ratio = duration > map.length ? (map.length / duration) : 1;

    // The input is the active, NG-filtered collection, not the history cache or live-DOM budget.
    for (const type of ['top', 'naka', 'bottom']) {
      const chats = this._chat && this._chat[type];
      if (!Array.isArray(chats)) { continue; }
      for (const chat of chats) {
        const pos = chat && chat.vpos;
        if (!chat || chat.fork === 2 || !Number.isFinite(pos) || pos < 0) { continue; }
        const bin = Math.min(Math.floor(pos * ratio / 100), length - 1);
        map[bin]++;
      }
    }
    for (i = 0; i < Math.min(length, 20); i++) {// 先頭付近は「うぽつ」などで一極集中しがちなのでリミットを設ける
      map[i] = Math.min(5, map[i]);
    }
    for (; i < Math.min(length, 60); i++) {
      map[i] = Math.min(10, map[i]);
    }
    map.length = length;
    return map;
  }
}
HeatMapModel.RESOLUTION = 200;

class HeatMapView {
  declare _isInitialized: Loose;
  declare _palette: Loose;
  declare canvas: Loose;
  declare container: Loose;
  declare context: Loose;
  declare height: Loose;
  declare map: Loose;
  declare model: Loose;
  declare width: Loose;
  constructor(params?: Loose) {
    this.model  = params.model;
    this.container = params.container;
    this.canvas = params.canvas;
  }
  initializePalette() {
    this._palette = [];
    for (let c = 0; c < 256; c++) {
      const
        r = Math.floor((c > 127) ? (c / 2 + 128) : 0),
        g = Math.floor((c > 127) ? (255 - (c - 128) * 2) : (c * 2)),
        b = Math.floor((c > 127) ? 0 : (255  - c * 2));
      this._palette.push(`rgb(${r}, ${g}, ${b})`);
    }
  }
  initializeCanvas() {
    if (!this.canvas) {
      this.canvas = this.container.querySelector('canvas.heatMap');
    }

    this.context = this.canvas.getContext('2d', {alpha: false, desynchronized: true});
    this.width = this.canvas.width;
    this.height = this.canvas.height;

    this.reset();
  }
  reset() {
    if (!this.context) { return; }
    this.context.fillStyle = this._palette[0];
    this.context.beginPath();
    this.context.fillRect(0, 0, this.width, this.height);
  }
  async toDataURL() {
    if (!this.canvas) {
      return '';
    }
    const type = 'image/png';
    const canvas = this.canvas;
    try {
      return canvas.toDataURL(type);
    } catch(e) {
      const blob = await new Promise(res => {
        if (canvas.convertToBlob) {
          return res(canvas.convertToBlob({type}));
        }
        this.canvas.toBlob(res, type);
      }).catch((e): Loose => null);
      if (!blob) {
        return '';
      }
      return new Promise((ok, ng) => {
        const reader = new FileReader();
        reader.onload = () => { ok(reader.result); };
        reader.onerror = e => ng(e);
        reader.readAsDataURL((blob as Loose));
      }).catch(e => '');
    }
  }
  update(map?: Loose) {
    if (!this._isInitialized) {
      this._isInitialized = true;
      this.initializePalette();
      this.initializeCanvas();
      this.reset();
    }
    map = map || this.model.map;
    // Never normalize model counts in place: public map/HeatSync keeps the 0..255 contract.
    map = Array.from(map);
    this.map = map;
    if (!map.length) { this.reset(); return true; }

    console.time('draw HeatMap');

    // 一番コメント密度が高い所を100%として相対的な比率にする
    // 赤い所が常にピークになってわかりやすいが、
    // コメントが一カ所に密集している場合はそれ以外が薄くなってしまうのが欠点
    let max = 0, i;
    // -4 してるのは、末尾にコメントがやたら集中してる事があるのを集計対象外にするため (ニコニ広告に付いてたコメントの名残？)
    for (i = Math.max(map.length - 4, 0); i >= 0; i--) max = Math.max(map[i], max);

    if (max > 0) {
      let rate = 255 / max;
      for (i = map.length - 1; i >= 0; i--) {
        map[i] = Math.min(255, Math.floor(map[i] * rate));
      }
    } else {
      // An empty/all-NG collection supersedes and erases the previous nonempty image.
      map.fill(0);
    }

    const context = this.context;

    for (i = map.length - 1; i >= 0; i--) {
      context.fillStyle = this._palette[parseInt(map[i], 10)] || this._palette[0];
      context.beginPath();
      const left = Math.floor(i * this.width / map.length);
      const right = Math.floor((i + 1) * this.width / map.length);
      context.fillRect(left, 0, right - left, this.height);
    }
    console.timeEnd('draw HeatMap');
    context.commit && context.commit();
    return true;
  }
}

class HeatMap {
  declare _generation: Loose;
  declare _watchId: Loose;
  declare model: Loose;
  declare view: Loose;
  /**
   *
   * @param {object} params
   * @prop {Element?} container
   * @prop {HTMLCamvasElement?} canvas
   */
  constructor(params?: Loose) {
    /** @type {HeatMapModel} */
    this.model = new HeatMapModel({});
    /** @type {HeatMapView} */
    this.view = new HeatMapView({
      model: this.model,
      container: params.container,
      canvas: params.canvas
    });
    this.reset();
  }
  // Task187（監査v2 F13）: 動画を切り替えたら世代を進め、どの動画のヒートマップかを覚える。
  // 古い世代の非同期の完了（toDataURL）は捨て、別の動画のヒートマップとして通知・保存させない
  reset(params = {}) {
    this._generation = (this._generation || 0) + 1;
    this._watchId = (params && typeof (params as Loose).watchId === 'string' && (params as Loose).watchId) ? (params as Loose).watchId : null;
    this.model.reset();
    this.view.map = [];
    this.view.reset();
  }
  get watchId() {
    return this._watchId || null;
  }
  // Snapshot only histogram inputs. Neither worker messages nor model storage need comment bodies.
  static snapshotChatList(chatList?: Loose) {
    const snapshot = {top: ([] as Loose), naka: ([] as Loose), bottom: ([] as Loose)};
    for (const type of ['top', 'naka', 'bottom']) {
      for (const chat of (Array.isArray(chatList && chatList[type]) ? chatList[type] : [])) {
        const vpos = chat && (chat.vpos ?? chat.props?.vpos);
        const fork = chat && (chat.fork ?? chat.props?.fork);
        if (Number.isFinite(vpos) && vpos >= 0) {
          (snapshot as Loose)[type].push({vpos, fork: fork === 2 ? 2 : fork === 1 ? 1 : 0});
        }
      }
    }
    return snapshot;
  }
  setData({watchId, duration, chatList}: Loose) {
    if (watchId !== this._watchId) { this.reset({watchId}); }
    // One snapshot, one redraw/export. No transient old-comments/new-duration publication.
    this.model._duration = duration;
    this.model.chatList = HeatMap.snapshotChatList(chatList);
    this._publish();
  }
  _publish() {
    const generation = this._generation = (this._generation || 0) + 1;
    if (!this.model._chatReady || !Number.isFinite(this.duration) || this.duration < 1) {
      this.view.map = [];
      this.view.reset();
      return;
    }
    if (!this.view.update()) { return; }
    const watchId = this._watchId || null;
    const map = Array.from(this.map);
    const duration = this.duration;
    this.toDataURL().then(dataURL => {
      if (generation !== this._generation) { return; }
      self.emit('heatMapUpdate', {watchId, map, duration, dataURL});
    }).catch(() => {});
  }
  /**
   * @params {number} duration
   */
  set duration(duration: Loose) {
    if (this.model.duration === duration) { return; }
    this.model.duration = duration;
    this._publish();
  }
  get duration() {
    return this.model.duration;
  }
  /**
   * @params {NicoChat[]} chatList
   */
  set chatList(chatList: Loose) {
    this.model.chatList = HeatMap.snapshotChatList(chatList);
    this._publish();
  }
  get canvas() {
    return this.view.canvas || {};
  }
  get map() {
    return this.view.map || [];
  }
  async toDataURL() {
    return this.view.toDataURL();
  }
}
  return HeatMap;
} // end of HeatMapInitFunc

const HeatMapWorker = (() => {
  const _func = function(self?: Loose) {
    const HeatMap = HeatMapInitFunc(self);

    let heatMap: Loose;
    const init = ({canvas}: Loose) => heatMap = new HeatMap({canvas});
    const update = ({chatList}: Loose) => heatMap.chatList = chatList;
    const duration = ({duration}: Loose) => heatMap.duration = duration;
    const reset = (params?: Loose) => heatMap.reset(params);
    self.onmessage = async ({command, params}: Loose) => {
      let result = {status: 'ok'};
      switch (command) {
        case 'init':
          init(params);
          break;
        case 'update':
          update(params);
          break;
        case 'duration':
          duration(params);
          break;
        case 'reset':
          reset(params);
          break;
        case 'setData':
          heatMap.setData(params);
          break;
        case 'getData': {
          const generation = heatMap._generation;
          const map = Array.from(heatMap.map), duration = heatMap.duration;
          const dataURL = await heatMap.toDataURL();
          if (generation !== heatMap._generation) { return {status: 'stale'}; }
          Object.assign(result, {dataURL, map, duration});
          break;
        }
      }
      return result;
    };
  };
  const func = `
  function(self) {
    ${HeatMapInitFunc.toString()};
    (${_func.toString()})(self);
  }
  `;
  const isOffscreenCanvasAvailable = !!HTMLCanvasElement.prototype.transferControlToOffscreen;
  let worker: Loose;
  const createMainThreadHeatMap = ({container, width, height, canvas}: Loose) => {
    const HeatMap = HeatMapInitFunc({
      emit: (...args: Loose[]) => global.emitter.emit(...args)
    });
    return new HeatMap({container, width, height, canvas});
  };
  const stopWorker = (target?: Loose) => {
    try { target && target.terminate && target.terminate(); } catch (e) {}
    if (worker === target) {
      worker = null;
    }
  };
  const replaceTransferredCanvas = (container?: Loose, canvas?: Loose) => {
    let replacement = canvas && canvas.cloneNode ? canvas.cloneNode(false) : null;
    if (!replacement && typeof document !== 'undefined' && document.createElement) {
      replacement = document.createElement('canvas');
      replacement.className = (canvas && canvas.className) || 'heatMap';
      replacement.width = (canvas && canvas.width) || 200;
      replacement.height = (canvas && canvas.height) || 10;
    }
    if (!replacement) {
      return null;
    }
    if (canvas) {
      replacement.width = canvas.width;
      replacement.height = canvas.height;
      if (!replacement.className) {
        replacement.className = canvas.className || 'heatMap';
      }
    }
    if (canvas && canvas.parentNode && canvas.parentNode.replaceChild) {
      canvas.parentNode.replaceChild(replacement, canvas);
    } else if (canvas && canvas.replaceWith) {
      canvas.replaceWith(replacement);
    } else if (container && container.append) {
      try { canvas && canvas.remove && canvas.remove(); } catch (e) {}
      container.append(replacement);
    } else {
      return null;
    }
    return replacement;
  };
  const init = async ({container, width, height}: Loose) => {
    if (!isOffscreenCanvasAvailable) {
      return createMainThreadHeatMap({container, width, height});
    }
    const activeWorker = worker =
      worker || workerUtil.createCrossMessageWorker(func, {name: 'HeatMapWorker'});
    const canvas = container.querySelector('canvas.heatMap');
    const layer = canvas.transferControlToOffscreen();
    try {
      await activeWorker.post({command: 'init', params: {canvas: layer}}, {transfer: [layer]});
    } catch (e) {
      stopWorker(activeWorker);
      const replacement = replaceTransferredCanvas(container, canvas);
      if (!replacement) {
        window.console.warn('HeatMap worker init failed; fallback canvas unavailable');
        throw e;
      }
      window.console.warn('HeatMap worker init failed; using main-thread fallback');
      return createMainThreadHeatMap({container, width, height, canvas: replacement});
    }

    let _chatList: Loose, _duration: Loose, disabled = false;
    const disable = (e?: Loose) => {
      if (disabled) { return; }
      disabled = true;
      stopWorker(activeWorker);
      if (canvas && canvas.style) {
        canvas.style.visibility = 'hidden';
      }
      window.console.warn('HeatMap worker disabled after RPC failure',
        {reason: e && (e.reason || e.name || e.status) || 'unknown'});
    };
    const safePost = async (body?: Loose, options?: Loose) => {
      if (disabled) {
        return null;
      }
      try {
        return await activeWorker.post(body, options);
      } catch (e) {
        disable(e);
        return null;
      }
    };
    return {
      canvas,
      update(chatList?: Loose) {
        chatList = HeatMap.snapshotChatList(chatList);
        return (safePost as Loose)({command: 'update', params: {chatList}});
      },
      get duration() { return _duration; },
      set duration(d) {
        _duration = d;
        (safePost as Loose)({command: 'duration', params: {duration: d}});
      },
      reset(params = {}) {
        _chatList = null; _duration = undefined;
        return (safePost as Loose)({command: 'reset', params: {watchId: (params && (params as Loose).watchId) || null}});
      },
      setData({watchId, duration, chatList}: Loose) {
        _duration = duration; _chatList = chatList;
        return (safePost as Loose)({command: 'setData', params: {
          watchId, duration, chatList: HeatMap.snapshotChatList(chatList)
        }});
      },
      get chatList() {return _chatList;},
      set chatList(chatList) { this.update(_chatList = chatList); }
    };
  };
  return {init};
})();

const HeatMap = HeatMapInitFunc({
  emit: (...args: Loose[]) => global.emitter.emit(...args)
});

// Task187（監査v2 F13）: ヒートマップの通知を保存してよいのは、通知に付いた動画IDが今の動画と一致する時だけ。
// 動画IDが無い・別の動画の通知は保存しない（IndexedDBへ別動画のヒートマップを書かない）
const heatMapCacheEntry = (payload?: Loose, currentWatchId?: Loose) => {
  if (!payload || typeof payload.watchId !== 'string' || !payload.watchId) { return null; }
  if (payload.watchId !== currentWatchId) { return null; }
  if (!Array.isArray(payload.map) || !Number.isFinite(payload.duration)) { return null; }
  return {watchId: payload.watchId, heatMap: {map: payload.map, duration: payload.duration, dataURL: payload.dataURL}};
};

export {HeatMap, HeatMapWorker, heatMapCacheEntry};
