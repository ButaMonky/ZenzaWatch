// Task642: compile-only contracts for StoryboardCacheDb.
import {StoryboardCacheDb} from '../nico-src/StoryboardCacheDb';
import type {StoryboardCacheRecord, StoryboardDbBridge} from '../nico-src/StoryboardCacheDb';

const stored: Promise<StoryboardCacheRecord | undefined> = StoryboardCacheDb.put('sm9', {status: 'ok'});
void stored;
// Cached payloads are opaque until a caller validates them.
const cached: Promise<unknown> = StoryboardCacheDb.get('sm9');
void cached;
void StoryboardCacheDb.gc();
void StoryboardCacheDb.delete('sm9');
// @ts-expect-error cache keys are strings
void StoryboardCacheDb.get(9);
// @ts-expect-error expireTime is a number of milliseconds
void StoryboardCacheDb.gc('7d');

const bridge: StoryboardDbBridge = {bridgeDb: async () => ({})};
StoryboardCacheDb.api(bridge);
// @ts-expect-error the bridge must provide bridgeDb
StoryboardCacheDb.api({});
