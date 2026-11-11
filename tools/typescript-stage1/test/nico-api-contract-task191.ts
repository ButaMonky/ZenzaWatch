// Compile the actual production constructor contract, not a duplicated interface.
import type {NativeSeekPointerParams} from '../nico-src/VideoControlBar';
declare const element: HTMLElement;
declare const svg: SVGElement;
declare const node: Node;
declare const valid: NativeSeekPointerParams;
const accepted: NativeSeekPointerParams = {
  pointer: element, getTimelineGeometry: () => null, playerState: valid.playerState
};
// @ts-expect-error selectors are not native DOM markers
const selector: NativeSeekPointerParams = {...accepted, pointer: '.seekBarPointer'};
// @ts-expect-error null cannot own marker style/classList
const missing: NativeSeekPointerParams = {...accepted, pointer: null};
// @ts-expect-error SVG markers do not satisfy the HTML owner contract
const foreign: NativeSeekPointerParams = {...accepted, pointer: svg};
// @ts-expect-error generic nodes may be text or comments
const text: NativeSeekPointerParams = {...accepted, pointer: node};
// @ts-expect-error a function returning an arbitrary object is not geometry
const invalidGeometry: NativeSeekPointerParams = {...accepted, getTimelineGeometry: () => ({width: 1})};
// @ts-expect-error a missing geometry provider is not valid construction
const incomplete: NativeSeekPointerParams = {pointer: element, playerState: valid.playerState};
