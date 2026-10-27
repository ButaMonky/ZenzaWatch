import {workerUtil} from '../../../lib/src/infra/workerUtil';
import {StoryboardInfoModel} from './StoryboardInfoModel';
// GENERATED FROM tools/typescript-stage1/nico-src/StoryboardWorker.ts (Task962). Edit the .ts and run npm run nico:sync.
//===BEGIN===
const StoryboardWorker = (() => {
    const func = function (self) {
        const SCROLL_BAR_WIDTH = 8;
        const BLANK_SRC = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAAE0lEQVQoU2NkYGD4z4AHMI4MBQCFZAgB+jxHYAAAAABJRU5ErkJggg==';
        let BLANK_IMG;
        const items = {};
        const getCanvas = (width, height) => {
            if (self.OffscreenCanvas) {
                return new OffscreenCanvas(width, height);
            }
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            return canvas;
        };
        // ArrayBuffer -> DataURL
        const a2d = (arrayBuffer, type = 'image/jpeg') => {
            return new Promise((ok, ng) => {
                const reader = new FileReader();
                reader.onload = () => ok(reader.result);
                reader.onerror = ng;
                reader.readAsDataURL(new Blob([arrayBuffer], { type }));
            });
        };
        /**
         * @param {ArrayBuffer|string} src
         */
        const loadImage = async (src) => {
            try {
                if (self.createImageBitmap) {
                    return await createImageBitmap(src instanceof ArrayBuffer ?
                        new Blob([src], { type: 'image/jpeg' }) :
                        (await fetch(src, { credentials: 'omit' }).then(r => {
                            if (!r.ok) {
                                throw new Error(`HTTP ${r.status}`);
                            }
                            return r.blob();
                        })));
                }
                else {
                    const img = new Image();
                    img.src = src instanceof ArrayBuffer ? (await a2d(src)) : src;
                    await img.decode();
                    return img;
                }
            }
            catch (e) {
                console.warn('load image fail', e);
                return null;
            }
        };
        loadImage(BLANK_SRC).then(img => BLANK_IMG = img);
        // Task 070: 同じページを同時に要求された時に二重に取得・デコードしないよう、Promiseをキャッシュする。
        // 失敗したページはキャッシュしない（次のシークで取り直す）。
        const ImageCacheMap = new class {
            constructor() {
                this.map = new Map();
            }
            async get(src) {
                let cache = this.map.get(src);
                if (!cache) {
                    cache = { ref: 0, promise: loadImage(src), image: null };
                    this.map.set(src, cache);
                    cache.promise.then((image) => {
                        cache.image = image;
                        if (!image && this.map.get(src) === cache) {
                            this.map.delete(src);
                        }
                    });
                }
                cache.ref++;
                cache.updated = Date.now();
                this.gc(src);
                return (await cache.promise) || BLANK_IMG;
            }
            release(src, expectedCache) {
                const cache = this.map.get(src);
                // A failed/evicted page may have been replaced under the same URL.
                // Only the generation that acquired the reference may release it.
                if (!cache || (expectedCache && cache !== expectedCache)) {
                    return;
                }
                if (cache.ref <= 0) {
                    return;
                }
                cache.ref--;
                if (cache.ref === 0) {
                    cache.promise.then((image) => image && image.close && image.close());
                    this.map.delete(src);
                }
            }
            gc(except) {
                const MAX = 8;
                const map = this.map;
                if (map.size <= MAX) {
                    return;
                }
                // Never evict a bitmap while any view or in-flight draw holds a lease.
                const sorted = [...map].filter(([src, cache]) => src !== except && cache.ref <= 0)
                    .sort((a, b) => a[1].updated - b[1].updated);
                while (map.size > MAX && sorted.length) {
                    const [src, cache] = sorted.shift();
                    map.delete(src);
                    cache.promise.then((image) => image && image.close && image.close());
                }
            }
            has(src) {
                return this.map.has(src);
            }
        };
        class BoardView {
            constructor({ canvas, info, name }) {
                this.canvas = canvas;
                this.name = name;
                this._currentTime = -1;
                this._scrollLeft = 0;
                this._info = null;
                this.lastPos = {};
                this.ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
                this.bitmapCtx = canvas.getContext('bitmaprenderer');
                this.bufferCanvas = getCanvas(canvas.width, canvas.height);
                this.bufferCtx = this.bufferCanvas.getContext('2d', { alpha: false, desynchronized: true });
                this.images = ImageCacheMap;
                this.totalWidth = 0;
                this.isReady = false;
                this.boards = [];
                this._infoGeneration = 0;
                this._disposed = false;
                this._animationGeneration = 0;
                this.isAnimating = false;
                this.cls();
                if (info) {
                    this.isInitialized = this.setInfo(info);
                }
                else {
                    this.isInitialized = Promise.resolve();
                }
            }
            get info() { return this._info; }
            set info(infoRawData) { this.setInfo(infoRawData); }
            async setInfo(infoRawData) {
                if (this._disposed) {
                    return;
                }
                // Every async update owns its own immutable model snapshot. Reusing and
                // mutating this._info meant an old A promise could install its images
                // after B was already current.
                const generation = ++this._infoGeneration;
                const current = () => !this._disposed && generation === this._infoGeneration;
                this.isReady = false;
                const info = this._info = new StoryboardInfoModel(infoRawData);
                if (!info.isAvailable) {
                    const previous = this.boards;
                    this.boards = [];
                    this._releaseBoards(previous);
                    this._currentTime = -1;
                    this.totalWidth = 0;
                    return this.cls();
                }
                const timerLabel = `BoardView setInfo:${this.name}:${generation}`;
                console.time(timerLabel);
                const cols = info.cols;
                const rows = info.rows;
                const pageWidth = info.pageWidth;
                const boardWidth = pageWidth * rows;
                const cellWidth = info.cellWidth;
                const cellHeight = info.cellHeight;
                this.height = cellHeight;
                this.totalWidth = Math.ceil(info.duration * 1000 / info.cellIntervalMs) * cellWidth;
                // info.cellCount * info.cellWidth;
                const boards = (await Promise.all(info.images.map(async (url, idx) => {
                    const generated = [];
                    let image = null;
                    let imageCacheEntry;
                    try {
                        try {
                            const pendingImage = this.images.get(url);
                            // Preserve the exact cache generation through async drawing.
                            imageCacheEntry = this.images.map?.get(url);
                            image = await pendingImage;
                        }
                        catch (error) {
                            // A failed image becomes a blank board with normal frame borders.
                            // The other pages, and subsequent videos, must remain usable.
                            console.warn('BoardView image load failed', error);
                        }
                        if (!current()) {
                            return generated;
                        }
                        for (let row = 0; row < rows; row++) {
                            const canvas = getCanvas(pageWidth, cellHeight);
                            const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
                            ctx.beginPath();
                            const sy = row * cellHeight;
                            if (image) {
                                try {
                                    ctx.drawImage(image, 0, sy, pageWidth, cellHeight, 0, 0, pageWidth, cellHeight);
                                }
                                catch (error) {
                                    console.warn('BoardView image draw failed', error);
                                }
                            }
                            ctx.strokeStyle = 'rgb(128, 128, 128)';
                            ctx.shadowColor = 'rgb(192, 192, 192)';
                            ctx.shadowOffsetX = -1;
                            for (let col = 0; col < cols; col++) {
                                const x = col * cellWidth;
                                ctx.strokeRect(x, 1, cellWidth - 1, cellHeight + 2);
                            }
                            generated.push({
                                image: canvas,
                                left: idx * boardWidth + row * pageWidth,
                                right: idx * boardWidth + row * pageWidth + pageWidth,
                                width: pageWidth
                            });
                        }
                        return generated;
                    }
                    finally {
                        // Keep cache references balanced for normal, failed and superseded
                        // requests, including those resolved only after dispose().
                        this.images.release(url, imageCacheEntry);
                    }
                }))).flat();
                if (!current()) {
                    this._releaseBoards(boards);
                    console.timeEnd(timerLabel);
                    return;
                }
                const previous = this.boards;
                this.boards = boards;
                this._releaseBoards(previous);
                this.height = info.cellHeight;
                this._currentTime = -1;
                this.cls();
                console.timeEnd(timerLabel);
                this.isReady = true;
                this.reDraw();
            }
            _releaseBoards(boards) {
                for (const board of boards || []) {
                    const bitmap = board.image;
                    if (!bitmap) {
                        continue;
                    }
                    try {
                        if (typeof bitmap.close === 'function') {
                            bitmap.close();
                        }
                        else {
                            // Canvas / OffscreenCanvas has no close(). Resetting dimensions
                            // lets its pixel buffer go while a superseded async task drains.
                            bitmap.width = 0;
                            bitmap.height = 0;
                        }
                    }
                    catch (_) { /* cleanup must never revive stale ownership */ }
                }
            }
            reDraw() {
                const left = this._scrollLeft;
                this._scrollLeft = -1;
                this.scrollLeft = left;
            }
            get scrollLeft() {
                return this._scrollLeft;
            }
            set scrollLeft(left) {
                if (this._disposed) {
                    return;
                }
                left = Math.max(0, Math.min(this.totalWidth - this.width, left));
                if (this._scrollLeft === left) {
                    return;
                }
                this._scrollLeft = left;
                if (!this.info || !this.info.isAvailable || !this.isReady) {
                    return;
                }
                const width = this.width;
                const height = this.height;
                const totalWidth = this.totalWidth;
                const right = left + width;
                const bctx = this.bufferCtx;
                bctx.beginPath();
                for (const board of this.boards) {
                    if (board.right < left) {
                        continue;
                    }
                    if (board.left > right) {
                        break;
                    }
                    const dx = board.left - left;
                    bctx.drawImage(board.image, 0, 0, board.width, height, dx, 0, board.width, height);
                }
                const scrollBarLength = width * width / totalWidth;
                if (scrollBarLength < width) {
                    const scrollBarLeft = width * left / totalWidth;
                    bctx.fillStyle = 'rgba(240, 240, 240, 0.8)';
                    bctx.fillRect(scrollBarLeft, height - SCROLL_BAR_WIDTH, scrollBarLength, SCROLL_BAR_WIDTH);
                }
                if (this.isAnimating && this._currentTime >= 0) {
                    bctx.fillStyle = 'rgba(255, 255, 144, 0.5)';
                    const cellWidth = this.info.cellWidth;
                    const cellIndex = this._currentTime * 1000 / this.info.cellIntervalMs;
                    const pointerLeft = cellWidth * cellIndex - left - cellWidth / 2;
                    bctx.fillRect(pointerLeft, 0, cellWidth, height);
                }
                if (this.bufferCanvas.transferToImageBitmap && this.bitmapCtx && this.bitmapCtx.transferFromImageBitmap) {
                    const bitmap = this.bufferCanvas.transferToImageBitmap();
                    this.bitmapCtx.transferFromImageBitmap(bitmap);
                }
                else {
                    this.ctx.beginPath();
                    this.ctx.drawImage(this.bufferCanvas, 0, 0, width, height, 0, 0, width, height);
                }
            }
            cls() {
                this.bufferCtx.clearRect(0, 0, this.width, this.height);
                this.ctx.clearRect(0, 0, this.width, this.height);
            }
            get currentTime() {
                const center = this._scrollLeft + this.width / 2;
                return this.duration * (center / this.totalWidth);
            }
            set currentTime(time) { this.setCurrentTime(time); }
            get width() { return this.canvas.width; }
            get height() { return this.canvas.height; }
            set width(width) {
                this.canvas.width = width;
                this.bufferCanvas.width = width;
            }
            set height(height) {
                this.canvas.height = height;
                this.bufferCanvas.height = height;
            }
            setCurrentTime(sec) {
                if (this._disposed || !this.info?.isAvailable) {
                    return;
                }
                this._currentTime = sec;
                const duration = Math.max(1, this.info.duration);
                const per = sec / duration;
                const intervalMs = this.info.cellIntervalMs;
                const totalWidth = this.totalWidth;
                const innerWidth = this.width;
                const cellWidth = this.info.cellWidth;
                const cellIndex = this._currentTime * 1000 / intervalMs;
                const scrollLeft = Math.min(Math.max(cellWidth * cellIndex - innerWidth * per, 0), totalWidth - innerWidth);
                //        const scrollLeft = Math.min(Math.max(totalWidth * r - innerWidth * per, 0), totalWidth - innerWidth);
                this.scrollLeft = scrollLeft;
            }
            resize({ width, height }) {
                if (this._disposed) {
                    return;
                }
                width && (this.width = width);
                height && (this.height = height);
                if (this.isReady) {
                    this.reDraw();
                }
                else {
                    this.cls();
                }
            }
            sharedMemory({ buffer, MAP }) {
                const view = new Float32Array(buffer);
                const iview = new Int32Array(buffer);
                this.buffer = {
                    get currentTime() {
                        return view[MAP.currentTime];
                    },
                    get timestamp() {
                        return iview[MAP.timestamp];
                    },
                    wait() {
                        const tm = Atomics.load(iview, MAP.timestamp);
                        Atomics.wait(iview, MAP.timestamp, tm, 3000);
                        return Atomics.load(iview, MAP.timestamp);
                    },
                    get duration() {
                        return view[MAP.duration];
                    },
                    get playbackRate() {
                        return view[MAP.playbackRate];
                    },
                    get paused() {
                        return iview[MAP.paused] !== 0;
                    }
                };
            }
            async execAnimation() {
                this.isAnimating = true;
                const generation = ++this._animationGeneration;
                const active = () => this.isAnimating && !this._disposed && generation === this._animationGeneration;
                const buffer = this.buffer;
                while (active()) {
                    while (!this.isReady && active()) {
                        await new Promise(res => setTimeout(res, 500));
                    }
                    if (!active()) {
                        return;
                    }
                    while (this.isReady && active() && !buffer.paused) {
                        buffer.wait();
                        this.currentTime = this.buffer.currentTime;
                        await new Promise(res => requestAnimationFrame(res)); // 結局raf安定だった
                    }
                    if (!active()) {
                        return;
                    }
                    await new Promise(res => setTimeout(res, 1000));
                }
            }
            startAnimation() {
                if (this._disposed || !this.buffer || this.isAnimating) {
                    return;
                }
                this.currentTime = this.buffer.currentTime;
                this.execAnimation();
            }
            async stopAnimation() {
                this._animationGeneration++;
                this.isAnimating = false;
                if (this._disposed) {
                    return;
                }
                await new Promise(res => requestAnimationFrame(res));
                if (!this._disposed) {
                    this.reDraw();
                }
            }
            dispose() {
                if (this._disposed) {
                    return;
                }
                this._disposed = true;
                this._animationGeneration++;
                this._infoGeneration++;
                this.isAnimating = false;
                this.isReady = false;
                const oldBoards = this.boards;
                this.boards = [];
                this._releaseBoards(oldBoards);
                this._info = null;
                this.buffer = null;
                this.totalWidth = 0;
                this.cls();
            }
        }
        class ThumbnailView {
            constructor({ canvas, info, name }) {
                this.canvas = canvas;
                this.name = name;
                this._currentTime = -1;
                this._info = new StoryboardInfoModel(info);
                this.lastPos = {};
                this.ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
                this.images = ImageCacheMap;
                this.cls();
                this.isInitialized = Promise.resolve();
                this.isAnimating = false;
                this._imageLeases = new Map();
                this._disposed = false;
            }
            _releaseImageLeases() {
                if (!this._imageLeases) {
                    return;
                }
                for (const [src, lease] of this._imageLeases) {
                    this.images.release(src, lease.cache);
                }
                this._imageLeases.clear();
            }
            _releaseUnusedImageLeases(keep) {
                if (!this._imageLeases) {
                    return;
                }
                for (const [src, lease] of this._imageLeases) {
                    if (keep.has(src)) {
                        continue;
                    }
                    this._imageLeases.delete(src);
                    this.images.release(src, lease.cache);
                }
            }
            _hasCurrentImageLease(src) {
                const lease = this._imageLeases?.get(src);
                return !!lease && this.images.has(src) &&
                    (!lease.cache || !this.images.map || this.images.map.get(src) === lease.cache);
            }
            _getImageWithLease(src) {
                this._imageLeases = this._imageLeases || new Map();
                if (this._hasCurrentImageLease(src)) {
                    return this._imageLeases.get(src).request;
                }
                // An older failed page may have disappeared or been replaced at the same URL.
                const obsolete = this._imageLeases.get(src);
                if (obsolete) {
                    this._imageLeases.delete(src);
                    this.images.release(src, obsolete.cache);
                }
                const request = Promise.resolve(this.images.get(src));
                const lease = { request, cache: this.images.map?.get(src) };
                this._imageLeases.set(src, lease);
                const releaseFailed = () => {
                    if (this._imageLeases.get(src) === lease) {
                        this._imageLeases.delete(src);
                        this.images.release(src, lease.cache);
                    }
                };
                // ImageCacheMap drops failed loads; never pin its BLANK fallback.
                request.then(image => {
                    if (image === BLANK_IMG || !this.images.has(src)) {
                        releaseFailed();
                    }
                }, releaseFailed);
                return request;
            }
            get info() { return this._info; }
            set info(info) {
                if (this._disposed) {
                    return;
                }
                // Invalidate a suspended setCurrentTime() before its old image resolves.
                this._drawSeq = (this._drawSeq || 0) + 1;
                this.isReady = false;
                this._releaseImageLeases();
                this._info.update(info);
                this._currentTime = -1;
                this.lastPos = {};
                this.cls();
                if (!this._info.isAvailable) {
                    return;
                }
                this.isReady = true;
            }
            async setInfo(info) {
                this.info = info;
            }
            cls() {
                this.ctx.clearRect(0, 0, this.width, this.height);
            }
            get currentTime() { return this._currentTime; }
            set currentTime(time) { this.setCurrentTime(time); }
            get width() { return this.canvas.width; }
            get height() { return this.canvas.height; }
            set width(width) { this.canvas.width = width; }
            set height(height) { this.canvas.height = height; }
            async setCurrentTime(time) {
                if (this._disposed) {
                    return;
                }
                time > this.info.duration && (time = this.info.duration);
                time < 0 && (time = 0);
                if (this._currentTime === time &&
                    this._hasCurrentImageLease(this.lastPos.url)) {
                    return;
                }
                const pos = this.info.getThumbnailPosition(time * 1000);
                if (Object.keys(pos).every(key => pos[key] === this.lastPos[key]) &&
                    this._hasCurrentImageLease(pos.url)) {
                    this._currentTime = time;
                    return;
                }
                // Keep only the visible page and adjacent prefetch pages pinned.
                // Old in-flight frames are already invalidated by the draw sequence.
                const keep = new Set([pos.url]);
                for (const neighbor of [pos.page - 1, pos.page + 1]) {
                    if (neighbor >= 0 && neighbor < this.info.pageCount) {
                        const src = this.info.getPage(neighbor);
                        if (typeof src === 'string') {
                            keep.add(src);
                        }
                    }
                }
                this._releaseUnusedImageLeases(keep);
                this.lastPos = pos;
                this._currentTime = time;
                const { url, row, col, page } = pos;
                const cellWidth = this.info.cellWidth;
                const cellHeight = this.info.cellHeight;
                const seq = this._drawSeq = (this._drawSeq || 0) + 1;
                const image = await this._getImageWithLease(url);
                // Task 070: 取得を待っている間に別の位置へ移動していたら古い絵は描かない
                if (seq !== this._drawSeq || !image) {
                    return;
                }
                // 隣のページを先に読んでおく（URLの場合のみ。シークバーを動かした時に待たないように）
                this.prefetch(page - 1);
                this.prefetch(page + 1);
                const imageLeft = col * cellWidth;
                const imageTop = row * cellHeight;
                const scale = Math.min(this.width / cellWidth, this.height / cellHeight);
                try {
                    this.cls();
                    this.ctx.drawImage(image, imageLeft, imageTop, cellWidth, cellHeight, (this.width - cellWidth * scale) / 2, (this.height - cellHeight * scale) / 2, cellWidth * scale, cellHeight * scale);
                }
                catch (e) {
                    // gcで閉じられた直後のImageBitmapなど。次の移動で描き直される
                    this.lastPos = {};
                }
            }
            prefetch(page) {
                if (this._disposed || !this.info || page < 0 || page >= this.info.pageCount) {
                    return;
                }
                const src = this.info.getPage(page);
                if (typeof src !== 'string' || this.images.has(src)) {
                    return;
                }
                this._getImageWithLease(src).catch(() => { });
            }
            resize({ width, height }) {
                this.width = width;
                this.height = height;
                this.cls();
            }
            dispose() {
                if (this._disposed) {
                    return;
                }
                this.stopAnimation();
                this.info = null; // releases only this view's actual image leases, once
                this._disposed = true;
            }
            sharedMemory() { }
            async execAnimation() {
                const generation = ++this._animationGeneration;
                const active = () => this.isAnimating && generation === this._animationGeneration;
                while (active()) {
                    while (!this.isReady && active()) {
                        await new Promise(res => setTimeout(res, 500));
                    }
                    if (!active()) {
                        return;
                    }
                    await this.setCurrentTime((this.currentTime + this.info.interval / 1000) % this.info.duration);
                    if (!active()) {
                        return;
                    }
                    await new Promise(res => setTimeout(res, 1000));
                }
            }
            startAnimation() {
                if (this._disposed || this.isAnimating) {
                    return;
                }
                this.isAnimating = true;
                this.execAnimation();
            }
            stopAnimation() {
                this._animationGeneration++;
                this.isAnimating = false;
            }
        }
        const getId = function () { return `Storyboard-${this.id++}`; }.bind({ id: 0 });
        const createView = async ({ canvas, info, name }, type = 'thumbnail') => {
            const id = getId();
            const view = type === 'thumbnail' ?
                new ThumbnailView({ canvas, info, name }) :
                new BoardView({ canvas, info, name });
            items[id] = view;
            await view.isInitialized;
            return { status: 'ok', id };
        };
        const info = async ({ id, info }) => {
            const item = items[id];
            if (!item) {
                throw new Error(`unknown id:${id}`);
            }
            await item.setInfo(info);
            return { status: 'ok' };
        };
        const currentTime = ({ id, currentTime }) => {
            const item = items[id];
            if (!item) {
                throw new Error(`unknown id:${id}`);
            }
            item.setCurrentTime(currentTime);
            return { status: 'ok' };
        };
        const scrollLeft = ({ id, scrollLeft }) => {
            const item = items[id];
            if (!item) {
                throw new Error(`unknown id:${id}`);
            }
            item.scrollLeft = scrollLeft;
            return { status: 'ok' };
        };
        const resize = (params) => {
            const item = items[params.id];
            if (!item) {
                throw new Error(`unknown id:${params.id}`);
            }
            item.resize(params);
            return { status: 'ok' };
        };
        const cls = (params) => {
            const item = items[params.id];
            if (!item) {
                throw new Error(`unknown id:${params.id}`);
            }
            item.cls();
            return { status: 'ok' };
        };
        const dispose = ({ id }) => {
            const item = items[id];
            if (!item) {
                return;
            }
            item.dispose();
            delete items[id];
            return { status: 'ok' };
        };
        const sharedMemory = ({ id, buffer, MAP }) => {
            const item = items[id];
            if (!item) {
                throw new Error(`unknown id:${id}`);
            }
            item.sharedMemory({ buffer, MAP });
            return { status: 'ok' };
        };
        const startAnimation = ({ id, interval }) => {
            const item = items[id];
            if (!item) {
                throw new Error(`unknown id:${id}`);
            }
            item.startAnimation();
            return { status: 'ok' };
        };
        const stopAnimation = ({ id, interval }) => {
            const item = items[id];
            if (!item) {
                throw new Error(`unknown id:${id}`);
            }
            item.stopAnimation();
            return { status: 'ok' };
        };
        self.onmessage = async ({ command, params }) => {
            switch (command) {
                case 'createThumbnail':
                    return createView(params, 'thumbnail');
                case 'createBoard':
                    return createView(params, 'board');
                case 'info':
                    return info(params);
                case 'currentTime':
                    return currentTime(params);
                case 'scrollLeft':
                    return scrollLeft(params);
                case 'resize':
                    return resize(params);
                case 'cls':
                    return cls(params);
                case 'dispose':
                    return dispose(params);
                case 'sharedMemory':
                    return sharedMemory(params);
                case 'startAnimation':
                    return startAnimation(params);
                case 'stopAnimation':
                    return stopAnimation(params);
            }
        };
    };
    const isOffscreenCanvasAvailable = !!HTMLCanvasElement.prototype.transferControlToOffscreen;
    const NAME = 'StoryboardWorker';
    let worker;
    const initWorker = async () => {
        if (worker) {
            return worker;
        }
        if (!isOffscreenCanvasAvailable) {
            if (!worker) {
                worker = {
                    name: NAME,
                    onmessage: () => { },
                    post: ({ command, params }) => worker.onmessage({ command, params })
                };
                func(worker);
            }
        }
        else {
            worker = worker || workerUtil.createCrossMessageWorker(func, { name: NAME, inject: StoryboardInfoModel.toString() });
        }
        return worker;
    };
    const createView = ({ container, canvas, info, ratio, name, style }, type = 'thumbnail') => {
        style = style || {};
        ratio = ratio || window.devicePixelRatio || 1;
        name = name || 'Storyboard';
        if (!canvas) {
            canvas = document.createElement('canvas');
            Object.assign(canvas.style, {
                width: '100%',
                height: '100%'
            });
            container && container.append(canvas);
            style.widthPx && (canvas.width = Math.max(style.widthPx));
            style.heightPx && (canvas.height = Math.max(style.heightPx));
        }
        canvas.dataset.name = name;
        canvas.classList.add('is-loading');
        // const worker = await ;
        const layer = isOffscreenCanvasAvailable ? canvas.transferControlToOffscreen() : canvas;
        // Only the latest request may dismiss the loading indicator. Setup is generation 0.
        let loadingGeneration = 0, isDisposed = false;
        const finishLoading = (generation) => {
            if (!isDisposed && generation === loadingGeneration) {
                canvas.classList.remove('is-loading');
            }
        };
        const promiseSetup = (async () => {
            try {
                const worker = await initWorker();
                const result = await worker.post({ command: type === 'thumbnail' ? 'createThumbnail' : 'createBoard',
                    params: { canvas: layer, info, style, name } }, { transfer: [layer] });
                return result.id;
            }
            finally {
                finishLoading(0);
            }
        })();
        let currentTime = -1, scrollLeft = -1, isAnimating = false;
        const post = async ({ command, params }, transfer = {}) => {
            const id = await promiseSetup;
            params = params || {};
            params.id = id;
            return worker.post({ command, params }, transfer);
        };
        const result = {
            container,
            canvas,
            setInfo(info) {
                if (isDisposed) {
                    return Promise.resolve();
                }
                const generation = ++loadingGeneration;
                currentTime = -1;
                scrollLeft = -1;
                canvas.classList.add('is-loading');
                return post({ command: 'info', params: { info } })
                    .finally(() => finishLoading(generation));
            },
            resize({ width, height }) {
                scrollLeft = -1;
                return post({ command: 'resize', params: { width, height } });
            },
            get scrollLeft() {
                return scrollLeft;
            },
            set scrollLeft(left) {
                if (scrollLeft === left) {
                    return;
                }
                scrollLeft = left;
                post({ command: 'scrollLeft', params: { scrollLeft } });
            },
            get currentTime() {
                return currentTime;
            },
            set currentTime(time) {
                if (currentTime === time) {
                    return;
                }
                currentTime = time;
                post({ command: 'currentTime', params: { currentTime } });
            },
            dispose() {
                if (isDisposed) {
                    return;
                }
                isDisposed = true;
                loadingGeneration++;
                canvas.classList.remove('is-loading');
                // Teardown is best-effort if setup already failed.
                post({ command: 'dispose', params: {} }).catch(() => { });
            },
            sharedMemory({ MAP, buffer }) {
                post({ command: 'sharedMemory', params: { MAP, buffer } });
            },
            startAnimation() {
                isAnimating = true;
                post({ command: 'startAnimation', params: {} });
            },
            stopAnimation() {
                isAnimating = false;
                post({ command: 'stopAnimation', params: {} });
            },
            get isAnimating() {
                return isAnimating;
            }
        };
        return result;
    };
    return {
        initWorker,
        createThumbnail: (args) => createView(args, 'thumbnail'),
        createBoard: (args) => createView(args, 'board')
    };
})();
//===END===
export {
  StoryboardWorker
};
