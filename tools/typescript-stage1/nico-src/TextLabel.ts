/**
 * Canonical TypeScript source for packages/lib/src/ui/TextLabel.js (Task788).
 * Canvas text labels (time, rate) drawn in a Worker through OffscreenCanvas when
 * available, otherwise in-page. `func` is stringified into the Worker, so it stays
 * self-contained.
 */
export interface LabelStyle {
  widthPx?: number;
  heightPx?: number;
  ratio?: number;
  fontFamily?: string;
  fontWeight?: string;
  fontSizePx?: number;
  color?: string;
  backgroundColor?: string;
  textAlign?: CanvasTextAlign | string;
  [key: string]: unknown;
}
interface LabelItem {canvas: OffscreenCanvas | HTMLCanvasElement; style: LabelStyle; ctx: CanvasRenderingContext2D; text: string}
type LabelMessage = {command: string; params: Record<string, unknown>};
interface LabelWorker {
  name: string;
  onmessage: (message: LabelMessage) => unknown;
  post(message: LabelMessage, options?: unknown): Promise<Record<string, unknown>>;
}

/** The part of workerUtil (packages/lib/src/infra/workerUtil.js) used here. */
declare const workerUtil: {createCrossMessageWorker(func: (self: LabelWorker) => void, options: {name: string}): LabelWorker};

