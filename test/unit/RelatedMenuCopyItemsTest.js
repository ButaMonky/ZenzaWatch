'use strict';
const assert=require('assert');
const {createContext,loadClass}=require('../helpers/extractSource');
const load=()=>loadClass('packages/zenza/src/menu/RelatedMenuActions.js','RelatedMenuActions',createContext({URL}));
const copy=(id='copy-id',text='{videoId}')=>({id,label:'Copy',kind:'copy',copyTemplate:text,enabled:true});
const ctx={videoId:'sm9',watchId:'sm9',videoUrl:'https://www.nicovideo.jp/watch/sm9',
  videoTitle:'日本語 & <test>',currentTime:'85'};
describe('Task398 custom copy data and execution',()=>{
  it('accepts copy entries without requiring URL and preserves legacy link shape',()=>{
    const a=load(),old={id:'old',label:'Old',url:'https://example.org/{videoId}',enabled:true,openInNewTab:false};
    const result=a.validateLinks([old,copy()]);
    assert.strictEqual(result.valid,true);
    assert.deepStrictEqual(JSON.parse(JSON.stringify(result.links)),[old,copy()]);
    assert.strictEqual(result.links[1].url,undefined);
  });
  it('rejects unknown copy variables, malformed braces, empty text and unknown item kinds',()=>{
    const a=load();
    for(const item of [copy('x','{cookie}'),copy('x','{videoId'),copy('x',''),
      copy('x','a'.repeat(4097)),{...copy(),kind:'run-script'}]){
      assert.strictEqual(a.validateLinks([item]).valid,false,JSON.stringify(item));
    }
  });
  it('substitutes copy variables as literal text without URL escaping or HTML interpretation',()=>{
    const a=load();
    assert.strictEqual(typeof a.resolveCopy,'function');
    assert.strictEqual(a.resolveCopy('{videoTitle}\n{videoUrl}\nID={videoId}',ctx).text,
      '日本語 & <test>\nhttps://www.nicovideo.jp/watch/sm9\nID=sm9');
    assert.strictEqual(a.resolveCopy('{uploaderName}',ctx).text,null);
  });
  it('aggregates matching copies once before navigation and opens only link entries',()=>{
    const a=load(),out=[];
    const items=[copy(),copy('title','{videoTitle}'),copy('missing','{uploaderName}'),
      {...copy('disabled'),enabled:false},
      {id:'open',label:'Open',url:'https://example.org/{videoId}',openInNewTab:false}];
    const n=a.openShortcutsByIds(items,items.map(x=>x.id),ctx,
      (url,target)=>out.push(['open',url,target]),text=>out.push(['copy',text]));
    assert.strictEqual(n,3);
    assert.deepStrictEqual(out,[['copy','sm9\n日本語 & <test>'],['open','https://example.org/sm9','_self']]);
  });
  it('never turns a copy template that resembles a URL into a navigation',()=>{
    const a=load(),opened=[],copied=[];
    a.openShortcutsByIds([copy('x','https://example.org/{videoId}')],['x'],ctx,
      (...args)=>opened.push(args),text=>copied.push(text));
    assert.deepStrictEqual(opened,[]);
    assert.deepStrictEqual(copied,['https://example.org/sm9']);
  });
});
