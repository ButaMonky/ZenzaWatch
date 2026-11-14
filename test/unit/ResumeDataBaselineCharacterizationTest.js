'use strict';
// P12 characterization of the PRE-feature data model. The current multi-point
// behavior is not an approval of its UX; these tests document what must migrate.
const assert=require('assert');
const fs=require('fs');
const {createContext,run}=require('../helpers/extractSource');
const {execFileSync}=require('child_process');
const parser=require('@babel/parser');
// Inspect the actual frozen pre-feature P13 commit, never the edited P12 product.
const baseline=execFileSync('git',['show',
 '89d78f47038cf94e51500aa615b2b1590702354a:src/VideoInfo.js'],
 {encoding:'utf8'});
const tree=parser.parse(baseline,{sourceType:'unambiguous',plugins:['classProperties']});
const klass=tree.program.body.find(node=>node.type==='ClassDeclaration'&&
 node.id?.name==='VideoInfoModel');
if(!klass)throw Error('P12 historical VideoInfoModel class missing');
const historicalClass=baseline.slice(klass.start,klass.end);

function model({server=0,local=[],duration=300}={}){
 const ctx=createContext({JSONable:class {}});
 run(historicalClass+';globalThis.VideoInfoModel=VideoInfoModel;',ctx);
 const Model=ctx.VideoInfoModel;
 const m=Object.create(Model.prototype);
 m._videoDetail={length:duration};
 m._cacheData={resume:local};
 m._resumeInfo={initialPlaybackPosition:server};
 return m;
}
describe('P12 pre-feature resume data topology (characterization, not target contract)',()=>{
 it('currently exposes server previous followed by multiple local histories',()=>{
  const local=[{now:1760000000000,time:50},{now:1750000000000,time:80}];
  const m=model({server:100,local});
  const got=m.resumePoints;
  assert.deepStrictEqual(got.map(x=>x.time),[100,50,80]);
  assert.strictEqual(got[0].now,'前回');
  assert.equal(local.length,2,'reading must not mutate cached history');
 });
 it('currently falls back to older local history when server says zero',()=>{
  const m=model({server:0,local:[{now:1760000000000,time:72}]});
  assert.deepStrictEqual(m.resumePoints.map(x=>x.time),[72],
    'local old history may reappear after server reset unless explicitly invalidated');
 });
 it('filters near-edges in local history but does not filter server values there',()=>{
  const m=model({server:298,local:[
   {now:1760000000000,time:2},{now:1760000000001,time:298},
   {now:1760000000002,time:45}
  ]});
  assert.deepStrictEqual(m.resumePoints.map(x=>x.time),[298,45]);
 });
 it('a whole-record cache delete cannot serve as a one-position deletion',()=>{
  const code=execFileSync('git',['show','89d78f47038cf94e51500aa615b2b1590702354a:packages/lib/src/nico/WatchInfoCacheDb.js'],{encoding:'utf8'});
  assert(code.includes('delete(watchId) { return cacheDb.delete({ key: watchId }); }'));
  assert(code.includes('limits: { resume: 10 }'));
  assert(code.includes('prepend: { resume }'));
 });
});