const TextLabel = (() => {
  const func = function(self: LabelWorker) {
    const items: Record<string, LabelItem> = {};

    const getId = function(this: {id: number}) {return `id-${this.id++}${Math.random()}`;}.bind({id: 0});

    const create = async ({canvas, style}: {canvas: LabelItem['canvas']; style: LabelStyle}) => {
      const id = getId();
      const ctx = canvas.getContext('2d', {
        desynchronized: true,
        // preserveDrawingBuffer: true
      }) as CanvasRenderingContext2D;
      items[id] = {
        canvas, style, ctx, text: ''
      };
      return setStyle({id, style});
    };

    const setStyle = ({id, style, name}: {id: string; style: LabelStyle; name?: string}) => {
      const item = items[id];
      if (!item) { throw new (Error as unknown as new (...args: unknown[]) => Error)('unknown id', id); }
      name = name || 'label';
      const {canvas, ctx} = item;
      item.text = '';
      style.widthPx && (canvas.width = style.widthPx * (style.ratio as number));
      style.heightPx && (canvas.height = style.heightPx * (style.ratio as number));

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      return {id, text: ''};
    };

    const drawText = ({id, text}: {id: string; text: string}) => {
      const item = items[id];
      if (!item) { throw new (Error as unknown as new (...args: unknown[]) => Error)('unknown id', id); }
      const {canvas, ctx, style} = item;
      if (item.text === text) {
        return;
      }
      ctx.beginPath();
      ctx.font = `${style.fontWeight || ''} ${style.fontSizePx ? `${style.fontSizePx * (style.ratio as number)}px` : ''} ${style.fontFamily || ''}`.trim();
      const measured = ctx.measureText(text);
      let {width, height} = measured as TextMetrics & {height?: number};
      height = (height || (style.fontSizePx as number)) * (style.ratio as number);
      const left = (canvas.width - width) / 2;
      const top = canvas.height - (canvas.height - height) / 2;
      ctx.fillStyle = style.color as string;
      // Task 077c: textAlign を指定していないラベルで undefined を代入し、描くたびに
      // 「not a valid enum value of type CanvasTextAlign」の警告が大量に出ていた（D-23）。
      // 位置は left を自分で計算しているので、未指定の時は代入しない。
      if (style.textAlign) { ctx.textAlign = style.textAlign as CanvasTextAlign; }
      ctx.textBaseline = 'bottom';
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillText(text, left, top);
      // ctx.commit && ctx.commit();
      return {id, text};
    };

    const dispose = ({id}: {id: string}) => {
      delete items[id];
    };

    self.onmessage = async ({command, params}: LabelMessage) => {
      switch (command) {
        case 'create':
          return create(params as unknown as Parameters<typeof create>[0]);
        case 'style':
          return setStyle(params as unknown as Parameters<typeof setStyle>[0]);
        case 'drawText':
          return drawText(params as unknown as Parameters<typeof drawText>[0]);
        case 'dispose':
          return dispose(params as unknown as Parameters<typeof dispose>[0]);
      }
    };
  };

  const isOffscreenCanvasAvailable = !!HTMLCanvasElement.prototype.transferControlToOffscreen;
  const getContainerStyle = ({container, canvas, ratio}: {container: HTMLElement; canvas: HTMLCanvasElement; ratio?: number}) => {
    let style = window.getComputedStyle(container || document.body);
    ratio = ratio || window.devicePixelRatio;
    const width = (container.offsetWidth || canvas.width) * ratio;
    const height = (container.offsetHeight || canvas.height) * ratio;
    if (!width || !height) {
      style = window.getComputedStyle(document.body);
    }
    return {
      width,
      height,
      font: style.font,
      fontFamily: style.fontFamily,
      fontWeight: style.fontWeight,
      fontSizePx: (style.fontSize.replace(/[a-z]/g, '') as unknown as number) * 1,
      color: style.color,
      backgroundColor: style.backgroundColor,
      textAlign: style.textAlign,
      ratio
    };
  };

  const NAME = 'TextLabelWorker';

  let worker: LabelWorker;
  const initWorker = async () => {
    if (worker) { return worker; }
    if (!isOffscreenCanvasAvailable) {
      if (!worker) {
        worker = {
          name: NAME,
          onmessage: () => {},
          post: ({command, params}: LabelMessage) => worker.onmessage({command, params}) as Promise<Record<string, unknown>>
        };
        func(worker);
      }
    } else {
      worker = worker || workerUtil.createCrossMessageWorker(func, {name: NAME});
    }
    return worker;
  };
  const create = ({container, canvas, ratio, name, style, text}: {
    container: HTMLElement; canvas?: HTMLCanvasElement; ratio?: number; name?: string; style?: LabelStyle; text?: string}) => {
    style = style || {};
    // 大した負荷じゃないしRetina前提にしてしまう
    ratio = Math.max(ratio || window.devicePixelRatio || 2, 2);
    style.ratio = style.ratio || ratio;
    name = name || 'label';
    if (!canvas) {
      canvas = document.createElement('canvas');
      Object.assign(canvas.style, {
        // Task790 (TEXTLABEL-SIZE-001): a template string is always truthy, so the old
        // `|| '100%'` never applied and an unset size became "undefinedpx".
        width: style.widthPx ? `${style.widthPx}px` : '100%',
        height: style.heightPx ? `${style.heightPx}px` : '100%',
        backgroundColor: style.backgroundColor || ''
      });
      container && container.append(canvas);
      style.widthPx &&  (canvas.width = Math.max(style.widthPx * ratio));
      style.heightPx && (canvas.height = Math.max(style.heightPx * ratio));
    }
    canvas.dataset.name = name;

    const containerStyle = getContainerStyle({container, canvas, ratio});
    style.fontFamily = style.fontFamily || containerStyle.fontFamily;
    style.fontWeight = style.fontWeight || containerStyle.fontWeight;
    style.color      = style.color      || containerStyle.color;


    const promiseSetup = (async () => {
      const layer = isOffscreenCanvasAvailable ? (canvas as HTMLCanvasElement).transferControlToOffscreen() : canvas as HTMLCanvasElement;
      const worker = await initWorker();
      const result = await worker.post(
        {command: 'create', params: {canvas: layer, style, name}},
        {transfer: [layer]}
      );
      return result.id;
    })();
    const init = {text};
    const post = async ({command, params}: {command: string; params?: Record<string, unknown>}, transfer = {}) => {
      const id = await promiseSetup;
      params = params || {};
      params.id = id;
      return worker.post({command, params}, transfer);
    };

    const result = {
      container,
      canvas,
      style() {
        init.text = '';
        const style = getContainerStyle({container, canvas: canvas as HTMLCanvasElement});
        return post({command: 'style', params: {style, name}});
      },
      async drawText(text: string) {
        if (init.text === text) {
          return;
        }
        const result = await post({command: 'drawText', params: {text}});
        init.text = result.text as string;
      },
      get text(): string | undefined { return init.text; },
      set text(t: string | undefined) { this.drawText(t as string); },
      // Task790 (TEXTLABEL-DISPOSE-001): go through `post` so the label id is sent; the
      // worker side destructures params.id and the bare message made it throw.
      dispose: () => post({command: 'dispose'})
    };
    text && (result.text = text);
    return result;
  };
  return {create};
})();

export {TextLabel};
