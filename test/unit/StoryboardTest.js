'use strict';

import assert from 'power-assert';
import {createStoryboardClasses} from '../../packages/lib/src/nico/VideoSessionWorker';

// createStoryboardClasses(util) is a factory (Task 018) so it can be
// exercised here without a real Worker thread or a real network. We pass
// a stub `util` whose `fetch` always rejects — none of the tests below
// call `load()`/`_createSession()` (the only methods that call
// util.fetch), so it is never invoked.
const {
  StoryboardInfoLoader,
  StoryboardSession,
  DomandStoryboardSession,
  DmcStoryboardSession,
  DmcStoryboardInfoLoader,
} = createStoryboardClasses({
  fetch: () => Promise.reject(new Error('util.fetch should not be called by these tests')),
});

describe('Storyboard (packages/lib/src/nico/VideoSessionWorker.js)', () => {

  describe('StoryboardSession.create()', () => {
    it('serverType: dmc で DmcStoryboardSession を生成する', () => {
      const session = StoryboardSession.create({
        serverType: 'dmc',
        videoInfo: {dmcStoryboardInfo: {urls: [{url: '//example.com/api/sessions'}]}},
      });
      assert(session instanceof DmcStoryboardSession);
    });

    it('serverType: domand で DomandStoryboardSession を生成する', () => {
      const session = StoryboardSession.create({
        serverType: 'domand',
        videoInfo: {domandInfo: {}},
      });
      assert(session instanceof DomandStoryboardSession);
    });

    it('未知のserverTypeはエラーになる', () => {
      assert.throws(() => {
        StoryboardSession.create({serverType: 'unknown', videoInfo: {}});
      });
    });
  });

  describe('DmcStoryboardSession#_createRequestString()', () => {
    // 現行実装（packages/lib/src/nico/VideoSessionWorker.js内の
    // DmcStoryboardSession._createRequestString()）は、videoInfo.dmcStoryboardInfo
    // からキャメルケースのフィールドを読み、DMCセッションAPI用のsnake_caseな
    // JSONリクエストを組み立てる。かつての test/pending/StoryboardTest.js は
    // snake_caseな平坦なinfoオブジェクトを直接渡していたが、これは古いAPI形状で
    // 現行実装とは一致しない（Task 018で判明）。
    const dmcStoryboardInfo = {
      playerId: 'abcdefg-h-ijklmnopqrstr_1234567890',
      authTypes: {storyboard: 'auth-12345'},
      contentId: '12345',
      contentKeyTimeout: Math.floor(Math.random() * 60000),
      heartbeatLifetime: Math.floor(Math.random() * 30000),
      priority: Math.random(),
      recipeId: 'sushi-sm9',
      serviceUserId: '1234',
      signature: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      token: '12345-token',
      urls: [
        {url: '//example.com/api/sessions'},
        {url: '//example.com/api/sessions'},
      ],
      videos: ['720p_aaaaa', '540p_bbbbb'],
    };

    const session = new DmcStoryboardSession({videoInfo: {dmcStoryboardInfo}});
    const request = JSON.parse(session._createRequestString());

    it('client_info.player_id', () => {
      assert.equal(dmcStoryboardInfo.playerId, request.session.client_info.player_id);
    });

    it('content_auth', () => {
      assert.equal(dmcStoryboardInfo.authTypes.storyboard, request.session.content_auth.auth_type);
      assert.equal(dmcStoryboardInfo.contentKeyTimeout, request.session.content_auth.content_key_timeout);
      assert.equal(dmcStoryboardInfo.serviceUserId, request.session.content_auth.service_user_id);
    });

    it('content_id', () => {
      assert.equal(dmcStoryboardInfo.contentId, request.session.content_id);
    });

    it('content_src_id_sets: videosがそのままcontent_src_idsになる', () => {
      assert.equal(dmcStoryboardInfo.videos[0], request.session.content_src_id_sets[0].content_src_ids[0]);
      assert.equal(dmcStoryboardInfo.videos[1], request.session.content_src_id_sets[0].content_src_ids[1]);
    });

    it('keep_method.heartbeat.lifetime', () => {
      assert.equal(dmcStoryboardInfo.heartbeatLifetime, request.session.keep_method.heartbeat.lifetime);
    });

    it('priority', () => {
      assert.equal(dmcStoryboardInfo.priority, request.session.priority);
    });

    it('recipe_id', () => {
      assert.equal(dmcStoryboardInfo.recipeId, request.session.recipe_id);
    });

    it('session_operation_auth', () => {
      assert.equal(dmcStoryboardInfo.signature,
        request.session.session_operation_auth.session_operation_auth_by_signature.signature);
      assert.equal(dmcStoryboardInfo.token,
        request.session.session_operation_auth.session_operation_auth_by_signature.token);
    });

    // 旧テストはinfo.urls[0].is_ssl / is_well_known_portの値をリクエストに
    // 反映する想定だったが、現行実装はこれらを常に'yes'固定にしている
    // （urls配列の中身は実際には参照されず、request組み立てに使われるのは
    // urls[0].urlだけ＝コンストラクタで_urlとして取り出される送信先URL）。
    // 仕様変更かどうか不明（旧APIには可変フラグがあったのかもしれない）だが、
    // 現行のコードが実際にそうなっていることをそのまま記録する。
    it('storyboard_download_parameters は現行実装では常に yes 固定', () => {
      const params = request.session.protocol.parameters.http_parameters.parameters.storyboard_download_parameters;
      assert.equal(params.use_ssl, 'yes');
      assert.equal(params.use_well_known_port, 'yes');
    });
  });

  describe('DmcStoryboardInfoLoader', () => {
    // load()は実ネットワークfetchを行うため、_rawDataを直接セットして
    // ゲッターのロジックだけを検証する（load()が_rawData = result.dataと
    // 代入する形に合わせ、{meta, data}のdataの中身だけを渡す）。
    const loader = new DmcStoryboardInfoLoader({url: 'https://example.com/storyboard.json'});
    loader._rawData = {
      version: 1,
      storyboards: [
        {
          thumbnail_width: 100,
          thumbnail_height: 60,
          rows: 5,
          columns: 10,
          interval: 1000,
          quality: 10,
          images: [{timestamp: 0, uri: 'http://example.com/a'}],
        },
        {
          thumbnail_width: 200,
          thumbnail_height: 120,
          rows: 5,
          columns: 10,
          interval: 1000,
          quality: 90,
          images: [{timestamp: 0, uri: 'http://example.com/b'}],
        },
      ],
    };

    it('storyboards配列を件数通りに変換する', () => {
      assert.equal(loader._storyboards.length, 2);
    });

    it('quality/columns/rows/intervalをそのまま持つ', () => {
      const sb = loader._storyboards.find(s => s.quality === 90);
      assert.equal(sb.columns, 10);
      assert.equal(sb.rows, 5);
      assert.equal(sb.interval, 1000);
      assert.equal(sb.thumbnail.width, 200);
      assert.equal(sb.thumbnail.height, 120);
    });

    it('imagesのuriがurlに変換される', () => {
      const sb = loader._storyboards.find(s => s.quality === 90);
      assert.equal(sb.images[0].url, 'http://example.com/b');
    });

    // Task 018で発見したバグ（_storyboardsの並び替え比較関数が数値の差ではなく
    // booleanを返していて画質降順にならない）をTask 020で修正した
    // （`.toSorted((a, b) => b.quality < a.quality)` → `(a, b) => b.quality - a.quality`）。
    // ユーザー承認済み（「直しちゃいましょう」）。回帰検知用に正しい挙動を記録する。
    it('storyboardゲッターは最高画質のものを選ぶ', () => {
      const best = loader.storyboard;
      assert.equal(best.quality, 90);
    });
  });

  describe('StoryboardInfoLoader（基底クラス）', () => {
    it('durationはデフォルト1、setterで変更できる', () => {
      const loader = new StoryboardInfoLoader({url: 'https://example.com'});
      assert.equal(loader.duration, 1);
      loader.duration = 42;
      assert.equal(loader.duration, 42);
    });
  });
});
