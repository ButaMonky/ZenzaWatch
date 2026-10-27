// Task643: compile-only contracts for VideoSearch.
import {NicoSearchApiV2Query, NicoSearchApiV2Loader, parseVideoSearchSortValue} from '../nico-src/VideoSearch';
import type {NvapiSearchResult, SnapshotSearchResult, OwnerSearchResult, SortValue, VideoSearchParams} from '../nico-src/VideoSearch';

const query = new NicoSearchApiV2Query('word', {sort: 'v', order: 'd', page: 2, f_range: '1'});
const qs: string = query.toString();
void qs;
void new NicoSearchApiV2Query({searchWord: 'word', searchType: 'tag'});

const params: VideoSearchParams = {sort: 'f', order: 'a', l_range: 1, genre: 'game', selectContentType: 'long'};
const result: Promise<NvapiSearchResult | SnapshotSearchResult | OwnerSearchResult> =
  NicoSearchApiV2Loader.searchMore('word', params, 300);
void result;
void NicoSearchApiV2Loader.search('word', params);
const owners: Promise<Map<string, {userId: unknown; channelId: unknown}>> = NicoSearchApiV2Loader.lookupOwnerIds(['sm9']);
void owners;
const nvQuery = NicoSearchApiV2Loader.nvapi.buildQuery('word', params);
void nvQuery;
// @ts-expect-error the nvapi helper takes a string word
void NicoSearchApiV2Loader.nvapi.search({searchWord: 'word'});

const sort: SortValue = parseVideoSearchSortValue('l,a');
void sort;
// @ts-expect-error the stored sort value is a string
void parseVideoSearchSortValue(3);

void (async () => {
  const r = await NicoSearchApiV2Loader.search('word');
  // Narrow on the engine tag: only nvapi results carry resultState.
  if ('engine' in r && r.engine === 'nvapi') {
    const state: 'complete' | 'empty' | 'truncated' | 'partial' = r.resultState;
    void state;
  }
  // @ts-expect-error snapshot results have no resultState
  void (r as SnapshotSearchResult).resultState;
})();
