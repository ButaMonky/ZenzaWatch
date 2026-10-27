// Task726: compile-only contracts for the infra helpers moved to TypeScript.
import {sleep} from '../nico-src/sleep';
import {env} from '../nico-src/env';
import {dimport} from '../nico-src/dimport';
import {speech} from '../nico-src/speech';
import {StorageWriter} from '../nico-src/StorageWriter';
import {CacheStorage} from '../nico-src/CacheStorage';
import {MediaSessionApi} from '../nico-src/MediaSessionApi';
import {bounce, throttle} from '../nico-src/bounce';
import {AntiPrototypeJs} from '../nico-src/AntiPrototypeJs';

const waited: Promise<void> = sleep(100);
void waited;
// @ts-expect-error the delay is a number of milliseconds
void sleep('1s');
// Task787 (SLEEP-IDLE-001): sleep.idle() waits; it no longer returns a function.
const idleWait: Promise<unknown> = sleep.idle();
void idleWait;

const isChrome: boolean = env.isChrome();
void isChrome;

// Loaded modules are opaque until the caller checks them.
const loaded: Promise<unknown> = dimport('https://example.invalid/m.js');
void loaded;
// @ts-expect-error the module URL is a string
void dimport(1);

void speech.speak('こんにちは', {lang: 'ja-JP', rate: 1.2});
// @ts-expect-error rate is a number
void speech.speak('x', {rate: 'fast'});
const voices: SpeechSynthesisVoice[] = speech.voices('ja-JP');
void voices;

const json: Promise<string> = StorageWriter.toJson({a: 1});
void json;
const slot: symbol = StorageWriter.writer;
void slot;

const cache = new CacheStorage(localStorage);
cache.setItem('k', {v: 1}, 1000);
const cached: unknown = cache.getItem('k');
void cached;
// @ts-expect-error keys are strings
cache.getItem(1);
// @ts-expect-error a Storage object is required
void new CacheStorage({});

MediaSessionApi.updateByVideoInfo({title: 't', owner: {name: 'o'}, thumbnail: 'u', duration: 10});
// @ts-expect-error owner.name is required
MediaSessionApi.updateByVideoInfo({title: 't', owner: {}, thumbnail: 'u', duration: 10});
MediaSessionApi.updatePositionState({duration: 10, playbackRate: 1, currentTime: 2});

const debounced = bounce.idle((a: number) => a * 2);
void debounced(1);
// @ts-expect-error the wrapped function takes a number
void debounced('1');
const throttled = throttle((a: string) => a, 100);
throttled.cancel();
const rafThrottled = throttle.raf(() => undefined);
rafThrottled.cancel();

const pure: Promise<unknown> = AntiPrototypeJs();
void pure;
