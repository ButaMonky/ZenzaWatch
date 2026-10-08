'use strict';

const assert = require('assert');
const {createContext, loadClass} = require('../helpers/extractSource');

function setup() {
  const context = createContext({URL, console});
  const RelatedMenuActions = loadClass(
    'packages/zenza/src/menu/RelatedMenuActions.js', 'RelatedMenuActions', context);
  return RelatedMenuActions;
}
const sample = {
  id: 'nico-test', label: 'ニコチャート',
  url: 'https://example.com/watch/{videoId}',
  enabled: true, openInNewTab: true
};

describe('Task313 persistent related-menu links and trusted action API', () => {
  it('uses a stable config key and exposed variable vocabulary', () => {
    const api = setup();
    assert.strictEqual(api.CONFIG_KEY, 'relatedMenu.customLinks');
    assert.deepStrictEqual(Array.from(api.VARIABLES),
      ['videoId','watchId','videoUrl','videoTitle','uploaderUserId',
       'uploaderChannelId','uploaderName','currentTime']);
  });
  it('validates ordered link lists, enabled state and tab preference', () => {
    const api = setup();
    const result = api.validateLinks([sample,
      {id:'history',label:'履歴',url:'https://example.com/history',
       enabled:false,openInNewTab:false}]);
    assert.strictEqual(result.valid,true);
    assert.strictEqual(result.links.length,2);
    assert.deepStrictEqual(Array.from(result.links, x => x.id), ['nico-test','history']);
    assert.strictEqual(result.links[1].enabled,false);
    assert.strictEqual(result.links[1].openInNewTab,false);
  });
  it('rejects unsafe URL schemes, credentials, unknown tokens and duplicate IDs', () => {
    const api = setup();
    const invalid = [
      {...sample,url:'javascript:alert(1)'},
      {...sample,url:'data:text/html,pwn'},
      {...sample,url:'https://user:pass@example.com/a'},
      {...sample,url:'https://example.com/{notApproved}'},
      {...sample,url:'https://example.com/{videoId'},
      {...sample,url:'https://example.com/line\nnext'}
    ];
    invalid.forEach(item => assert.strictEqual(api.validateLinks([item]).valid,false,item.url));
    assert.strictEqual(api.validateLinks([sample,{...sample}]).valid,false);
    assert.strictEqual(api.validateLinks(new Array(41).fill(sample)).valid,false);
    assert.strictEqual(api.validateLinks('not-json-array').valid,false);
  });
  it('encodes title, names, URL and timestamp as URL components', () => {
    const api = setup();
    const ctx = api.makeContext({
      videoId:'sm123',watchId:'sm123',title:'A&B / 日本語',
      owner:{type:'user',id:42,name:'佐藤 & Co'}
    },12.8);
    assert.strictEqual(ctx.videoUrl,'https://www.nicovideo.jp/watch/sm123');
    const result = api.resolveUrl(
      'https://example.com/video/{videoId}?name={uploaderName}&title={videoTitle}&at={currentTime}',
      ctx);
    assert.strictEqual(result.url,
      'https://example.com/video/sm123?name='+encodeURIComponent('佐藤 & Co')+
      '&title='+encodeURIComponent('A&B / 日本語')+'&at=12');
    assert.strictEqual(Object.isFrozen(ctx),true);
    assert.strictEqual(ctx.currentTime,'12');
  });
  it('distinguishes uploader users from channels and does not invent deleted IDs', () => {
    const api = setup();
    const user = api.makeContext({videoId:'sm9',watchId:'sm9',
      owner:{type:'user',id:undefined,name:'非公開'}});
    assert.strictEqual(user.uploaderUserId,'');
    assert.strictEqual(api.resolveUrl('https://example.com/{uploaderUserId}',user).url,null);
    assert.strictEqual(api.makeContext({owner:{type:'user',id:0}}).uploaderUserId,'');
    const channel = api.makeContext({videoId:'so123',watchId:'so123',
      owner:{type:'channel',id:345,name:'sample'}});
    assert.strictEqual(channel.uploaderUserId,'');
    assert.strictEqual(channel.uploaderChannelId,'345');
    assert.strictEqual(api.resolveUrl('https://example.com/{uploaderChannelId}',channel).url,
      'https://example.com/345');
  });
  it('drops bad restored rows while retaining valid neighbors', () => {
    const api = setup();
    const filtered = api.getLinks([sample,null,
      {id:'bad',label:'x',url:'javascript:alert(1)'},
      {id:'good',label:'safe',url:'https://example.com/static'}]);
    assert.deepStrictEqual(Array.from(filtered, x => x.id),['nico-test','good']);
  });
  it('registers safe metadata actions, notifies both menus and unregisters', () => {
    const api = setup();
    const changes = [];
    const off = api.onChange(() => changes.push('change'));
    const invoked = [];
    const unregister = api.register({
      id:'copy-watch',label:'コピー',action:ctx=>invoked.push({...ctx}),
      available:ctx=>!!ctx.videoId
    });
    assert.strictEqual(api.getActions({videoId:''})[0].enabled,false);
    assert.strictEqual(api.invoke('copy-watch',{videoId:''}),false);
    assert.strictEqual(api.getActions({videoId:'sm9'})[0].enabled,true);
    assert.strictEqual(api.invoke('copy-watch',{videoId:'sm9'}),true);
    assert.deepStrictEqual(invoked.map(x=>x.videoId),['sm9']);
    assert.throws(()=>api.register({id:'copy-watch',label:'duplicate',action() {}}));
    unregister();
    assert.strictEqual(api.getActions({videoId:'sm9'}).length,0);
    assert.deepStrictEqual(changes,['change','change']);
    off();
  });
  it('isolates throwing / rejected custom callbacks without breaking other actions', async () => {
    const api = setup();
    api.register({id:'throwing',label:'Bad',action(){throw new Error('test')}});
    api.register({id:'rejected',label:'Bad promise',
      action(){return Promise.reject(new Error('test'));}});
    assert.strictEqual(api.invoke('throwing',{}),false);
    assert.strictEqual(api.invoke('rejected',{}),true);
    await new Promise(resolve=>setImmediate(resolve));
  });
});
