'use strict';
// P12-02 atomic per-video auto resume clearing; never delete watch metadata.
const {assert,ticks,observe,deferred,eventTarget,controllerFixture,adapterFixture}=
  require('../helpers/idbRecoveryFixture');

function fakeStore(initial){
 let record=initial?{...initial}:null;
 const requests=[];
 let deletes=0,reads=0;
 const store={
  async update(data){
   requests.push(data);
   if(data.onlyExisting&&!record)return null;
   const updated={...(record||{})};
   for(const [key,value]of Object.entries(data.defaults||{})){
    if(!updated[key])updated[key]=value;
   }
   Object.assign(updated,data.patch||{});
   for(const [key,values]of Object.entries(data.prepend||{}))
    updated[key]=values.concat(Array.isArray(updated[key])?updated[key]:[]);
   for(const [key,limit]of Object.entries(data.limits||{}))
    if(Array.isArray(updated[key]))updated[key]=updated[key].slice(0,limit);
   record=updated;
   return {...record};
  },
  updateTime(){reads++;return Promise.resolve(record);},
  delete(){deletes++;throw Error('WHOLE_RECORD_DELETE_FORBIDDEN');}
 };
 return {store,requests,get record(){return record;},get deletes(){return deletes;},
  get reads(){return reads;}};
}


describe('Single automatic position storage',()=>{
 it('normal saves replace the old point while preserving metadata',async()=>{
  const h=fakeStore({watchId:'sm9',resume:[{time:22,now:1},{time:11,now:0}],comment:['kept']});
  const api=adapterFixture('WatchInfoCacheDb',h.store);
  await api.put('sm9',{currentTime:65});
  assert.equal(h.record.resume.length,1);assert.equal(h.record.resume[0].time,65);
  assert.deepEqual(h.record.comment,['kept']);
 });
 it('explicit edit at zero survives metadata updates and is cleared by delete',async()=>{
  const h=fakeStore({watchId:'sm9',resume:[{time:22,now:1}]});
  const api=adapterFixture('WatchInfoCacheDb',h.store);
  await api.put('sm9',{currentTime:0,explicitResume:true});
  assert.equal(h.record.resumeOverride,0);assert.equal(h.record.resume[0].time,0);
  await api.put('sm9',{watchCount:1});assert.equal(h.record.resumeOverride,0);
  await api.clearAutomaticResume('sm9');assert.equal(h.record.resumeOverride,null);
 });
});
