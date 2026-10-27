'use strict';
const assert = require('assert');
const {JSDOM} = require('jsdom');
const {extract, createContext, run, read} = require('../helpers/extractSource');

const SOURCE = 'packages/zenza/src/pocket/PocketDescriptionCard.js';
function setup() {
  const dom = new JSDOM('<div id="container"></div>', {url:'https://www.nicovideo.jp/my'});
  const document = dom.window.document;
  const ctx = createContext({document, window:dom.window});
  run('const PocketDescriptionCard=' + extract(SOURCE, 'PocketDescriptionCard', 'var') +
    ';this.Card = PocketDescriptionCard;', ctx);
  const Card = ctx.Card;
  const root = document.querySelector('#container');
  const make = (id='sm46828117', label=id, zenza=true) => {
    const url = 'https://www.nicovideo.jp/watch/' + id;
    const card = Card.make(document,id,url,label,zenza);
    if (card) { root.append(card.root); }
    return card;
  };
  return {Card,dom,root,make,close:()=>dom.window.close()};
}
const makeInfo = (id, title='タイトル') => ({
  status:'ok', id, videoId:id, title, thumbnail:'https://cdn.example/thumb.jpg',
  duration:691, postedAt:'2026/10/26 14:00:00',
  viewCount:11234, commentCount:789, mylistCount:75
});

