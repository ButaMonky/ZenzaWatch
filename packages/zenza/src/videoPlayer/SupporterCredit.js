//===BEGIN===
/*
 * Task 080: 動画の最後に流れる「提供」画面（ニコニ広告・ギフトの支援者クレジット）
 *
 * 本家プレイヤー（nvpc_next）を解析して、同じ情報・同じ流れで再現したもの。
 * 詳しい解析結果は docs/design-pack/89_TASK_080_*.md の2章。
 *
 * 【使う API（どれも認証不要。www.nicovideo.jp 以外のサブドメインからも読める）】
 *   GET https://api.nicoad.nicovideo.jp/v2/contents/video/{動画ID}/pickup_supporters?tags={タグをカンマ区切り}
 *     → data.supporters.{adTopSupporter, adRecentSupporter, giftTopSupporter, giftRecentSupporter}
 *        （それぞれ supporterName, userId, auxiliary.bgColor など。adTopSupporter.message がある事も）
 *       data.logoImageUrl / infoText / infoUrl … 画面上部の帯（ニコニ貢献の案内）
 *       data.voiceUrl … 提供音声の mp3。期間ごとに変わる（例: .../credit/Lasttykiss_2026_1st.mp3、約11.5秒）
 *       data.banner … 期間限定の左右のバナー（{left:{imageUrl,linkUrl}, right:{...}}。無いことが多い）
 *   GET https://api.nicoad.nicovideo.jp/v1/nage_video/{動画ID}/gift/effects
 *     → data.effects[] … 落ちてくるギフト。imageUrl（絵）, assetUrl（大きさ等のJSON）, point, supporterName, message
 *       assetUrl の JSON: {imageGridRow: 横のマス数, imageGridColumn: 縦のマス数, message*…}
 *
 * 【本家の流れ】
 *   - 動画本編の後ろに「提供」のコンテンツがつながっていて、提供音声（mp3）の長さだけ流れる。
 *     時間は音声の再生位置で進む（音声が終われば提供画面も終わる）。コメントもその間流れ続ける。
 *   - 1280×720 の画面。背景は adTopSupporter.auxiliary.bgColor（無ければ #00f）。
 *     bgVideoPosition がある時は、その位置の動画の場面を背景に使う（Zenza では最後の場面で代用）。
 *   - 「提　供」の下に、ニコニ広告のトップ支援者・最新の支援者（NEW!）。
 *     ギフトもある時は 5秒 で左へ 0.3秒 かけてスライドし、ギフトのトップ・最新の支援者に切り替わる。
 *   - ギフトは 1000×562.5 の仮想画面に 50px のマス目で下から積み上がるように落ちてくる（1.25秒、3乗の加速）。
 *     300pt 以上のギフトは、着地後 2.25秒 だけ支援者名と「+ポイント」を表示。
 *   - 本家のロゴ（ニコニ広告・ギフト・NEW!）は本家のSVGだが、ここでは文字で描く（本家の素材は同梱しない）。
 */
