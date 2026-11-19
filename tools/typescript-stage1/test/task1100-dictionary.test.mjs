import test from 'node:test';
import assert from 'node:assert/strict';
import {loadSource} from './nonvisual-audit-source-harness.mjs';

test('dictionary reports broken batch fields without recording tag names or caching an unknown result',async () => {
  const events=[], cache=new Map(), warnings=[];
  const diag=loadSource('nico-src/RequestDiagnostics.ts','RequestDiagnostics');
  diag.setSink(e=>events.push(e));
  const name='fixture-tag';
  const replies=[{}, [{title:name}], [{request_title:name}], [], new SyntaxError(name)];
  const loader=loadSource('nico-src/NicodicArticleLoader.ts','NicodicArticleLoader',{
    RequestDiagnostics:diag, sessionStorage:{}, URLSearchParams, AbortController, setTimeout, clearTimeout,
    CacheStorage:class {getItem(k){return cache.get(k)} setItem(k,v){cache.set(k,v)}},
    window:{console:{warn:(...args)=>warnings.push(args)}},
    fetch:async()=>({ok:true,status:200,json:async()=>{
      const reply=replies.shift(); if(reply instanceof Error) throw reply; return reply;
    }})
  });
  for(const field of ['articles','articles[].request_title','articles[].title']) {
    assert.equal(await loader.exists(name),null);
    assert.equal(events.at(-1).missing,field);
    assert.equal(events.at(-1).statusCode,200);
    assert.equal(cache.size,0);
  }
  assert.equal(await loader.exists(name),false);
  assert.equal(events.at(-1).outcome,'recovered');
  assert.equal(cache.size,1);
  await loader.exists('other-fixture');
  assert.equal(events.at(-1).missing,'response.json');
  assert(!JSON.stringify(events).includes(name));
  assert(!warnings.flat().some(value=>String(value).includes(name)));
});
