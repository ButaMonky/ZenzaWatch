// Task645: parseThumbInfo parity — getthumbinfo XML to thumbInfo, failures,
// passthrough, and that toString() stays a self-contained function (MylistPocket).
import test from 'node:test';
import assert from 'node:assert/strict';
import {createContext,runInContext} from 'node:vm';
import {createRequire} from 'node:module';
import {NICO_API_BY_NAME} from '../scripts/nico-api-registry.mjs';
import {emitNico,read,loadLegacy,snapshot,settle,legacySection} from './nico-api-harness.mjs';

emitNico();
const require=createRequire(import.meta.url);
const {JSDOM}=require('jsdom');
const {DOMParser}=new JSDOM('').window;
const spec=NICO_API_BY_NAME.parseThumbInfo;
const before=read(spec.fixture),after=read(spec.runtime);

const thumb=(inner,status='ok')=>`<?xml version="1.0" encoding="UTF-8"?>
<nicovideo_thumb_response status="${status}">${inner}</nicovideo_thumb_response>`;
const video=({id='sm9',watch='sm9',thumbUrl='http://nicovideo.cdn.nimg.jp/thumbnails/9/9',length='5:20',owner=''}={})=>thumb(`
  <thumb>
    <video_id>${id}</video_id><title>題名 &amp; title</title><description>説明</description>
    <thumbnail_url>${thumbUrl}</thumbnail_url><first_retrieve>2007-03-06T00:33:00+09:00</first_retrieve>
    ${length===null?'':`<length>${length}</length>`}<movie_type>flv</movie_type>
    <view_counter>18135121</view_counter><comment_num>4843412</comment_num><mylist_counter>176842</mylist_counter>
    <last_res_body>悪霊退散</last_res_body><watch_url>https://www.nicovideo.jp/watch/${watch}</watch_url>
    <tags domain="jp"><tag lock="1">陰陽師</tag><tag category="1" lock="1">音楽</tag><tag>ゲーム</tag></tags>
    ${owner}
  </thumb>`);
const CASES={
  user:video({owner:'<user_id>4</user_id><user_nickname>中の</user_nickname><user_icon_url>https://icon/4.jpg</user_icon_url>'}),
  userBlank:video({owner:'<user_id>5</user_id><user_nickname></user_nickname>'}),
  userEmptyId:video({owner:'<user_id></user_id>'}),
  channel:video({id:'so123',watch:'1340000000',owner:'<ch_id>2632720</ch_id><ch_name>ch</ch_name><ch_icon_url>https://ch/icon</ch_icon_url>'}),
  channelBlank:video({id:'so9',watch:'so9',owner:'<ch_id>7</ch_id>'}),
  both:video({owner:'<user_id>4</user_id><ch_id>8</ch_id>'}),
  originalId:video({id:'sm100',watch:'1234567',thumbUrl:'https://already/https'}),
  noOwner:video({length:'0:07'}),
  longLength:video({length:'125:59'}),
  deleted:thumb('<error><code>DELETED</code><description>deleted</description></error>','fail'),
  failNoDetail:thumb('','fail'),
  wrongRoot:'<other status="ok"/>',
  emptyString:''
};
// Task647 (PT-MISSING-001): these legacy crashes are now failure objects (tested below).
const MISSING={
  missingLength:video({length:null}),
  missingWatchUrl:video().replace(/<watch_url>.*?<\/watch_url>/,''),
  missingVideoId:video().replace(/<video_id>.*?<\/video_id>/,''),
  emptyVideoId:video({id:''}),
  missingThumbnail:video().replace(/<thumbnail_url>.*?<\/thumbnail_url>/,'')
};

function load(code){return loadLegacy(code,'parseThumbInfo',{DOMParser});}
async function compare(label,input){
  const A=load(before),B=load(after);
  const ra=await settle(()=>A(input)),rb=await settle(()=>B(input));
  assert.deepEqual(snapshot(rb),snapshot(ra),label);
  return ra;
}

test('XML responses parse identically',async()=>{
  for(const [label,xml] of Object.entries(CASES))await compare(label,xml);
  const sm9=await compare('sm9 spot check',CASES.user);
  assert.equal(sm9.value.duration,320);
  assert.equal(sm9.value.thumbnail,'https://nicovideo.cdn.nimg.jp/thumbnails/9/9');
  assert.equal(sm9.value.owner.name,'中の');
});

test('Task647 PT-MISSING-001: ok responses missing required elements fail instead of throwing',async()=>{
  const fail={status:'fail',code:'INVALID_RESPONSE',message:'thumbinfo response is missing required fields'};
  for(const [label,xml] of Object.entries(MISSING)){
    const legacy=await settle(()=>load(before)(xml));
    const fixed=await settle(()=>load(after)(xml));
    if(label!=='emptyVideoId')assert.equal(legacy.ok,false,label+': legacy threw');
    assert.deepEqual(snapshot(fixed),snapshot({ok:true,value:fail}),label);
  }
  // The stringified function (MylistPocket) has the same guard.
  const context=createContext({DOMParser});
  runInContext(`${load(after).toString()}\nglobalThis.__r=parseThumbInfo(${JSON.stringify(MISSING.missingLength)});`,context);
  assert.deepEqual(snapshot(context.__r),fail);
});

test('non-string input is returned unchanged',async()=>{
  const obj={status:'ok',v:'sm9'};
  for(const input of [obj,null,undefined,42,{status:'fail'}]){
    const A=load(before),B=load(after);
    assert.equal(B(input),input);
    assert.equal(A(input),input);
  }
});

test('toString() is a self-contained function declaration (MylistPocket injection)',async()=>{
  const B=load(after);
  const source=B.toString();
  assert.match(source,/^function parseThumbInfo\(xmlText\) \{/);
  // Evaluate the injected text alone, as MylistPocket does, with only DOMParser available.
  const context=createContext({DOMParser});
  runInContext(`${source}\nglobalThis.__r=parseThumbInfo(${JSON.stringify(CASES.channel)});`,context);
  assert.deepEqual(snapshot(context.__r),snapshot(load(before)(CASES.channel)));
  assert.equal(legacySection(after).trim().split('\n').filter(l=>/^\S/.test(l)&&!/^(\/\*\*| \*|\/\/)/.test(l)).length,2);
});
