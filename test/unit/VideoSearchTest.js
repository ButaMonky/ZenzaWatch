import assert from 'power-assert';
import {NicoSearchApiV2Query} from '../../packages/lib/src/nico/VideoSearch';
const {F_RANGE, L_RANGE} = NicoSearchApiV2Query;

// test/pending/VideoSearchTest.js から復帰（Task 019）。
// もともとのファイルは StoryboardTest.js と同じ構造的な問題を抱えていた
// （アサーションが `it()` の外、`describe()` の本体に直接書かれていて、
// テストとして実行されていなかった）。ロジック自体は現行の
// packages/lib/src/nico/VideoSearch.js の実装と一致することを確認済みで、
// StoryboardTest.jsのようなexport不能問題はなかったため、
// アサーションを `it()` に移すだけで復帰できた。

describe('Video Search API v2', () => {
  const baseParams = {
    searchWord: 'hogehoge',
    searchType: 'tag',
    order: 'd',
  };

  const NOW = Date.now();
  const create = (params) => new NicoSearchApiV2Query(Object.assign(params, {'_now': NOW}));

  describe('基本パース', () => {
    it('tag検索・order=dの基本形', () => {
      const params = Object.assign({}, baseParams);
      const query = new NicoSearchApiV2Query(params);
      assert.equal(query.q, 'hogehoge');
      assert.equal(query.targets.length, 1);
      assert.equal(query.targets[0], 'tagsExact');
      assert.equal(query.sort, '-lastCommentTime');
    });

    it('sort=_hot指定を受け付ける（エラーにならない）', () => {
      const params = {
        searchWord: 'fugafuga',
        searchType: 'tag',
        sort: '_hot',
      };
      assert.doesNotThrow(() => new NicoSearchApiV2Query(params));
    });
  });

  describe('user指定対応', () => {
    it('userIdがequalフィルタになる', () => {
      const params = Object.assign({}, baseParams, {userId: 1234});
      const query = create(params);
      const filters = query.filters;
      assert.equal(filters[0].field, 'userId');
      assert.equal(filters[0].type, 'equal');
      assert.equal(typeof filters[0].value, 'number');
      assert.equal(filters[0].value, 1234);
    });
  });

  describe('channel指定対応', () => {
    it('channelIdがequalフィルタになる', () => {
      const params = Object.assign({}, baseParams, {channelId: '2525'});
      const query = create(params);
      const filters = query.filters;
      assert.equal(filters[0].field, 'channelId');
      assert.equal(filters[0].type, 'equal');
      assert.equal(typeof filters[0].value, 'number');
      assert.equal(filters[0].value, 2525);
    });
  });

  describe('コメント数指定対応', () => {
    it('commentCountがrangeフィルタ（from指定）になる', () => {
      const params = Object.assign({}, baseParams, {commentCount: 12345});
      const query = create(params);
      const filters = query.filters;
      assert.equal(filters[0].field, 'commentCounter');
      assert.equal(filters[0].type, 'range');
      assert.equal(filters[0].from, 12345);
    });
  });

  describe('投稿日時指定対応(utime)', () => {
    it('utimeFrom/utimeToがstartTimeのrangeフィルタになる', () => {
      const params = Object.assign({}, baseParams);
      const from = new Date('2007-03-06').getTime();
      const to = new Date('2017-03-06').getTime();
      const query = create(Object.assign(params, {utimeFrom: from, utimeTo: to}));
      const filters = query.filters;
      assert.equal(filters[0].field, 'startTime');
      assert.equal(filters[0].type, 'range');
      assert.equal(filters[0].from, from);
      assert.equal(filters[0].to, to);
    });

    it('from > toの時は入れ替わる', () => {
      const params = Object.assign({}, baseParams);
      const from = new Date('2007-03-06').getTime();
      const to = new Date('2017-03-06').getTime();
      const query = create(Object.assign(params, {utimeFrom: to, utimeTo: from}));
      const filters = query.filters;
      assert.equal(filters[0].from, from, 'from > toの時は入れ替わる');
      assert.equal(filters[0].to, to, 'from > toの時は入れ替わる');
    });
  });

  describe('投稿日時指定対応(date)', () => {
    it('dateFrom/dateToがstartTimeのrangeフィルタになる', () => {
      const params = Object.assign({}, baseParams);
      const from = new Date('2007-03-06');
      const to = new Date('2017-03-06');
      const query = create(Object.assign(params, {dateFrom: from, dateTo: to}));
      const filters = query.filters;
      assert.equal(filters[0].field, 'startTime');
      assert.equal(filters[0].type, 'range');
      assert.equal(filters[0].from, from.getTime());
      assert.equal(filters[0].to, to.getTime());
    });
  });

  describe('公式検索ページの f_range対応', () => {
    it('U_1H/U_24H/U_1W/U_30Dが現在時刻からのstartTime rangeになる', () => {
      const params = Object.assign({}, baseParams);

      let query = create(Object.assign(params, {f_range: F_RANGE.U_1H}));
      let filters = query.filters;
      assert.equal(filters[0].field, 'startTime');
      assert.equal(filters[0].type, 'range');
      assert.equal(filters[0].from, NOW - 1000 * 60 * 60);

      query = create(Object.assign(params, {f_range: F_RANGE.U_24H}));
      filters = query.filters;
      assert.equal(filters[0].from, NOW - 1000 * 60 * 60 * 24);

      query = create(Object.assign(params, {f_range: F_RANGE.U_1W}));
      filters = query.filters;
      assert.equal(filters[0].from, NOW - 1000 * 60 * 60 * 24 * 7);

      query = create(Object.assign(params, {f_range: F_RANGE.U_30D}));
      filters = query.filters;
      assert.equal(filters[0].from, NOW - 1000 * 60 * 60 * 24 * 30);
    });
  });

  describe('公式検索ページの l_range対応', () => {
    it('U_5MIN/O_20MINがlengthSeconds rangeになる', () => {
      const params = Object.assign({}, baseParams);

      let query = create(Object.assign(params, {l_range: L_RANGE.U_5MIN}));
      let filters = query.filters;
      assert.equal(filters[0].field, 'lengthSeconds');
      assert.equal(filters[0].type, 'range');
      assert.equal(filters[0].from, 0);
      assert.equal(filters[0].to, 60 * 5);

      query = create(Object.assign(params, {l_range: L_RANGE.O_20MIN}));
      filters = query.filters;
      assert.equal(filters[0].from, 60 * 20);
    });
  });

  describe('公式検索ページの 日付指定対応', () => {
    it('start/end(YYYY-MM-DD)がstartTime rangeになる', () => {
      const params = Object.assign({}, baseParams);

      const start = '2007-03-06';
      const end = '2017-03-06';
      const query = create(Object.assign(params, {start, end}));
      const filters = query.filters;
      assert.equal(filters[0].field, 'startTime');
      assert.equal(filters[0].type, 'range');
      assert.equal(filters[0].from, (new Date(start)).getTime());
      assert.equal(filters[0].to, (new Date(end)).getTime());
    });
  });
});
