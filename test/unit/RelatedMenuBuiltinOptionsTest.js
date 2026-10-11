'use strict';
const assert=require('assert');
const {createContext,loadClass}=require('../helpers/extractSource');
const Order=loadClass('src/RelatedMenuOrder.js','RelatedMenuOrder',createContext({URL}));

describe('Task396 builtin menu options and copy formats',()=>{
  it('shares canonical shortcut IDs without introducing shadow KEY settings',()=>{
    assert.strictEqual(Object.keys(Order.SHORTCUT_ACTION_IDS).length,7);
    assert.strictEqual(Order.SHORTCUT_ACTION_IDS.official,'OPEN_GINZA');
    assert.strictEqual(Order.SHORTCUT_ACTION_IDS.original,'OPEN_ORIGINAL_VIDEO');
    assert.strictEqual(Order.SHORTCUT_ACTION_IDS['copy-url'],'COPY_WATCH_URL');
  });
  it('accepts safe built-in overrides while keeping defaults sparse',()=>{
    assert.strictEqual(Order.validateOptions({}),true);
    const o={official:{label:'公式',openMode:'new-window',popupWidth:760,popupHeight:650,
        includePosition:false},
      twitter:{urlTemplate:'https://example.com/search?q={videoId}&t={currentTime}'},
      'copy-url':{copyFormat:'id'}};
    assert.strictEqual(Order.validateOptions(o),true);
    assert.strictEqual(Order.getOption(o,'copy-url').copyFormat,'id');
    assert.deepStrictEqual(Object.keys(Order.getOption({},'copy-url')),[]);
  });
  it('rejects unknown IDs, unsafe URL schemes, unknown variables and invalid window sizes',()=>{
    for(const options of [null,[],{'__proto__.foo':{}},
      {official:{copyFormat:'id'}},{'copy-url':{copyFormat:'random'}},
      {official:{openMode:'new-window',popupWidth:20}},
      {ad:{openMode:'stealth'}},{twitter:{urlTemplate:'javascript:alert(1)'}},
      {tree:{urlTemplate:'https://example.com/{cookie}'}},
      {twitter:{urlTemplate:'https://name:password@example.com/path'}},
      {official:{urlTemplate:'https://example.com'}},
      {unknown:{label:'x'}},{twitter:{label:'<'.repeat(81)}}]){
      if(Object.keys(options||{}).length===0 && options && !Array.isArray(options)){continue;}
      assert.strictEqual(Order.validateOptions(options),false,JSON.stringify(options));
    }
  });
  it('copies only the video ID when requested, otherwise preserves URL and formats',()=>{
    const context={videoId:'sm9',watchId:'sm9',videoTitle:'Example',currentTime:'85',
      videoUrl:'https://www.nicovideo.jp/watch/sm9'};
    assert.strictEqual(Order.formatCopy('id',context),'sm9');
    assert.strictEqual(Order.formatCopy('url',context),'https://www.nicovideo.jp/watch/sm9');
    assert.strictEqual(Order.formatCopy('position',context),
      'https://www.nicovideo.jp/watch/sm9?from=85');
    assert.strictEqual(Order.formatCopy('title-url',context),
      'Example\nhttps://www.nicovideo.jp/watch/sm9');
    assert.strictEqual(Order.formatCopy('markdown',context),
      '[Example](https://www.nicovideo.jp/watch/sm9)');
  });
});
