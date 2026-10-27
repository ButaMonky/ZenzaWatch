// Task646: compile-only contracts for ThumbInfoCacheDb / WatchInfoCacheDb.
import {ThumbInfoCacheDb} from '../nico-src/ThumbInfoCacheDb';
import {WatchInfoCacheDb} from '../nico-src/WatchInfoCacheDb';
import type {WatchInfoRecord} from '../nico-src/WatchInfoCacheDb';

void (async () => {
  const cache = await ThumbInfoCacheDb.open();
  const stored: {watchId: string; updatedAt: number} | undefined = await cache.put('<xml/>');
  void stored;
  // Cached rows are not validated by the cache layer.
  const row: unknown = await cache.get('sm9');
  void row;
  // @ts-expect-error the raw XML is a string
  void cache.put(42);

  const record: WatchInfoRecord = await WatchInfoCacheDb.put('sm9', {currentTime: 10, watchCount: 1});
  const id: string = record.watchId;
  void id;
  void WatchInfoCacheDb.putBestEffort('sm9', {comment: {text: 'x'}});
  // @ts-expect-error currentTime is seconds as a number
  void WatchInfoCacheDb.put('sm9', {currentTime: '10'});
  // @ts-expect-error the bridge must provide bridgeDb
  WatchInfoCacheDb.api({});
})();

import {NicoQuery, ItemDataConverter} from '../nico-src/NicoQuery';
import type {NicoQuerySearchParams} from '../nico-src/NicoQuery';
import {StoryboardInfoLoader} from '../nico-src/StoryboardInfoLoader';

const q = new NicoQuery('tag/word?sort=%22-f%22');
const sp: NicoQuerySearchParams = q.searchParams;
const order: 'a' | 'd' = sp.order;
void order;
const title: string = q.title;
void title;
void NicoQuery.fetch(q);
// @ts-expect-error queries are strings or NicoQuery instances
void NicoQuery.fetch(42);
void ItemDataConverter.makeSortText('第1話');
void StoryboardInfoLoader.load('dmc', {hasDomandStoryboard: true});
