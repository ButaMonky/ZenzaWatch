// Task800: compile-only contracts for Emitter / Handler / PromiseHandler.
import {Emitter, EmitterInitFunc, Handler, PromiseHandler} from '../nico-src/Emitter';
import type {EmitterInstance, PromiseHandlerInstance} from '../nico-src/Emitter';

const e = new Emitter();
const chained: EmitterInstance = e.on('update', (value: number) => value * 2);
void chained;
e.once('ready', () => {});
e.emit('update', 1, 'extra');
// @ts-expect-error event names are strings
e.on(1, () => {});
// @ts-expect-error a listener function is required
e.on('update');
const ready: Promise<unknown> = e.promise('ready');
void ready;
e.emitResolve('ready', true);
const has: boolean | undefined = e.hasPromise('ready');
void has;

const h = new Handler((x: number) => x);
const n: number = h.length;
void n;
const p = new PromiseHandler((resolve) => resolve(1));
const same: PromiseHandlerInstance = p.resolve(2);
void same;
const fresh = EmitterInitFunc();
const e2 = new fresh.Emitter();
void e2;
