'use strict';
const assert=require('assert');
const {pocketUtil}=require('../helpers/pocketHarness');
const {extract,createContext,run,read}=require('../helpers/extractSource');

function fixture(zenza=true) {
  const s=pocketUtil({url:'https://www.nicovideo.jp/my'});
  s.util.hasLargeThumbnail = () => false;
  const host=s.doc.createElement('div');
  host.id='mylistPocket-popup';host.classList.add('show');
  const description=s.doc.createElement('div');
  description.className='description';
  host.append(description);
  s.doc.body.append(host);
  const infoCalls=[], grades=[], extraCalls=[];
  const context=createContext({
    document:s.doc,window:s.w,util:s.util,
    Emitter:class {},
    ThumbInfoLoader:{load:async id=>{
      infoCalls.push(id);
      return {status:'ok',id,videoId:id,title:'題名 '+id,
        thumbnail:'https://cdn.example/'+id+'.jpg',
        duration:123,postedAt:'2026/10/26 12:00',
        viewCount:11234,commentCount:20,mylistCount:3};
    }},
    AdDecorationLoader:{load:async ids=>{
      grades.push([...ids]);
      return new Map(ids.map(id=>[id,id==='sm123'?'gold':'normal']));
    }},
    PocketCardMetadataLoader:{load:async id=>{
      extraCalls.push(id);
      return {videoId:id,likeCount:42,owner:{type:'user',id:'188548',name:'say2',
        icon:'https://img.nicoprofile.nimg.jp/usericon/18/188548.jpg'}};
    }}
  });
  // Exercise the real selector/installer instead of a legacy-only test stub.
  run('const ThumbnailSourcePolicy='+extract('packages/lib/src/nico/ThumbnailSourcePolicy.js',
    'ThumbnailSourcePolicy','var')+';',context);
  run('const PocketThumbnail='+extract('packages/zenza/src/pocket/PocketThumbnail.js',
    'PocketThumbnail','var')+';',context);
  run('const PocketDescriptionCard='+extract('packages/zenza/src/pocket/PocketDescriptionCard.js',
    'PocketDescriptionCard','var')+';this.Cards=PocketDescriptionCard;',context);
  run('const VideoInfoView='+extract('src/_pocket.js','VideoInfoView','class')+
    ';this.View=VideoInfoView;',context);
  const view=Object.create(context.View.prototype);
  view._videoInfo={watchId:'sm9'};
  view._isZenzaReady=zenza;
  view._hostDom=host;
  view._descriptionCardsGeneration=0;
  const flush=async()=>{
    for(let i=0;i<18;i++)await Promise.resolve();
  };
  return {s,host,description,view,infoCalls,grades,extraCalls,flush,close:()=>s.close()};
}

describe('Task950: real MylistPocket VideoInfoView description wiring',()=>{
  let h;
  afterEach(()=>{h?.close();h=null;});

  it('transforms sm links via real linkification, fetches cards, and uses NicoAd once',async()=>{
    h=fixture(true);
    h.view._createDescription(h.description,'前: sm123 次: sm456');
    const cards=[...h.description.querySelectorAll('.mpp-video-card')];
    assert.strictEqual(cards.length,2);
    assert(!h.description.querySelector('a button'));
    await h.flush();
    assert.deepStrictEqual(h.infoCalls,['sm123','sm456']);
    assert.strictEqual(h.grades.length,1);
    assert.deepStrictEqual(h.grades[0],['sm123','sm456']);
    assert.deepStrictEqual(h.extraCalls,['sm123','sm456']);
    assert.strictEqual(cards[0].querySelector('.mpp-card-owner-name').textContent,'say2');
    assert.strictEqual(cards[0].querySelector('.mpp-card-owner').href,
      'https://www.nicovideo.jp/user/188548');
    assert(cards[0].querySelector('.mpp-card-counters').textContent.includes('いいね: 42'));
    assert.strictEqual(cards[0].querySelector('.mpp-card-title').textContent,'題名 sm123');
    assert.strictEqual(cards[0].querySelector('img').src,'https://cdn.example/sm123.jpg');
    assert(cards[0].classList.contains('is-adDecoration-gold'));
    assert(!cards[1].classList.contains('is-adDecoration-gold'));
    assert.strictEqual(cards[0].querySelector('.mpp-card-info').dataset.command,'info');
    assert.strictEqual(cards[0].querySelector('.mpp-card-title').dataset.command,'zenza-open');
    assert(h.description.textContent.includes('前:') && h.description.textContent.includes('次:'));
  });

  it('does not intercept native watch links without Zenza',async()=>{
    h=fixture(false);
    h.view._createDescription(h.description,'sm9');
    await h.flush();
    const title=h.description.querySelector('.mpp-card-title');
    assert(title);
    assert.strictEqual(title.href,'https://www.nicovideo.jp/watch/sm9');
    assert.strictEqual(title.hasAttribute('data-command'),false);
  });

  it('upgrades previously rendered cards when ZenzaWatch becomes ready later',()=>{
    const source=read('src/_pocket.js');
    const view=source.indexOf('class VideoInfoView extends Emitter');
    const detector=source.indexOf('ZenzaDetector.detect().then(() => {',view);
    const next=source.indexOf('window.ZenzaWatch.emitter.on',detector);
    assert(view>=0 && detector>view && next>detector);
    const block=source.slice(detector,next);
    assert(block.includes('this._isZenzaReady = true'));
    assert(block.includes('PocketDescriptionCard.enableZenzaLinks(this._hostDom)'));
  });

  it('retains optional NG/favorite observation after converting links to cards',()=>{
    const source=read('src/_pocket.js');
    const begin=source.indexOf('class VideoInfoView extends Emitter');
    const view=source.slice(begin,source.indexOf('class VideoInfo {',begin));
    assert(view.includes("query: 'a.videoLink, .mpp-video-card'"));
    assert(source.includes('item.dataset.watchId'));
  });

  it('removes the obsolete deleted.jpg implementation, retains popup info action',()=>{
    const source=read('src/_pocket.js');
    const start=source.indexOf('      _createDescription(elm, data) {');
    const end=source.indexOf('      _updateNicodicMarks(',start);
    assert(start>0&&end>start);
    const block=source.slice(start,end);
    assert(!block.includes('video_deleted.jpg'));
    assert(block.includes('PocketDescriptionCard.make'));
    assert(block.includes('PocketDescriptionCard.hydrate'));
    assert(block.includes('AdDecorationLoader.load(ids)'));
    assert(block.includes('PocketCardMetadataLoader.load(id)'));
  });

  it('embeds module and shared NicoAd loader INSIDE page-world userscript',()=>{
    const source=read('dist/MylistPocket.user.js');
    const a=source.indexOf('const monkey = (PRODUCT) => {');
    const b=source.indexOf('const PocketDescriptionCard = (() => {',a);
    const c=source.indexOf('const AdDecorationLoader = (() => {',a);
    const injection=source.indexOf('monkey.toString()',a);
    assert(a>=0&&b>a&&c>b&&injection>c);
    assert(source.includes('is-adDecoration-gold'));
    assert(source.includes('api.nicoad.nicovideo.jp/v1/contents/video/decoration'));
    const extra=source.indexOf('const PocketCardMetadataLoader = (() => {',a);
    assert(extra>a && extra<injection);
    assert(source.includes('nvapi.nicovideo.jp/v1/videos?watchIds='));
  });
});
