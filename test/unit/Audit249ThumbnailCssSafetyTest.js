'use strict';
const assert=require('assert');
const {createContext,loadClass}=require('../helpers/extractSource');
function inspect(file,url){
  const html=(strings,...values)=>({strings:Array.from(strings),values});
  const ctx=createContext({dll:{lit:{html},directives:{classMap:x=>x}},
    textUtil:{secToTime:()=> '2:00'}});
  const View=loadClass(file,'VideoListItemView',ctx);
  View.map=new WeakMap();
  const item={title:'Example',count:{view:1,comment:2,mylist:3},itemId:'one',
    watchId:'sm123',timestamp:1,duration:120,postedAt:'2026-01-01T00:00:00Z',
    thumbnail:url,isLazy:false};
  const result=View.build(item);
  const all=[];
  const visit=node=>{
    if(!node||typeof node!=='object')return;
    if(Array.isArray(node.strings)){
      all.push(node);
      node.values.forEach(visit);
    }
  };
  visit(result);
  const panel=all.find(t=>t.strings.some(s=>s.includes('thumbnailContainer')&&s.includes('style=')));
  assert(panel,'must render actual thumbnail view');
  const at=panel.strings.findIndex(s=>s.includes('thumbnailContainer')&&s.includes('style='));
  return {style:panel.values[at],dataSrc:panel.values[at+2]};
}
describe('Audit #249: imported thumbnail_url cannot inject CSS declarations',()=>{
  for(const path of ['packages/zenza/src/Playlist/VideoListItemView.js','dist/ZenzaWatch-dev.user.js']){
    it(path+' accepts ordinary HTTPS and HTTP thumbnail URLs',()=>{
      const url='https://nicovideo.cdn.nimg.jp/thumbnails/123/123.7?x=1&y=2';
      const value=inspect(path,url);
      assert.strictEqual(value.style,'background-image: url("'+url+'")');
      assert.strictEqual(value.dataSrc,url);
      assert.match(inspect(path,'http://img.invalid/ok.jpg').style,/^background-image: url/);
    });
    it(path+' rejects CSS delimiters, javascript URLs, and oversize URLs',()=>{
      for(const unsafe of [
        'x); opacity:0; pointer-events:none; background-image:url(https://invalid.test/a)',
        'https://bad.invalid/a);opacity:0',
        'https://bad.invalid/a" color:red',
        'javascript:alert(1)','data:image/svg+xml,abc',
        'https://bad.invalid/a'+ 'x'.repeat(3000)
      ]){
        const result=inspect(path,unsafe);
        assert.strictEqual(result.style,'',unsafe.slice(0,35));
        assert.strictEqual(result.dataSrc,'');
      }
    });
  }
});
