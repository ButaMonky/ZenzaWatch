import {workerUtil} from '../infra/workerUtil';
// GENERATED FROM tools/typescript-stage1/nico-src/TextLabel.ts (Task788). Edit the .ts and run npm run nico:sync.
//===BEGIN===
const TextLabel = (() => {
    const func = function (self) {
        const items = {};
        const getId = function () { return `id-${this.id++}${Math.random()}`; }.bind({ id: 0 });
        const create = async ({ canvas, style }) => {
            const id = getId();
            const ctx = canvas.getContext('2d', {
                desynchronized: true,
                // preserveDrawingBuffer: true
            });
            items[id] = {
                canvas, style, ctx, text: ''
            };
            return setStyle({ id, style });
        };
        const setStyle = ({ id, style, name }) => {
            const item = items[id];
            if (!item) {
                throw new Error('unknown id', id);
            }
            name = name || 'label';
            const { canvas, ctx } = item;
            item.text = '';
            style.widthPx && (canvas.width = style.widthPx * style.ratio);
            style.heightPx && (canvas.height = style.heightPx * style.ratio);
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            return { id, text: '' };
        };
        const drawText = ({ id, text }) => {
            const item = items[id];
            if (!item) {
                throw new Error('unknown id', id);
            }
            const { canvas, ctx, style } = item;
            if (item.text === text) {
                return;
            }
            ctx.beginPath();
            ctx.font = `${style.fontWeight || ''} ${style.fontSizePx ? `${style.fontSizePx * style.ratio}px` : ''} ${style.fontFamily || ''}`.trim();
            const measured = ctx.measureText(text);
            let { width, height } = measured;
            height = (height || style.fontSizePx) * style.ratio;
            const left = (canvas.width - width) / 2;
            const top = canvas.height - (canvas.height - height) / 2;
            ctx.fillStyle = style.color;
            // Task 077c: textAlign を指定していないラベルで undefined を代入し、描くたびに
            // 「not a valid enum value of type CanvasTextAlign」の警告が大量に出ていた（D-23）。
            // 位置は left を自分で計算しているので、未指定の時は代入しない。
            if (style.textAlign) {
                ctx.textAlign = style.textAlign;
            }
            ctx.textBaseline = 'bottom';
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.fillText(text, left, top);
            // ctx.commit && ctx.commit();
            return { id, text };
        };
        const dispose = ({ id }) => {
            delete items[id];
        };
        self.onmessage = async ({ command, params }) => {
            switch (command) {
                case 'create':
                    return create(params);
                case 'style':
                    return setStyle(params);
                case 'drawText':
                    return drawText(params);
                case 'dispose':
                    return dispose(params);
            }
        };
    };
    const isOffscreenCanvasAvailable = !!HTMLCanvasElement.prototype.transferControlToOffscreen;
    const getContainerStyle = ({ container, canvas, ratio }) => {
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
            fontSizePx: style.fontSize.replace(/[a-z]/g, '') * 1,
            color: style.color,
            backgroundColor: style.backgroundColor,
            textAlign: style.textAlign,
            ratio
        };
    };
    const NAME = 'TextLabelWorker';
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
            worker = worker || workerUtil.createCrossMessageWorker(func, { name: NAME });
        }
        return worker;
    };
    const create = ({ container, canvas, ratio, name, style, text }) => {
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
            style.widthPx && (canvas.width = Math.max(style.widthPx * ratio));
            style.heightPx && (canvas.height = Math.max(style.heightPx * ratio));
        }
        canvas.dataset.name = name;
        const containerStyle = getContainerStyle({ container, canvas, ratio });
        style.fontFamily = style.fontFamily || containerStyle.fontFamily;
        style.fontWeight = style.fontWeight || containerStyle.fontWeight;
        style.color = style.color || containerStyle.color;
        const promiseSetup = (async () => {
            const layer = isOffscreenCanvasAvailable ? canvas.transferControlToOffscreen() : canvas;
            const worker = await initWorker();
            const result = await worker.post({ command: 'create', params: { canvas: layer, style, name } }, { transfer: [layer] });
            return result.id;
        })();
        const init = { text };
        const post = async ({ command, params }, transfer = {}) => {
            const id = await promiseSetup;
            params = params || {};
            params.id = id;
            return worker.post({ command, params }, transfer);
        };
        const result = {
            container,
            canvas,
            style() {
                init.text = '';
                const style = getContainerStyle({ container, canvas: canvas });
                return post({ command: 'style', params: { style, name } });
            },
            async drawText(text) {
                if (init.text === text) {
                    return;
                }
                const result = await post({ command: 'drawText', params: { text } });
                init.text = result.text;
            },
            get text() { return init.text; },
            set text(t) { this.drawText(t); },
            // Task790 (TEXTLABEL-DISPOSE-001): go through `post` so the label id is sent; the
            // worker side destructures params.id and the bare message made it throw.
            dispose: () => post({ command: 'dispose' })
        };
        text && (result.text = text);
        return result;
    };
    return { create };
})();
//===END===
export {TextLabel};