const SupporterCredit = (() => {
  const NICOAD_API = 'https://api.nicoad.nicovideo.jp';
  const CANVAS_W = 1280, CANVAS_H = 720;
  const DEFAULT_DURATION = 11.5;   // 音声が読めない時の長さ（本家の音声は約11.5秒）
  const MAX_DURATION = 30;         // 本家も30秒で描画を止める
  const PAGE_SWITCH_SEC = 5, PAGE_SWITCH_DUR = 0.3;
  const DEFAULT_BG = '#00f';
  const TEXT_FONT = 'YuGothic,"YuGothic M","Hiragino Kaku Gothic ProN",Meiryo,Arial,sans-serif';
  const GIFT_FONT = 'Avenir,Lato,BlinkMacSystemFont,"Helvetica Neue","Hiragino Kaku Gothic ProN",Meiryo,sans-serif';
  // ギフトの仮想画面（本家と同じ）
  const GIFT = {
    CELL: 50, VIEW_W: 1000, VIEW_H: 1000 * 9 / 16, FALL_SEC: 1.25, SPREAD_SEC: 5.75,
    SHOW_NAME_POINT: 300, NAME_SEC: 2.25, NAME_IN_SEC: 0.25, SCROLL_RATIO: 0.6
  };

  const easeInCubic = t => t < 0 ? 0 : t > 1 ? 1 : t * t * t;
  const easeOutCubic = t => t < 0 ? 0 : t > 1 ? 1 : 1 - (1 - t) ** 3;

  const withTimeout = (promise, ms = 10000) =>
    Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))]);

  const fetchJson = (url, signal) =>
    withTimeout(fetch(url, {credentials: 'include', signal}).then(r => r.ok ? r.json() : null))
      .catch(() => null);

  const loadImage = url => withTimeout(new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  }));

  /**
   * 提供画面の情報を読む。表示するものが無ければ null。
   * @param {{videoId: string, tags?: string[], signal?: AbortSignal}} params
   */
  const load = async ({videoId, tags = [], signal = null}) => {
    if (!videoId) { return null; }
    const id = encodeURIComponent(videoId);
    const q = tags.length ? `?tags=${encodeURIComponent(tags.join(','))}` : '';
    const [sup, gift] = await Promise.all([
      fetchJson(`${NICOAD_API}/v2/contents/video/${id}/pickup_supporters${q}`, signal),
      fetchJson(`${NICOAD_API}/v1/nage_video/${id}/gift/effects`, signal)
    ]);
    const data = sup && sup.data;
    const supporters = data && data.supporters;
    if (!supporters || (!supporters.adTopSupporter && !supporters.giftTopSupporter)) {
      return null;
    }
    return {
      videoId,
      supporters,
      logoImageUrl: data.logoImageUrl || '',
      infoText: data.infoText || '',
      infoUrl: data.infoUrl || '',
      voiceUrl: data.voiceUrl || '',
      banner: data.banner && data.banner.left && data.banner.right ? data.banner : null,
      gifts: (gift && gift.data && Array.isArray(gift.data.effects)) ? gift.data.effects : []
    };
  };

  /*
   * ギフトの絵と大きさのJSONを読む（失敗したものは外す）。
   * ギフトの種類（期間限定・新しいギフト）は API の imageUrl / assetUrl で決まるので、
   * 種類の一覧は持たない。同じ絵・JSON は1回だけ読む（同じ動画内の重複・連続再生の次の動画でも使い回す）。
   */
  const assetCache = new Map();
  const cached = (key, create) => {
    if (assetCache.has(key)) { return assetCache.get(key); }
    const p = create();
    p.catch(() => assetCache.delete(key));
    assetCache.set(key, p);
    if (assetCache.size > 400) { assetCache.delete(assetCache.keys().next().value); }
    return p;
  };
  const loadGiftAssets = async gifts => {
    const loaded = await Promise.all(gifts.map(async gift => {
      try {
        const [image, assetData] = await Promise.all([
          cached(`img:${gift.imageUrl}`, () => loadImage(gift.imageUrl)),
          cached(`json:${gift.assetUrl}`, () => withTimeout(fetch(gift.assetUrl).then(r => r.json())))
        ]);
        if (!assetData || !assetData.imageGridRow || !assetData.imageGridColumn) { return null; }
        return Object.assign({}, gift, {image, assetData});
      } catch (e) {
        return null;
      }
    }));
    return loaded.filter(g => !!g);
  };

  // ---- 文字の描画（本家の描き方に合わせる: 白文字＋黒ふち、中央揃え、行の中央に置く）----
  const drawText = (ctx, text, {x, y, width, fontSize, lineHeight = 1, align = 'center',
    fill = '#fff', stroke = '#000', strokeWidth = 5, font = TEXT_FONT, weight = 800, overflow = 'ellipsis'}) => {
    if (!text) { return y; }
    ctx.save();
    ctx.font = `${weight} ${fontSize}px ${font}`;
    ctx.lineJoin = 'round';
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    let lines = [String(text)];
    if (overflow === 'ellipsis' && width && ctx.measureText(lines[0]).width > width) {
      let s = lines[0];
      while (s.length > 1 && ctx.measureText(`${s}...`).width > width) { s = s.slice(0, -1); }
      lines = [`${s}...`];
    } else if (overflow === 'wrap' && width) {
      lines = [];
      let line = '';
      Array.from(String(text)).forEach(ch => {
        if (ctx.measureText(line + ch).width > width && line) { lines.push(line); line = ch; } else { line += ch; }
      });
      lines.push(line);
    }
    const lh = fontSize * lineHeight;
    const ox = align === 'left' ? 0 : align === 'right' ? width : width / 2;
    lines.forEach((line, i) => {
      const ty = y + lh * i + (lh - fontSize) / 2 + fontSize / 2;
      if (stroke) {
        ctx.lineWidth = strokeWidth;
        ctx.strokeStyle = stroke;
        ctx.strokeText(line, x + ox, ty);
      }
      ctx.fillStyle = fill;
      ctx.fillText(line, x + ox, ty);
    });
    ctx.restore();
    return y + lh * lines.length;
  };

  /** 「NEW!」の札（本家はSVG。ここでは文字で描く） */
  const drawNewBadge = (ctx, cx, cy, scale = 1) => {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-12 * Math.PI / 180);
    ctx.font = `italic 900 ${Math.round(26 * scale)}px ${GIFT_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 6 * scale;
    ctx.strokeStyle = '#000';
    ctx.strokeText('NEW!', 0, 0);
    ctx.fillStyle = '#FFD700';
    ctx.fillText('NEW!', 0, 0);
    ctx.restore();
  };

  /** 「ニコニ広告」「ギフト」の見出し（本家はロゴのSVG。ここでは文字で描く） */
  const drawHeading = (ctx, text, cx, top, height, accent) => {
    ctx.save();
    ctx.font = `900 ${Math.round(height * 0.95)}px ${TEXT_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 7;
    ctx.strokeStyle = '#000';
    const y = top + height / 2;
    ctx.strokeText(text, cx, y);
    ctx.fillStyle = '#fff';
    ctx.fillText(text, cx, y);
    // 見出しの下に細い色の線（本家ロゴの代わりの飾り）
    const w = Math.min(ctx.measureText(text).width + 24, 360);
    ctx.fillStyle = accent;
    ctx.fillRect(cx - w / 2, top + height + 4, w, 4);
    ctx.restore();
  };

  /**
   * 「提供」の文字部分。2ページ（ニコニ広告 / ギフト）を横に並べた幅2倍の canvas に一度だけ描き、
   * 毎フレームはその一部を貼るだけにする（本家と同じ作り）。
   */
  class SupportersPage {
    constructor(supporters) {
      this.supporters = supporters;
      this.base = document.createElement('canvas');
      this.base.width = CANVAS_W;
      this.base.height = CANVAS_H;
      this.pages = document.createElement('canvas');
      this.pages.width = CANVAS_W * 2;
      this.pages.height = CANVAS_H;
      this.contentWidth = 730;
      this._render();
    }
    _textArea(offsetX = 0) {
      return {x: offsetX + (CANVAS_W - this.contentWidth) / 2, width: this.contentWidth};
    }
    _render() {
      const s = this.supporters;
      const base = this.base.getContext('2d');
      const bottom = drawText(base, '提　供', Object.assign(this._textArea(), {y: 140, fontSize: 52, lineHeight: 1.4}));
      const ctx = this.pages.getContext('2d');
      const renderPage = (offsetX, heading, accent, top, recent, message) => {
        if (!top) { return; }
        const cx = offsetX + CANVAS_W / 2;
        let y = bottom + 12;
        drawHeading(ctx, heading, cx, y, 37, accent);
        y = drawText(ctx, top.supporterName, Object.assign(this._textArea(offsetX), {y: y + 90, fontSize: 40, lineHeight: 1.5}));
        if (message) {
          y = drawText(ctx, message, Object.assign(this._textArea(offsetX), {y: y + 5, fontSize: 28, lineHeight: 1.2}));
        }
        y += 70;
        if (recent && recent.supporterName) {
          drawText(ctx, recent.supporterName, Object.assign(this._textArea(offsetX), {y, fontSize: 37, lineHeight: 1.2}));
          ctx.save();
          ctx.font = `800 32px ${TEXT_FONT}`;
          const w = Math.min(ctx.measureText(recent.supporterName).width, this.contentWidth);
          ctx.restore();
          drawNewBadge(ctx, cx - w / 2 - 34, y - 10);
        }
      };
      renderPage(0, 'ニコニ広告', '#ffcc00', s.adTopSupporter, s.adRecentSupporter,
        s.adTopSupporter && s.adTopSupporter.message);
      renderPage(CANVAS_W, 'ギフト', '#ff6fa8', s.giftTopSupporter, s.giftRecentSupporter, null);
    }
    render(ctx, t) {
      const s = this.supporters;
      ctx.drawImage(this.base, 0, 0);
      let x = 0;
      if (s.adTopSupporter && s.giftTopSupporter) {
        if (t >= PAGE_SWITCH_SEC) {
          x = -CANVAS_W * easeInCubic(Math.min((t - PAGE_SWITCH_SEC) / PAGE_SWITCH_DUR, 1));
        }
      } else if (!s.adTopSupporter && s.giftTopSupporter) {
        x = -CANVAS_W;
      }
      ctx.drawImage(this.pages, x, 0);
    }
  }

  /** ギフトの配置表（本家の mb クラスと同じ考え方）。行0が一番下 */
  class GiftGrid {
    constructor(maxCol) {
      this.maxCol = Math.max(1, maxCol);
      this.map = [];
      this.rowSize = 0;
      this.topBaseLine = 0;
      this.items = [];
    }
    _get(col, row) { return this.map[row] ? (this.map[row][col] || null) : null; }
    _vacant(col, row, w, h) {
      for (let i = 0; i < w; i++) {
        for (let j = 0; j < h; j++) {
          if (this._get(col + i, row + j) !== null) { return false; }
        }
      }
      return true;
    }
    add(data, w, h) {
      const lastCol = Math.max(this.maxCol - w + 1, 1);
      for (let row = 0; row < 1000; row++) {
        for (let col = 0; col < lastCol; col++) {
          if (!this._vacant(col, row, w, h)) { continue; }
          for (let i = 0; i < w; i++) {
            for (let j = 0; j < h; j++) {
              (this.map[row + j] = this.map[row + j] || [])[col + i] = true;
            }
          }
          this.items.push({data, col, row});
          this.rowSize = Math.max(this.rowSize, row + h);
          this.topBaseLine = Math.max(this.topBaseLine, row + 1);
          return;
        }
      }
    }
  }

  /** 落ちてくるギフト */
  class GiftLayer {
    constructor(gifts, {paddingInline = 0} = {}) {
      const usable = GIFT.VIEW_W - GIFT.VIEW_W * paddingInline;
      const grid = new GiftGrid(Math.floor(usable / GIFT.CELL));
      gifts.forEach(g => grid.add(g, g.assetData.imageGridRow, g.assetData.imageGridColumn));
      const totalH = grid.rowSize * GIFT.CELL;
      const floor = Math.max(totalH, GIFT.VIEW_H);
      this.items = grid.items.map(({data, col, row}) => {
        const w = data.assetData.imageGridRow * GIFT.CELL, h = data.assetData.imageGridColumn * GIFT.CELL;
        const start = (GIFT.SPREAD_SEC / Math.max(1, grid.topBaseLine)) * (row + Math.random());
        const land = start + GIFT.FALL_SEC;
        return {
          gift: data,
          x: (GIFT.VIEW_W - usable) / 2 + col * GIFT.CELL,
          y: floor - row * GIFT.CELL - h,
          w, h, start, land,
          showName: data.point >= GIFT.SHOW_NAME_POINT
        };
      });
      this.scroll = null;
      if (totalH >= GIFT.VIEW_H) {
        const limit = totalH - GIFT.VIEW_H * GIFT.SCROLL_RATIO;
        let s = 0, e = 0;
        this.items.forEach(item => {
          if (item.y < limit) { s = s ? Math.min(s, item.land) : item.land; }
          e = Math.max(e, item.land);
        });
        this.scroll = {start: s, end: e, before: totalH - GIFT.VIEW_H, after: -100};
      }
    }
    _scrollY(t) {
      const sc = this.scroll;
      if (!sc) { return 0; }
      if (t <= sc.start) { return sc.before; }
      if (t >= sc.end) { return sc.after; }
      return sc.before - (t - sc.start) / Math.max(0.001, sc.end - sc.start) * (sc.before - sc.after);
    }
    render(ctx, t) {
      const zoom = CANVAS_W / GIFT.VIEW_W;
      const sy = this._scrollY(t);
      const fall = item => {
        if (t <= item.start) { return -GIFT.VIEW_H; }
        if (t >= item.land) { return 0; }
        return -GIFT.VIEW_H + GIFT.VIEW_H * easeInCubic((t - item.start) / GIFT.FALL_SEC);
      };
      this.items.forEach(item => {
        if (t < item.start) { return; }
        const y = item.y + fall(item) - sy;
        if (y > GIFT.VIEW_H) { return; }
        ctx.drawImage(item.gift.image, item.x * zoom, y * zoom, item.w * zoom, item.h * zoom);
        this._renderMessage(ctx, item, y, zoom);
      });
      // 支援者名と「+ポイント」（着地してから 2.25秒、下から少し持ち上がって出る）
      this.items.forEach(item => {
        if (!item.showName || t < item.land || t > item.land + GIFT.NAME_SEC) { return; }
        const lift = 100 - 100 * easeOutCubic((t - item.land) / GIFT.NAME_IN_SEC);
        const y = item.y + lift - sy;
        if (y > GIFT.VIEW_H) { return; }
        ctx.save();
        ctx.globalAlpha = 0.8;
        drawText(ctx, item.gift.supporterName, {
          x: item.x * zoom, y: (y - 50) * zoom, width: item.w * zoom, fontSize: 25 * zoom,
          strokeWidth: 4 * zoom, font: GIFT_FONT
        });
        drawText(ctx, `+${item.gift.point}`, {
          x: (item.x + (item.w - 200) / 2) * zoom, y: (y - 20) * zoom, width: 200 * zoom,
          fontSize: 37.5 * zoom, strokeWidth: 4 * zoom, font: GIFT_FONT, overflow: 'nowrap'
        });
        ctx.restore();
      });
    }
    _renderMessage(ctx, item, y, zoom) {
      const a = item.gift.assetData, message = item.gift.message;
      if (!message || !a.messageFieldX || !a.messageFieldY || !a.messageFieldWidth || !a.messageFontSize) { return; }
      drawText(ctx, message, {
        x: (item.x + a.messageFieldX) * zoom, y: (y + a.messageFieldY) * zoom,
        width: a.messageFieldWidth * zoom, fontSize: a.messageFontSize * zoom,
        lineHeight: a.messageLineHeight || 1.2, align: a.messageAlign || 'center',
        fill: a.messageFillColor || '#fff', stroke: a.messageStrokeColor || null,
        strokeWidth: 4 * zoom, font: GIFT_FONT, overflow: 'wrap'
      });
    }
  }

  const CSS = `
    .zenzaSupporterCredit {
      position: absolute;
      inset: 0;
      z-index: 8;
      display: none;
      opacity: 0;
      transition: opacity 0.4s ease;
      container-type: size;
      background: #000;
      pointer-events: none;
    }
    .zenzaSupporterCredit.is-show { display: block; }
    .zenzaSupporterCredit.is-visible { opacity: 1; }
    .zenzaSupporterCredit .scBox {
      position: absolute;
      top: 50%;
      left: 50%;
      width: min(100cqw, calc(100cqh * 16 / 9));
      height: min(100cqh, calc(100cqw * 9 / 16));
      transform: translate(-50%, -50%);
    }
    .zenzaSupporterCredit canvas.scCanvas {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
    }
    .zenzaSupporterCredit .scHeader {
      box-sizing: border-box;
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 8%;
      padding: 0 1%;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 1em;
      background: rgba(0, 0, 0, 0.5);
      color: #fff;
      font-size: 4cqh;
      pointer-events: auto;
      overflow: hidden;
      white-space: nowrap;
    }
    .zenzaSupporterCredit .scHeader img { height: 80%; }
    .zenzaSupporterCredit .scHeader a {
      color: inherit;
      text-decoration: underline;
      overflow: hidden;
      text-overflow: ellipsis;
      cursor: pointer;
    }
    .zenzaSupporterCredit .scHeader a:hover { opacity: 0.9; }
    .zenzaSupporterCredit .scBanners {
      position: absolute;
      inset: 0;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .zenzaSupporterCredit .scBanners a {
      display: block;
      height: 100%;
      aspect-ratio: 4 / 11;
      pointer-events: auto;
    }
    .zenzaSupporterCredit .scBanners img { width: 100%; height: 100%; object-fit: contain; display: block; }
    .zenzaSupporterCredit .scSkip {
      position: absolute;
      right: 1.5%;
      bottom: 3%;
      padding: 0.4em 1em;
      font-size: max(12px, 2.4cqh);
      color: #fff;
      background: rgba(0, 0, 0, 0.55);
      border: 1px solid rgba(255, 255, 255, 0.5);
      border-radius: 2em;
      cursor: pointer;
      pointer-events: auto;
      opacity: 0.75;
      transition: opacity 0.2s;
    }
    .zenzaSupporterCredit .scSkip:hover { opacity: 1; }
  `;

  /**
   * 提供画面の本体。NicoVideoPlayer が、動画が最後まで再生された時（ended）に start() する。
   * 時間は提供音声の再生位置で進む（音声が使えない時は時計で進める）。
   */
  class CreditView {
    constructor({parentNode}) {
      this.parentNode = parentNode;
      this.view = null;
      this.data = null;
      this.state = 'idle'; // idle / playing / paused
      this._raf = 0;
      this._clockBase = 0;
      this._clockStart = 0;
      this._draw = this._draw.bind(this);
      this.onEnd = null;
      this.onSkip = null;
    }

    _initializeDom() {
      if (this.view) { return; }
      if (!document.getElementById('zenzaSupporterCreditStyle')) {
        const style = document.createElement('style');
        style.id = 'zenzaSupporterCreditStyle';
        style.textContent = CSS;
        (document.head || document.documentElement).append(style);
      }
      const view = this.view = document.createElement('div');
      view.className = 'zenzaSupporterCredit';
      view.innerHTML = `
        <div class="scBox">
          <canvas class="scCanvas" width="${CANVAS_W}" height="${CANVAS_H}"></canvas>
          <div class="scBanners"></div>
          <div class="scHeader"></div>
          <button type="button" class="scSkip" title="提供画面を飛ばす">スキップ ▶▶</button>
        </div>`;
      this.canvas = view.querySelector('canvas');
      this.ctx = this.canvas.getContext('2d');
      // プレイヤー側のクリック（再生/一時停止・ドラッグ）へ伝えない
      ['click', 'mousedown', 'pointerdown', 'dblclick', 'contextmenu'].forEach(name => {
        view.querySelector('.scSkip').addEventListener(name, e => e.stopPropagation());
        view.querySelector('.scHeader').addEventListener(name, e => e.stopPropagation());
        view.querySelector('.scBanners').addEventListener(name, e => {
          e.target.closest('a') && e.stopPropagation();
        });
      });
      view.querySelector('.scSkip').addEventListener('click', e => {
        e.preventDefault();
        this.onSkip && this.onSkip();
      });
      this.parentNode.append(view);
    }

    /** 表示の準備（読み込みが済んだ情報を渡す） */
    async prepare(data, {gift = true} = {}) {
      this.dispose();
      this.data = data;
      this._initializeDom();
      const s = data.supporters;
      const bg = s.adTopSupporter;
      this.bgColor = (bg && bg.auxiliary && bg.auxiliary.bgColor) || DEFAULT_BG;
      this.useVideoBackground = !!(bg && bg.auxiliary && typeof bg.auxiliary.bgVideoPosition === 'number');
      this.page = new SupportersPage(s);
      const header = this.view.querySelector('.scHeader');
      header.textContent = '';
      if (data.logoImageUrl) {
        const img = document.createElement('img');
        img.src = data.logoImageUrl;
        img.alt = '';
        header.append(img);
      }
      if (data.infoText) {
        const a = document.createElement('a');
        a.textContent = data.infoText;
        a.href = data.infoUrl || 'https://koken.nicovideo.jp';
        a.target = '_blank';
        a.rel = 'noopener';
        header.append(a);
      }
      header.style.display = header.childNodes.length ? '' : 'none';
      const banners = this.view.querySelector('.scBanners');
      banners.textContent = '';
      const hasBanner = !!data.banner && !this.useVideoBackground;
      if (hasBanner) {
        ['left', 'right'].forEach(side => {
          const b = data.banner[side];
          const a = document.createElement('a');
          a.href = b.linkUrl || '#';
          a.target = '_blank';
          a.rel = 'noopener';
          const img = document.createElement('img');
          img.src = b.imageUrl;
          img.alt = side === 'left' ? '左側のバナー' : '右側のバナー';
          a.append(img);
          banners.append(a);
        });
      }
      this.audio = null;
      if (data.voiceUrl) {
        const audio = this.audio = new Audio();
        audio.preload = 'auto';
        audio.src = data.voiceUrl;
      }
      this.giftLayer = null;
      if (gift && data.gifts.length) {
        const gifts = await loadGiftAssets(data.gifts);
        if (this.data === data && gifts.length) {
          this.giftLayer = new GiftLayer(gifts, {paddingInline: hasBanner ? 0.45 : 0});
        }
      }
    }

    get isReady() { return !!(this.data && this.page); }
    get isActive() { return this.state !== 'idle'; }
    get isPlaying() { return this.state === 'playing'; }

    get duration() {
      const d = this.audio && this.audio.duration;
      return Math.min(MAX_DURATION, (d && isFinite(d) && d > 0) ? d : DEFAULT_DURATION);
    }

    get currentTime() {
      if (this._audioOk && this.audio) { return this.audio.currentTime; }
      if (this.state === 'playing') {
        return this._clockBase + (performance.now() - this._clockStart) / 1000;
      }
      return this._clockBase;
    }

    /** 動画の最後の場面（背景に使う場合）を覚えておく */
    _captureBackground(videoElement) {
      this.bgCanvas = null;
      if (!this.useVideoBackground || !videoElement || !videoElement.videoWidth) { return; }
      try {
        const c = document.createElement('canvas');
        c.width = CANVAS_W;
        c.height = CANVAS_H;
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
        const vw = videoElement.videoWidth, vh = videoElement.videoHeight;
        const scale = Math.min(CANVAS_W / vw, CANVAS_H / vh);
        ctx.drawImage(videoElement, (CANVAS_W - vw * scale) / 2, (CANVAS_H - vh * scale) / 2, vw * scale, vh * scale);
        this.bgCanvas = c;
      } catch (e) {
        this.bgCanvas = null;
      }
    }

    start({volume = 1, muted = false, voice = true, videoElement = null} = {}) {
      if (!this.isReady) { return false; }
      this._captureBackground(videoElement);
      this.view.classList.add('is-show');
      void this.view.offsetWidth;
      this.view.classList.add('is-visible');
      this._clockBase = 0;
      this._audioOk = false;
      this.state = 'playing';
      this._clockStart = performance.now();
      if (this.audio) {
        this.audio.currentTime = 0;
        this.setVolume(volume, muted || !voice);
        this.audio.onended = () => this._finish();
        this.audio.play().then(() => {
          if (this.state === 'idle') { this.audio.pause(); return; }
          this._audioOk = true;
          this.state === 'paused' && this.audio.pause();
        }).catch(e => {
          window.console.warn('提供音声を再生できませんでした（時計で進めます）', e && e.name);
          this._audioOk = false;
        });
      }
      this._schedule();
      return true;
    }

    setVolume(volume, muted) {
      if (!this.audio) { return; }
      this.audio.volume = Math.max(0, Math.min(1, volume));
      this.audio.muted = !!muted;
    }

    pause() {
      if (this.state !== 'playing') { return; }
      this._clockBase = this.currentTime;
      this.state = 'paused';
      this.audio && this._audioOk && this.audio.pause();
    }

    resume() {
      if (this.state !== 'paused') { return; }
      this.state = 'playing';
      this._clockStart = performance.now();
      if (this.audio && this._audioOk) {
        this.audio.play().catch(() => { this._audioOk = false; });
      }
      this._schedule();
    }

    /** 表示をやめる（onEnd は呼ばない） */
    stop() {
      if (this.state === 'idle') { return; }
      this.state = 'idle';
      this._raf && cancelAnimationFrame(this._raf);
      this._raf = 0;
      if (this.audio) {
        this.audio.onended = null;
        this.audio.pause();
      }
      if (this.view) {
        this.view.classList.remove('is-visible');
        setTimeout(() => {
          this.state === 'idle' && this.view && this.view.classList.remove('is-show');
        }, 400);
      }
    }

    _finish() {
      if (this.state === 'idle') { return; }
      this.stop();
      this.onEnd && this.onEnd();
    }

    _schedule() {
      if (!this._raf) { this._raf = requestAnimationFrame(this._draw); }
    }

    _draw() {
      this._raf = 0;
      if (this.state === 'idle') { return; }
      const t = this.currentTime;
      const ctx = this.ctx;
      if (this.bgCanvas) {
        ctx.drawImage(this.bgCanvas, 0, 0);
      } else {
        ctx.fillStyle = this.bgColor;
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      }
      this.giftLayer && this.giftLayer.render(ctx, t);
      this.page && this.page.render(ctx, t);
      if (t >= this.duration + 0.05) {
        this._finish();
        return;
      }
      this.state === 'playing' && this._schedule();
    }

    dispose() {
      this.stop();
      if (this.audio) {
        this.audio.removeAttribute('src');
        this.audio = null;
      }
      this.data = null;
      this.page = null;
      this.giftLayer = null;
      this.bgCanvas = null;
    }
  }

  return {load, loadGiftAssets, CreditView, GiftLayer, GiftGrid, CANVAS_W, CANVAS_H};
})();

//===END===

export {SupporterCredit};
