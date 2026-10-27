// Task479: compile-only contracts for CommonsTreeLoader.
import {CommonsTreeLoader} from '../nico-src/CommonsTreeLoader';
import type {CommonsWork, ScanAllResult} from '../nico-src/CommonsTreeLoader';

async function ids(): Promise<string[]> {
  const result: ScanAllResult = await CommonsTreeLoader.scanAll('sm9', {pageSize: 300});
  return result.parents.works.concat(result.children.works).map((w: CommonsWork) => w.contentId);
}
void ids;
void CommonsTreeLoader.loadRelatives('sm9', 'children', 300, {startOffset: 300});
void CommonsTreeLoader.load('sm9', undefined, {offsets: {parents: null, children: 100}});
// @ts-expect-error only parents/children exist in the commons tree API
void CommonsTreeLoader.loadRelatives('sm9', 'siblings');
// @ts-expect-error offsets are numbers or null
void CommonsTreeLoader.load('sm9', 300, {offsets: {parents: '0'}});
const wait: number | null = CommonsTreeLoader.retryAfterMs('5');
void wait;
async function hint(work: CommonsWork): Promise<string> {
  // meta is optional; title is a validated string when present
  return work.meta?.title ?? work.contentId;
}
void hint;
