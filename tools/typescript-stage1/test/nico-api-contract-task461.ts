// Task461: compile-only contracts for RecommendAPILoader / NVWatchCaller / MatrixRankingLoader.
import {RecommendAPILoader} from '../nico-src/RecommendAPILoader';
import type {RecommendRecipe} from '../nico-src/RecommendAPILoader';
import {NVWatchCaller} from '../nico-src/NVWatchCaller';
import {MatrixRankingLoader} from '../nico-src/MatrixRankingLoader';

// Recommend data is unvalidated: callers must narrow before reading items.
async function related(): Promise<number> {
  const data: unknown = await RecommendAPILoader.load({videoId: 'sm9'});
  // @ts-expect-error unknown recommend data cannot be dereferenced directly
  void data.items;
  return Array.isArray(data) ? data.length : 0;
}
void related;
void RecommendAPILoader.loadSeries(123, {title: 'x'});
// @ts-expect-error a recipe requires its id
const badRecipe: RecommendRecipe = {videoId: 'sm9'};
void badRecipe;
// @ts-expect-error series options only accept a string title
void RecommendAPILoader.loadSeries('1', {title: 1});

// Tracking ping may resolve undefined (failures are swallowed by design).
const ping: Promise<Response | undefined> = NVWatchCaller.call('tracking');
void ping;
// @ts-expect-error trackingId is a string
void NVWatchCaller.call(1);

const ranking: Promise<unknown> = MatrixRankingLoader.load();
void ranking;
