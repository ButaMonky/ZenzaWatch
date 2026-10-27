import {RequestAnimationFrame} from '../src/RequestAnimationFrame';

const raf = new RequestAnimationFrame(() => {}, 2);
new RequestAnimationFrame(() => {});
raf.enable();
raf.disable();
raf.execOnce();
void raf.callRaf();
void raf.callRaf(3);
// @ts-expect-error callbacks must be functions.
new RequestAnimationFrame('not-a-function');
// @ts-expect-error frame skips must be numeric when present.
new RequestAnimationFrame(() => {}, 'skip');
// @ts-expect-error timing internals are implementation-owned.
raf._generation = 1;
// @ts-expect-error cannot directly run a private frame callback.
raf._onFrame(1);
