'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const crypto = require('crypto');
const {extract, createContext, run} = require('../helpers/extractSource');
const rel = 'packages/zenza/src/pocket/PocketThumbnail.js';

function setup() {
  const c=createContext();
  run('const ThumbnailSourcePolicy='+extract('packages/lib/src/nico/ThumbnailSourcePolicy.js','ThumbnailSourcePolicy','var')+';',c);
  run('const PocketThumbnail='+extract(rel,'PocketThumbnail','var')+
    ';this.pocket=PocketThumbnail;',c);
  return c.pocket;
}
const payload=thumb=>({data:{response:{video:{thumbnail:thumb}}}});
const flush=async()=>{for(let i=0;i<6;i++) await Promise.resolve();};

describe('Task713 TypeScript MylistPocket thumbnail helper',()=>{
  it('prefers clean original 1280px before player 960px and keeps signed query unchanged',()=>{
    const api=setup();
    const signed='https://img.cdn.nimg.jp/s/nicovideo/thumbnails/46923344/46923344.original/r1280x720l?key=AbCdXYZ';
    assert.deepStrictEqual([...api.watchUrls(payload({url:'https://cdn.example/small',
      ogp:signed,player:'https://cdn.example/960'}))],
      [signed,'https://cdn.example/960','https://cdn.example/small']);
  });
  it('accepts v4 watch response and gracefully handles missing data',()=>{
    const api=setup();
    const v4={data:{response:{$watchV4:{data:{video:{thumbnail:{
      ogp:'https://cdn.example/high',normal:'https://cdn.example/normal'}}}}}}};
    assert.deepStrictEqual([...api.watchUrls(v4)],
      ['https://cdn.example/normal','https://cdn.example/high']);
    assert.deepStrictEqual([...api.watchUrls({errorCode:'NOT_FOUND'})],[]);
    assert.deepStrictEqual([...api.watchUrls(null)],[]);
  });
  it('filters the proven goptim play-overlay variant while retaining signed player 960x540',()=>{
    const api=setup();
    const url='https://goptim.video.nimg.jp/thumbnail/1280x720?b=p&bs=54&i=46949237.64709125&s=blur&key=example';
    const player='https://img.cdn.nimg.jp/s/nicovideo/thumbnails/46949237/46949237.64709125.original/a960x540l?key=example';
    assert.deepStrictEqual([...api.watchUrls(payload({
      ogp:url,player,large:'https://nicovideo.cdn.nimg.jp/thumbnails/46949237/46949237.64709125.L'
    }))],[player,'https://nicovideo.cdn.nimg.jp/thumbnails/46949237/46949237.64709125.L']);
  });
  it('rejects unsafe schemes, duplicates, and invalid metadata',()=>{
    const api=setup();
    assert.deepStrictEqual([...api.normalize(['javascript:alert(1)','data:image/x','https://a/a',
      'https://a/a',{},'',null,'http://a/b'])],['https://a/a','https://a/b']);
  });
  it('uses legacy .L with original thumbnail fallback and never changes signed links',()=>{
    const api=setup();
    assert.deepStrictEqual([...api.legacyUrls('https://nicovideo.cdn.nimg.jp/thumbnails/3/3.M',true)],
      ['https://nicovideo.cdn.nimg.jp/thumbnails/3/3.L',
       'https://nicovideo.cdn.nimg.jp/thumbnails/3/3.M']);
    const signed='https://img.cdn.nimg.jp/file?r=2&key=secret';
    assert.deepStrictEqual([...api.legacyUrls(signed,true)],[signed]);
  });
  it('tries image candidates sequentially and stops on exhaustion',()=>{
    const api=setup();
    const img={src:'',onerror:null};
    api.install(img,['https://cdn.example/high','https://cdn.example/low']);
    assert.strictEqual(img.src,'https://cdn.example/high');
    img.onerror();
    assert.strictEqual(img.src,'https://cdn.example/low');
    img.onerror();
    assert.strictEqual(img.onerror,null);
  });
  it('an obsolete image failure cannot clobber a replacement preview',()=>{
    const api=setup();
    const img={src:'',onerror:null};
    api.install(img,['https://cdn.example/old','https://cdn.example/old-fallback']);
    const stale=img.onerror;
    api.install(img,['https://cdn.example/new']);
    stale();
    assert.strictEqual(img.src,'https://cdn.example/new');
  });
  it('does not apply a result when the information popup is stale',()=>{
    const api=setup();
    const img={src:'https://cdn.example/previous',onerror:null};
    api.install(img,['https://cdn.example/new'],()=>false);
    assert.strictEqual(img.src,'https://cdn.example/previous');
  });
  it('requests detailed thumbnails only on the official www host',async()=>{
    const api=setup();
    let count=0;
    const fetcher=()=>{count++;return Promise.resolve({ok:true,json:()=>Promise.resolve({})});};
    assert.deepStrictEqual([...await api.getHighQuality('sm9',fetcher,'google.com')],[]);
    assert.deepStrictEqual([...await api.getHighQuality('../x',fetcher,'www.nicovideo.jp')],[]);
    assert.strictEqual(count,0);
  });
  it('deduplicates concurrent watch requests and memoizes valid URLs',async()=>{
    const api=setup();
    let count=0, finish;
    const fetcher=()=>{count++;return new Promise(resolve=>{finish=resolve;});};
    const pending1=api.getHighQuality('sm48192121',fetcher,'www.nicovideo.jp');
    const pending2=api.getHighQuality('sm48192121',fetcher,'www.nicovideo.jp');
    assert.strictEqual(count,1);
    finish({ok:true,json:()=>Promise.resolve(payload({ogp:'https://cdn.example/HQ'}))});
    const a=await pending1,b=await pending2;
    assert.deepStrictEqual([...a],['https://cdn.example/HQ']);
    assert.deepStrictEqual([...b],['https://cdn.example/HQ']);
    assert.deepStrictEqual([...await api.getHighQuality('sm48192121',fetcher,'www.nicovideo.jp')],
      ['https://cdn.example/HQ']);
    assert.strictEqual(count,1);
  });
  it('preserves legacy image if watch API fails or rejects',async()=>{
    const api=setup();
    let count=0;
    const fail=()=>{count++;return Promise.reject(new Error('network denied'));};
    assert.deepStrictEqual([...await api.getHighQuality('sm9000001',fail,'www.nicovideo.jp')],[]);
    assert.strictEqual(count,1);
    assert.deepStrictEqual([...await api.getHighQuality('sm9000001',fail,'www.nicovideo.jp')],[]);
    assert.strictEqual(count,1);
  });
  it('is strict TypeScript-generated JavaScript, not a manually edited copy',()=>{
    const root=path.resolve(__dirname,'../..');
    const runtime=fs.readFileSync(path.join(root,rel),'utf8');
    const source=fs.readFileSync(
      path.join(root,'packages/zenza/src/pocket/PocketThumbnail.ts'),'utf8');
    assert(runtime.startsWith('// GENERATED FROM packages/zenza/src/pocket/PocketThumbnail.ts'));
    const sha=crypto.createHash('sha256').update(source,'utf8').digest('hex');
    assert(runtime.includes('// SOURCE_SHA256 '+sha), 'TS source fingerprint stale');
    const emitted=path.join(root,'tools/typescript-stage1/.generated/pocket/PocketThumbnail.js');
    const checker=path.join(root,'tools/typescript-stage1/scripts/sync-pocket-thumbnail.mjs');
    // The public repository publishes the TS source and runtime, but excludes
    // private generator tooling. The source SHA remains verifiable there.
    if(fs.existsSync(emitted)&&fs.existsSync(checker)){
      cp.execFileSync(process.execPath,[checker,'--check'],
        {cwd:root,stdio:['ignore','pipe','pipe']});
    }
  });
});
