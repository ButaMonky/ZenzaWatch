import {JSDOM} from 'jsdom';
import test from 'node:test';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {loadSource} from './nonvisual-audit-source-harness.mjs';

const diagnostics = () => loadSource('nico-src/RequestDiagnostics.ts', 'RequestDiagnostics');
const catalog = JSON.parse(readFileSync(new URL('../../../docs/research/api_catalog.json', import.meta.url)));
const secret = randomUUID();
const failing = () => { throw Error('Diagnostic must not read response body'); };

test('every catalog HTTP operation can name its registered route without copying user data', () => {
  const diag = diagnostics();
  const events = [];
  diag.setSink(e => events.push(e));
  for (const item of catalog.entries.filter(e => e.id !== 'video.owner.icon-cdn')) {
    const url = item.url.replace('{nvComment.server}','https://public.nvcomment.nicovideo.jp').replace(/{[^}]+}/g,secret);
    diag.begin('nico-api',item.id,'response',undefined,undefined,{url,method:item.method}).failure({kind:'network'});
    const event = events.at(-1);
    assert.equal(event.method,item.method,item.id);
    const path = diag.pathFor(event.endpoint);
    assert.equal(path?.replace(/{[^}]+}/g,'{}'),new URL(item.url.replace('{nvComment.server}','https://public.nvcomment.nicovideo.jp')).pathname.replace(/%7B/g,'{').replace(/%7D/g,'}').replace(/{[^}]+}/g,'{}').replace(/\/$/,''),item.id);
    assert(!JSON.stringify(event).includes(secret));
  }
});
test('the observed HTTP declaration and body prefix survive JSON failures and service rejection', () => {
  const diag=diagnostics(), events=[];
  diag.setSink(e=>events.push(e));
  const url='https://nvapi.nicovideo.jp/v1/recommend?recipe='+secret;
  const response={status:200,url,headers:{get:()=> 'application/json; private='+secret},text:failing,clone:failing};
  for (const [text,format] of [['  ','empty'],['<!doctype html><main>'+secret,'html'],['{"private"','json-like'],[undefined,'invalid-json']]) {
    diag.begin('recommend',secret,'response',undefined,undefined,{url,method:'GET'}).failure(
      diag.readFailure(response,{name:'SyntaxError'},text));
    const event=events.at(-1);
    assert.equal(event.responseType,'json');
    assert.equal(event.bodyFormat,format);
    assert.equal(event.endpoint,'recommend');
    assert.equal(event.reason,'schema');
  }
  diag.begin('recommend',secret,'response').failure(diag.responseFailure(response,{status:429,errorCode:secret}));
  assert.equal(events.at(-1).reason,'service');
  assert.equal(events.at(-1).responseType,'json');
  assert.equal(events.at(-1).endpoint,'recommend');
  diag.startRequest(url).failure(new TypeError('Failed to fetch'));
  assert.equal(events.at(-1).reason,'network');
  assert(!JSON.stringify(events).includes(secret));
});
test('copy projects a normalized HTTP failure, timing and actionable follow-up from safe evidence', async () => {
  const diag=diagnostics();
  const policy=loadSource('nico-src/NotificationJournalPolicy.ts','NotificationJournalPolicy',{RequestDiagnostics:diag});

  const now=Date.now(), details={operation:'recommend',reason:'http',phase:'response',endpoint:'recommend',method:'GET',
    responseType:'html',bodyFormat:'html',statusCode:503,count:2,elapsedMs:685,lastSuccessAt:now-4000};
  const record=policy.normalize({category:'network',source:'recommend',details,firstOccurredAt:now-1000,lastOccurredAt:now},
    {id:'fixture',timestamp:now});
  const dom=new JSDOM('<section class="activeTab"></section>');
  const journal={list:async()=>[record],subscribe:()=>()=>{},toDiagnosticEntry:e=>policy.toDiagnosticEntry(e)};
  const panel=loadSource('nico-src/NotificationHistoryPanel.ts','NotificationHistoryPanel',{RequestDiagnostics:diag,
    NotificationJournal:journal,document:dom.window.document,window:dom.window});
  const root=dom.window.document.querySelector('section');
  panel.mount(root);await new Promise(r=>setImmediate(r));
  root.querySelector('[data-entry-id]').click();
  root.querySelector('[data-history-action="copy"]').click();await new Promise(r=>setImmediate(r));
  const report=root.querySelector('textarea').value;dom.window.close();
  for (const fragment of ['GET /v1/recommend','HTTP状態　503','HTML','2回','685 ms','最終成功','最初の失敗','最後の失敗','次に確認すること']) {
    assert(report.includes(fragment),fragment);
  }
  const unsafe=policy.normalize({details:{...details,endpoint:secret,method:secret,responseType:secret,bodyFormat:secret,lastSuccessAt:secret}},
    {id:'fixture',timestamp:now});
  assert(!JSON.stringify(unsafe).includes(secret));
});
test('a failure remembers a successful attempt only for the same operation and scope', () => {
  const diag=diagnostics(), events=[];diag.setSink(e=>events.push(e));
  diag.begin('search','sample','response').success();
  diag.begin('search','different','response').failure({kind:'timeout'});
  assert.equal(events.at(-1).lastSuccessAt,undefined);
  diag.begin('search','sample','response').failure({kind:'timeout'});
  assert(Number.isSafeInteger(events.at(-1).lastSuccessAt));
});

test('optional NicoAd metadata distinguishes an absent envelope from a rejected/malformed one', () => {
  const diag=diagnostics(), events=[];
  diag.setSink(e=>events.push(e));
  const settle=(meta, missing, status=200)=>diag.begin('advertising','target','response').decoded({status},meta,missing,false);
  settle(undefined,undefined);
  assert.equal(events.length,0);
  settle({},undefined);
  assert.equal(events.at(-1)?.missing,'meta.status');
  settle(undefined,undefined);
  assert.equal(events.at(-1)?.outcome,'recovered');
  settle(undefined,'data.sponsors');
  assert.equal(events.at(-1)?.missing,'data.sponsors');
  settle({status:403},undefined);
  assert.equal(events.at(-1)?.reason,'permission');
  settle(undefined,undefined,503);
  assert.equal(events.at(-1)?.statusCode,503);
});
test('a handled Commons 404 is silent in the transport observer', () => {
  const diag=diagnostics(), events=[];
  diag.setSink(e=>events.push(e));
  diag.startRequest('https://public-api.commons.nicovideo.jp/v1/tree/sm9/relatives/parents').response({status:404});
  assert.equal(events.length,0);
});

test('a remote property cannot be stored as a missing field or mistaken for a repeated contract change', () => {
  const diag=diagnostics(), events=[];
  diag.setSink(e=>events.push(e));
  for (const [i,missing] of [secret,'data.items','data.totalCount'].entries()) {
    diag.begin('search','scope'+i,'response').failure({kind:'schema',missing});
  }
  assert.equal(events[0].missing,undefined);
  assert(!events.some(e=>e.reason==='spec-change'));
  assert(!JSON.stringify(events).includes(secret));
});
