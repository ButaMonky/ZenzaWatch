// Task465: DOM-backed parity against the untouched NicoRssLoader fixture.
import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {NICO_API_BY_NAME} from '../scripts/nico-api-registry.mjs';
import {emitNico,read,loadLegacy,settle,snapshot} from './nico-api-harness.mjs';

emitNico();
const spec=NICO_API_BY_NAME.NicoRssLoader;
const before=read(spec.fixture),after=read(spec.runtime);
const DOMParser=new JSDOM('').window.DOMParser;

function item({id='sm9',title='test',length='01:23',date='12：34：56',
  guid='urn:video,2024-02-03:ok',image='https://example.invalid/123.45.jpg',counts=true}={}){
  const stats=counts?
    '<span class="nico-info-total-res">1,234</span><span class="nico-info-total-mylist">23</span><span class="nico-info-total-view">12,345</span>':'';
  const html=`<span class="nico-info-length">${length}</span>`+
    `<span class="nico-info-date">${date}</span><div class="nico-thumbnail"><img src="${image}"></div>`+
    `<div class="nico-description">description</div>${stats}`;
  return `<item><link>https://www.nicovideo.jp/watch/${id}</link><guid>${guid}</guid>`+
    `<title>${title}</title><description><![CDATA[${html}]]></description></item>`;
}
const rss=items=>`<?xml version="1.0"?><rss><channel>${items.join('')}</channel></rss>`;

function environment(body,flags={}) {
  const calls=[];
  const netUtil={fetch:url=>{
    calls.push(url);
    if(flags.networkError)return Promise.reject(Error('offline'));
    return Promise.resolve({text:()=>flags.textError?Promise.reject(SyntaxError('invalid text')):Promise.resolve(body)});
  }};
  const textUtil={dateToString:date=>date.toISOString()};
  return {calls,globals:{netUtil,textUtil,DOMParser,Promise,Error,SyntaxError}};
}

async function parity(name,method,arg,body,flags={}) {
  const left=environment(body,flags),right=environment(body,flags);
  const oldApi=loadLegacy(before,'NicoRssLoader',left.globals);
  const newApi=loadLegacy(after,'NicoRssLoader',right.globals);
  const oldResult=await settle(()=>oldApi[method](arg));
  const newResult=await settle(()=>newApi[method](arg));
  assert.deepEqual(snapshot(newResult),snapshot(oldResult),name+' result');
  assert.deepEqual(right.calls,left.calls,name+' network calls');
  return {result:newResult,calls:right.calls};
}

test('NicoRssLoader: empty RSS, standard parse and optional counters',async()=>{
  const empty=await parity('empty','load','https://example.invalid/rss',rss([]));
  assert.deepEqual(snapshot(empty.result.value),[]);
  const parsed=await parity('items','load','https://example.invalid/rss',
    rss([item({id:'12345'}),item({id:'sm123',counts:false})]));
  assert.equal(parsed.result.value.length,2);
  assert.equal(parsed.result.value[0].id,'so123');
  assert.equal(parsed.result.value[0].uniq_id,'12345');
  assert.equal(parsed.result.value[0].length_seconds,83);
  assert.equal(parsed.result.value[0].num_res,1234);
  assert.equal(parsed.result.value[0].mylist_counter,23);
  assert.equal(parsed.result.value[0].view_counter,12345);
  assert.equal(parsed.result.value[1].num_res,undefined);
});

test('NicoRssLoader: ranking default and encoded tag URLs',async()=>{
  const normal=await parity('default ranking','loadRanking',{},rss([]));
  assert.equal(normal.calls[0],'https://www.nicovideo.jp/ranking/genre/all?term=hour&rss=2.0');
  const tagged=await parity('ranking tag','loadRanking',{genre:'music',term:'24h',tag:'邦楽 &歌'},rss([item()]));
  assert.equal(tagged.calls[0],
    'https://www.nicovideo.jp/ranking/genre/music?term=24h&tag='+encodeURIComponent('邦楽 &歌')+'&rss=2.0');
});

test('NicoRssLoader: data corruption and failures preserve legacy behavior',async()=>{
  await parity('bad GUID','load','https://example.invalid/rss',rss([item({guid:'invalid'})]));
  await parity('bad time','load','https://example.invalid/rss',rss([item({date:'unknown'})]));
  await parity('invalid XML','load','https://example.invalid/rss','<bad xml');
  await parity('network reject','load','https://example.invalid/rss',rss([]),{networkError:true});
  await parity('text reject','load','https://example.invalid/rss',rss([]),{textError:true});
  await parity('null ranking arguments','loadRanking',null,rss([]));
});
