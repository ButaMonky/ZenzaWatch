// Task469: compile-time thumbnail-gate response contract.
import {ThumbInfoLoader} from '../nico-src/ThumbInfoLoader';
import type {ThumbInfoSuccess} from '../nico-src/ThumbInfoLoader';

const result: Promise<ThumbInfoSuccess> = ThumbInfoLoader.load('sm9');
void result;
const gate: unknown = ThumbInfoLoader.initGate();
void gate;
// @ts-expect-error video ID is a string, not a numeric identifier
void ThumbInfoLoader.load(123);
// @ts-expect-error success payload fields are unknown until parsed
const title: Promise<{title: string}> = ThumbInfoLoader.load('sm1');
void title;
const expected: ThumbInfoSuccess = {status: 'ok', xml: '<thumb/>'};
const unverified: unknown = expected.xml;
void unverified;
