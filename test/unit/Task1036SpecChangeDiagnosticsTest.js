'use strict';
// Task1036: ニコニコの仕様変更でエラーが出たとき、どこを直せばよいか分かる通知履歴。
const assert=require('assert'),fs=require('fs'),vm=require('vm');
const {stripTypeScriptTypes}=require('node:module');
const load=(file,name,extra={})=>{
 const source=stripTypeScriptTypes(fs.readFileSync('tools/typescript-stage1/nico-src/'+file,'utf8'))
  .replace(/^import .*$/gm,'').replace(/^export\s*\{[^}]*\};?\s*$/gm,'').replace(/^export type .*$/gm,'');
 const ctx=vm.createContext({URL,Date,Map,Set,WeakMap,Math,JSON,Number,String,Object,Array,...extra});
 vm.runInContext(source+';globalThis.out='+name+';',ctx);return ctx.out;
};
describe('Task1036 spec-change diagnostics',()=>{
 const harness=()=>{const diag=load('RequestDiagnostics.ts','RequestDiagnostics');const events=[];diag.setSink(e=>events.push(e));return {diag,events};};
 it('every failure names the source file to fix',()=>{
  const {diag,events}=harness();
  diag.begin('video-info','sm1','response').failure({status:503});
  assert.equal(events[0].module,'nico-src/VideoInfoLoader.ts');
 });
 it('a script error (the 2026-11 comment bug) is classified as script with the undefined path',()=>{
  const {diag,events}=harness();
  let error;try{const msgInfo={};const {videoId}=msgInfo.threadInfo;void videoId;}catch(e){error=e;}
  diag.begin('nicoru','1785930270','response').failure(error);
  assert.equal(events[0].reason,'script');assert.equal(events[0].errorName,'TypeError');
  assert.equal(events[0].missing,'msgInfo.threadInfo');assert.equal(events[0].module,'nico-src/ThreadLoader.ts');
 });
 it('schema failures carry the missing field name, never values',()=>{
  const {diag,events}=harness();
  diag.begin('comment-read','sm2','response').failure({kind:'schema',errorCode:'RESPONSE_SCHEMA',reason:'missing-thread-key'});
  diag.begin('video-info','sm3','response').failure({reason:'watch api',errorCode:'WATCH_SCHEMA',missing:'data.video.duration'});
  assert.equal(events[0].missing,'missing-thread-key');assert.equal(events[1].missing,'data.video.duration');
 });
 it('three different targets failing the same way within 30 minutes raise one spec-change suspicion',()=>{
  const {diag,events}=harness();
  for(const id of ['sm1','sm2'])diag.begin('video-info',id,'response').failure({reason:'watch api',errorCode:'WATCH_SCHEMA',missing:'data.player'});
  assert.ok(!events.some(e=>e.reason==='spec-change'),'2件ではまだ出さない');
  diag.begin('video-info','sm3','response').failure({reason:'watch api',errorCode:'WATCH_SCHEMA',missing:'data.player'});
  const spec=events.filter(e=>e.reason==='spec-change');
  assert.equal(spec.length,1);assert.equal(spec[0].distinctTargets,3);assert.equal(spec[0].module,'nico-src/VideoInfoLoader.ts');
  assert.equal(spec[0].missing,'data.player');assert.match(spec[0].message,/仕様変更の可能性/);
  diag.begin('video-info','sm4','response').failure({reason:'watch api',errorCode:'WATCH_SCHEMA'});
  assert.equal(events.filter(e=>e.reason==='spec-change').length,1,'同じ疑いは30分に1件まで');
 });
 it('the same target failing repeatedly is not a spec-change suspicion',()=>{
  const {diag,events}=harness();
  for(let i=0;i<5;i++)diag.begin('search','same','response').failure({kind:'schema'});
  assert.ok(!events.some(e=>e.reason==='spec-change'));
 });
 it('the journal keeps the new safe fields and groups them for separate on/off',()=>{
  const policy=load('NotificationJournalPolicy.ts','NotificationJournalPolicy');
  const entry=policy.normalize({level:'error',category:'network',message:'x',source:'video-info',
   details:{operation:'video-info',reason:'spec-change',module:'nico-src/VideoInfoLoader.ts',missing:'data.video.duration',
    where:'Ue.load@58012',distinctTargets:3,errorName:'TypeError',secret:'nope',missingUrl:'https://x/y'}},{id:'a',timestamp:1});
  assert.equal(entry.details.module,'nico-src/VideoInfoLoader.ts');assert.equal(entry.details.missing,'data.video.duration');
  assert.equal(entry.details.where,'Ue.load@58012');assert.equal(entry.details.distinctTargets,3);
  assert.equal(entry.details.secret,undefined);
  assert.equal(policy.recordingGroup(entry),'specChange');
  const script=policy.normalize({category:'system',message:'x',details:{operation:'script-error',reason:'script'}},{id:'b',timestamp:1});
  assert.equal(policy.recordingGroup(script),'scriptError');
  const nicoru=policy.normalize({category:'network',message:'x',details:{operation:'nicoru',reason:'script'}},{id:'c',timestamp:1});
  assert.equal(policy.recordingGroup(nicoru),'commentAction');
  const url=policy.normalize({message:'x',details:{missing:'https://evil.example/a?token=1'}},{id:'d',timestamp:1});
  assert.equal(url.details.missing,undefined,'URLは項目名として通さない');
 });
 it('settings expose the new toggles and retention with sensible defaults',()=>{
  const config=fs.readFileSync('tools/typescript-stage1/advanced-src/Config.ts','utf8');
  for(const key of ['record.specChange','record.scriptError','record.commentAction'])assert.ok(config.includes(`'notificationHistory.${key}': true`));
  assert.ok(config.includes("'notificationHistory.maxRecords': 5000"));assert.ok(config.includes("'notificationHistory.maxAgeDays': 90"));
  const model=fs.readFileSync('tools/typescript-stage1/advanced-src/ModernAdvancedSettingsModel.ts','utf8');
  for(const key of ['record.specChange','record.scriptError','record.commentAction','maxRecords','maxAgeDays'])assert.ok(model.includes(`'notificationHistory.${key}'`));
 });
 it('the watch-response validator reports the first broken field',()=>{
  const src=fs.readFileSync('tools/typescript-stage1/nico-src/VideoInfoLoader.ts','utf8');
  assert.match(src,/missingWatchV4Field/);assert.match(src,/missing: missingWatchV4Field\(data\)/);
 });
});
