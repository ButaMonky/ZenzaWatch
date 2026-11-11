'use strict';
// Transaction-ordered synthetic IDB/Lock/BC fixture. Never touches browser storage.
const {createContext,extract,run}=require('./extractSource');
const turn=()=>new Promise(resolve=>setImmediate(resolve));
const clone=value=>value===undefined?undefined:JSON.parse(JSON.stringify(value));
function sharedStorage(){
  const stores=new Map(),channels=[],messages=[];
  let version=0,transactionTail=Promise.resolve(),lockTail=Promise.resolve();
  const locks={request(name,callback){const work=lockTail.then(()=>callback({name}));lockTail=work.catch(()=>{});return work;}};
  class Channel{
    constructor(name){this.name=name;this.onmessage=null;this.handlers=new Set();channels.push(this);}
    addEventListener(type,handler){if(type==='message')this.handlers.add(handler);}
    postMessage(data){for(const peer of channels)if(peer!==this&&peer.name===this.name)messages.push(()=>{const event={data:clone(data)};peer.onmessage?.(event);for(const fn of peer.handlers)fn(event);});}
    close(){const i=channels.indexOf(this);if(i>=0)channels.splice(i,1);this.handlers.clear();this.onmessage=null;}
  }
  function factory(options={}){
    const pendingOpens=[];
    let writes=0;
    const connection={
      objectStoreNames:{contains:name=>stores.has(name)},
      createObjectStore(name){stores.set(name,new Map());return{createIndex(){}};},
      close(){},
      transaction(names,mode='readonly'){
        const requested=Array.isArray(names)?names:[names];
        for(const name of requested)if(!stores.has(name))throw Error('Missing synthetic store');
        const tx={error:null,oncomplete:null,onerror:null,onabort:null};
        const operations=[];let active=false,finished=false,queued=false,snapshot;
        let release;const previous=transactionTail;transactionTail=new Promise(resolve=>{release=resolve;});
        const fail=()=>{if(finished)return;finished=true;tx.error=Error('Synthetic transaction failure');tx.onerror?.();tx.onabort?.();release();};
        const schedule=()=>{if(active&&!queued&&!finished){queued=true;setImmediate(drain);}};
        function drain(){
          queued=false;if(finished)return;
          const op=operations.shift();
          if(!op){finished=true;if(mode==='readwrite')for(const [name,map]of snapshot)stores.set(name,map);try{tx.oncomplete?.();}finally{release();}return;}
          try{op();}catch{fail();}schedule();
        }
        const request=fn=>{const req={result:undefined,error:null};operations.push(()=>{req.result=fn();req.onsuccess?.({target:req});});schedule();return req;};
        tx.abort=fail;
        tx.objectStore=name=>({
          get:key=>request(()=>{if(name!=='entries'&&options.failMetadata)throw Error('metadata');return clone(snapshot.get(name).get(key));}),
          getAll:()=>request(()=>[...snapshot.get(name).values()].map(clone)),
          put:value=>request(()=>{if(name==='entries'&&(options.failWrite===true||++writes===options.failWrite))throw Error('write');snapshot.get(name).set(value.id,clone(value));return value.id;}),
          clear:()=>request(()=>{if(options.failClear)throw Error('clear');snapshot.get(name).clear();}),
          index:()=>({openCursor:()=>request(()=>null)})
        });
        previous.then(()=>{snapshot=new Map(requested.map(name=>[name,new Map([...stores.get(name)].map(([key,value])=>[key,clone(value)]))]));active=true;schedule();});
        return tx;
      }
    };
    return {options,get writeCount(){return writes;},release(){pendingOpens.splice(0).forEach(fn=>fn());},open(name,nextVersion){
      if(options.failOpen)throw Error('Synthetic open failure');
      const req={result:connection};
      const finish=()=>queueMicrotask(()=>{if(version<nextVersion){version=nextVersion;req.onupgradeneeded?.();}req.onsuccess?.();});
      if(options.holdOpen)pendingOpens.push(finish);else finish();return req;
    }};
  }
  function journal(options={}){
    const db=factory(options),context=createContext({indexedDB:db,navigator:{locks},BroadcastChannel:Channel,
      localStorage:{getItem(){throw Error('Storage disabled');},setItem(){throw Error('Storage disabled');}},
      ...(options.now===undefined?{}:{Date:class extends Date{static now(){return options.now;}}})});
    for(const name of ['NotificationJournalPolicy','NotificationJournalStore'])run('const '+name+'='+extract('packages/zenza/src/notification/'+name+'.js',name,'var')+';',context);
    run('const NotificationJournal='+extract('src/NotificationJournal.js','NotificationJournal','var')+';this.journal=NotificationJournal;',context);
    return {api:context.journal,db,options};
  }
  return {journal,factory,locks,stores,deliver(reverse=false){const batch=messages.splice(0);if(reverse)batch.reverse();batch.forEach(fn=>fn());}};
}
module.exports={sharedStorage,turn};
