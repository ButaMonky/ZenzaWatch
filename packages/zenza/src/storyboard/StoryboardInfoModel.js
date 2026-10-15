import {Emitter} from '../../../lib/src/Emitter';
//===BEGIN===

class StoryboardInfoModel extends Emitter {
  static get blankData() {
    return {
      format: 'dmc',
      status: 'fail',
      duration: 1,
      storyboard: {
        version: "1",
        thumbnail: {
          width: 160,
          height: 90,
        },
        columns: 1,
        rows: 1,
        interval: 1000,
        images: [{
          timestamp: 0,
          url: 'https://example.com'
        }],
      }
    };
  }

  // Task474/NICOCOMPAT-04: A transport success is not a usable storyboard.
  // Guard the layout and image records before the Worker creates canvases.
  // Keep genuine legacy numeric strings and a zero interval (ratio fallback)
  // without inventing new server metadata.
  static isUsableData(data) {
    const object = value => !!value && typeof value === 'object' && !Array.isArray(value);
    const finite = value => value != null && value !== '' && Number.isFinite(Number(value));
    const integer = value => finite(value) && Number.isSafeInteger(Number(value));
    const board = data && data.storyboard;
    if (!object(board) || !object(board.thumbnail) || !finite(data.duration) ||
        Number(data.duration) < 0) { return false; }
    const {width, height} = board.thumbnail;
    const {rows, columns, interval, count, images} = board;
    if (!integer(width) || !integer(height) || !integer(rows) ||
        !integer(columns) || !integer(count) || !finite(interval)) { return false; }
    const w = Number(width), h = Number(height);
    const r = Number(rows), c = Number(columns), n = Number(count);
    const step = Number(interval);
    if (w <= 0 || h <= 0 || w > 4096 || h > 4096 ||
        r <= 0 || c <= 0 || r > 256 || c > 256 || n < 0 ||
        step < 0 || r * c > 16384 || w * h * r * c > 16 * 1024 * 1024 ||
        !Array.isArray(images) || images.length === 0 || images.length > 8192 ||
        n > images.length * r * c) { return false; }
    for (const image of images) {
      if (!object(image) || typeof image.url !== 'string' || !image.url.trim()) {
        return false;
      }
    }
    return true;
  }

  constructor(rawData) {
    super();
    this.update(rawData);
  }

  update(rawData) {
    if (!rawData || rawData.status !== 'ok' || !this.constructor.isUsableData(rawData)) {
      this._rawData = this.constructor.blankData;
    } else {
      this._rawData = rawData;
    }
    this.primary = this._rawData.storyboard;
    this.emit('update', this);
    return this;
  }
  reset() {
    this._rawData = this.constructor.blankData;
    this.primary = this._rawData.storyboard;
    this.emit('reset');
  }
  get rawData() {
    return this._rawData || this.constructor.blankData;
  }

  get isAvailable() {return this._rawData.status === 'ok';}

  get hasSubStoryboard() { return false; }

  get status() {return this._rawData.status;}
  get message() {return this._rawData.message;}
  get duration() {return this._rawData.duration * 1;}
  get isDmc() {return this._rawData.format === 'dmc';}
  get urls() { return this.primary.images.map(img => img.url); }
  get images() {
    return [...Array(this.pageCount)].map((a, i) => this.getPage(i));
  }
  get cellWidth() { return this.primary.thumbnail.width * 1; }
  get cellHeight() { return this.primary.thumbnail.height * 1; }
  get cellIntervalMs() {
    const rawInterval = this.primary.interval * 1;
    if (Number.isFinite(rawInterval) && rawInterval > 0) { return rawInterval; }
    // A legacy zero interval still uses the old index ratio path, but the
    // Worker must never calculate an infinite canvas width from it.
    const lengthMs = this.duration * 1000;
    const count = this.cellCount;
    return Number.isFinite(lengthMs) && lengthMs > 0 &&
      Number.isFinite(count) && count > 0 ? Math.max(1, lengthMs / count) : 1000;
  }
  get cellCount() { return this.primary.count * 1; }
  get rows() { return this.primary.rows * 1; }
  get cols() { return this.primary.columns * 1; }
  get pageCount() { return this.primary.images.length; }
  get totalRows() { return Math.ceil(this.cellCount / this.cols); }
  get pageWidth() { return this.cellWidth * this.cols; }
  get pageHeight() { return this.cellHeight * this.rows; }
  get countPerPage() { return this.rows * this.cols; }

  /**
   *  nページ目のURL/Bufferを返す。 ゼロオリジン
   */
  getPage(page) {
    const {url, buffer} = this.primary.images[page];
    return buffer ?? url;
  }

  /**
   * msに相当するサムネは何番目か？を返す
   */
  getIndex(ms) {
    // The storyboard, board pointer and thumbnails must use the same declared
    // interval. Count/duration ratios drift for partial last cells; floor(ms/1000)
    // also loses subsecond thumbnails.
    const durationMs = Math.max(0, this.duration * 1000);
    const boundedMs = Math.max(0, Math.min(ms, durationMs));
    // Keep the original legacy ratio fallback for a declared zero interval.
    const intervalMs = this.primary.interval * 1;
    const index = Number.isFinite(intervalMs) && intervalMs > 0
      ? Math.floor(boundedMs / intervalMs)
      // Malformed legacy data with no usable interval: keep the old ratio fallback.
      : Math.floor(Math.floor(boundedMs / 1000) * this.cellCount /
        Math.max(1, this.duration));
    const lastIndex = Math.max(0,
      (Number.isFinite(this.cellCount) ? this.cellCount : 0) - 1);
    return Math.max(0, Math.min(Number.isFinite(index) ? index : 0, lastIndex));
  }

  /**
   * Indexのサムネイルは何番目のページにあるか？を返す
   */
  getPageIndex(thumbnailIndex) {
    const perPage = this.countPerPage;
    const pageIndex = Math.floor(thumbnailIndex / perPage);
    return Math.max(0, Math.min(this.pageCount - 1, pageIndex)); // Task 070: 末尾で範囲外になっていた
  }

  /**
   *  msに相当するサムネは何ページの何番目にあるか？を返す
   */
  getThumbnailPosition(ms) {
    const index = this.getIndex(ms);
    const page = this.getPageIndex(index);

    const mod = index % this.countPerPage;
    const row = Math.floor(mod / Math.max(1, this.cols));
    const col = mod % Math.max(1, this.cols); // Task 070: rows と取り違えていた（10x10 以外でずれる）
    return {
      page,
      url: this.getPage(page),
      index,
      row,
      col
    };
  }
}

//===END===
export {StoryboardInfoModel};