describe('Task950 MylistPocket description cards', function() {
  let h;
  afterEach(()=>{h?.close();h=null;});

  it('renders a playlist-like card rather than deleted thumbnail plus ID',()=>{
    h=setup();
    const c=h.make('sm46828117', '元動画 sm46828117');
    assert(c);
    assert.strictEqual(c.root.dataset.watchId,'sm46828117');
    assert.strictEqual(c.thumb.getAttribute('href'),'https://www.nicovideo.jp/watch/sm46828117');
    assert.strictEqual(c.title.textContent,'元動画 sm46828117');
    assert.strictEqual(c.infoButton.dataset.param,'sm46828117');
    assert.strictEqual(c.thumb.dataset.command,'zenza-open');
    assert.strictEqual(c.title.dataset.command,'zenza-open');
    assert.strictEqual(c.image.hasAttribute('src'),false);
    assert.strictEqual(c.root.querySelectorAll('a button').length,0);
    assert.strictEqual(c.infoButton.parentElement.lastElementChild,c.infoButton,
      'info button must be rightmost in the footer');
    assert.strictEqual(c.ownerLink.parentElement.firstElementChild,c.ownerLink);
    assert.strictEqual(c.ownerIcon.className,'mpp-card-owner-icon');
  });

  it('works without Zenza and blocks unsafe IDs and URLs',()=>{
    h=setup();
    const c=h.make('sm123','sm123',false);
    assert(!c.title.classList.contains('command'));
    assert(!c.thumb.classList.contains('command'));
    assert.strictEqual(h.Card.make(h.dom.window.document,'sm9',
      'https://evil.example/watch/sm9','no',true),null);
    assert.strictEqual(h.Card.make(h.dom.window.document,'sm9<script>',
      'https://www.nicovideo.jp/watch/sm9','no',true),null);
    assert.strictEqual(h.Card.make(h.dom.window.document,'sm','https://www.nicovideo.jp/watch/sm','no',true),null);
  });

  it('upgrades existing card links if ZenzaWatch becomes ready after the popup opened',()=>{
    h=setup();
    const card=h.make('sm123','before detection',false);
    const ordinary=h.dom.window.document.createElement('a');
    ordinary.className='ordinary';
    ordinary.href='https://www.nicovideo.jp/watch/sm9';
    h.root.append(ordinary);
    // Contributor descriptions can contain class/data attributes that resemble
    // a real card. Only module-owned cards may acquire command handlers.
    const spoof=h.dom.window.document.createElement('div');
    spoof.className='mpp-video-card';
    spoof.dataset.watchId='sm123';
    spoof.innerHTML='<a class="mpp-card-title" href="https://example.invalid/">foreign</a>';
    h.root.append(spoof);
    assert.strictEqual(card.title.dataset.command,undefined);
    const first=h.Card.enableZenzaLinks(h.root);
    assert.strictEqual(first,1);
    assert.strictEqual(card.thumb.dataset.command,'zenza-open');
    assert.strictEqual(card.title.dataset.command,'zenza-open');
    assert.strictEqual(card.title.dataset.param,'sm123');
    assert.strictEqual(card.infoButton.dataset.command,'info');
    assert.strictEqual(ordinary.hasAttribute('data-command'),false);
    assert.strictEqual(spoof.querySelector('a').hasAttribute('data-command'),false);
    assert.strictEqual(h.Card.enableZenzaLinks(h.root),1);
    assert.strictEqual(card.root.querySelectorAll('a.command').length,2);
    assert.strictEqual(h.Card.enableZenzaLinks(null),0);
  });

  it('does not leave loading forever when metadata resolves as a failure object',async()=>{
    h=setup();
    const bad=h.make('sm1'), good=h.make('sm2');
    let inspected;
    await h.Card.hydrate([bad,good],{
      loadInfo:async id=>id==='sm1'?{status:'fail',message:'removed'}:makeInfo('sm2'),
      loadDecoration:async ids=>{
        inspected=Array.from(ids);
        return new Map([['sm2','gold']]);
      },
      installImage:()=>{},isCurrent:()=>true
    });
    assert(bad.root.classList.contains('is-failed'));
    assert.match(bad.state.textContent,/取得できません/);
    assert(!bad.state.textContent.includes('取得中'));
    assert.strictEqual(bad.info,undefined);
    assert.deepStrictEqual(inspected,['sm2']);
    assert(good.root.classList.contains('is-adDecoration-gold'));
  });

  it('uses textContent, video metadata, and compact counts safely',()=>{
    h=setup();
    const c=h.make('sm9','sm9');
    const title='<img src=x onerror=alert(1)> 実際のタイトル';
    const images=[];
    assert(h.Card.applyInfo(c,makeInfo('sm9',title),{
      installImage:(image,url)=>{images.push(url);image.src=url;},isCurrent:()=>true
    }));
    assert.strictEqual(c.root.querySelectorAll('img').length,2, 'video and poster avatar');
    assert.strictEqual(c.title.textContent,title);
    assert.strictEqual(c.title.querySelector('img'),null);
    assert.strictEqual(c.duration.textContent,'11:31');
    assert.match(c.counters.textContent,/再生: 1.1万/);
    assert.match(c.counters.textContent,/コメ: 789/);
    assert.match(c.counters.textContent,/いいね: 不明/);
    assert.strictEqual(c.ownerName.textContent,'(投稿者情報なし)');
    assert.strictEqual(c.ownerLink.hasAttribute('href'),false);
    assert.deepStrictEqual(images,['https://cdn.example/thumb.jpg']);
    assert.strictEqual(c.state.textContent,'');
  });

  it('preserves NG and favorite presentation on the new card container',()=>{
    h=setup();
    const css=h.Card.CSS;
    for(const token of ['.mpp-video-card.is-ng-wait',
      '.mpp-video-card.is-ng-queue',
      '.mpp-video-card.is-ng-current',
      '.mpp-video-card.is-ng-rejected',
      '.mpp-video-card.is-fav-favorited']) {
      assert(css.includes(token),'missing card NG/fav style: '+token);
    }
    assert(css.includes(
      'body.is-ng-disable #mylistPocket-popup .mpp-video-card.is-ng-rejected'));
    assert(css.includes('display:grid!important'));
    assert(css.includes('outline:3px dotted orange'));
  });


  it('shows uploader avatar/name on the left and preserves a right-aligned info button',()=>{
    h=setup();
    const card=h.make('sm9');
    const owner={type:'user',id:'188548',name:'say2',
      icon:'https://img.nicoprofile.nimg.jp/usericon/18/188548.jpg'};
    assert(h.Card.applyInfo(card,{...makeInfo('sm9'),owner}));
    assert.strictEqual(card.ownerName.textContent,'say2');
    assert.strictEqual(card.ownerLink.href,'https://www.nicovideo.jp/user/188548');
    assert.strictEqual(card.ownerLink.target,'_blank');
    assert(card.ownerIcon.src.includes('/usericon/18/188548.jpg'));
    assert.strictEqual(card.infoButton.dataset.command,'info');
    assert.strictEqual(card.infoButton.parentElement.lastElementChild,card.infoButton);
    assert(!card.ownerLink.classList.contains('command'));
  });

  it('reuses NicoAd-backed missing-owner supplement and overlays a verified like count',()=>{
    h=setup();
    const c=h.make('sm9');
    const owner={type:'user',id:'7654',name:'投稿者を補完',
      icon:'https://img.nicoprofile.nimg.jp/usericon/1/7654.jpg',isSupplemented:true};
    assert(h.Card.applyInfo(c,{...makeInfo('sm9'),owner}));
    c.info={...makeInfo('sm9'),owner};
    h.Card.applyExtra(c,{likeCount:173,owner:{type:'user',id:'999',name:'wrong'}});
    assert.strictEqual(c.ownerName.textContent,'投稿者を補完');
    assert.strictEqual(c.ownerLink.href,'https://www.nicovideo.jp/user/7654');
    assert.strictEqual(c.likeCell.textContent,'いいね: 173');
    assert.strictEqual(c.likeCell.title,'いいね: 173');
    h.Card.applyExtra(c,{likeCount:0});
    assert.strictEqual(c.likeCell.textContent,'いいね: 0');
    h.Card.applyExtra(c,{likeCount:undefined});
    assert.strictEqual(c.likeCell.textContent,'いいね: 0');
  });

  it('uses visible nvapi owner only when ThumbInfo/NicoAd lacks the poster',()=>{
    h=setup();
    const c=h.make('sm9');
    const owner={type:'user',id:'',name:'(投稿者情報なし)',
      icon:'https://secure-dcdn.cdn.nimg.jp/nicoaccount/usericon/defaults/blank.jpg',
      isSupplemented:true};
    assert(h.Card.applyInfo(c,{...makeInfo('sm9'),owner}));
    c.info={...makeInfo('sm9'),owner};
    const extra={likeCount:38,owner:{type:'user',id:'188548',name:'say2',
      icon:'https://img.nicoprofile.nimg.jp/usericon/18/188548.jpg'}};
    h.Card.applyExtra(c,extra);
    assert.strictEqual(c.ownerName.textContent,'say2');
    assert.strictEqual(c.ownerLink.href,'https://www.nicovideo.jp/user/188548');
    assert.strictEqual(c.likeCell.textContent,'いいね: 38');
    h.Card.applyExtra(c,{owner:{type:'user',id:'',name:'<script>alert(1)</script>',icon:'javascript:evil'}});
    assert.strictEqual(c.ownerLink.querySelector('script'),null);
    assert.strictEqual(c.ownerLink.href,'https://www.nicovideo.jp/user/188548');
  });

  it('displays a validated channel identity and tolerates missing owner data',()=>{
    h=setup();
    const card=h.make('so123');
    assert(h.Card.applyInfo(card,{...makeInfo('so123'),
      owner:{type:'channel',id:'ch765',name:'公式チャンネル',icon:'http://img.nicoprofile.nimg.jp/usericon/1.jpg'}}));
    assert.strictEqual(card.ownerLink.href,'https://ch.nicovideo.jp/ch765');
    assert.strictEqual(card.ownerName.textContent,'公式チャンネル');
    assert(card.ownerIcon.src.startsWith('https://'));
    h.Card.showOwner(card,{id:'javascript:',type:'user',name:'残存アカウント'});
    assert.strictEqual(card.ownerLink.hasAttribute('href'),false);
    assert.strictEqual(card.ownerName.textContent,'残存アカウント');
  });

  it('loads likes separately from title, limits extra requests, and does not stall crowns',async()=>{
    h=setup();
    const cards=Array.from({length:7},(_,i)=>h.make('sm'+(100+i)));
    let started=0,active=0,max=0;
    const pendings=[];
    let resolveFirst;
    const first=new Promise(r=>{resolveFirst=r;});
    let releaseAll;
    const gate=new Promise(r=>{releaseAll=r;});
    const p=h.Card.hydrate(cards,{
      loadInfo:async id=>makeInfo(id),
      loadDecoration:async ids=>new Map([[ids[0],'gold']]),
      loadExtra:async id=>{
        started++;active++;max=Math.max(max,active);
        pendings.push(id);
        await gate;active--;
        return {likeCount:42,owner:null};
      },
      installImage:()=>{},isCurrent:()=>true
    });
    for(let i=0;i<35;i++)await Promise.resolve();
    assert.strictEqual(cards[0].title.textContent,'タイトル');
    assert.strictEqual(cards[0].likeCell.textContent,'いいね: 不明');
    assert.strictEqual(cards[0].root.classList.contains('is-adDecoration-gold'),true,
      'NicoAd must not await slower likes endpoint');
    assert.strictEqual(started,3,'extra requests must be bounded');
    releaseAll();
    await p;
    assert.strictEqual(started,7);
    assert.strictEqual(max,3);
    assert(cards.every(c=>c.likeCell.textContent==='いいね: 42'));
  });

  it('ignores stale extra metadata after switching to another information panel',async()=>{
    h=setup();
    const c=h.make('sm777');
    let resolve;
    const later=new Promise(r=>{resolve=r;});
    let owned=true;
    const task=h.Card.hydrate([c],{
      loadInfo:async id=>makeInfo(id),
      loadExtra:()=>later,
      installImage:()=>{},isCurrent:()=>owned
    });
    for(let i=0;i<15;i++)await Promise.resolve();
    owned=false;
    resolve({likeCount:777,owner:{type:'user',id:'24',name:'stale'}});
    await task;
    assert.strictEqual(c.likeCell.textContent,'いいね: 不明');
    assert.strictEqual(c.ownerName.textContent,'(投稿者情報なし)');
  });

  it('reuses the exact gold/silver crown artwork from the playlist',()=>{
    h=setup();
    const src=read('packages/zenza/src/Playlist/VideoListItemView.js');
    for(const grade of ['gold','silver']){
      const match=src.match(new RegExp('\\.videoItem\\.is-adDecoration-'+grade+
        ' \\.thumbnailContainer::after\\s*\\{\\s*background-image: url\\("([^"]+)"\\);'));
      assert(match && h.Card.CSS.includes(match[1]), 'playlist badge '+grade);
    }
    const card=h.make('sm9');
    h.Card.applyDecoration(card,'gold');
    assert(card.root.classList.contains('is-adDecoration-gold'));
    h.Card.applyDecoration(card,'silver');
    assert(!card.root.classList.contains('is-adDecoration-gold'));
    assert(card.root.classList.contains('is-adDecoration-silver'));
    h.Card.applyDecoration(card,null);
    assert(!card.root.classList.contains('is-adDecoration-silver'));
  });

  it('limits concurrent metadata work to 3 and batches decorations once',async()=>{
    h=setup();
    const cards=Array.from({length:8},(_,i)=>h.make('sm'+(i+10)));
    let active=0,max=0,batches=0,completed=0;
    await h.Card.hydrate(cards,{
      loadInfo: async id => {
        active++;max=Math.max(max,active);
        await Promise.resolve();await Promise.resolve();active--;completed++;
        return makeInfo(id,'loaded '+id);
      },
      loadDecoration: async ids => {
        batches++;
        assert.strictEqual(completed,8);
        assert.strictEqual(ids.length,8);
        return new Map([[ids[0],'gold'],[ids[1],'silver']]);
      },
      installImage:()=>{},isCurrent:()=>true
    });
    assert.strictEqual(max,3);
    assert.strictEqual(batches,1);
    assert(cards[0].root.classList.contains('is-adDecoration-gold'));
    assert(cards[1].root.classList.contains('is-adDecoration-silver'));
    assert(!cards[2].root.classList.contains('is-adDecoration-gold'));
  });

  it('passes canonical metadata IDs to the real decoration API adapter',async()=>{
    h=setup();
    const card=h.make('1234');
    let lookedUp;
    await h.Card.hydrate([card],{
      loadInfo:async()=>makeInfo('sm1234'),
      loadDecoration:async ids=>{lookedUp=ids;return new Map([['sm1234','gold']]);},
      installImage:()=>{},isCurrent:()=>true
    });
    assert.deepStrictEqual(Array.from(lookedUp),['sm1234']);
    assert(card.root.classList.contains('is-adDecoration-gold'));
  });

  it('ignores stale results and never calls the crown API after closing',async()=>{
    h=setup();
    const card=h.make('sm9');
    let resolve;
    const pending=new Promise(r=>{resolve=r;});
    let current=true,requests=0;
    const promise=h.Card.hydrate([card],{
      loadInfo:()=>pending,
      loadDecoration:async()=>{requests++;return new Map();},
      isCurrent:()=>current,installImage:()=>{}
    });
    current=false;resolve(makeInfo('sm9'));
    await promise;
    assert.strictEqual(card.title.textContent,'sm9');
    assert.strictEqual(requests,0);
  });

  it('keeps failed/deleted videos usable without inventing a gold crown',async()=>{
    h=setup();
    const [bad,good]=[h.make('sm1'),h.make('sm2')];
    await h.Card.hydrate([bad,good],{
      loadInfo: async id => {
        if(id==='sm1')throw Error('deleted');
        return makeInfo('sm2');
      },
      loadDecoration:async ids=>{
        assert.deepStrictEqual(Array.from(ids),['sm2']);
        return new Map([['sm2','silver']]);
      },
      installImage:()=>{},isCurrent:()=>true
    });
    assert(bad.root.classList.contains('is-failed'));
    assert.match(bad.state.textContent,/取得できません/);
    assert(!bad.root.classList.contains('is-adDecoration-silver'));
    assert(good.root.classList.contains('is-adDecoration-silver'));
  });
});
