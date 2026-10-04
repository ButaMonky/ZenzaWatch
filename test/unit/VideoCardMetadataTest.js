const assert = require('assert');
const {createPlaylistContext} = require('../helpers/playlistHarness');
const {beginSection, run, loadClass} = require('../helpers/extractSource');
const plain = value => JSON.parse(JSON.stringify(value));
describe('Task222 video card metadata', () => {
  it('preserves snapshot search likes', () => {
    const {NicoSearchApiV2Loader} = require('../../packages/lib/src/nico/VideoSearch');
    const result=NicoSearchApiV2Loader.parseResult(JSON.stringify({meta:{status:200,totalCount:1},data:[{contentId:'sm1',title:'x',thumbnailUrl:'https://example.invalid/a.jpg',likeCounter:25}]}));
    const {VideoListItem}=createPlaylistContext();
    assert.strictEqual(VideoListItem.createByMylistItem(result.list[0]).count.like,25);
  });
  it('retains available likes, uploader and explicit access flags through saving', () => {
    const {VideoListItem} = createPlaylistContext();
    const item = VideoListItem.createByMylistItem({content: {id:'sm1', title:'video', count:{view:1,comment:2,mylist:3,like:0}, thumbnail:{url:'https://example.invalid/a.jpg'}, owner:{id:'42',name:'author',ownerType:'user',iconUrl:'https://example.invalid/u.jpg'}, isPaymentRequired:true}});
    const restored = new VideoListItem(plain(item.serialize()));
    assert.strictEqual(restored.count.like, 0);
    assert.strictEqual(restored.owner.name, 'author');
    assert.strictEqual(restored.owner.icon, 'https://example.invalid/u.jpg');
    assert.strictEqual(restored.isPaymentRequired, true);
  });
  it('does not invent likes or paid badges for unknown channel videos', () => {
    const {item} = createPlaylistContext();
    const v = item('so123');
    assert.strictEqual(v.count.like, undefined);
    assert.strictEqual(v.isPaymentRequired, false);
    assert.strictEqual(v.owner, null);
  });
  it('upgrades and refreshes metadata without replacing the item', () => {
    const {VideoListItem,videoInfo} = createPlaylistContext();
    const v = VideoListItem.createBlankInfo('sm1');
    const id = v.itemId;
    v.upgradeByVideoInfo(videoInfo('sm1', {count:{view:1,comment:2,mylist:3,like:12}, cardAccess:{paid:true,member:true,premium:false}}));
    assert.strictEqual(v.count.like, 12);
    assert.strictEqual(v.isMemberOnly, true);
    v.updateByVideoInfo(videoInfo('sm1',{count:{view:1,comment:2,mylist:3,like:0},cardAccess:{paid:false,member:false,premium:true}}));
    assert.strictEqual(v.count.like, 0);
    assert.strictEqual(v.isPaymentRequired, false);
    assert.strictEqual(v.isPremiumOnly, true);
    assert.strictEqual(v.itemId, id);
    assert.strictEqual(new VideoListItem(plain(v.serialize())).isPremiumOnly, true);
  });
  it('exposes the actual watch model likes and payment flags', () => {
    const {c} = createPlaylistContext(); c.JSONable=class {};
    const Model=loadClass('src/VideoInfo.js','VideoInfoModel',c);
    const model=new Model({watchApiData:{videoDetail:{likeCount:99}},isNeedPayment:true,isMemberFree:false,isPremiumFree:true});
    assert.strictEqual(model.count.like,99);
    assert.deepStrictEqual(plain(model.cardAccess),{paid:true,member:false,premium:true});
  });
  it('rejects malformed likes and unsafe owner icons', () => {
    const {item}=createPlaylistContext();
    for(const like of [-1,NaN,Infinity,'0',null,{}]) { assert.strictEqual(item('sm1',{like}).count.like,undefined); }
    assert.strictEqual(item('sm1',{owner:{name:'x',icon:'javascript:alert(1)'}}).owner.icon,'');
  });
  it('renders known zero likes while deferring uploader and access badge UI', () => {
    const {c,item} = createPlaylistContext();
    const html = (parts,...values) => parts.reduce((s,p,i) => s+p+(i<values.length ? values[i] : ''),'');
    c.dll={lit:{html},directives:{classMap:()=>''}};
    run(beginSection('packages/zenza/src/Playlist/VideoListItemView.js')+';globalThis.View=VideoListItemView;',c);
    const v=item('sm1',{like:0,owner:{name:'Author',icon:'https://example.invalid/i.png'},isPaymentRequired:true});
    v.isLazy=false;
    const rendered=c.View.build(v);
    assert(rendered.includes('likeCount'));
    assert(!rendered.includes('cardOwner'));
    assert(!rendered.includes('accessBadges'));
    const unknown=item('so2'); unknown.isLazy=false;
    assert(!c.View.build(unknown).includes('likeCount'));
    assert(!c.View.build(unknown).includes('\u6709\u6599'));
  });
});
