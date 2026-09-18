import {VideoInfoModel} from '../../src/VideoInfo';
import assert from 'power-assert';
import fs from 'fs';

// ============================================================================
// 本テストの前提について（Task 022）
// ============================================================================
// 旧バージョンのこのファイルは「smile(flv) vs dmc、どちらが高画質か」という
// 古い判定ロジックをテストしていたが、実際の src/VideoInfo.js の
// maybeBetterQualityServerType は、その後「domand vs dmc」を比較する実装に
// 完全に置き換わっていた（smileへの参照は現行実装に一切残っていない）。
// さらに、ユーザーが実際のニコニコ動画から取得した watch API レスポンス
// （最古の動画 sm9、および取得当日にアップロードされた最新動画 sm46772778の
// 2件）を確認したところ、どちらも media.delivery（dmcInfo）は null で、
// 配信方式が Domand（HLS）に一本化されていることが確認された。
// つまり実運用では isDmcAvailable が true になるケースは事実上存在しない。
//
// そのため、この2つの実データを「isDomandOnly（domandのみ）」のケースの
// フィクスチャとして使用し、実際には再現できなくなった「dmcが使われている
// 場合」の分岐（isDmcOnly、および domand/dmc 両対応時の解像度比較）は、
// src/VideoInfo.js の DmcInfo クラス自身が要求するデータ構造
// （movie.session, movie.videos[].metadata.resolution.height など）に
// 忠実に沿って作成した「合成（synthetic）データ」でテストする。
// このsynthetic dataは実在のAPIレスポンスではなく、DmcInfoクラスの実装
// （getter がどのフィールドを読むか）から逆算して組み立てたものである。
// 詳細: docs/design-pack/30_TASK_022_VIDEOINFO_MAYBEBETTER_REDESIGN.md
// ============================================================================

const loadFixture = (path) => JSON.parse(fs.readFileSync(path, 'utf8'));

// DmcInfo（src/VideoInfo.js）が実際に参照するフィールドのみを満たす、
// 合成のdmcInfoブロックを作る。heightPxが動画の縦解像度。
const makeSyntheticDmcInfo = (heightPx) => ({
  import_version: 0,
  movie: {
    session: {
      urls: [{url: 'https://api.dmc.nico/api/sessions'}],
      signature: 'SYNTHETIC-SIG',
      token: 'SYNTHETIC-TOKEN',
      serviceUserId: '2525',
      contentId: 'out1',
      playerId: 'nicovideo-2525',
      recipeId: 'nicovideo-synthetic',
      protocols: ['http', 'hls'],
      contentKeyTimeout: 600000,
      priority: 0.8,
      authTypes: {http: 'ht2', hls: 'ht2'},
      heartbeatLifetime: 120000,
      transferPresets: ['standard2'],
    },
    videos: [
      {
        id: 'archive_h264_synthetic',
        isAvailable: true,
        metadata: {levelIndex: 0, resolution: {width: Math.round(heightPx * 16 / 9), height: heightPx}},
      },
    ],
    audios: [
      {id: 'archive_aac_synthetic', isAvailable: true, metadata: {levelIndex: 0}},
    ],
  },
});

describe('maybeBetterQualityServerType domandとdmc どっちがたぶん高画質？の判定', function () {

  let rawData;

  beforeEach(() => {
    // sm9（ニコニコ最古の動画、2007年）の実際のwatch APIレスポンスから作成した
    // フィクスチャ。2026年時点で取得したもので、dmcInfo（media.delivery）は
    // nullだった＝domandのみで配信されている。
    rawData = loadFixture('./test/fixtures/VideoInfoRawData.json');
  });

  it('sm9（最古の動画）の実データ: domandのみ配信 → domand', function () {
    const info = new VideoInfoModel(rawData);
    assert.equal(info.isDomandAvailable, true);
    assert.equal(info.isDmcAvailable, false);
    assert.equal(info.isDomandOnly, true);
    assert.equal(info.maybeBetterQualityServerType, 'domand');
  });

  it('取得当日にアップロードされた最新動画(sm46772778)の実データ: 同じくdomandのみ → domand', function () {
    const newRawData = loadFixture('./test/fixtures/VideoInfoRawData.newVideo.json');
    const info = new VideoInfoModel(newRawData);
    assert.equal(info.isDomandAvailable, true);
    assert.equal(info.isDmcAvailable, false);
    assert.equal(info.isDomandOnly, true);
    assert.equal(info.maybeBetterQualityServerType, 'domand');
  });

  it('[synthetic] dmcのみ対応（domand非対応）の場合は dmc', function () {
    rawData.domandInfo = null;
    rawData.isDomand = false;
    rawData.dmcInfo = makeSyntheticDmcInfo(720);
    rawData.isDmc = true;

    const info = new VideoInfoModel(rawData);
    assert.equal(info.isDomandOnly, false);
    assert.equal(info.isDmcOnly, true);
    assert.equal(info.maybeBetterQualityServerType, 'dmc');
  });

  it('[synthetic] domand・dmc両対応で domandの方が高解像度なら domand', function () {
    // sm9実データのdomandは最高360p(360x480)。dmc側をそれより低い240pにする。
    rawData.dmcInfo = makeSyntheticDmcInfo(240);
    rawData.isDmc = true;

    const info = new VideoInfoModel(rawData);
    assert.equal(info.isDmcAvailable, true);
    assert.equal(info.isDomandAvailable, true);
    const highestDomand = Math.max(...info.domandInfo.videos.map(v => v.height));
    const highestDmc = Math.max(...info.dmcInfo.videos.map(v => v.metadata.resolution.height));
    assert.ok(highestDomand >= highestDmc, `テスト前提が崩れている: domand=${highestDomand} dmc=${highestDmc}`);
    assert.equal(info.maybeBetterQualityServerType, 'domand');
  });

  it('[synthetic] domand・dmc両対応で dmcの方が高解像度なら dmc', function () {
    // sm9実データのdomandは最高360p。dmc側をそれより高い1080pにする。
    rawData.dmcInfo = makeSyntheticDmcInfo(1080);
    rawData.isDmc = true;

    const info = new VideoInfoModel(rawData);
    const highestDomand = Math.max(...info.domandInfo.videos.map(v => v.height));
    const highestDmc = Math.max(...info.dmcInfo.videos.map(v => v.metadata.resolution.height));
    assert.ok(highestDmc > highestDomand, `テスト前提が崩れている: domand=${highestDomand} dmc=${highestDmc}`);
    assert.equal(info.maybeBetterQualityServerType, 'dmc');
  });

  it('domand・dmcどちらも非対応の場合は domand（現行実装のフォールバック挙動）', function () {
    rawData.domandInfo = null;
    rawData.isDomand = false;
    rawData.dmcInfo = null;
    rawData.isDmc = false;

    const info = new VideoInfoModel(rawData);
    assert.equal(info.isDomandOnly, false);
    assert.equal(info.isDmcOnly, false);
    // src/VideoInfo.js の maybeBetterQualityServerType は
    // `if (!this.isDmcAvailable) return 'domand';` を持つため、
    // domandも使えない状況でも'domand'を返す（実運用では起こり得ない
    // 組み合わせだが、現行実装の実際の挙動として記録しておく）。
    assert.equal(info.maybeBetterQualityServerType, 'domand');
  });

});
