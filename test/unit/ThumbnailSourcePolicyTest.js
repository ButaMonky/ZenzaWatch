'use strict';
const assert=require('assert');
const {extract,createContext,run,read}=require('../helpers/extractSource');
const SOURCE='packages/lib/src/nico/ThumbnailSourcePolicy.js';
function policy(){
  const ctx=createContext({URL});
  run('const ThumbnailSourcePolicy='+extract(SOURCE,'ThumbnailSourcePolicy','var')+
    ';this.api=ThumbnailSourcePolicy;',ctx);
  return ctx.api;
}
const direct='https://img.cdn.nimg.jp/s/nicovideo/thumbnails/46962870/46962870.original/r1280x720l?key=opaque';
const player='https://img.cdn.nimg.jp/s/nicovideo/thumbnails/46962870/46962870.original/a960x540l?key=opaque';
const composed='https://goptim.video.nimg.jp/thumbnail/1280x720?i=46949237&s=blur&key=opaque';
describe('Task952 shared thumbnail source policy',()=>{
  it('prefers clean original OGP for the studied direct CDN case',()=>{
    const api=policy();
    assert.deepStrictEqual(Array.from(api.select({ogp:direct,player},['https://cdn.example/small'],{mode:'smart'})),
      [direct,player,'https://cdn.example/small',null]);
  });
  it('skips baked-in goptim preview for smart but preserves the old OGP-first mode',()=>{
    const api=policy();
    assert.deepStrictEqual(Array.from(api.select({ogp:composed,player},[],{mode:'smart'})),
      [null,player,null]);
    assert.deepStrictEqual(Array.from(api.select({ogp:composed,player},[],{mode:'legacy'})),
      [composed,player]);
  });
  it('keeps other unknown OGP only when the caller wants a last-chance fallback',()=>{
    const api=policy();
    const unknown='https://other.cdn.example/image?r=1&key=opaque';
    const a=api.select({ogp:unknown,player},['https://cdn.example/small'],{mode:'smart'});
    assert.deepStrictEqual(Array.from(a),[null,player,'https://cdn.example/small',null]);
    const b=api.select({ogp:unknown,player},['https://cdn.example/small'],
      {mode:'smart',includeUnknownOgp:true});
    assert.deepStrictEqual(Array.from(b),[null,player,'https://cdn.example/small',unknown]);
  });
  it('only trusts HTTPS img.cdn.nimg.jp; misleading domains and schemes stay untrusted',()=>{
    const api=policy();
    for(const value of [
      'https://img.cdn.nimg.jp.evil.example/a',
      'https://evil.example/?redirect=img.cdn.nimg.jp',
      'http://img.cdn.nimg.jp/a',
      'javascript:alert(1)',
      'data:text/html,evil',
      {}
    ]){assert.strictEqual(api.isDirectOriginalOgp(value),false);}
    assert.strictEqual(api.isDirectOriginalOgp(direct),true);
    assert.strictEqual(api.isKnownCompositedOgp(composed),true);
    assert.strictEqual(api.isKnownCompositedOgp('https://goptim.video.nimg.jp.evil.example/a'),false);
  });
  it('has no fetch/DOM/cache side effects and never edits signed URLs',()=>{
    const src=read(SOURCE);
    assert(!/fetch\s*\(|XMLHttpRequest|\.createElement\s*\(/.test(src));
    const api=policy();
    assert.strictEqual(api.select({ogp:direct,player},[],{mode:'smart'})[0],direct);
  });
});
